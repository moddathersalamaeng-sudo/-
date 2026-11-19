/** Phase 16 — certificate serials, seals, QR link payloads, per-course design and the v2 certificate record. */
import test from 'node:test'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sha256Hex } from '../../src/domain/sha256.mjs';
import * as C from '../../src/domain/credential.mjs';
import { issueCertificate } from '../../src/domain/certificates.mjs';
import qrcode from '../../src/vendor/qrcode.mjs';

const COURSES = JSON.parse(readFileSync(new URL('../../data/seed/courses.json', import.meta.url), 'utf8')).items;
const en = JSON.parse(readFileSync(new URL('../../data/i18n/en.json', import.meta.url), 'utf8'));
const ar = JSON.parse(readFileSync(new URL('../../data/i18n/ar.json', import.meta.url), 'utf8'));
const done = c => ({ progress: [{ id: c.id, completed_lessons: c.modules.flatMap(m => m.lessons.map(l => l.id)) }], attempts: [{ assessment_id: c.assessments.final, passed: true, score: 87.6 }] });

test('SHA-256 matches Node crypto (ASCII, Arabic, long, block edges)', () => {
  for (const s of ['', 'abc', 'مدثر سلامه', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(5000)]) assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'), s.slice(0, 10));
});

test('serial: shape, stability, check character catches typos', () => {
  const c = COURSES.find(x => x.id === 'CRS-ISO-AUD');
  const s = C.makeSerial({ course: c, userId: 'local', issuedAt: '2026-11-19T08:00:00Z' });
  assert.match(s, /^CIA-C-ISOAUD-2611-[0-9A-HJKMNP-TV-Z]{7}$/); assert.equal(C.serialState(s), 'ok');
  assert.equal(C.makeSerial({ course: c, userId: 'local', issuedAt: '2026-11-19T08:00:00Z' }), s, 'deterministic');
  assert.notEqual(C.makeSerial({ course: c, userId: 'other', issuedAt: '2026-11-19T08:00:00Z' }), s, 'differs per learner');
  let caught = 0, tried = 0;
  for (let i = 18; i < s.length; i++) for (const ch of C.B32) { if (ch === s[i]) continue; tried++; if (C.serialState(s.slice(0, i) + ch + s.slice(i + 1)) !== 'ok') caught++; }
  assert.ok(caught / tried > 0.95, `${caught}/${tried}`);
  assert.equal(C.serialState('CIA-C-ISOAUD-1234567'), 'legacy'); assert.equal(C.serialState('hello'), 'malformed'); assert.equal(C.serialState(s.toLowerCase()), 'ok');
});

test('QR link payload: round trip with an Arabic name; any edited detail is caught', () => {
  const c = COURSES.find(x => x.id === 'CRS-Q-CAPA');
  const rec = issueCertificate({ course: c, ...done(c), name: 'مدثر سلامه', now: '2026-11-19T08:00:00Z' });
  const p = C.encodePayload(rec);
  assert.match(p, /^[A-Za-z0-9_-]+$/); assert.ok(p.length < 400);
  const v = C.verifyLink(rec.number, p);
  assert.equal(v.state, 'intact'); assert.equal(v.data.name, 'مدثر سلامه'); assert.equal(v.data.score, 88); assert.equal(v.seal, rec.seal);
  for (const [k, val] of [[2, 'Someone Else'], [3, '2025-01-01'], [5, 100], [4, 99], [1, 'CRS-ISO-101']]) {
    const o = JSON.parse(new TextDecoder().decode(C.unb64url(p))); o[k] = val;
    assert.equal(C.verifyLink(rec.number, C.b64url(new TextEncoder().encode(JSON.stringify(o)))).state, 'altered', k);
  }
  const other = issueCertificate({ course: c, ...done(c), name: 'Other Person', userId: 'u2', now: '2026-11-19T08:00:00Z' });
  assert.equal(C.verifyLink(other.number, p).state, 'altered', 'details moved to another serial');
  assert.equal(C.verifyLink(rec.number, 'not*base64').state, 'malformed'); assert.equal(C.verifyLink(rec.number, '').state, 'missing');
  assert.equal(C.verifyLink(rec.number.slice(0, -1) + (rec.number.endsWith('0') ? '1' : '0'), p).state, 'typo');
  assert.equal(C.decodePayload('x'.repeat(2000)).ok, false);
  const href = C.verifyHref('https://example.test/-/academy/?lang=ar#/x', rec);
  assert.match(href, /^https:\/\/example\.test\/-\/academy\/\?lang=ar#\/verify\/CIA-C-QCAPA-2611-[0-9A-Z]{7}\?p=/);
  const q = qrcode(0, 'M'); q.addData(href); q.make(); assert.ok(q.getModuleCount() <= 57, `QR version ≤ 10 (${q.getModuleCount()} modules)`);
  const prod = C.verifyHref('https://moddathersalamaeng-sudo.github.io/-/academy/', rec); const q2 = qrcode(0, 'M'); q2.addData(prod); q2.make(); assert.ok(q2.getModuleCount() <= 57, `live address: ${q2.getModuleCount()} modules, ${prod.length} chars`);
});

test('design: every published course gets its own seal; colours follow the academy', () => {
  const pub = COURSES.filter(c => c.governance.content_status === 'published');
  const keys = new Set(pub.map(c => JSON.stringify([C.designFor(c).seal, C.designFor(c).frame])));
  assert.ok(keys.size >= pub.length - 1, `${keys.size}/${pub.length} distinct seals`);
  const acad = id => C.designFor(COURSES.find(c => c.id === id)).academy;
  assert.equal(acad('CRS-ISO-AUD'), 'iso'); assert.equal(acad('CRS-PM-RISK'), 'pmi'); assert.equal(acad('CRS-Q-CAPA'), 'quality'); assert.equal(acad('CRS-EX-RADAR'), 'excellence');
  const r = C.rosettePaths(C.designFor(pub[0]).seal); assert.ok(r.length >= 3 && r.every(p => /^M[-\d.,L]+Z$/.test(p)));
  assert.ok(C.framePaths(C.designFor(pub[0]).frame, 297, 210).every(p => p.startsWith('M') && p.endsWith('Z')));
});

test('certificate record v2: serial kept, score, highlights, seal; a Phase 11 number stays', () => {
  const c = COURSES.find(x => x.id === 'CRS-ISO-AUD');
  const a = issueCertificate({ course: c, ...done(c), name: 'Ali Hassan', now: '2026-11-19T08:00:00Z' });
  assert.equal(a.version, 2); assert.equal(a.score, 88); assert.equal(a.academy, 'iso'); assert.ok(a.highlights.length >= 2 && a.highlights.length <= 4);
  assert.match(a.seal, /^[0-9A-Z]{10}$/);
  const b = issueCertificate({ course: c, ...done(c), name: 'Ali M. Hassan', existing: a, now: '2026-12-01T08:00:00Z' });
  assert.equal(b.number, a.number); assert.equal(b.issued_at, a.issued_at); assert.notEqual(b.seal, a.seal);
  const legacy = issueCertificate({ course: c, ...done(c), name: 'Ali Hassan', existing: { number: 'CIA-C-ISOAUD-0ABCDEF', issued_at: '2026-11-12T08:00:00Z' } });
  assert.equal(legacy.number, 'CIA-C-ISOAUD-0ABCDEF'); assert.equal(C.verifyLink(legacy.number, C.encodePayload(legacy)).state, 'intact');
  const noFinal = issueCertificate({ course: c, progress: done(c).progress, attempts: [{ assessment_id: c.assessments.final, passed: true }], name: 'Ali Hassan' });
  assert.equal(noFinal.score, null);
});

test('cx16 strings: same keys in Arabic and English, honest wording kept', () => {
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [[p + k, v]] : flat(v, p + k + '.'));
  const E = Object.fromEntries(flat(en.cx16)), A = Object.fromEntries(flat(ar.cx16));
  assert.deepEqual(Object.keys(E).sort(), Object.keys(A).sort()); assert.ok(Object.keys(E).length >= 70);
  for (const [k, v] of Object.entries(E)) assert.ok(!/accredit|certified by|official/i.test(v) || /not/i.test(v), k);
  assert.match(E['v.body.intact'], /cannot confirm who issued it/); assert.match(E.kind, /Completion/);
});
