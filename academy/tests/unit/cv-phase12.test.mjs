/**
 * Phase 12 — CV Builder (ADD-12): validation, honest content (credentials as declared, "issuer record checked" only after a
 * reviewer's issuer check, CIA certificates as completion, only assessed / verified competencies, CPD as hours recorded),
 * section switches, plain-text and Word exports escape markup and keep RTL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCv, buildCv, cvText, cvWordHtml, CV_SECTIONS } from '../../src/domain/cv.mjs';
import * as P from '../../src/domain/passport.mjs';

const TODAY = '2026-11-12';
const labels = (k, p = {}) => k + (Object.keys(p).length ? ' ' + JSON.stringify(p) : '');

test('CV details: name required and validated, email and phone checked, sections default on', () => {
  assert.equal(validateCv({}).errors.name, 'required');
  assert.equal(validateCv({ name: '<b>x' }).errors.name, 'chars');
  const e = validateCv({ name: 'Sara Ali', email: 'not-an-email', phone: 'call me' }).errors;
  assert.deepEqual(Object.keys(e).sort(), ['email', 'phone']);
  const ok = validateCv({ name: 'سارة علي', email: 'sara@example.org', phone: '+966 50 000 0000', include: { cpd: false } });
  assert.ok(ok.value); assert.equal(ok.value.include.cpd, false); assert.equal(ok.value.include.summary, true);
  assert.deepEqual(Object.keys(ok.value.include), CV_SECTIONS);
});

test('CV content is honest: declared credentials, issuer check only when verified, CIA completion wording, assessed competencies only, CPD as hours', () => {
  const credA = P.saveCredential({ type: 'professional_cert', name: 'Lead Auditor QMS', issuer: 'Body A', issued: '2024-01-01', verify_url: 'https://a.example/v' }, { today: TODAY });
  const credB = P.saveCredential({ type: 'membership', name: 'Member', issuer: 'Society B', issued: '2023-01-01' }, { today: TODAY });
  const credX = P.saveCredential({ type: 'license', name: 'Old licence', issuer: 'Licensing Office', issued: '2020-01-01', expires: '2021-01-01' }, { today: TODAY });
  const v = P.makeVerification({ target_kind: 'credential', target_id: credA.id, reviewer: 'Sara Reviewer', date: TODAY, method: 'issuer_check', decision: 'verified' }, TODAY);
  const log = P.makeLog('auditor', { audit_type: 'internal', standard: 'ISO 9001:2015', role: 'lead', days: 2, date: '2026-10-01' }, { today: TODAY });
  const cpd = [P.makeCpd({ title: 'Workshop', category: 'workshop', date: '2026-03-01', hours: 6 }, { today: TODAY })];
  const rows = [{ id: 'AUD-01', competency: { name: { en: 'Audit planning' } }, level: 3, status: 'platform_assessed' }, { id: 'AUD-02', competency: { name: { en: 'Evidence' } }, level: 4, status: 'reviewer_verified' },
    { id: 'AUD-03', competency: { name: { en: 'Self only' } }, level: 4, status: 'self_declared' }, { id: 'AUD-04', competency: { name: { en: 'Low' } }, level: 2, status: 'platform_assessed' }];
  const m = buildCv({ cv: { name: 'Sara Ali', summary: 'Quality engineer.', include: {} }, profile: { current_role: 'Quality Engineer', years_experience: '8', education: 'master', languages: ['ar', 'en'] },
    role: { name: { en: 'Internal Auditor' } }, credentials: [credA, credB, credX], certificates: [{ id: 'C1', course_id: 'C1', course_title: { en: 'Internal auditing' }, number: 'CIA-C-X-1', issued_at: '2026-11-06T00:00:00Z' }],
    logs: [log], cpd, verifications: [v], rows, today: TODAY, labels });
  const sec = id => m.sections.find(s => s.id === id);
  assert.equal(m.header.headline, 'Quality Engineer');
  const creds = sec('credentials').items;
  assert.equal(creds.length, 2, 'an expired credential is left out');
  assert.match(creds.find(x => x.title === 'Lead Auditor QMS').sub, /cv\.issuerChecked/);
  assert.doesNotMatch(creds.find(x => x.title === 'Member').sub, /issuerChecked/);
  assert.match(sec('learning').items[0].sub, /cv\.ciaCompletion/);
  assert.deepEqual(sec('competencies').items.map(x => x.title), ['Evidence', 'Audit planning']);
  assert.match(sec('cpd').items[0].title, /"n":6/);
  assert.ok(sec('practice').items[0].title.includes('ISO 9001:2015'));
  assert.ok(!JSON.stringify(m).match(/verified by cia|accredited|PDU/i));
  const off = buildCv({ cv: { name: 'Sara Ali', include: { credentials: false, cpd: false } }, credentials: [credA], cpd, today: TODAY, labels });
  assert.ok(!off.sections.some(s => s.id === 'credentials' || s.id === 'cpd'));
});

test('CV exports: plain text one fact per line; Word HTML escapes markup and is right-to-left in Arabic', () => {
  const m = { header: { name: 'Sara <script>', headline: 'QE & auditor', location: 'Riyadh', email: 'a@b.co', phone: '' }, sections: [{ id: 'summary', title: 'Profile', items: [{ title: 'Line "one"', sub: 'a < b' }], note: 'n' }] };
  const txt = cvText(m);
  assert.ok(txt.startsWith('Sara <script>\r\nQE & auditor\r\nRiyadh | a@b.co'));
  assert.ok(txt.includes('PROFILE\r\n- Line "one"\r\n  a < b'));
  const doc = cvWordHtml(m, { lang: 'ar' });
  assert.ok(doc.includes('dir="rtl"') && doc.includes('&lt;script&gt;') && doc.includes('a &lt; b') && !doc.includes('<script>'));
});
