/**
 * Phase 12A — Company Portal (src/domain/company.mjs): matrix cell rules, single points of failure, TNA roll-ups,
 * prioritisation, share-file validation (only consented parts, never upgrades, rejects foreign files, never overwrites),
 * assignment lifecycle and due states, exports (escaping, Arabic, formula neutralisation), registry, figures, strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, text } from './_util.mjs';
import * as C from '../../src/domain/company.mjs';
import { exportPassport } from '../../src/domain/passport.mjs';
import { severity } from '../../src/domain/recommendations.mjs';
import { validateRegistry, shellEntries, MAX_TOP, MAX_MENU } from '../../src/nav/registry.js';

const TODAY = '2026-11-12';
const comps = ['A-1', 'A-2', 'B-1', 'B-2'].map((id, i) => ({ id, domain: id[0], name: { en: 'Comp ' + id, ar: 'كفاءة ' + (i + 1) } }));
const ids = comps.map(c => c.id);
const roles = [{ id: 'R-ENG', name: { en: 'Engineer', ar: 'مهندس' }, targets: { 'A-1': 3, 'A-2': 2, 'B-1': 0, 'B-2': 1 } }, { id: 'R-MGR', name: { en: 'Manager', ar: 'مدير' }, targets: { 'A-1': 4, 'A-2': 3, 'B-1': 3, 'B-2': 0 } }];
const departments = [{ id: 'D-1', name: 'Quality', roles: ['R-ENG', 'R-MGR'] }, { id: 'D-2', name: 'Empty', roles: ['R-ENG'] }];
const V = { reviewer: 'Huda Karim', date: '2026-10-01', method: 'work_sample' };
const mk = (key, name, rows, { parts = ['competencies', 'verified'], now = '2026-11-10T08:00:00.000Z', extra = {}, id } = {}) =>
  C.buildShare({ employee: { key, name, job_title: 'Engineer' }, parts, shareId: id || 'SHR-' + key, now, data: { competencies: rows, ...extra } });
const read = (f, existingIds = []) => C.readShare(JSON.stringify(f), { competencyIds: ids, existingIds, today: TODAY });
/* Hand-calculated fixture:
   Sara  (R-ENG: A-1 3, A-2 2, B-2 1): A-1 assessed 75 % → 3 (met) · A-2 self 1 (gap 1) · B-2 nothing (gap 1)      → gap 2, met 1/3
   Omar  (R-ENG):                      A-1 self 1 (gap 2, critical) · A-2 verified 2 (met) · B-2 self 1 (met)        → gap 2, met 2/3
   Lina  (R-MGR: A-1 4, A-2 3, B-1 3): A-1 verified 4 (met) · A-2 assessed 60 % → 2 (gap 1) · B-1 nothing (gap 3)   → gap 4, met 1/3
   Zaid  (no role)                                                                                                    → not analysed */
const files = [
  mk('EMP-SARA', 'Sara Ali', [{ id: 'A-1', level: 3, source: 'assessment', percent: 75, date: '2026-11-01' }, { id: 'A-2', level: 1, source: 'self' }]),
  mk('EMP-OMAR', 'Omar Said', [{ id: 'A-1', level: 1, source: 'self' }, { id: 'A-2', level: 2, source: 'verified', date: V.date, verification: V }, { id: 'B-2', level: 1, source: 'self' }]),
  mk('EMP-LINA', 'Lina Noor', [{ id: 'A-1', level: 4, source: 'verified', date: V.date, verification: V }, { id: 'A-2', level: 2, source: 'assessment', percent: 60 }]),
  mk('EMP-ZAID', 'Zaid Omar', [{ id: 'A-1', level: 2, source: 'self' }])
];
const shares = files.map(f => read(f).share);
const placements = [{ id: 'EMP-SARA', department_id: 'D-1', role_id: 'R-ENG' }, { id: 'EMP-OMAR', department_id: 'D-1', role_id: 'R-ENG' }, { id: 'EMP-LINA', department_id: 'D-1', role_id: 'R-MGR' }];
const people = C.peopleFrom(shares, placements, TODAY);
const P = key => people.find(p => p.key === key);

test('company profile, departments and company-defined roles are validated', () => {
  assert.deepEqual(C.validateCompany({ name: '' }).errors, { name: 'required' });
  assert.equal(C.validateCompany({ name: 'Acme', min_holders: 9 }).errors.min_holders, 'range');
  assert.equal(C.validateCompany({ name: 'Acme', plan_year: 1999 }).errors.plan_year, 'range');
  const ok = C.validateCompany({ name: '  شركة   الاختبار ', sector: 'Energy' }).value;
  assert.equal(ok.name, 'شركة الاختبار'); assert.equal(ok.min_holders, C.DEFAULT_MIN_HOLDERS); assert.equal(ok.schema, 'cia.company.v1');
  assert.equal(C.validateDepartment({ name: 'quality' }, { roleIds: ['R-ENG'], existing: departments }).errors.name, 'duplicate');
  assert.equal(C.validateDepartment({ name: 'Ops', roles: ['R-X'] }, { roleIds: ['R-ENG'], existing: [] }).errors.roles, 'unknown');
  assert.deepEqual(C.validateDepartment({ name: 'Ops', roles: ['R-ENG', 'R-ENG'] }, { roleIds: ['R-ENG'], existing: [] }).value.roles, ['R-ENG']);
  assert.equal(C.validateCustomRole({ name: 'Custom', targets: {} }, { competencyIds: ids }).errors.targets, 'empty');
  assert.equal(C.validateCustomRole({ name: 'Custom', targets: { 'A-1': 7 } }, { competencyIds: ids }).errors.targets, 'range');
  assert.equal(C.validateCustomRole({ name: 'engineer', targets: { 'A-1': 2 } }, { competencyIds: ids, existing: roles }).errors.name, 'duplicate');
  const r = C.validateCustomRole({ name: 'Site QA', based_on: 'R-ENG', targets: { 'A-1': 2, 'ZZ': 5 } }, { competencyIds: ids }).value;
  assert.deepEqual(r.targets, { 'A-1': 2, 'A-2': 0, 'B-1': 0, 'B-2': 0 }); assert.equal(r.custom, true);
  assert.equal(C.allRoles(roles, [r]).length, 3);
});

test('share: the form needs a name, at least one part and the explicit consent', () => {
  assert.deepEqual(Object.keys(C.validateShareInput({ name: '', parts: [], consent: false }).errors).sort(), ['consent', 'name', 'parts']);
  assert.equal(C.validateShareInput({ name: 'Sara Ali', parts: ['cpd'], consent: 'yes' }).errors.consent, 'required');
  assert.equal(C.validateShareInput({ name: 'Sara Ali', parts: ['cpd'], consent: true }, ['competencies']).errors.parts, 'required', 'a part with nothing to share cannot be picked');
  assert.deepEqual(C.validateShareInput({ name: ' Sara  Ali ', parts: ['cpd', 'bogus', 'competencies'], consent: true }).value, { name: 'Sara Ali', job_title: '', employee_no: '', parts: ['competencies', 'cpd'] });
  assert.ok(C.CONSENT_TEXT.en.length > 80 && C.CONSENT_TEXT.ar.length > 80);
});

test('share: competency rows come from the device evidence model and a verified level is shared only when consented', () => {
  const selfLevels = { 'A-1': 2, 'A-2': 4, 'B-1': 3 };
  const evidence = { 'A-1': { percent: 88, at: '2026-11-02T10:00:00Z' } };
  const verifications = [{ id: 'competency:A-2', target_kind: 'competency', target_id: 'A-2', decision: 'verified', level: 5, ...V }, { id: 'competency:B-1', target_kind: 'competency', target_id: 'B-1', decision: 'verified', level: 5, reviewer: 'X', date: V.date, method: V.method }];
  const both = C.shareCompetencies({ competencies: comps, selfLevels, evidence, verifications, withLevels: true, withVerified: true, today: TODAY });
  assert.deepEqual(both.map(r => [r.id, r.level, r.source]), [['A-1', 4, 'assessment'], ['A-2', 5, 'verified'], ['B-1', 3, 'self']], 'an invalid verification (reviewer too short) is ignored');
  const noVer = C.shareCompetencies({ competencies: comps, selfLevels, evidence, verifications, withLevels: true, withVerified: false, today: TODAY });
  assert.deepEqual(noVer.find(r => r.id === 'A-2'), { id: 'A-2', level: 4, source: 'self', date: null }, 'without consent the verified level falls back to the self-rating');
  const onlyVer = C.shareCompetencies({ competencies: comps, selfLevels, evidence, verifications, withLevels: false, withVerified: true, today: TODAY });
  assert.deepEqual(onlyVer.map(r => r.id), ['A-2']);
  assert.ok(!both.some(r => r.id === 'B-2'), 'a competency with nothing to show is not shared');
});

test('share file: lists exactly the consented parts, carries the bilingual consent, the name and the date', () => {
  const f = C.buildShare({ employee: { key: 'EMP-1', name: 'Sara Ali' }, parts: ['cpd', 'competencies'], shareId: 'SHR-1', now: '2026-11-10T08:00:00.000Z',
    data: { competencies: [{ id: 'A-1', level: 2, source: 'self' }, { id: 'A-2', level: 5, source: 'verified', verification: V }], cpd: { total: 10, count: 2, by_year: { 2026: 10 } }, credentials: [{ name: 'PMP' }], roadmap: { target_role: 'R' }, assignments: [{ id: 'ASG-1' }] } });
  assert.equal(f.schema, 'cia.passport-share.v1'); assert.equal(f.app, 'cia-academy');
  assert.deepEqual(f.includes, ['competencies', 'cpd']);
  assert.deepEqual(Object.keys(f.data).sort(), ['competencies', 'cpd'], 'credentials, roadmap and assignments were not ticked, so they are not in the file');
  assert.deepEqual(f.data.competencies.map(r => r.id), ['A-1'], 'the verified row is left out when verified levels were not ticked');
  assert.equal(f.consent.accepted, true); assert.equal(f.consent.name, 'Sara Ali'); assert.ok(f.consent.text.en && f.consent.text.ar);
  assert.match(f.digest, /^[0-9a-f]{16}$/);
  assert.equal(C.digestOf({ b: 1, a: [1, { d: 2, c: 3 }] }), C.digestOf({ a: [1, { c: 3, d: 2 }], b: 1 }), 'key order does not change the digest');
});

test('import: foreign, damaged, future-dated, consent-less and duplicate files are refused', () => {
  assert.equal(C.readShare('{nope', {}).err, 'json');
  assert.equal(C.readShare('x'.repeat(C.MAX_FILE_BYTES + 1), {}).err, 'size');
  assert.equal(read(exportPassport({})).err, 'schema', 'a passport backup is not a share');
  assert.equal(read({ app: 'other', schema: C.SHARE_SCHEMA, data: {} }).err, 'schema');
  const f = files[0];
  assert.equal(read({ ...f, employee: { ...f.employee, name: 'X' } }).err, 'employee');
  const edit = patch => { const x = { ...structuredClone(f), ...patch }; delete x.digest; return { ...x, digest: C.digestOf(x) }; };
  assert.equal(read(edit({ shared_at: '2027-01-01T00:00:00Z' })).err, 'date');
  assert.equal(read(edit({ includes: ['competencies', 'salary'] })).err, 'parts');
  assert.equal(read(edit({ consent: { ...f.consent, accepted: false } })).err, 'consent');
  assert.equal(read(edit({ consent: { ...f.consent, name: 'Someone Else' } })).err, 'consent');
  const tampered = structuredClone(f); tampered.data.competencies[1].level = 5;
  assert.equal(read(tampered).err, 'digest', 'a level edited after download is caught');
  assert.equal(read(f, [f.share_id]).err, 'duplicate', 'never overwrites a stored share');
  assert.equal(read(f).ok, true);
});

test('import: only the consented parts are read and a status is never upgraded', () => {
  const raw = { app: 'cia-academy', schema: C.SHARE_SCHEMA, share_id: 'SHR-X', shared_at: '2026-11-10T08:00:00.000Z', employee: { key: 'EMP-X', name: 'Xavier Test' }, includes: ['competencies'],
    consent: { accepted: true, name: 'Xavier Test', accepted_at: '2026-11-10T08:00:00.000Z' },
    data: { competencies: [{ id: 'A-1', level: 5, source: 'verified', percent: 62, verification: V }, { id: 'A-2', level: 5, source: 'assessment', percent: 41 }, { id: 'B-1', level: 5, source: 'verified' }, { id: 'B-2', level: 9, source: 'self' },
      { id: 'ZZ-9', level: 3, source: 'self' }, { id: 'A-2', level: 1, source: 'self' }], cpd: { total: 99 }, credentials: [{ name: 'Secret' }], salary: 1 } };
  const out = read({ ...raw, digest: C.digestOf(raw) });
  assert.equal(out.ok, true);
  assert.deepEqual(Object.keys(out.share.data), ['competencies']);
  assert.deepEqual(out.notes.stripped.sort(), ['cpd', 'credentials', 'salary']);
  assert.deepEqual(out.share.data.competencies, [{ id: 'A-1', level: 2, source: 'assessment', percent: 62, date: null }, { id: 'A-2', level: 1, source: 'assessment', percent: 41, date: null }],
    'verified levels were not consented → fall back to the assessed level; an assessed level is recomputed from its percentage; out-of-range and unknown rows are dropped');
  assert.equal(out.notes.downgraded, 2); assert.equal(out.notes.unknown, 1); assert.equal(out.notes.dropped, 2);
  const v2 = { ...raw, includes: ['verified'], data: { competencies: [{ id: 'A-1', level: 4, source: 'verified', verification: { ...V, date: '2027-01-01' } }, { id: 'A-2', level: 3, source: 'verified', verification: V }, { id: 'B-1', level: 3, source: 'verified', verification: { ...V, method: 'magic' } }] } };
  const o2 = read({ ...v2, digest: C.digestOf(v2) });
  assert.deepEqual(o2.share.data.competencies.map(r => [r.id, r.source]), [['A-2', 'verified']], 'verified is kept only with a named reviewer, a past date and a known method');
  const cred = { ...raw, includes: ['credentials'], data: { credentials: [{ name: 'PMP', issuer: 'PMI', state: 'verified' }, { name: 'CQE', issuer: 'ASQ', state: 'verified', checked_by: V }] } };
  const o3 = read({ ...cred, digest: C.digestOf(cred) });
  assert.deepEqual(o3.share.data.credentials.map(c => c.state), ['self_declared', 'verified'], 'a credential is "verified" only with the reviewer who checked the issuer record');
});

test('people: the newest share per person is used, older ones stay in the history, old shares are flagged', () => {
  const older = read(mk('EMP-SARA', 'Sara Ali', [{ id: 'A-1', level: 1, source: 'self' }], { now: '2026-06-01T08:00:00.000Z', id: 'SHR-OLD' })).share;
  const ps = C.peopleFrom([...shares, older], placements, TODAY);
  const sara = ps.find(p => p.key === 'EMP-SARA');
  assert.equal(sara.history, 2); assert.equal(sara.share.id, 'SHR-EMP-SARA'); assert.equal(sara.levels['A-1'].level, 3); assert.equal(sara.stale, false);
  const onlyOld = C.peopleFrom([older], [], TODAY)[0];
  assert.equal(onlyOld.stale, true); assert.ok(onlyOld.age_days > C.STALE_DAYS); assert.equal(onlyOld.role_id, null);
  assert.equal(C.peopleFrom(shares.filter(s => s.employee_key !== 'EMP-ZAID'), placements, TODAY).length, 3, 'deleting a share withdraws the person');
});

test('matrix cell: source and gap, verified first, critical from two levels, engine severity', () => {
  assert.deepEqual(C.matrixCell(3, null), { required: 3, level: 0, source: 'none', gap: 3, met: false, critical: true, priority: severity(3, 0.6, 0.35), priority_value: 0.63, percent: null, date: null, verification: null });
  const v = C.matrixCell(4, { level: 4, source: 'verified', verification: V });
  assert.equal(v.met, true); assert.equal(v.priority, 'Achieved'); assert.equal(v.verification.reviewer, 'Huda Karim');
  const s = C.matrixCell(5, { level: 1, source: 'self' });
  assert.equal(s.gap, 4); assert.equal(s.priority_value, 2.2); assert.equal(s.priority, 'High');
  assert.equal(C.matrixCell(5, { level: 1, source: 'verified' }).priority, 'Critical', 'the better a low level is evidenced, the more certain the need');
  assert.equal(C.matrixCell(2, { level: 1, source: 'assessment' }).critical, false);
  assert.equal(C.matrixCell(2, { level: 5, source: 'self' }).gap, 0, 'a level above the requirement is not a negative gap');
  assert.equal(P('EMP-OMAR').levels['A-2'].source, 'verified');
});

test('matrix: rows, required columns, coverage and people without a role (hand-calculated)', () => {
  const m = C.buildMatrix({ people, roles, departments, competencies: comps });
  assert.equal(m.people, 4); assert.equal(m.without_role, 1);
  assert.deepEqual(m.columns.map(c => c.id), ['A-1', 'A-2', 'B-1', 'B-2']);
  const row = k => m.rows.find(r => r.person.key === k);
  assert.deepEqual(row('EMP-SARA').summary, { required: 3, met: 1, gaps: 2, total_gap: 2, critical: 0, no_evidence: 1, readiness: 33 });
  assert.deepEqual(row('EMP-OMAR').summary, { required: 3, met: 2, gaps: 1, total_gap: 2, critical: 1, no_evidence: 0, readiness: 67 });
  assert.deepEqual(row('EMP-LINA').summary, { required: 3, met: 1, gaps: 2, total_gap: 4, critical: 1, no_evidence: 1, readiness: 33 });
  assert.equal(row('EMP-SARA').cells['B-1'], null, 'not required for the role');
  assert.equal(row('EMP-ZAID').role, null); assert.deepEqual(row('EMP-ZAID').cells, {});
  assert.deepEqual(m.coverage, { 'A-1': { required: 3, met: 2, total_gap: 2 }, 'A-2': { required: 3, met: 1, total_gap: 2 }, 'B-1': { required: 1, met: 0, total_gap: 3 }, 'B-2': { required: 2, met: 1, total_gap: 1 } });
  const f = C.buildMatrix({ people, roles, departments, competencies: comps, filter: { role_id: 'R-MGR', domain: 'B' } });
  assert.equal(f.rows.length, 1); assert.deepEqual(f.columns.map(c => c.id), ['B-1']);
});

test('single points of failure: a required competency reached by fewer people than the threshold', () => {
  /* D-1 needs max(R-ENG, R-MGR): A-1 4 · A-2 3 · B-1 3 · B-2 1. Holders: A-1 → Lina; A-2 → nobody; B-1 → nobody; B-2 → Omar. */
  const sp = C.singlePoints({ people, roles, departments, competencies: comps, minHolders: 2 });
  assert.deepEqual(sp.map(s => [s.department_id, s.competency_id, s.required_level, s.count, s.kind]), [['D-1', 'A-2', 3, 0, 'none'], ['D-1', 'B-1', 3, 0, 'none'], ['D-1', 'A-1', 4, 1, 'single'], ['D-1', 'B-2', 1, 1, 'single']]);
  assert.deepEqual(sp.find(s => s.competency_id === 'A-1').holder_names, ['Lina Noor']);
  assert.ok(!sp.some(s => s.department_id === 'D-2'), 'a department with no people is not flagged');
  assert.equal(C.singlePoints({ people, roles, departments, competencies: comps, minHolders: 1 }).length, 2, 'threshold 1 flags only "nobody"');
  const noList = C.singlePoints({ people, roles, departments: [{ id: 'D-1', name: 'Quality', roles: [] }], competencies: comps });
  assert.equal(noList.length, 4, 'without listed roles the roles of its people are used');
});

test('TNA: required − current per person, rolled up per department and company (hand-calculated)', () => {
  const t = C.buildTna({ people, roles, departments, competencies: comps });
  const ind = k => t.individuals.find(i => i.key === k);
  assert.deepEqual(ind('EMP-SARA').needs.map(n => [n.competency_id, n.required, n.current, n.gap, n.source]), [['A-2', 2, 1, 1, 'self'], ['B-2', 1, 0, 1, 'none']]);
  assert.deepEqual(ind('EMP-LINA').needs.map(n => [n.competency_id, n.gap]), [['B-1', 3], ['A-2', 1]], 'ordered by priority value: 3×0.6×0.35 = 0.63 before 1×0.6×0.85 = 0.51');
  assert.equal(ind('EMP-ZAID').needs.length, 0); assert.equal(ind('EMP-ZAID').role_id, null);
  const co = t.company;
  assert.deepEqual({ people: co.people, with_role: co.with_role, without_role: co.without_role, required_cells: co.required_cells, met_cells: co.met_cells, readiness: co.readiness, total_gap: co.total_gap, mean_gap: co.mean_gap, gap_per_person: co.gap_per_person, critical_cells: co.critical_cells, people_with_needs: co.people_with_needs, spof: co.spof },
    { people: 4, with_role: 3, without_role: 1, required_cells: 9, met_cells: 4, readiness: 44, total_gap: 8, mean_gap: 0.89, gap_per_person: 2.67, critical_cells: 2, people_with_needs: 3, spof: 4 });
  const need = id => co.needs.find(n => n.competency_id === id);
  assert.deepEqual([need('A-1').people_affected, need('A-1').total_gap, need('A-1').mean_gap, need('A-1').max_gap], [1, 2, 2, 2]);
  assert.deepEqual([need('A-2').people_affected, need('A-2').total_gap, need('A-2').mean_gap], [2, 2, 1]);
  assert.deepEqual([need('B-1').people_affected, need('B-1').total_gap, need('B-1').no_evidence], [1, 3, 1]);
  assert.deepEqual([need('B-2').people_affected, need('B-2').total_gap], [1, 1]);
  assert.deepEqual(need('A-2').people.map(p => p.name).sort(), ['Lina Noor', 'Sara Ali']);
  const d1 = t.departments.find(d => d.id === 'D-1'); const d2 = t.departments.find(d => d.id === 'D-2');
  assert.deepEqual([d1.people, d1.total_gap, d1.readiness, d1.mean_gap, d1.needs.length, d1.spof], [3, 8, 44, 0.89, 4, 4]);
  assert.deepEqual([d2.people, d2.total_gap, d2.readiness, d2.mean_gap, d2.needs.length], [0, 0, null, null, 0], 'an empty department is listed with zero counts');
  assert.equal(t.unplaced.people, 1); assert.equal(t.unplaced.without_role, 1);
  const empty = C.buildTna({ people: [], roles, departments, competencies: comps });
  assert.equal(empty.company.readiness, null); assert.deepEqual(empty.company.needs, []);
});

test('prioritisation: needs follow the engine severity, then the summed priority value', () => {
  const t = C.buildTna({ people, roles, departments, competencies: comps });
  const order = t.company.needs.map(n => [n.competency_id, n.priority, n.priority_value]);
  /* A-1: Omar 2×0.6×0.55 = 0.66 · B-1: Lina 3×0.6×0.35 = 0.63 · A-2: Sara 1×0.4×0.55 = 0.22 + Lina 1×0.6×0.85 = 0.51 → 0.73 · B-2: Sara 1×0.2×0.35 = 0.07 */
  assert.deepEqual(order, [['A-2', 'Low', 0.73], ['A-1', 'Low', 0.66], ['B-1', 'Low', 0.63], ['B-2', 'Low', 0.07]]);
  const hot = C.buildTna({ people: [{ ...P('EMP-OMAR'), levels: { 'A-1': { level: 0, source: 'none' } }, role_id: 'R-BIG' }], roles: [{ id: 'R-BIG', name: 'Big', targets: { 'A-1': 5, 'A-2': 5 } }], departments, competencies: comps });
  assert.deepEqual(hot.company.needs.map(n => n.priority), ['Medium', 'Medium']);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(i => C.planQuarter(i, 8)), ['Q1', 'Q1', 'Q2', 'Q2', 'Q3', 'Q3', 'Q4', 'Q4']);
  assert.equal(C.planQuarter(0, 1), 'Q1'); assert.equal(C.planQuarter(2, 3), 'Q3');
});

const courses = [{ id: 'C-A1', slug: 'c-a1', title: { en: 'A1 basics', ar: 'أساسيات' }, level: 1, training_hours: 6, competency_mappings: [{ competency: 'A-1' }, { competency: 'A-2' }] }, { id: 'C-A1X', slug: 'c-a1x', title: { en: 'A1 advanced', ar: 'متقدم' }, level: 3, training_hours: 4, competency_mappings: [{ competency: 'A-1' }] }];
const labs = [{ id: 'L-B1', slug: 'l-b1', title: { en: 'B1 lab', ar: 'مختبر' }, minutes: 45, competencies: ['B-1', 'A-1'] }];

test('annual plan: one line per need with suggestions, hours, quarters, overrides and totals', () => {
  const tna = C.buildTna({ people, roles, departments, competencies: comps });
  const plan = C.annualPlan({ tna, competencies: comps, departments, courses, labs, year: 2027 });
  assert.deepEqual(plan.rows.map(r => [r.competency_id, r.quarter, r.people_affected, r.course?.id || null, r.lab?.id || null, r.hours_per_person, r.total_hours]),
    [['A-2', 'Q1', 2, 'C-A1', null, 6, 12], ['A-1', 'Q2', 1, 'C-A1', 'L-B1', 6.75, 6.75], ['B-1', 'Q3', 1, null, 'L-B1', 0.75, 0.75], ['B-2', 'Q4', 1, null, null, 0, 0]]);
  assert.deepEqual(plan.totals, { lines: 4, skipped: 0, hours: 19.5, seats: 5, unmatched: 1, by_quarter: { Q1: { lines: 1, hours: 12 }, Q2: { lines: 1, hours: 6.75 }, Q3: { lines: 1, hours: 0.75 }, Q4: { lines: 0 + 1, hours: 0 } } });
  const moved = C.annualPlan({ tna, competencies: comps, departments, courses, labs, year: 2027, overrides: { 'A-2': { quarter: 'Q4' }, 'B-2': { skip: true }, 'A-1': { quarter: 'Q9' } } });
  assert.equal(moved.rows[0].quarter, 'Q4'); assert.equal(moved.rows[0].moved, true); assert.equal(moved.rows[1].quarter, 'Q2', 'an unknown quarter is ignored');
  assert.deepEqual([moved.totals.lines, moved.totals.skipped, moved.totals.by_quarter.Q4.hours, moved.totals.by_quarter.Q1.lines], [3, 1, 12, 0]);
  assert.equal(C.suggestFor('A-1', { courses, labs }).course.id, 'C-A1', 'lowest level first');
  assert.deepEqual(C.suggestFor('ZZ', { courses, labs }), { course: null, lab: null });
});

test('exports: CSV, Excel XML and Word escape their syntax, keep Arabic and neutralise formulas', () => {
  const evil = C.peopleFrom([read(mk('EMP-EVIL', '=HYPERLINK("http://x","y")', [{ id: 'A-1', level: 1, source: 'self' }])).share, read(mk('EMP-AR', 'سارة <b>علي</b> & "ابن"', [{ id: 'A-1', level: 1, source: 'self' }])).share],
    [{ id: 'EMP-EVIL', department_id: 'D-1', role_id: 'R-ENG' }, { id: 'EMP-AR', department_id: 'D-1', role_id: 'R-ENG' }], TODAY);
  const deps = [{ id: 'D-1', name: '+Quality, "A"', roles: ['R-ENG'] }];
  const tna = C.buildTna({ people: evil, roles, departments: deps, competencies: comps });
  const plan = C.annualPlan({ tna, competencies: comps, departments: deps, courses, labs, year: 2027 });
  const labels = (k, p) => k + (p ? ':' + Object.values(p).join('|') : '');
  const doc = C.planDocument(plan, { company: { name: '@شركة الجودة', sector: '-cmd' }, tna, lang: 'ar', labels, today: TODAY });
  assert.equal(doc.dir, 'rtl'); assert.equal(doc.table.columns.length, 11); assert.equal(doc.table.rows.length, 3);
  assert.equal(doc.label, C.COMPANY_LABEL.ar);
  const csv = C.planCsv(doc);
  assert.ok(csv.startsWith('﻿')); assert.ok(csv.includes('\r\n'));
  assert.ok(csv.includes("'=HYPERLINK") && !/(^|,)=HYPERLINK/m.test(csv), 'a name starting with = is neutralised');
  assert.ok(csv.includes("'@شركة الجودة") && csv.includes("'-cmd") && csv.includes('"\'+Quality, ""A"""'), 'leading @ - + are neutralised and quotes doubled');
  assert.ok(csv.includes('سارة <b>علي</b> & ""ابن""'));
  const xls = C.planSpreadsheet(doc);
  assert.ok(xls.includes('<DisplayRightToLeft/>') && xls.includes('سارة &lt;b&gt;علي&lt;/b&gt; &amp; &quot;ابن&quot;') && xls.includes('&apos;=HYPERLINK') && !xls.includes('<b>'));
  const word = C.planWord(doc);
  assert.ok(word.includes('dir="rtl"') && word.includes('&lt;b&gt;علي') && !word.includes('<b>علي'));
  const m = C.buildMatrix({ people: evil, roles, departments: deps, competencies: comps });
  const mcsv = C.matrixCsv(m, { labels, lang: 'ar' });
  assert.ok(mcsv.includes("'=HYPERLINK") && mcsv.includes('A-1 كفاءة 1') && mcsv.includes('1/3 src.self') && mcsv.includes('0/2 src.none'));
  const en = C.planDocument(plan, { company: { name: 'Acme' }, tna, lang: 'en', labels });
  assert.equal(en.dir, 'ltr'); assert.equal(en.label, C.COMPANY_LABEL.en);
});

const catalog = { course: courses, lab: labs, assessment: [{ id: 'ASM-1', slug: 'asm-1', title: { en: 'Quiz', ar: 'اختبار' } }], route: [{ id: 'PATH-1', title: { en: 'Route', ar: 'مسار' }, steps: [{ type: 'course', target_id: 'C-A1' }, { type: 'assessment', target_id: 'ASM-1' }, { type: 'knowledge', target_id: 'KA-1' }] }] };

test('assignments: validation, audience expansion and the file one employee imports', () => {
  const ctx = { catalog, people, departments, today: TODAY };
  assert.deepEqual(Object.keys(C.validateAssignment({}, ctx).errors).sort(), ['audience', 'due', 'type']);
  assert.equal(C.validateAssignment({ type: 'course', target_id: 'NOPE', due: '2026-12-01', audience: { type: 'person', id: 'EMP-SARA' } }, ctx).errors.target_id, 'required');
  assert.equal(C.validateAssignment({ type: 'course', target_id: 'C-A1', due: '2026-11-11', audience: { type: 'person', id: 'EMP-SARA' } }, ctx).errors.due, 'past');
  assert.equal(C.validateAssignment({ type: 'course', target_id: 'C-A1', due: '2026-02-30', audience: { type: 'person', id: 'EMP-SARA' } }, ctx).errors.due, 'invalid');
  assert.equal(C.validateAssignment({ type: 'course', target_id: 'C-A1', due: '2026-12-01', audience: { type: 'department', id: 'D-2' } }, ctx).errors.audience, 'empty');
  const one = C.makeAssignment(C.validateAssignment({ type: 'lab', target_id: 'L-B1', due: TODAY, note: ' Before the audit ', audience: { type: 'person', id: 'EMP-SARA' } }, ctx).value, { id: 'ASG-1', now: '2026-11-12T09:00:00Z' });
  assert.deepEqual([one.assignees, one.href, one.hours, one.note, one.schema], [['EMP-SARA'], '#/labs/l-b1', 0.75, 'Before the audit', 'cia.assignment.v1']);
  const dep = C.makeAssignment(C.validateAssignment({ type: 'course', target_id: 'C-A1', due: '2026-12-20', audience: { type: 'department', id: 'D-1' } }, ctx).value, { id: 'ASG-2', now: '2026-11-12T09:00:00Z' });
  assert.deepEqual(dep.assignees.sort(), ['EMP-LINA', 'EMP-OMAR', 'EMP-SARA']);
  const file = C.assignmentFile({ company: { name: 'Acme', admin_name: 'HR' }, person: P('EMP-SARA'), assignments: [one, dep, { ...dep, id: 'ASG-3', cancelled: true }], batchId: 'BAT-1', now: '2026-11-12T09:00:00Z' });
  assert.deepEqual(file.items.map(i => i.id), ['ASG-1', 'ASG-2']); assert.equal(file.employee.key, 'EMP-SARA'); assert.equal(file.schema, 'cia.assignment.v1');
  assert.deepEqual(C.assignmentFile({ person: P('EMP-ZAID'), assignments: [one, dep], batchId: 'B' }).items, []);
});

test('assignment file import: refuses foreign, damaged and misaddressed files; never overwrites; skips unknown targets', () => {
  const dep = { id: 'ASG-2', type: 'course', target_id: 'C-A1', title: { en: 'A1', ar: 'أ' }, due: '2026-12-20', assignees: ['EMP-SARA'], created_at: '2026-11-12T09:00:00Z' };
  const file = C.assignmentFile({ company: { name: 'Acme' }, person: P('EMP-SARA'), assignments: [dep, { ...dep, id: 'ASG-9', target_id: 'C-DRAFT' }, { ...dep, id: 'ASG-8', type: 'lab', target_id: 'L-B1' }], batchId: 'BAT-1', now: '2026-11-12T09:00:00Z' });
  const known = { course: ['C-A1'], lab: new Set(['L-B1']), assessment: [], route: [] };
  const rd = (f, o = {}) => C.readAssignmentFile(JSON.stringify(f), { myKey: 'EMP-SARA', existing: [], known, today: TODAY, ...o });
  assert.equal(C.readAssignmentFile('nope', {}).err, 'json');
  assert.equal(rd(files[0]).err, 'schema', 'a passport share is not an assignment file');
  assert.equal(rd({ ...file, items: [] }).err, 'digest');
  assert.equal(rd(file, { myKey: 'EMP-OMAR' }).err, 'other_person');
  assert.equal(rd(file, { today: '2026-11-01' }).err, 'date');
  const ok = rd(file);
  assert.deepEqual(ok.add.map(a => a.id), ['ASG-2', 'ASG-8']); assert.deepEqual(ok.skipped, { duplicate: 0, unknown: 1, invalid: 0 }); assert.equal(ok.add[0].company, 'Acme');
  assert.deepEqual(rd(file, { existing: ok.add }).skipped, { duplicate: 2, unknown: 1, invalid: 0 });
  assert.equal(rd(file, { existing: ok.add }).add.length, 0);
  assert.equal(rd(file, { myKey: null }).ok, true, 'a device that never shared has no key to compare');
});

test('assignment lifecycle: progress on the employee device, due states, and status back in the next share', () => {
  const course = { id: 'C-A1', modules: [{ lessons: [{ id: 'L1' }, { id: 'L2' }] }], assessments: { final: 'ASM-1' } };
  const facts = { courses: [course], progress: [{ id: 'C-A1', completed_lessons: ['L1'], updated_at: '2026-11-20T10:00:00Z' }], attempts: [], labs, labAttempts: [], routes: catalog.route, completedIds: [] };
  const it = { id: 'ASG-2', type: 'course', target_id: 'C-A1', due: '2026-12-20' };
  assert.deepEqual(C.assignmentProgress(it, facts), { state: 'in_progress', percent: 50, completed_at: null });
  const done = { ...facts, progress: [{ id: 'C-A1', completed_lessons: ['L1', 'L2'], updated_at: '2026-11-25T10:00:00Z' }], attempts: [{ assessment_id: 'ASM-1', passed: true, submitted_at: '2026-11-25T11:00:00Z', score: 90 }] };
  assert.deepEqual(C.assignmentProgress(it, done), { state: 'completed', percent: 100, completed_at: '2026-11-25' });
  assert.equal(C.assignmentProgress({ type: 'assessment', target_id: 'ASM-1' }, { attempts: [{ assessment_id: 'ASM-1', passed: false, score: 40, submitted_at: 'a' }] }).state, 'in_progress');
  assert.deepEqual(C.assignmentProgress({ type: 'assessment', target_id: 'ASM-1' }, done), { state: 'completed', percent: 100, completed_at: '2026-11-25' });
  assert.equal(C.assignmentProgress({ type: 'lab', target_id: 'L-B1' }, { labAttempts: [{ lab_id: 'L-B1', attempt_no: 1, score: 55, mark_met: false }] }).state, 'in_progress');
  assert.equal(C.assignmentProgress({ type: 'lab', target_id: 'L-B1' }, { labAttempts: [{ lab_id: 'L-B1', attempt_no: 2, score: 80, mark_met: true, submitted_at: '2026-11-30T08:00:00Z' }] }).completed_at, '2026-11-30');
  assert.deepEqual(C.assignmentProgress({ type: 'route', target_id: 'PATH-1' }, { routes: catalog.route, completedIds: ['C-A1'] }), { state: 'in_progress', percent: 50, completed_at: null });
  assert.equal(C.assignmentProgress({ type: 'route', target_id: 'PATH-1' }, { routes: catalog.route, completedIds: ['C-A1', 'ASM-1'] }).state, 'completed');
  assert.equal(C.assignmentProgress({ type: 'course', target_id: 'GONE' }, facts).state, 'not_started');
  assert.equal(C.dueState('2026-11-11', 'in_progress', TODAY), 'overdue'); assert.equal(C.dueState('2026-11-12', 'not_started', TODAY), 'due_soon');
  assert.equal(C.dueState('2026-11-26', 'not_started', TODAY), 'due_soon'); assert.equal(C.dueState('2026-11-27', 'not_started', TODAY), 'open');
  assert.equal(C.dueState('2026-01-01', 'completed', TODAY), 'completed'); assert.equal(C.daysLeft('2026-11-10', TODAY), -2);
  /* administrator side */
  const asg = { id: 'ASG-2', due: '2026-12-20', assignees: ['EMP-SARA', 'EMP-OMAR', 'EMP-GONE'], cancelled: false };
  const before = C.assignmentStatus(asg, people, TODAY);
  assert.deepEqual(before.rows.map(r => [r.key, r.state, r.awaiting, r.due_state]), [['EMP-SARA', 'not_started', true, 'open'], ['EMP-OMAR', 'not_started', true, 'open'], ['EMP-GONE', 'not_started', true, 'open']]);
  assert.equal(before.rows[2].withdrawn, true); assert.equal(before.awaiting, 3);
  const next = read(mk('EMP-SARA', 'Sara Ali', [], { parts: ['assignments'], now: '2026-11-12T08:00:00.000Z', id: 'SHR-NEXT', extra: { assignments: C.shareAssignments([it], done) } })).share;
  const after = C.assignmentStatus(asg, C.peopleFrom([...shares, next], placements, TODAY), TODAY);
  assert.deepEqual([after.rows[0].state, after.rows[0].awaiting, after.rows[0].due_state, after.rows[0].completed_at], ['completed', false, 'completed', '2026-11-25']);
  assert.deepEqual([after.completed, after.open, after.due_state], [1, 2, 'open']);
  assert.equal(C.assignmentStatus({ ...asg, due: '2026-11-01' }, people, TODAY).due_state, 'overdue');
  assert.equal(C.assignmentStatus({ ...asg, assignees: ['EMP-SARA'] }, C.peopleFrom([...shares, next], placements, TODAY), TODAY).due_state, 'completed');
  const csv = C.trackerCsv([{ ...asg, type: 'course', title: { en: '=A1', ar: 'أ' } }], people, { labels: k => k, today: TODAY });
  assert.ok(csv.includes("'=A1") && csv.includes('asg.awaiting') && csv.includes('asg.withdrawn'));
});

test('workspace backup: round trip, never overwrites, refuses foreign and damaged files', () => {
  const profile = C.validateCompany({ name: 'Acme' }).value;
  const file = C.exportCompany({ profile, departments, roles: [], placements, shares, assignments: [], plan: { id: 'me', overrides: { 'A-1': { quarter: 'Q2' } } } }, '2026-11-12T09:00:00Z');
  assert.equal(file.schema, 'cia.company.v1');
  const fresh = C.importCompany(JSON.stringify(file), {});
  assert.equal(fresh.ok, true); assert.equal(fresh.profile.name, 'Acme'); assert.equal(fresh.add.shares.length, 4); assert.equal(fresh.add.departments.length, 2); assert.deepEqual(fresh.plan.overrides, { 'A-1': { quarter: 'Q2' } });
  const again = C.importCompany(JSON.stringify(file), { profile, departments, placements, shares, plan: { id: 'me' } });
  assert.equal(again.profile, null); assert.equal(again.plan, null); assert.deepEqual(Object.values(again.add).map(x => x.length), [0, 0, 0, 0, 0]); assert.equal(again.skipped.duplicate, 9);
  assert.equal(C.importCompany(JSON.stringify(files[0]), {}).err, 'schema');
  assert.equal(C.importCompany(JSON.stringify({ ...file, exported_at: 'x' }), {}).err, 'digest');
  assert.equal(C.importCompany('nope', {}).err, 'json');
});

test('sample company: fictional, labelled, passes the same import as a real share, and gives five or more people', () => {
  const ciaRoles = json('data/seed/competency/target-roles.json').items; const competencies = json('data/seed/competency/competencies.json').items;
  const s = C.sampleCompany({ ciaRoles, competencies, today: TODAY });
  assert.ok(s.files.length >= 5); assert.equal(s.profile.sample, true); assert.ok(s.departments.every(d => d.sample && /sample/i.test(d.name)));
  const got = []; for (const f of s.files) { const o = C.readShare(JSON.stringify(f), { competencyIds: competencies.map(c => c.id), existingIds: got.map(x => x.id), today: TODAY }); assert.equal(o.ok, true, f.share_id); assert.equal(o.share.sample, true); assert.match(o.share.name, /^Sample/); got.push(o.share); }
  const ps = C.peopleFrom(got, s.placements, TODAY);
  const t = C.buildTna({ people: ps, roles: ciaRoles, departments: s.departments, competencies });
  assert.equal(t.company.with_role, s.files.length); assert.ok(t.company.readiness > 0 && t.company.readiness < 100); assert.ok(t.company.needs.length > 0 && t.spof.length > 0);
  assert.ok(ps.some(p => p.stale), 'one sample share is old, to show the freshness flag');
});

test('registry and roles: five top items, menu limits unchanged, the workspace is an account-menu entry for company roles only', () => {
  const nav = json('data/seed/navigation.json').items;
  assert.deepEqual(validateRegistry(nav), []);
  assert.equal(nav.filter(e => e.placement === 'top').length, MAX_TOP);
  assert.ok(shellEntries(nav, ['learner'], 'menu').length <= MAX_MENU);
  assert.equal(shellEntries(nav, ['learner'], 'menu').length, 7, 'the learner menu did not grow');
  const co = nav.find(e => e.id === 'company');
  assert.deepEqual([co.status, co.placement, co.route, co.phase, co.roles], ['active', 'user', '/company', '12A', ['company_admin', 'admin']]);
  assert.equal(json('data/seed/roles.json').items.find(r => r.id === 'company_admin').placeholder, false);
  const main = text('src/main.js');
  assert.match(main, /path: '\/company', view: companyView, titleKey: 'co12a\.title', roles: \['company_admin', 'admin'\]/);
  assert.match(main, /path: '\/company\/plan'.*roles: \['company_admin', 'admin'\]/);
  for (const c of ['company_profile', 'company_departments', 'company_roles', 'company_people', 'company_shares', 'company_assignments', 'company_plan', 'passport_shares', 'assignments_inbox']) assert.ok(main.includes(`collection: '${c}'`), c);
});

test('figures and strings: governed drafts with placements; co12a complete in both languages, explicit consent, no claims', () => {
  const figs = json('data/seed/figures.json').items.filter(f => f.owner_phase === '12A');
  assert.equal(figs.length, 4);
  for (const f of figs) { assert.ok(['cycle', 'flow', 'ladder'].includes(f.template), f.id); assert.ok(f.caption.en && f.caption.ar && f.read.en && f.read.ar, f.id); assert.ok(['needs_review', 'published'].includes(f.governance.content_status), f.id); }
  const map = new Map(json('data/seed/lesson-figures.json').items.map(x => [x.id, x.figures]));
  for (const k of ['company:main', 'company:share', 'company:matrix', 'company:tna']) assert.ok(map.get(k)?.every(id => figs.some(f => f.id === id)), k);
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]));
  const en = Object.fromEntries(flat(json('data/i18n/en.json').co12a)); const ar = Object.fromEntries(flat(json('data/i18n/ar.json').co12a));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  const ph = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join();
  for (const k of Object.keys(en)) { assert.ok(String(ar[k]).trim(), k); assert.equal(ph(en[k]), ph(ar[k]), k); assert.doesNotMatch(String(en[k]), /\bPhase\b/, k); }
  const used = new Set();
  for (const f of ['src/views/company.js', 'src/views/company-share.js', 'src/views/myspace.js', 'src/views/passport.js']) for (const m of text(f).matchAll(/t\('co12a\.([A-Za-z0-9_.]+)'/g)) used.add(m[1]);
  for (const m of text('src/domain/company.mjs').matchAll(/labels\('([A-Za-z0-9_.]+)'/g)) used.add(m[1]);
  for (const k of used) assert.ok(k.endsWith('.') || k.endsWith('_') || k === 'people.ask' ? Object.keys(en).some(x => x.startsWith(k)) : k in en, 'missing string co12a.' + k);
  for (const s of [...C.SHARE_PARTS.map(p => 'share.part.' + p), ...C.LEVEL_SOURCES.flatMap(x => ['src.' + x, 'srcLong.' + x]), ...C.DUE_STATES.map(x => 'asg.due.' + x), ...C.ASSIGNMENT_TYPES.map(x => 'asg.type.' + x), ...C.PROGRESS_STATES.map(x => 'asg.state.' + x)]) assert.ok(en[s], s);
  const claim = /(accredited|accreditation|\bPDU\b|\bRU\b|recognised CPD|CPD provider|verified by CIA|certified by CIA|certif(y|ies) (employees|companies|your)|EFQM assessment|audit certification)/i;
  for (const [k, v] of [...Object.entries(en), ['COMPANY_LABEL', C.COMPANY_LABEL.en], ['SHARE_LABEL', C.SHARE_LABEL.en], ['CONSENT', C.CONSENT_TEXT.en]]) for (const m of String(v).matchAll(new RegExp(claim, 'gi')))
    assert.match(String(v).slice(Math.max(0, m.index - 90), m.index + m[0].length), /\b(not|no|never|nor|neither|without)\b/i, `${k}: unnegated claim “${m[0]}”`);
  assert.match(C.COMPANY_LABEL.en, /not a performance appraisal and not a hiring decision/); assert.match(C.COMPANY_LABEL.ar, /ليست تقييم أداء ولا قرار توظيف/);
});
