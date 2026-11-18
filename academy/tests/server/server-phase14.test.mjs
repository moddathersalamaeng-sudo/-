/**
 * Phase 14 server tests against a real PostgreSQL (CIA_TEST_PG). Every check runs through the HTTP API and, for the security
 * probes, directly in SQL as the restricted role cia_app with a second account — so a refusal is proven in the database,
 * not only in the interface or the API code.
 *   CIA_TEST_PG=postgres://… npm run test:server*.test.mjs
 */
import test, { before, after } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startHarness, ADMIN_URL, ACADEMY } from './_harness.mjs';
import { pg } from '../../server/lib/pgdriver.mjs';
import { ApiClient, ServerAdapter } from '../../src/data/adapters/server.js';
import { CollectionRepository } from '../../src/data/repository.js';
import { makeLabAttempt } from '../../src/domain/labs.mjs';
import { buildShare } from '../../src/domain/company.mjs';

const skip = !ADMIN_URL && 'set CIA_TEST_PG to a PostgreSQL superuser URL';
let H;
before(async () => { if (!skip) H = await startHarness(); });
after(async () => { if (H) await H.stop(); });

const today = new Date().toISOString().slice(0, 10);
const labs = JSON.parse(readFileSync(path.join(ACADEMY, 'data', 'seed', 'labs.json'), 'utf8')).items;
const written = labs.find(l => l.governance?.content_status === 'published' && l.tasks.some(t => t.type === 'free_text'));

/** Run SQL as cia_app with cia.uid() = uid (what the API does), through the API's own login role. */
async function asApp(uid, sql, params = []) {
  const c = new pg.Client({ connectionString: H.apiUrl });
  await c.connect();
  try {
    await c.query('begin'); await c.query('set local role cia_app'); await c.query("select set_config('cia.uid', $1, true)", [uid || '']);
    const r = await c.query(sql, params); await c.query('rollback'); return r;
  } catch (e) { try { await c.query('rollback'); } catch { /* ignore */ } throw e; } finally { await c.end(); }
}

test('server adapter passes the same contract as the local adapter', { skip }, async () => {
  const a = await H.account();
  const adapter = new ServerAdapter({ api: new ApiClient({ base: H.base + '/api/v1', getToken: () => a.token }) });
  const repo = new CollectionRepository({ adapter, collection: 'bookmarks' });
  await repo.save({ id: 'b1', x: 1 }); await repo.save({ id: 'b2', x: 2 }); await repo.save({ id: 'b1', x: 3 });
  assert.deepEqual((await repo.list()).map(r => [r.id, r.x]).sort(), [['b1', 3], ['b2', 2]]);
  assert.equal((await repo.get('b2')).x, 2);
  assert.equal(await repo.remove('b2'), true);
  assert.deepEqual(await adapter.collections(), ['bookmarks']);
  await adapter.clear('bookmarks');
  assert.deepEqual(await repo.list(), []);
});

test('version conflict between two devices: second writer merges by id instead of overwriting', { skip }, async () => {
  const a = await H.account();
  const mk = () => new ServerAdapter({ api: new ApiClient({ base: H.base + '/api/v1', getToken: () => a.token }) });
  const d1 = mk(), d2 = mk();
  await d1.read('cpd'); await d2.read('cpd');
  await d1.write('cpd', [{ id: 'from-1' }]);
  const out = await d2.write('cpd', [{ id: 'from-2' }]);
  assert.deepEqual(out.map(r => r.id).sort(), ['from-1', 'from-2']);
  assert.deepEqual((await d1.read('cpd')).map(r => r.id).sort(), ['from-1', 'from-2']);
});

test('row-level security: a second account reads and changes nothing of the first, even with direct SQL', { skip }, async () => {
  const a = await H.account(), b = await H.account();
  await H.call('PUT', '/api/v1/collections/cpd', { token: a.token, body: { items: [{ id: 'secret', hours: 3 }] } });
  assert.deepEqual((await H.call('GET', '/api/v1/collections/cpd', { token: b.token })).body.items, []);
  assert.equal((await asApp(b.id, "select * from cia.records where user_id = $1", [a.id])).rowCount, 0, 'select hidden');
  assert.equal((await asApp(b.id, "update cia.records set data = '{}' where user_id = $1", [a.id])).rowCount, 0, 'update reaches nothing');
  assert.equal((await asApp(b.id, "delete from cia.records where user_id = $1", [a.id])).rowCount, 0, 'delete reaches nothing');
  await assert.rejects(asApp(b.id, "insert into cia.records (user_id, collection, record_id, data) values ($1, 'cpd', 'x', '{}')", [a.id]), /row-level security/);
  await assert.rejects(asApp(b.id, 'select pass_hash from cia.users'), /permission denied/, 'password hashes never granted');
  await assert.rejects(asApp(b.id, 'select * from cia.sessions'), /permission denied/);
  assert.equal((await asApp(b.id, 'select id from cia.users')).rowCount, 1, 'a learner sees only themselves');
  assert.equal((await asApp(null, 'select * from cia.records')).rowCount, 0, 'anonymous sees nothing');
  const still = (await H.owner.query("select data from cia.records where user_id = $1 and record_id = 'secret'", [a.id])).rows[0].data;
  assert.equal(still.hours, 3);
});

test('role enforcement matrix on the server: learner refused on every administrative route', { skip }, async () => {
  const l = await H.account();
  const routes = [['GET', '/api/v1/admin/users'], ['GET', '/api/v1/admin/drafts'], ['POST', '/api/v1/admin/drafts', { collection: 'courses', data: {} }], ['GET', '/api/v1/admin/analytics'],
    ['GET', '/api/v1/admin/verifications'], ['PUT', '/api/v1/admin/verifications/CERT-PMP', { status: 'pending' }], ['GET', '/api/v1/reviews/queue'], ['POST', '/api/v1/orgs', { name: 'X', first_admin_email: 'a@b.cc' }],
    ['GET', '/api/v1/admin/audit'], ['GET', '/api/v1/admin/export'], ['PUT', '/api/v1/admin/settings/tiers_enforced', { value: true }]];
  for (const [m, p, body] of routes) assert.equal((await H.call(m, p, { token: l.token, body })).status, 403, `${m} ${p}`);
  for (const [m, p, body] of routes) assert.equal((await H.call(m, p, { body })).status, 401, `signed out ${m} ${p}`);
  await assert.rejects(asApp(l.id, "insert into cia.user_roles (user_id, role) values ($1, 'admin')", [l.id]), /row-level security/, 'cannot grant oneself a role');
  assert.equal((await H.call('PUT', '/api/v1/collections/passport_verifications', { token: l.token, body: { items: [{ id: 'v', decision: 'verified' }] } })).status, 403);
  await assert.rejects(asApp(l.id, "insert into cia.records (user_id, collection, record_id, data) values ($1, 'passport_verifications', 'v', '{}')", [l.id]), /row-level security/);
});

test('move to account: preview equals apply; nothing overwritten; no status upgraded; idempotent', { skip }, async () => {
  const a = await H.account();
  await H.call('PUT', '/api/v1/collections/bookmarks', { token: a.token, body: { items: [{ id: 'b1', v: 'account' }] } });
  const task = written.tasks.find(t => t.type === 'free_text');
  const answers = Object.fromEntries(written.tasks.map(t => [t.id, t.type === 'free_text' ? 'A considered written answer about the evidence and the requirement.' : null]));
  const reviewed = makeLabAttempt(written, answers, { attemptNo: 1, reviews: { [task.id]: { score: Number(task.weight) || 1, reviewer: 'Same Device', date: today } } });
  const device = { bookmarks: [{ id: 'b1', v: 'device' }, { id: 'b2', v: 'device' }], lab_attempts: [reviewed], passport_verifications: [{ id: 'v1', decision: 'verified', target_id: 'X' }], review_decisions: [{ id: 'd' }] };
  const prev = (await H.call('POST', '/api/v1/migrate/preview', { token: a.token, body: { collections: device } })).body;
  const appl = (await H.call('POST', '/api/v1/migrate/apply', { token: a.token, body: { collections: device } })).body;
  assert.deepEqual(prev, appl.plan);
  assert.equal(appl.plan.reviewsNotMoved, 1);
  const bm = (await H.call('GET', '/api/v1/collections/bookmarks', { token: a.token })).body.items;
  assert.equal(bm.find(r => r.id === 'b1').v, 'account'); assert.ok(bm.some(r => r.id === 'b2'));
  const la = (await H.call('GET', '/api/v1/collections/lab_attempts', { token: a.token })).body.items[0];
  assert.deepEqual(la.reviews, {}); assert.ok(la.pending_review > 0, 'written task awaits review again (status went down, never up)');
  assert.deepEqual((await H.call('GET', '/api/v1/collections/passport_verifications', { token: a.token })).body.items, []);
  const again = (await H.call('POST', '/api/v1/migrate/apply', { token: a.token, body: { collections: device } })).body;
  assert.equal(again.plan.totals.add, 0);
});

test('lab attempts are re-scored on the server: a forged "complete" status or review is ignored', { skip }, async () => {
  const a = await H.account();
  const answers = Object.fromEntries(written.tasks.map(t => [t.id, t.type === 'free_text' ? 'Written answer long enough to count as an answer.' : null]));
  const att = makeLabAttempt(written, answers, { attemptNo: 1 });
  const forged = { ...att, status: 'complete', passed: true, pending_review: 0, score: 100, reviews: { x: { score: 99, reviewer: 'Me Myself', date: today } } };
  const r = await H.call('PUT', '/api/v1/collections/lab_attempts', { token: a.token, body: { items: [forged] } });
  assert.equal(r.status, 200);
  const stored = r.body.items[0];
  assert.equal(stored.status, 'awaiting_review'); assert.equal(stored.passed, false); assert.deepEqual(stored.reviews, {});
  const unknown = await H.call('PUT', '/api/v1/collections/lab_attempts', { token: a.token, body: { items: [{ ...att, id: 'NOPE#1', lab_id: 'NOPE' }] } });
  assert.deepEqual(unknown.body.dropped, ['NOPE#1']);
});

test('shared review: self-review refused in API and database; a reviewer scores another learner and the status changes by the existing rule', { skip }, async () => {
  const learner = await H.account(), reviewer = await H.account({ roles: ['reviewer'], name: 'Named Reviewer' });
  const answers = Object.fromEntries(written.tasks.map(t => [t.id, t.type === 'free_text' ? 'A full written answer to be reviewed by a person.' : null]));
  for (const t of written.tasks.filter(t => t.type !== 'free_text')) answers[t.id] = null;
  const att = makeLabAttempt(written, answers, { attemptNo: 1 });
  await H.call('PUT', '/api/v1/collections/lab_attempts', { token: learner.token, body: { items: [att] } });
  const req = await H.call('POST', '/api/v1/reviews', { token: learner.token, body: { record_id: att.id } });
  assert.equal(req.status, 201); assert.match(req.body.reference, /^A-[0-9A-F]{4}$/);
  // the reviewer sees the request without the learner's name or e-mail
  const q = (await H.call('GET', '/api/v1/reviews/queue', { token: reviewer.token })).body;
  const item = q.requests.find(x => x.id === req.body.id);
  assert.ok(item); assert.equal(q.sla_hours, null); assert.equal(item.sla.state, 'not_set');
  assert.ok(!JSON.stringify(item).includes(learner.email) && !JSON.stringify(item).includes(learner.name));
  // the learner cannot see or claim their own request in the queue
  const selfReviewer = await H.account({ roles: ['reviewer'] });
  await H.call('PUT', '/api/v1/collections/lab_attempts', { token: selfReviewer.token, body: { items: [att] } });
  const own = await H.call('POST', '/api/v1/reviews', { token: selfReviewer.token, body: { record_id: att.id } });
  assert.ok(!(await H.call('GET', '/api/v1/reviews/queue', { token: selfReviewer.token })).body.requests.some(x => x.id === own.body.id), 'own request hidden from own queue');
  assert.equal((await H.call('POST', `/api/v1/reviews/${own.body.id}/claim`, { token: selfReviewer.token, body: { name: 'Self Reviewer' } })).status, 403);
  await assert.rejects(asApp(selfReviewer.id, "update cia.review_requests set reviewer_id = $1, status = 'assigned' where id = $2", [selfReviewer.id, own.body.id]), /no_self_review|row-level security/);
  // a learner (no reviewer role) cannot claim
  assert.equal((await H.call('POST', `/api/v1/reviews/${req.body.id}/claim`, { token: learner.token, body: { name: 'xx' } })).status, 403);
  // the reviewer claims and scores; out-of-range score refused
  assert.equal((await H.call('POST', `/api/v1/reviews/${req.body.id}/claim`, { token: reviewer.token, body: { name: 'Named Reviewer' } })).status, 200);
  const tasks = written.tasks.filter(t => t.type === 'free_text');
  const tooHigh = await H.call('POST', `/api/v1/reviews/${req.body.id}/scores`, { token: reviewer.token, body: { scores: [{ task_id: tasks[0].id, score: 999 }] } });
  assert.equal(tooHigh.status, 400);
  const ok = await H.call('POST', `/api/v1/reviews/${req.body.id}/scores`, { token: reviewer.token, body: { scores: tasks.map(t => ({ task_id: t.id, score: Number(t.weight) || 1, comment: 'Clear and complete.' })) } });
  assert.equal(ok.status, 200); assert.equal(ok.body.pending_review, 0);
  const after = (await H.call('GET', '/api/v1/collections/lab_attempts', { token: learner.token })).body.items[0];
  assert.equal(after.pending_review, 0); assert.equal(after.status, 'complete');
  assert.ok(Object.values(after.reviews).every(r => r.reviewer === 'Named Reviewer'));
  // a later learner write cannot remove or forge the review
  const rewrite = await H.call('PUT', '/api/v1/collections/lab_attempts', { token: learner.token, body: { items: [{ ...after, reviews: {} }] } });
  assert.ok(Object.keys(rewrite.body.items[0].reviews).length === tasks.length, 'server keeps its own reviews');
  const audit = (await H.owner.query("select action from cia.audit_log where target = $1 order by id", [req.body.id])).rows.map(r => r.action);
  assert.deepEqual(audit, ['review.request', 'review.claim', 'review.complete']);
});

test('company on accounts: invitation, consent grant shows live, withdrawal hides it at once; administrators never see shares', { skip }, async () => {
  const admin = await H.account({ roles: ['admin'] }), boss = await H.account({ name: 'Company Boss' }), emp = await H.account({ name: 'Employee One' });
  const org = await H.call('POST', '/api/v1/orgs', { token: admin.token, body: { name: 'Pilot Co', first_admin_email: boss.email } });
  assert.equal(org.status, 201);
  assert.equal((await H.call('POST', '/api/v1/invitations/accept', { token: admin.token, body: { token: org.body.invitation.token } })).status, 403, 'not the invited e-mail / not the sender');
  assert.equal((await H.call('POST', '/api/v1/invitations/accept', { token: boss.token, body: { token: org.body.invitation.token } })).status, 200);
  const orgId = org.body.org.id;
  const inv = await H.call('POST', `/api/v1/orgs/${orgId}/invitations`, { token: boss.token, body: { email: emp.email } });
  assert.equal((await H.call('POST', '/api/v1/invitations/accept', { token: emp.token, body: { token: inv.body.token } })).status, 200);
  assert.equal((await H.call('POST', '/api/v1/invitations/accept', { token: emp.token, body: { token: inv.body.token } })).status, 400, 'used once');
  const competencies = JSON.parse(readFileSync(path.join(ACADEMY, 'data', 'seed', 'competency', 'competencies.json'), 'utf8')).items.filter(c => c.governance?.content_status === 'published');
  const share = buildShare({ employee: { key: 'EMP-1', name: 'Employee One', job_title: 'QA' }, parts: ['competencies', 'cpd', 'verified'], shareId: 'SHR-1', now: new Date().toISOString(),
    data: { competencies: [{ id: competencies[0].id, level: 3, source: 'self' }, { id: competencies[1].id, level: 5, source: 'verified', verification: { reviewer: 'Fake Reviewer', date: today, method: 'interview' } }], cpd: { total: 12, count: 3, by_year: {} } } });
  const g = await H.call('POST', '/api/v1/me/consents', { token: emp.token, body: { org_id: orgId, parts: ['competencies', 'cpd', 'verified'], accepted: true, share } });
  assert.equal(g.status, 201);
  const live = (await H.call('GET', `/api/v1/orgs/${orgId}/shares`, { token: boss.token })).body.shares;
  assert.equal(live.length, 1); assert.equal(live[0].display_name, 'Employee One'); assert.equal(live[0].snapshot.data.cpd.total, 12);
  assert.ok(!live[0].snapshot.data.competencies.some(r => r.source === 'verified'), 'a self-made "verified" level is not shown without a server verification');
  assert.ok(!JSON.stringify(live).includes(emp.email), 'no e-mail to the company');
  // the platform administrator cannot read shares, cannot join, cannot add themselves
  assert.equal((await H.call('GET', `/api/v1/orgs/${orgId}/shares`, { token: admin.token })).status, 403);
  await assert.rejects(asApp(admin.id, "insert into cia.org_members (org_id, user_id, role) values ($1, $2, 'company_admin')", [orgId, admin.id]), /row-level security/);
  assert.equal((await asApp(admin.id, 'select * from cia.consents where org_id = $1', [orgId])).rowCount, 0);
  // assignments delivered in-app; the employee changes only the state
  const asg = await H.call('POST', `/api/v1/orgs/${orgId}/assignments`, { token: boss.token, body: { assignee: emp.id, type: 'course', target_id: 'CRS-X', target_slug: 'crs-x', due: '2027-01-31' } });
  assert.equal(asg.status, 201);
  assert.equal((await H.call('GET', '/api/v1/me/assignments', { token: emp.token })).body.assignments.length, 1);
  assert.equal((await H.call('PATCH', `/api/v1/me/assignments/${asg.body.id}`, { token: emp.token, body: { state: 'in_progress' } })).status, 200);
  await assert.rejects(asApp(emp.id, "update cia.assignments set due = '2030-01-01' where id = $1", [asg.body.id]), /only the assignment state/);
  // withdrawal: effective in the same moment
  assert.equal((await H.call('POST', `/api/v1/me/consents/${g.body.id}/withdraw`, { token: emp.token })).status, 200);
  assert.equal((await H.call('GET', `/api/v1/orgs/${orgId}/shares`, { token: boss.token })).body.shares.length, 0);
  await assert.rejects(asApp(emp.id, 'update cia.consents set withdrawn_at = null where id = $1', [g.body.id]), /cannot change/);
  // an employee is not a company administrator
  assert.equal((await H.call('GET', `/api/v1/orgs/${orgId}/shares`, { token: emp.token })).status, 403);
});

test('Admin CMS: draft → versions → submit → named decision; author cannot approve own draft; export uses the existing decision format', { skip }, async () => {
  const author = await H.account({ roles: ['admin'], name: 'Content Author' }), rev = await H.account({ roles: ['reviewer'], name: 'Second Reviewer' });
  const course = JSON.parse(readFileSync(path.join(ACADEMY, 'data', 'seed', 'courses.json'), 'utf8')).items.find(c => c.governance?.content_status === 'published');
  const bad = await H.call('POST', '/api/v1/admin/drafts', { token: author.token, body: { collection: 'courses', data: { id: 'x' } } });
  assert.equal(bad.status, 400);
  const d = await H.call('POST', '/api/v1/admin/drafts', { token: author.token, body: { collection: 'courses', data: { ...course, governance: { ...course.governance } }, note: 'start' } });
  assert.equal(d.status, 201); assert.equal(d.body.data.governance.content_status, 'needs_review', 'never saved as published');
  const v2 = await H.call('PUT', `/api/v1/admin/drafts/${d.body.id}`, { token: author.token, body: { data: { ...d.body.data, summary: { ar: 'ملخص', en: 'Changed summary' } }, note: 'summary' } });
  assert.equal(v2.body.version, 2);
  const restored = await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/restore`, { token: author.token, body: { version: 1 } });
  assert.equal(restored.body.version, 3);
  const hist = (await H.call('GET', `/api/v1/admin/drafts/${d.body.id}`, { token: rev.token })).body;
  assert.equal(hist.versions.length, 3); assert.ok(hist.versions[1].changes.some(c => c.path.startsWith('summary')));
  assert.equal((await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/decision`, { token: rev.token, body: { decision: 'approve', reviewer_name: 'Second Reviewer' } })).status, 409, 'not submitted yet');
  await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/submit`, { token: author.token });
  assert.equal((await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/decision`, { token: author.token, body: { decision: 'approve', reviewer_name: 'Content Author' } })).status, 403, 'no self-approval');
  assert.equal((await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/decision`, { token: author.token, body: { decision: 'approve', reviewer_name: 'Content Author', basis: 'owner_approval' } })).status, 403, 'owner approval needs the recorded owner');
  await assert.rejects(asApp(author.id, "insert into cia.content_decisions (draft_id, version, decision, reviewer_id, reviewer_name, review_date) values ($1, 3, 'approve', $2, 'Content Author', current_date)", [d.body.id, author.id]), /own draft/);
  assert.equal((await H.call('PUT', `/api/v1/admin/drafts/${d.body.id}`, { token: rev.token, body: { data: d.body.data } })).status, 403, 'reviewers cannot edit drafts');
  assert.equal((await H.call('POST', `/api/v1/admin/drafts/${d.body.id}/decision`, { token: rev.token, body: { decision: 'approve', reviewer_name: 'Second Reviewer' } })).status, 200);
  const ex = (await H.call('GET', '/api/v1/admin/export', { token: author.token })).body;
  assert.equal(ex.decisions.schema, 'cia.review-decisions.v1'); assert.equal(ex.drafts.schema, 'cia.cms-drafts.v1');
  const dec = ex.decisions.decisions.find(x => x.record_id === course.id);
  assert.equal(dec.reviewer, 'Second Reviewer'); assert.equal(dec.decision, 'approve'); assert.equal(dec.version, ex.drafts.drafts.find(x => x.record_id === course.id).data.governance.version);
  // owner approval with the recorded owner works
  await H.owner.query("update cia.settings set value = to_jsonb($1::text) where key = 'owner_user_id'", [author.id]);
  const d2 = await H.call('POST', '/api/v1/admin/drafts', { token: author.token, body: { collection: 'sources', data: { id: 'SRC-TEST-OWNER', title: { ar: 'مصدر', en: 'Source' }, governance: { content_status: 'draft', content_source: 'owner', version: '0.1' } } } });
  await H.call('POST', `/api/v1/admin/drafts/${d2.body.id}/submit`, { token: author.token });
  assert.equal((await H.call('POST', `/api/v1/admin/drafts/${d2.body.id}/decision`, { token: author.token, body: { decision: 'approve', reviewer_name: 'Content Author', basis: 'owner_approval' } })).status, 200);
});

test('verification center: validated edits, history, public status line, reminders', { skip }, async () => {
  const admin = await H.account({ roles: ['admin'], name: 'Verifier Admin' });
  const list = (await H.call('GET', '/api/v1/admin/verifications', { token: admin.token })).body;
  assert.ok(list.verifications.length >= 20); assert.ok(list.reminders.length >= 1, 'records without a next review date are reminders');
  assert.equal((await H.call('PUT', '/api/v1/admin/verifications/CERT-PMP', { token: admin.token, body: { status: 'verified' } })).status, 400, 'verified needs who, when, where');
  const ok = await H.call('PUT', '/api/v1/admin/verifications/CERT-PMP', { token: admin.token, body: { status: 'verified', verifier: 'Verifier Admin', last_verified: today, source_url: 'https://www.pmi.org/certifications/project-management-pmp', next_review: '2027-03-01', facts: { exam_questions: 180 } } });
  assert.equal(ok.status, 200);
  assert.equal((await H.call('PUT', '/api/v1/admin/verifications/NOPE', { token: admin.token, body: { status: 'pending' } })).status, 404);
  const pub = (await H.call('GET', '/api/v1/verifications')).body.verifications.find(v => v.cert_id === 'CERT-PMP');
  assert.equal(pub.status, 'verified'); assert.equal(pub.verifier, 'Verifier Admin'); assert.equal(pub.last_verified, today);
  assert.ok(!('facts' in pub) && !('notes' in pub), 'the public line carries no notes or facts');
  assert.equal((await H.call('GET', '/api/v1/admin/verifications/CERT-PMP/history', { token: admin.token })).body.history.length, 1);
});

test('analytics: counts only, keyed daily hash for active learners, small counts suppressed, nothing personal stored', { skip }, async () => {
  const admin = await H.account({ roles: ['admin'] });
  const people = []; for (let i = 0; i < 5; i++) people.push(await H.account());
  for (const p of people) await H.call('POST', '/api/v1/events', { token: p.token, body: { events: [{ name: 'course_start', dim: 'CRS-A' }, { name: 'search_no_result', dim: `mail${people.indexOf(p)}@x.com fmea 0555123456` }, { name: 'hack', dim: 'x' }] } });
  await H.call('POST', '/api/v1/events', { token: people[0].token, body: { events: [{ name: 'course_start', dim: 'CRS-B' }] } });
  const anon = await H.call('POST', '/api/v1/events', { body: { events: [{ name: 'page_view', dim: '/assessments' }] } });
  assert.equal(anon.status, 202);
  const rows = (await H.call('GET', '/api/v1/admin/analytics', { token: admin.token })).body.rows;
  assert.equal(rows.find(r => r.event === 'course_start' && r.dim === 'CRS-A').count, 5);
  assert.equal(rows.find(r => r.event === 'course_start' && r.dim === 'CRS-B').count, null, 'fewer than 5 is hidden');
  assert.equal(rows.find(r => r.event === 'search_no_result').dim, 'fmea');
  assert.ok(rows.find(r => r.event === 'active_learners').count >= 5);
  const stored = JSON.stringify((await H.owner.query('select * from cia.analytics_daily')).rows) + JSON.stringify((await H.owner.query('select * from cia.analytics_active')).rows);
  for (const p of people) { assert.ok(!stored.includes(p.id) && !stored.includes(p.email), 'no id or e-mail stored'); }
  assert.ok(!stored.includes('0555123456') && !stored.includes('hack'));
  assert.equal((await H.owner.query('select count(*)::int as n from cia.analytics_keys')).rows[0].n, 1, 'one key, today only');
  await assert.rejects(asApp(admin.id, 'select * from cia.analytics_keys'), /permission denied/);
});

test('accounts: password reset revokes sessions; sign-in errors do not reveal accounts; delete removes every row', { skip }, async () => {
  const a = await H.account();
  assert.equal((await H.call('POST', '/api/v1/auth/signin', { body: { email: a.email, password: 'wrong password!!' } })).body.code, 'credentials');
  assert.equal((await H.call('POST', '/api/v1/auth/signin', { body: { email: 'nobody@example.test', password: 'wrong password!!' } })).body.code, 'credentials');
  assert.equal((await H.call('POST', '/api/v1/auth/signup', { body: { email: a.email, password: 'another long password', display_name: 'Dup Person' } })).status, 409);
  assert.equal((await H.call('POST', '/api/v1/auth/signup', { body: { email: 'short@example.test', password: 'short', display_name: 'Short Pw' } })).status, 400);
  assert.equal((await H.call('POST', '/api/v1/auth/reset/request', { body: { email: 'nobody@example.test' } })).status, 202);
  assert.equal((await H.call('POST', '/api/v1/auth/reset/request', { body: { email: a.email } })).status, 202);
  const msg = (await H.call('GET', '/api/v1/dev/outbox')).body.messages.find(m => m.to_email === a.email);
  const token = new URL(msg.body.link, 'http://x').hash.split('reset=')[1];
  assert.equal((await H.call('POST', '/api/v1/auth/reset/confirm', { body: { token, password: 'a brand new password' } })).status, 200);
  assert.equal((await H.call('GET', '/api/v1/auth/me', { token: a.token })).status, 401, 'old session revoked');
  assert.equal((await H.call('POST', '/api/v1/auth/reset/confirm', { body: { token, password: 'another new password' } })).status, 400, 'token used once');
  const s = await H.call('POST', '/api/v1/auth/signin', { body: { email: a.email, password: 'a brand new password' } });
  assert.equal(s.status, 200);
  await H.call('PUT', '/api/v1/collections/cpd', { token: s.body.token, body: { items: [{ id: 'c1' }] } });
  const exp = (await H.call('GET', '/api/v1/account/export', { token: s.body.token })).body;
  assert.deepEqual(exp.collections.cpd, [{ id: 'c1' }]);
  assert.equal((await H.call('DELETE', '/api/v1/account', { token: s.body.token, body: { password: 'wrong' } })).status, 401);
  assert.equal((await H.call('DELETE', '/api/v1/account', { token: s.body.token, body: { password: 'a brand new password' } })).status, 200);
  for (const t of ['users', 'records', 'sessions', 'user_roles']) {
    const col = t === 'users' ? 'id' : 'user_id';
    assert.equal((await H.owner.query(`select count(*)::int as n from cia.${t} where ${col} = $1`, [a.id])).rows[0].n, 0, t);
  }
  const auditDel = (await H.owner.query("select actor, target from cia.audit_log where action = 'account.delete' order by id desc limit 1")).rows[0];
  assert.equal(auditDel.actor, null); assert.ok(!auditDel.target.includes(a.email));
});

test('hardening: rate limit on sign-in, body limit, JSON only, CORS only for the site origin, security headers, logs without personal data', { skip }, async () => {
  const R = await startHarness({ env: { CIA_RATE_SCALE: '1' } });      // production limits
  try {
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await R.call('POST', '/api/v1/auth/signin', { body: { email: 'rl@example.test', password: 'x'.repeat(12) } })).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(401)); assert.ok(codes.slice(10).every(c => c === 429), codes.join());
  } finally { await R.stop(); }
  const big = await fetch(H.base + '/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [{ name: 'x', dim: 'y'.repeat(1_200_000) }] }) });
  assert.equal(big.status, 413);
  const text = await fetch(H.base + '/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"events":[]}' });
  assert.equal(text.status, 415);
  const ok = await fetch(H.base + '/api/v1/health', { headers: { Origin: 'http://site.test' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://site.test');
  const evil = await fetch(H.base + '/api/v1/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff'); assert.equal(ok.headers.get('cache-control'), 'no-store');
  const logs = H.logs.join('\n');
  assert.ok(!/@example\.test/.test(logs), 'no e-mail in logs');
  assert.ok(!/Bearer |correct horse|brand new password|wrong password|reset=/i.test(logs), 'no token, reset link or password value in logs');
  assert.ok(H.logs.every(l => Object.keys(JSON.parse(l)).every(k => ['t', 'id', 'method', 'route', 'status', 'ms', 'code', 'error', 'pg', 'message', 'at'].includes(k))), 'only the documented log fields');
});

test('migrations: down then up again works (rollback plan)', { skip }, async () => {
  const { migrate } = await import(path.join(ACADEMY, 'server', 'scripts', 'migrate.mjs'));
  const c = new pg.Client({ connectionString: ADMIN_URL }); await c.connect();
  const name = H.dbName + '_rb'; await c.query(`create database ${name}`); await c.end();
  const u = new URL(ADMIN_URL); u.pathname = '/' + name;
  await migrate(u.toString(), { log: () => {} });
  await migrate(u.toString(), { down: '001_init', log: () => {} });
  await migrate(u.toString(), { log: () => {} });
  const k = new pg.Client({ connectionString: u.toString() }); await k.connect();
  assert.equal((await k.query('select version from cia.schema_migrations')).rows[0].version, '001_init');
  await k.end();
  const d = new pg.Client({ connectionString: ADMIN_URL }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
});
