/**
 * Phase 14 unit tests (no database): move-to-account rules, merge, role matrix, tiers, analytics cleaning and suppression,
 * verification center, review service level, CMS drafts and export files, synced adapter with offline queue, session,
 * interface strings, CSP and "no secret in any client file".
 */
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planMigration, applyMigration, mergeCollection, stripDeviceReviews, DEVICE_ONLY } from '../../src/domain/migration.mjs';
import * as P from '../../src/domain/production.mjs';
import { MemoryAdapter } from '../../src/data/adapters/memory.js';
import { LocalStorageAdapter } from '../../src/data/adapters/local-storage.js';
import { SyncedAdapter, ServerAdapter, ApiClient, ApiError, QUEUE_COLLECTION } from '../../src/data/adapters/server.js';
import { CollectionRepository } from '../../src/data/repository.js';
import { AccountSession, AUTH_KEY } from '../../src/session/account-session.js';
import { eventsFromChange, AnalyticsQueue } from '../../src/ui/analytics.js';
import { MockStorage } from './_util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

/* ------------------------------------------------------------------ migration (D-111) */
test('move to account: never overwrites, skips verifications and device-only screens, idempotent', () => {
  const device = {
    bookmarks: [{ id: 'b1', v: 'device' }, { id: 'b2', v: 'device' }],
    passport_verifications: [{ id: 'v1', decision: 'verified' }],
    review_decisions: [{ id: 'd1' }], prefs: [{ id: 'ui' }],
    lab_attempts: [{ id: 'LAB-X#1', lab_id: 'LAB-X', reviews: { t1: { score: 2, reviewer: 'Rev', date: '2026-11-01' } }, status: 'complete' }]
  };
  const account = { bookmarks: [{ id: 'b1', v: 'account' }] };
  const plan = planMigration(device, account);
  const bm = plan.collections.find(c => c.collection === 'bookmarks');
  assert.deepEqual(bm.add, ['b2']); assert.deepEqual(bm.kept, ['b1']);
  assert.deepEqual(plan.skipped.map(s => s.collection).sort(), ['passport_verifications', 'prefs', 'review_decisions']);
  assert.equal(plan.reviewsNotMoved, 1);
  const { result } = applyMigration(device, account);
  assert.equal(result.bookmarks.find(r => r.id === 'b1').v, 'account', 'account copy kept');
  assert.deepEqual(result.lab_attempts[0].reviews, {}, 'same-device review not carried');
  assert.ok(!('passport_verifications' in result));
  const again = planMigration(device, { ...account, ...result });
  assert.equal(again.totals.add, 0, 'second run moves nothing');
});

test('move to account: invalid records counted, never moved; stripDeviceReviews leaves clean attempts alone', () => {
  const plan = planMigration({ cpd: [{ id: 'ok' }, { noid: 1 }, { id: 'ok' }, null] }, {});
  assert.deepEqual(plan.collections[0].add, ['ok']); assert.equal(plan.collections[0].invalid, 3);
  const a = { id: 'x', reviews: {} };
  assert.equal(stripDeviceReviews(a), a);
  assert.ok(DEVICE_ONLY.includes('sync_queue'));
});

test('merge after a version conflict: union by id; later device time stamp wins; guarded collections take the account copy', () => {
  const dev = [{ id: 'a', updated_at: '2026-11-18T10:00:00Z', v: 'dev' }, { id: 'c', v: 'dev-only' }];
  const acc = [{ id: 'a', updated_at: '2026-11-17T10:00:00Z', v: 'acc' }, { id: 'b', v: 'acc-only' }];
  const m = mergeCollection('cpd', dev, acc);
  assert.deepEqual(m.map(r => r.id), ['a', 'b', 'c']); assert.equal(m[0].v, 'dev');
  assert.equal(mergeCollection('cpd', [{ id: 'a', v: 'dev' }], [{ id: 'a', v: 'acc' }])[0].v, 'acc', 'no time stamp: account wins');
  assert.deepEqual(mergeCollection('passport_verifications', [{ id: 'fake' }], []), []);
});

/* ------------------------------------------------------------------ roles (D-113) */
test('role matrix: learners never reach another person\'s records, CMS or analytics; reviewers cannot self-review', () => {
  const L = ['learner'], R = ['learner', 'reviewer'], A = ['learner', 'admin'], C = ['learner', 'company_admin'];
  for (const action of ['records.other']) for (const roles of [L, R, A, C]) assert.equal(P.can(roles, action), false, `${roles}/${action}`);
  for (const action of ['cms.write', 'cms.export', 'users.manage', 'analytics.read', 'verification.write', 'review.queue', 'org.manage']) assert.equal(P.can(L, action), false, action);
  assert.equal(P.can(R, 'review.score', { actor: 'u1', subject: 'u2' }), true);
  assert.equal(P.can(R, 'review.score', { actor: 'u1', subject: 'u1' }), false, 'no self-review');
  assert.equal(P.can(A, 'cms.decide', { actor: 'u1', subject: 'u1' }), false, 'no self-approval');
  assert.equal(P.can(A, 'cms.decide', { actor: 'u1', subject: 'u1', ownerApproval: true }), true, 'owner approval basis');
  assert.equal(P.can(A, 'org.shares'), false, 'administrators do not read company shares');
  assert.equal(P.can(C, 'org.shares'), true);
  assert.equal(P.can(A, 'unknown.action'), false);
});

/* ------------------------------------------------------------------ tiers (ADD-16) */
test('tiers: recorded, matrix covers the spec, enforcement off by default', () => {
  assert.equal(P.tierAllows('corporate', 'free'), true, 'off by default');
  assert.equal(P.tierAllows('corporate', 'free', true), false);
  assert.equal(P.tierAllows('professional', 'corporate', true), true);
  assert.ok(P.FEATURE_TIERS.find(f => f.feature === 'company_portal').tiers.join() === 'corporate');
  const nav = json('data/seed/navigation.json').items;
  assert.ok(nav.every(e => P.TIERS.includes(e.requiredTier)));
});

/* ------------------------------------------------------------------ analytics (D-119) */
test('analytics: unknown events and bad dimensions refused; search terms cleaned of e-mails and digit runs; ids in routes removed', () => {
  assert.equal(P.cleanEvent('track_me', 'x'), null);
  assert.deepEqual(P.cleanEvent('course_start', 'CRS-ISO-101'), { event: 'course_start', dim: 'CRS-ISO-101' });
  assert.equal(P.cleanEvent('course_start', 'a b <script>'), null);
  assert.deepEqual(P.cleanEvent('search_no_result', 'ISO 9001 mail@x.com 0555123456'), { event: 'search_no_result', dim: 'iso 9001' });
  assert.equal(P.cleanEvent('search_no_result', 'a'), null);
  assert.equal(P.cleanEvent('page_view', '/academy/courses/:slug').dim, '/academy/courses/:slug');
  assert.equal(P.cleanEvent('coach_use', 'secret'), null);
  assert.deepEqual(P.cleanEvent('assessment_outcome', 'COMP-QM-01:high'), { event: 'assessment_outcome', dim: 'COMP-QM-01:high' });
  assert.equal(P.cleanEvent('sign_up', 'someone@example.com').dim, '', 'no dimension kept');
});

test('analytics: counts under 5 are suppressed; sections sum only shown counts', () => {
  const rows = P.suppress([{ event: 'course_start', dim: 'A', count: 12 }, { event: 'course_start', dim: 'B', count: 3 }, { event: 'active_learners', dim: '', count: 4 }]);
  assert.deepEqual(rows.map(r => r.count), [12, null, null]);
  const s = P.analyticsSections(rows);
  assert.equal(s.starts, 12); assert.equal(s.active.count, null);
});

test('analytics events from record changes: start, completion, submission, outcome band, lab, interview; nothing personal', () => {
  const ev = eventsFromChange('course_progress', [], [{ id: 'CRS-1', course_id: 'CRS-1' }]);
  assert.deepEqual(ev, [{ name: 'course_start', dim: 'CRS-1' }]);
  const done = eventsFromChange('course_progress', [{ id: 'CRS-1', course_id: 'CRS-1' }], [{ id: 'CRS-1', course_id: 'CRS-1', status: 'completed' }]);
  assert.deepEqual(done, [{ name: 'course_complete', dim: 'CRS-1' }]);
  const a = eventsFromChange('assessment_attempts', [], [{ id: 'att1', assessment_id: 'ASM-1', competency_breakdown: { 'COMP-1': { percent: 80 }, 'COMP-2': 30 } }]);
  assert.deepEqual(a.map(e => e.dim), ['ASM-1', 'COMP-1:high', 'COMP-2:low']);
  assert.deepEqual(eventsFromChange('interview_sessions', [{ id: 's1' }], [{ id: 's1' }, { id: 's2', answers: 'free text never sent' }]), [{ name: 'coach_use', dim: 'interview' }]);
  assert.deepEqual(eventsFromChange('cpd', [], [{ id: 'x', title: 'private' }]), []);
});

test('analytics queue sends nothing while signed out and batches when signed in', async () => {
  const sent = []; let signedIn = false;
  const q = new AnalyticsQueue({ api: { post: async (p, b) => { sent.push(b); } }, enabled: () => signedIn, max: 2, everyMs: 10_000 });
  q.push([{ name: 'sign_in' }]); q.flush();
  assert.equal(sent.length, 0);
  signedIn = true; q.push([{ name: 'sign_in' }, { name: 'bogus' }, { name: 'course_start', dim: 'C1' }]);
  assert.equal(sent.length, 1); assert.deepEqual(sent[0].events.map(e => e.name), ['sign_in', 'course_start']);
});

/* ------------------------------------------------------------------ verification center (D-117) */
test('verification center: verified needs who, when and an https source; reminders 30 days ahead, overdue flagged', () => {
  const today = '2026-11-18';
  assert.ok(P.validateCertVerification({ cert_id: 'CERT-PMP', status: 'verified' }, today).includes('verified_needs_who_when_where'));
  assert.deepEqual(P.validateCertVerification({ cert_id: 'CERT-PMP', status: 'verified', verifier: 'Modather', last_verified: '2026-11-10', source_url: 'https://www.pmi.org/certifications/project-management-pmp', next_review: '2027-02-10' }, today), []);
  assert.ok(P.validateCertVerification({ cert_id: 'CERT-PMP', status: 'pending', source_url: 'http://pmi.org' }, today).includes('source_url'));
  assert.ok(P.validateCertVerification({ cert_id: 'CERT-PMP', status: 'pending', last_verified: '2026-12-01' }, today).includes('last_verified'), 'future date');
  assert.ok(P.validateCertVerification({ cert_id: 'x', status: 'pending', last_verified: '2026-11-01', next_review: '2026-10-01' }, today).includes('next_before_last'));
  const r = P.verificationReminders([{ cert_id: 'A', next_review: '2026-11-01' }, { cert_id: 'B', next_review: '2026-12-10' }, { cert_id: 'C', next_review: '2027-06-01' }, { cert_id: 'D' }, { cert_id: 'E', status: 'changed', next_review: '2027-06-01' }], today);
  assert.deepEqual(r.map(x => x.cert_id), ['D', 'A', 'B', 'E']);
  assert.equal(r.find(x => x.cert_id === 'A').overdue, true);
  assert.equal(P.statusLine({ status: 'verified', next_review: '2026-11-01' }, today).overdue, true);
});

/* ------------------------------------------------------------------ review queue (D-116) */
test('review queue: references carry no name; no service level is invented; payload holds written tasks only', () => {
  assert.equal(P.reviewReference('1f3c9a00-0000-4000-8000-000000000000'), 'A-1F3C');
  assert.equal(P.slaState('2026-11-18T00:00:00Z', null, '2026-11-18T10:00:00Z').state, 'not_set');
  assert.equal(P.slaState('2026-11-18T00:00:00Z', 48, '2026-11-18T10:00:00Z').state, 'ok');
  assert.equal(P.slaState('2026-11-18T00:00:00Z', 10, '2026-11-18T09:00:00Z').state, 'due_soon');
  assert.equal(P.slaState('2026-11-18T00:00:00Z', 8, '2026-11-18T09:00:00Z').state, 'overdue');
  const lab = { id: 'L', tasks: [{ id: 't1', type: 'free_text', prompt: { en: 'Write' }, rubric: [{ id: 'r1' }], weight: 3 }, { id: 't2', type: 'single_choice', weight: 1 }] };
  const pl = P.reviewPayload(lab, { answers: { t1: 'my answer', t2: 'a' }, attempt_no: 2 });
  assert.deepEqual(pl.tasks.map(t => t.task_id), ['t1']); assert.equal(pl.tasks[0].max, 3); assert.ok(!JSON.stringify(pl).includes('"t2"'));
});

/* ------------------------------------------------------------------ CMS (D-115) */
test('CMS: drafts can never be saved as published; versions bump; export files use the existing decision format', () => {
  const pub = { id: 'CRS-X', governance: { content_status: 'published', content_source: 'owner', version: '1.2', reviewer: 'R', review_date: '2026-11-01' } };
  assert.ok(P.validateDraft('courses', pub).includes('status_must_be_pre_publication'));
  const next = P.nextDraftData({ ...pub }, pub);
  assert.equal(next.governance.version, '1.3'); assert.equal(next.governance.content_status, 'needs_review');
  assert.ok(!('reviewer' in next.governance) && !('review_date' in next.governance));
  assert.deepEqual(P.validateDraft('courses', next), []);
  assert.ok(P.validateDraft('users', next).includes('collection'));
  assert.ok(P.validateDraft('courses', { ...next, id: 'bad id!' }).includes('id'));
  const apply = readFileSync(path.join(ROOT, 'tools', 'apply_review_decisions.py'), 'utf8');
  for (const c of P.CMS_COLLECTIONS) assert.ok(apply.includes(`"${c}"`), `CMS collection ${c} is on the publishing allow-list`);
  const f = P.decisionsFile([{ collection: 'courses', record_id: 'CRS-X', data: next, decision: 'approve', reviewer_name: 'Named Reviewer', review_date: '2026-11-18', basis: 'expert_review' }]);
  assert.equal(f.schema, 'cia.review-decisions.v1'); assert.equal(f.decisions[0].version, '1.3');
  assert.deepEqual(P.diffRecords({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }), [{ path: 'b.c', before: 2, after: 3 }]);
});

/* ------------------------------------------------------------------ adapters (D-04, D-112) */
class FakeServer {
  constructor() { this.data = {}; this.offline = false; this.writes = 0; }
  async read(c) { if (this.offline) throw new ApiError(0, 'offline'); return structuredClone(this.data[c] || []); }
  async write(c, items) { if (this.offline) throw new ApiError(0, 'offline'); this.writes++; this.data[c] = structuredClone(items); return items; }
  async collections() { if (this.offline) throw new ApiError(0, 'offline'); return Object.keys(this.data).filter(k => this.data[k].length); }
  async clear(c) { delete this.data[c]; }
}

for (const [name, make] of [['memory', () => new MemoryAdapter()], ['local', () => new LocalStorageAdapter({ storage: new MockStorage(), userId: 'u-1' })],
  ['synced', () => new SyncedAdapter({ local: new LocalStorageAdapter({ storage: new MockStorage(), userId: 'u-1' }), server: new FakeServer() })]]) {
  test(`adapter contract (${name}): repository save / get / remove / collections / clear`, async () => {
    const a = make();
    const repo = new CollectionRepository({ adapter: a, collection: 'bookmarks' });
    await repo.save({ id: 'b1', x: 1 }); await repo.save({ id: 'b2', x: 2 }); await repo.save({ id: 'b1', x: 3 });
    assert.deepEqual((await repo.list()).map(r => [r.id, r.x]), [['b1', 3], ['b2', 2]]);
    assert.equal((await repo.get('b2')).x, 2);
    assert.equal(await repo.remove('b2'), true); assert.equal(await repo.remove('nope'), false);
    assert.deepEqual(await a.collections(), ['bookmarks']);
    await a.clear('bookmarks');
    assert.deepEqual(await repo.list(), []);
  });
}

test('synced adapter: works offline, queues the change, sends it when back online; guarded and device-only stay local', async () => {
  const server = new FakeServer(); server.offline = true;
  const statuses = [];
  const s = new SyncedAdapter({ local: new LocalStorageAdapter({ storage: new MockStorage(), userId: 'u-1' }), server, onStatus: x => statuses.push(x) });
  await s.write('cpd', [{ id: 'c1' }]); await s.flushing;
  assert.deepEqual(await s.read('cpd'), [{ id: 'c1' }], 'device copy works offline');
  assert.deepEqual(await s.pending(), ['cpd']); assert.ok(statuses.includes('offline'));
  server.offline = false; await s.flush();
  assert.deepEqual(server.data.cpd, [{ id: 'c1' }]); assert.deepEqual(await s.pending(), []);
  await s.write('passport_verifications', [{ id: 'fake' }]); await s.write('review_decisions', [{ id: 'd' }]); await s.flushing;
  assert.ok(!server.data.passport_verifications && !server.data.review_decisions);
  assert.ok(!(await s.collections()).includes(QUEUE_COLLECTION));
});

test('synced adapter pull: account copy replaces collections without pending changes; returns how many changed', async () => {
  const server = new FakeServer(); server.data = { bookmarks: [{ id: 'from-account' }], passport_verifications: [{ id: 'v', decision: 'verified' }] };
  const s = new SyncedAdapter({ local: new LocalStorageAdapter({ storage: new MockStorage(), userId: 'u-1' }), server });
  assert.equal(await s.pull(), 2);
  assert.deepEqual(await s.read('bookmarks'), [{ id: 'from-account' }]);
  assert.equal(await s.pull(), 0, 'nothing changed the second time');
});

test('server adapter: a version conflict merges by id and retries; ApiClient maps offline and errors', async () => {
  const calls = [];
  const api = { req: async (m, p, b) => { calls.push(b.base_version); return calls.length === 1 ? { status: 409, data: { version: 5, items: [{ id: 'other-device' }] } } : { status: 200, data: { version: 6 } }; } };
  const a = new ServerAdapter({ api });
  const out = await a.write('cpd', [{ id: 'mine' }]);
  assert.deepEqual(calls, [null, 5]); assert.deepEqual(out.map(r => r.id).sort(), ['mine', 'other-device']);
  const off = new ApiClient({ base: 'https://x', fetchImpl: async () => { throw new TypeError('fail'); } });
  await assert.rejects(off.get('/x'), e => e.status === 0 && e.offline);
  const bad = new ApiClient({ base: 'https://x', fetchImpl: async () => new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 }) });
  await assert.rejects(bad.get('/x'), e => e.status === 403 && e.code === 'forbidden');
});

test('account session: signed out it is one local learner; roles never switch in the browser; 401 forgets the token', async () => {
  const storage = new MockStorage();
  const api = new ApiClient({ base: 'https://x', fetchImpl: async () => new Response('{}', { status: 401 }) });
  const s = new AccountSession({ storage, api });
  assert.equal(s.signedIn, false); assert.deepEqual(s.roles, ['learner']); assert.equal(s.user.id, 'local');
  assert.equal(s.setRoles(['admin']), false);
  storage.setItem(AUTH_KEY, JSON.stringify({ token: 'tok', user: { id: 'AAA-1', roles: ['admin', 'hacker'] } }));
  const s2 = new AccountSession({ storage, api });
  assert.equal(s2.signedIn, true); assert.deepEqual(s2.roles, ['admin'], 'unknown role dropped'); assert.equal(s2.user.id, 'aaa-1');
  let out = false; s2.on('signedout', () => { out = true; });
  await s2.refresh();
  assert.equal(s2.signedIn, false); assert.equal(out, true); assert.equal(storage.getItem(AUTH_KEY), null);
});

/* ------------------------------------------------------------------ strings, CSP, secrets, config */
test('p14 strings: every key in both languages with the same placeholders; no claim wording', () => {
  const en = json('data/i18n/en.json').p14, ar = json('data/i18n/ar.json').p14;
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v]] : flat(v, p + k + '.')));
  const E = new Map(flat(en)), A = new Map(flat(ar));
  assert.ok(E.size > 250); assert.deepEqual([...E.keys()].sort(), [...A.keys()].sort());
  const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
  for (const [k, v] of E) { assert.equal(ph(v), ph(A.get(k)), k); assert.ok(!/certified by cia|cia certifies|\bpdus?\b|accredited/i.test(v), k); }
});

test('CSP: index.html has a strict policy, no inline script, and the language script is external', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] || '';
  assert.match(csp, /script-src 'self';/); assert.match(csp, /object-src 'none'/); assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(!/<script>(?!\s*<\/script>)/.test(html), 'no inline script');
  assert.match(html, /<script src="\.\/src\/boot-lang\.js"><\/script>/);
});

test('config: backend off by default; no secret or service key in any client file', () => {
  const cfg = json('data/config.json');
  assert.equal(cfg.backend.apiBase, ''); assert.match(cfg.version, /^2\./);
  const walk = d => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html'), path.join(ROOT, 'data', 'config.json')];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(s), `JWT-like string in ${f}`);
    assert.ok(!/service_role|sb_secret_|-----BEGIN [A-Z ]*PRIVATE KEY/.test(s), `secret marker in ${f}`);
    assert.ok(!/supabase\.co/.test(s), `hub project address in ${f}`);
  }
});
