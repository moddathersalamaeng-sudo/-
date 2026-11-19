/**
 * Phase 16 server tests (CIA_TEST_PG): the certificate register. Issue only on completion recorded in the account; stable
 * serial; name correction moves the seal, not the serial; public verification returns only printed details; withdrawal is
 * administrator-only; row-level security keeps one learner's register rows from another.
 */
import test, { before, after } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startHarness, ADMIN_URL, ACADEMY } from './_harness.mjs';
import { pg } from '../../server/lib/pgdriver.mjs';
import { issueCertificate } from '../../src/domain/certificates.mjs';
import { serialState, sealOf, credentialData } from '../../src/domain/credential.mjs';

const skip = !ADMIN_URL && 'set CIA_TEST_PG to a PostgreSQL superuser URL';
let H;
before(async () => { if (!skip) H = await startHarness(); });
after(async () => { if (H) await H.stop(); });
const course = JSON.parse(readFileSync(path.join(ACADEMY, 'data', 'seed', 'courses.json'), 'utf8')).items.find(c => c.id === 'CRS-ISO-AUD');
const lessons = course.modules.flatMap(m => m.lessons.map(l => l.id));

async function asApp(uid, sql, params = []) {
  const c = new pg.Client({ connectionString: H.apiUrl }); await c.connect();
  try { await c.query('begin'); await c.query('set local role cia_app'); await c.query("select set_config('cia.uid', $1, true)", [uid || '']); const r = await c.query(sql, params); await c.query('rollback'); return r; }
  catch (e) { try { await c.query('rollback'); } catch { /* ignore */ } throw e; } finally { await c.end(); }
}

test('certificate register: completion gate, stable serial, seal follows the name, public verify, admin-only withdrawal, RLS', { skip }, async () => {
  const a = await H.account(), other = await H.account(), admin = await H.account({ roles: ['admin'] });
  const post = (who, body) => H.call('POST', '/api/v1/certificates', { token: who.token, body });
  assert.equal((await H.call('POST', '/api/v1/certificates', { body: { course_id: course.id, name: 'Ali Hassan' } })).status, 401, 'sign-in required');
  assert.equal((await post(a, { course_id: course.id, name: 'Ali Hassan' })).status, 409, 'not complete yet');
  assert.equal((await post(a, { course_id: 'CRS-NOPE', name: 'Ali Hassan' })).status, 404);
  assert.equal((await post(a, { course_id: course.id, name: '<b>x' })).status, 400);
  await H.call('PUT', '/api/v1/collections/course_progress', { token: a.token, body: { items: [{ id: course.id, completed_lessons: lessons }] } });
  await H.call('PUT', '/api/v1/collections/assessment_attempts', { token: a.token, body: { items: [{ id: 'f1', assessment_id: course.assessments.final, passed: true, score: 88 }] } });
  const r1 = await post(a, { course_id: course.id, name: 'Ali  Hassan' });
  assert.equal(r1.status, 201); const c1 = r1.body.certificate;
  assert.equal(serialState(c1.serial), 'ok'); assert.equal(c1.name, 'Ali Hassan'); assert.equal(c1.score, 88); assert.equal(c1.status, 'valid');
  /* The device computes the same seal from the register's serial and date (what the client stores and prints). */
  const dev = issueCertificate({ course, progress: [{ id: course.id, completed_lessons: lessons }], attempts: [{ assessment_id: course.assessments.final, passed: true, score: 88 }], name: 'Ali Hassan', userId: a.id, existing: { number: c1.serial, issued_at: c1.issued_at } });
  assert.equal(dev.seal, c1.seal); assert.equal(sealOf(credentialData(dev)), c1.seal);
  const r2 = await post(a, { course_id: course.id, name: 'Ali Hassan' }); assert.equal(r2.status, 200); assert.equal(r2.body.certificate.serial, c1.serial);
  const r3 = await post(a, { course_id: course.id, name: 'Ali M. Hassan' }); assert.equal(r3.body.certificate.serial, c1.serial, 'serial is fixed'); assert.notEqual(r3.body.certificate.seal, c1.seal, 'seal follows the name');
  /* Public verification: no token; printed details only (no user id, no e-mail). */
  const v = await H.call('GET', `/api/v1/certificates/verify/${c1.serial}`);
  assert.equal(v.status, 200); assert.equal(v.body.certificate.name, 'Ali M. Hassan'); assert.equal(v.body.certificate.status, 'valid');
  assert.deepEqual(Object.keys(v.body.certificate).sort(), ['course_id', 'date', 'hours', 'issued_at', 'name', 'registered_at', 'score', 'seal', 'serial', 'status']);
  assert.equal((await H.call('GET', `/api/v1/certificates/verify/${c1.serial.slice(0, -1)}${c1.serial.endsWith('0') ? '1' : '0'}`)).status, 400, 'typo caught before lookup');
  /* Row-level security: another learner cannot read or change the row in SQL; cannot issue for a course they did not finish. */
  assert.equal((await asApp(other.id, 'select * from cia.certificates')).rowCount, 0);
  assert.equal((await asApp(other.id, "update cia.certificates set name = 'Hacker' where serial = $1", [c1.serial])).rowCount, 0);
  await assert.rejects(asApp(a.id, "update cia.certificates set status = 'revoked' where serial = $1", [c1.serial]), /permission denied/);
  assert.equal((await post(other, { course_id: course.id, name: 'Other Person' })).status, 409);
  /* Withdrawal: learner refused, administrator allowed (with a reason); verify then says revoked; re-issue refused. */
  assert.equal((await H.call('POST', `/api/v1/admin/certificates/${c1.serial}/revoke`, { token: a.token, body: { reason: 'x' } })).status, 403);
  assert.equal((await H.call('POST', `/api/v1/admin/certificates/${c1.serial}/revoke`, { token: admin.token, body: {} })).status, 400);
  assert.equal((await H.call('POST', `/api/v1/admin/certificates/${c1.serial}/revoke`, { token: admin.token, body: { reason: 'Issued in error' } })).status, 200);
  assert.equal((await H.call('GET', `/api/v1/certificates/verify/${c1.serial}`)).body.certificate.status, 'revoked');
  assert.equal((await post(a, { course_id: course.id, name: 'Ali Hassan' })).status, 409);
  const mine = await H.call('GET', '/api/v1/certificates/mine', { token: a.token }); assert.equal(mine.body.certificates.length, 1);
  const audit = await H.owner.query("select action from cia.audit_log where target = $1 order by id", [c1.serial]);
  assert.deepEqual(audit.rows.map(x => x.action), ['certificate.issue', 'certificate.update', 'certificate.revoke']);
});
