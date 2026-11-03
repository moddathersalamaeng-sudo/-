/** Phase 8 — PMI / PMO / P3O Academy: completeness contract, practice guides, certification explorer, routes and scenarios A–I. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, isPhase8, governedPhase8 } from './_util.mjs';
import { validateCourse, courseCompleteness } from '../../src/domain/courses.mjs';
import { validateAssessment, validateQuestion } from '../../src/domain/assessments.mjs';
import { validateGuide, guideItems, findItem, danglingCrossLinks, itemTeachable, guideTabs, ladderRung, GUIDE_KINDS } from '../../src/domain/guides.mjs';
import { pmiStartingPoint, pmIntent, validateCertification, certFactState, domainHours, studyWeeks, PM_ROUTES, PM_ROLE_ROUTE } from '../../src/domain/pmi.mjs';
import { assessmentEvidence, masteredCompetencies } from '../../src/domain/learner-model.mjs';
import { calculateGaps, generateRecommendations, buildLearningPath, suppressDemonstrated } from '../../src/domain/recommendations.mjs';
import { validateGovernance, isVisible } from '../../src/data/governance.js';

const seed = n => json(`data/seed/${n}.json`).items;
const courses = seed('courses'), questions = seed('questions'), assessments = seed('assessments'), paths = seed('learning-paths'), catalog = seed('recommendation-catalog');
const certs = seed('certifications'), sources = seed('sources'), nav = seed('navigation'), rels = seed('relationships');
const comps = json('data/seed/competency/competencies.json').items, roles = json('data/seed/competency/target-roles.json').items;
const index = json('data/guides/index.json').items;
const guides = Object.fromEntries(index.map(g => [g.slug, json(`data/guides/${g.slug}.json`).guide]));
const qIds = questions.map(q => q.id), aIds = assessments.map(a => a.id);
const byId = (list, id) => list.find(x => x.id === id);
const PM_COURSES = ['CRS-PM-101', 'CRS-PM-SSC', 'CRS-PM-RISK', 'CRS-PM-STAKE', 'CRS-PMO-DESIGN', 'CRS-PMO-KPI', 'CRS-PFM-PRIOR', 'CRS-P3O-101', 'CRS-PM-AGILE', 'CRS-PMP-PREP'];
const hand = PM_COURSES.map(id => byId(courses, id));
const practiceGuides = index.filter(g => g.kind === 'practice');
const genP = courses.filter(c => /^CRS-P-/.test(c.id));

test('Phase 8 hand-authored courses: ten, each meets the Phase 7 completeness contract, bilingual and validated', () => {
  assert.equal(hand.filter(Boolean).length, 10);
  for (const c of hand) {
    assert.deepEqual(validateCourse(c), [], c.id);
    assert.deepEqual(courseCompleteness(c, { questionIds: qIds, assessmentIds: aIds }), [], c.id);
    for (const l of c.modules.flatMap(m => m.lessons)) {
      const q = byId(questions, l.check_question_id);
      assert.deepEqual(validateQuestion(q), [], q.id);
      assert.equal(q.options.length, 4, q.id);
      assert.ok(q.options.every(o => o.why?.en && o.why?.ar), `${q.id}: rationale per option`);
    }
    for (const k of ['quiz', 'final', 'practical']) assert.deepEqual(validateAssessment(byId(assessments, c.assessments[k]), qIds), [], c.assessments[k]);
  }
});

test('replaced shells: CRS-PM-101 and CRS-P3O-101 are full courses; CRS-QMS-201 and CRS-EFQM-101 wait for Phases 9 and 10', () => {
  for (const id of ['CRS-PM-101', 'CRS-P3O-101']) assert.ok(byId(courses, id).modules.flatMap(m => m.lessons).every(l => l.content_blocks?.length === 5), id);
  assert.equal(byId(courses, 'CRS-QMS-201').planned_phase, 9);
  assert.equal(byId(courses, 'CRS-EFQM-101').planned_phase, 10);
  for (const id of ['CRS-QMS-201', 'CRS-EFQM-101']) assert.equal(isVisible(byId(courses, id), ['learner']), false, id);
});

test('labels and claims: internal or exam-prep label only, nothing claimed, completion is not a credential', () => {
  const CLAIM = /\b(PMI[- ]approved|PMI[- ]endorsed|Authori[sz]ed Training Partner|Registered Education Provider)\b/i;
  for (const c of [...hand, ...genP]) {
    assert.equal(c.external_accreditation_status, 'not_claimed', c.id);
    assert.equal(c.cpd_status, 'not_claimed', c.id);
    assert.equal(c.certificate_type, 'completion', c.id);
    assert.ok(['CIA INTERNAL COURSE', 'EXAM PREPARATION COURSE'].includes(c.status_label), c.id);
    const txt = JSON.stringify([c.title, c.overview, c.why_it_matters, c.professional_relevance, c.passing_criteria]);
    for (const m of txt.matchAll(new RegExp(CLAIM, 'gi'))) {
      const win = txt.slice(Math.max(0, m.index - 60), m.index);
      assert.match(win, /\bnot\b|\bno\b|isn't|ليست|غير/i, `${c.id}: positive claim “${m[0]}”`);
    }
  }
  const prep = byId(courses, 'CRS-PMP-PREP');
  assert.equal(prep.status_label, 'EXAM PREPARATION COURSE');
  assert.match(prep.passing_criteria.en, /does not award a PMI credential, PDUs/);
  assert.match(prep.overview.en, /not a PMI Authorized Training Partner/);
  assert.match(prep.overview.en, /does not reproduce PMBOK® Guide text or PMI exam questions/);
});

test('practice guides: four valid guides, every item teachable, dependencies and cross-guide links resolve, counts match the index', () => {
  assert.deepEqual(practiceGuides.map(g => g.slug).sort(), ['iso-21500', 'p3m3', 'p3o', 'pmo-excellence']);
  assert.ok(GUIDE_KINDS.includes('practice'));
  const known = Object.fromEntries(Object.entries(guides).map(([s, g]) => [s, new Set(guideItems(g).map(i => i.ref))]));
  for (const rec of practiceGuides) {
    const g = guides[rec.slug];
    assert.deepEqual(validateGuide(g), [], rec.slug);
    assert.deepEqual(danglingCrossLinks(g, known), [], rec.slug);
    assert.equal(guideItems(g).length, rec.counts.items, rec.slug);
    for (const i of guideItems(g)) assert.ok(itemTeachable(i, 'practice'), `${rec.slug} ${i.ref}`);
    for (const t of ['items', 'terms', 'faq', 'templates']) assert.ok(guideTabs(g).includes(t), `${rec.slug}: tab ${t}`);
    assert.equal(rec.governance.content_source, 'owner'); assert.equal(rec.governance.reviewer, 'Owner publication (live toolkit)');
  }
  assert.equal(guideItems(guides['iso-21500']).length, 58);
  assert.equal(guideItems(guides.p3o).length, 42);
  assert.equal(guideItems(guides['pmo-excellence']).length, 42);
  const p3m3 = guides.p3m3;
  assert.equal(guideItems(p3m3).length, 7);
  for (const i of guideItems(p3m3)) { assert.equal(i.questions.length, 4, i.ref); for (const q of i.questions) assert.deepEqual(q.levels.map(l => l.level), [2, 3, 4, 5]); assert.ok(!/\{x1?\}/.test(JSON.stringify(i)), `${i.ref}: placeholder left`); }
  assert.ok(guideItems(guides['pmo-excellence']).every(i => i.cross.length > 0), 'every excellence practice links to the three lenses');
  assert.deepEqual(['lowest', 'middle', 'highest'], [0, 1, 2].map(k => ladderRung(k, 3)));
});

test('practice guide validation catches broken records', () => {
  const g = structuredClone(guides.p3o);
  g.clauses[0].items[0].ev = [];
  g.clauses[0].items[1].links.in.push({ ref: 'nope', why: { en: '', ar: '' } });
  const e = validateGuide(g);
  assert.ok(e.some(x => x.startsWith('incomplete_item:')) && e.some(x => x.startsWith('dangling_link:')), e.join());
  assert.deepEqual(danglingCrossLinks({ clauses: [{ items: [{ ref: 'a', cross: [{ guide: 'p3o', ref: 'zz' }] }] }] }, { p3o: new Set(['v.case']) }), ['a->p3o#zz']);
});

test('guide courses from the practice guides: generated, needs review, one lesson per item, key from the item actions', () => {
  assert.equal(genP.length, 4);
  for (const c of genP) {
    const g = guides[c.guide];
    assert.equal(c.modules.flatMap(m => m.lessons).length, guideItems(g).length, c.id);
    governedPhase8(assert, c, 'system');
    for (const l of c.modules.flatMap(m => m.lessons)) {
      const q = byId(questions, l.check_question_id), it = findItem(g, l.source.ref);
      const key = q.options.find(o => o.id === q.correct_answer).text.en;
      assert.ok(it.how.some(x => x.en === key), `${q.id}: key from the item`);
      for (const o of q.options.filter(o => o.id !== q.correct_answer)) assert.ok(!it.how.some(x => x.en === o.text.en), `${q.id}: distractor is also an action`);
    }
  }
});

test('certification explorer: eight PMI certifications, valid, dated, sourced on pmi.org pages, pending facts carry no figures', () => {
  assert.equal(certs.length, 8);
  assert.deepEqual(certs.map(c => c.code.replace(/[®™]/g, '')).sort(), ['CAPM', 'PMI-ACP', 'PMI-PBA', 'PMI-PMOCP', 'PMI-RMP', 'PMP', 'PfMP', 'PgMP'].sort());
  const srcIds = new Set(sources.map(s => s.id));
  for (const c of certs) {
    assert.deepEqual(validateCertification(c), [], c.id);
    assert.deepEqual(validateGovernance(c), [], c.id);
    for (const s of c.source_ids) { assert.ok(srcIds.has(s), `${c.id}: ${s}`); assert.equal(byId(sources, s).verification_status, 'verified_by_lookup'); }
    for (const id of c.cia_courses) assert.ok(byId(courses, id), `${c.id}: ${id}`);
    for (const id of c.cia_routes) assert.ok(byId(paths, id), `${c.id}: ${id}`);
    assert.match(c.claims.en, /not a PMI Authorized Training Partner/);
    assert.match(c.claims.en, /do not award PDUs/);
  }
  const pmp = byId(certs, 'CERT-PMP');
  assert.deepEqual(pmp.domains.map(d => d.weight), [33, 41, 26]);
  assert.equal(pmp.exam.questions, 180); assert.equal(pmp.exam.minutes, 240);
  assert.deepEqual([pmp.fee.member, pmp.fee.non_member], [405, 555]);
  assert.equal(certFactState(pmp).renewal, 'pending'); assert.equal(pmp.renewal, null);
  assert.equal(certFactState(byId(certs, 'CERT-PGMP')).exam, 'pending');
  const bad = structuredClone(pmp); bad.facts_status.fee = 'pending';
  assert.ok(validateCertification(bad).includes('pending_fee_has_figures'));
  bad.official_url = 'https://example.com/pmp';
  assert.ok(validateCertification(bad).includes('official_url_not_pmi'));
});

test('routes: five PM routes, steps resolve, skip_if_mastered uses real competencies, navigation enables PMI Academy and Certification', () => {
  const pm = paths.filter(p => p.kind === 'pm_route');
  assert.deepEqual(pm.map(p => p.id).sort(), [...PM_ROUTES].sort());
  const compIds = new Set(comps.map(c => c.id)), visible = new Set([...courses, ...assessments].map(x => x.id));
  for (const p of pm) {
    for (const s of p.steps) {
      assert.ok(visible.has(s.target_id) || /^KA-/.test(s.target_id), `${p.id}: ${s.target_id}`);
      for (const c of s.skip_if_mastered || []) assert.ok(compIds.has(c), `${p.id}: ${c}`);
    }
    for (const c of p.certification_ids) assert.ok(byId(certs, c), c);
  }
  assert.equal(byId(paths, 'PATH-PMO').superseded_by, 'ROUTE-PMO');
  const cert = nav.find(n => n.id === 'certification'), pmi = nav.find(n => n.id === 'pmiAcademy');
  assert.equal(cert.status, 'active'); assert.equal(cert.route, '/academy/pmi/certifications');
  assert.equal(pmi.route, '/academy/pmi'); assert.equal(pmi.phase, 8);
  assert.equal(PM_ROLE_ROUTE['ROLE-PMOA'], 'ROUTE-PMO');
  assert.ok(byId(roles, 'ROLE-PM'), 'Project Manager role added for the framework gap');
  assert.equal(byId(roles, 'ROLE-PM').governance.content_status === 'needs_review' || byId(roles, 'ROLE-PM').governance.content_status === 'published', true);
});

test('relationships: courses prepare for certifications; diagnostics assess competencies', () => {
  assert.ok(rels.some(r => r.fromId === 'CRS-PMP-PREP' && r.relation === 'prepares_for' && r.toId === 'CERT-PMP'));
  assert.ok(rels.some(r => r.fromId === 'ASM-READY-PM-001' && r.relation === 'assesses'));
});

/* ------------------------------------------------------------------ acceptance scenarios (like Phase 7 A–I) */
const at = n => `2026-11-0${n}T10:00:00Z`;
const attempt = (aid, breakdown, n = 1) => ({ assessment_id: aid, submitted_at: at(n), passed: false, competency_breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, { earned: v, max: 100, percent: v, unknown: 0, items: 2 }])) });
const ev = attempts => assessmentEvidence(attempts);
const sp = (profile, attempts = [], completed = []) => pmiStartingPoint({ profile, evidence: ev(attempts), completed });
const route = (id, attempts = [], completed = []) => buildLearningPath(structuredClone(byId(paths, id)), { completedIds: completed, mastered: masteredCompetencies(ev(attempts)) });
const stepOf = (p, id) => p.steps.find(s => s.target_id === id);
const STRONG = { 'PM-01': 85, 'PM-02': 80, 'PM-03': 75 };

test('A: no profile → explore the fundamentals (no guessing)', () => {
  const r = sp(null); assert.equal(r.key, 'explore'); assert.equal(r.target_id, 'KA-011');
});
test('B: a profile without assessment evidence → the PM readiness diagnostic, even with 15 years of experience', () => {
  const r = sp({ target_role: 'ROLE-PM', years_experience: 15 });
  assert.equal(r.key, 'assess'); assert.equal(r.href, '#/assessments/pm-readiness');
});
test('C: an experienced project manager who demonstrates the foundations is not sent to foundations', () => {
  const att = [attempt('ASM-READY-PM-001', STRONG)];
  const r = sp({ target_role: 'ROLE-PM', target_certifications: 'PMP' }, att);
  assert.equal(r.key, 'pmp'); assert.notEqual(r.target_id, 'CRS-PM-101');
  const p = route('ROUTE-PMP', att);
  assert.equal(stepOf(p, 'CRS-PM-101').status, 'Skipped'); assert.equal(stepOf(p, 'CRS-PM-101').skip_reason, 'demonstrated');
  assert.notEqual(stepOf(p, 'CRS-PMP-PREP').status, 'Skipped');
});
test('D: weak foundations → Project Management Foundations first, whatever the target', () => {
  const r = sp({ target_role: 'ROLE-PMOA' }, [attempt('ASM-READY-PM-001', { 'PM-01': 40, 'PM-02': 75, 'PM-03': 70 })]);
  assert.equal(r.key, 'foundation'); assert.equal(r.target_id, 'CRS-PM-101');
});
test('E: a PMO analyst with demonstrated foundations is routed to PMO design', () => {
  const r = sp({ target_role: 'ROLE-PMOA' }, [attempt('ASM-READY-PM-001', STRONG)]);
  assert.equal(r.key, 'pmo'); assert.equal(r.target_id, 'CRS-PMO-DESIGN'); assert.equal(r.route_id, 'ROUTE-PMO');
});
test('F: a PMO analyst who also demonstrated PMO design continues with maturity and KPIs', () => {
  const att = [attempt('ASM-READY-PM-001', STRONG), attempt('ASM-PM-PMO-DIAG', { 'PMO-01': 82 }, 2)];
  const r = sp({ target_role: 'ROLE-PMOA' }, att);
  assert.equal(r.key, 'pmo_maturity'); assert.equal(r.target_id, 'CRS-PMO-KPI');
  assert.equal(stepOf(route('ROUTE-PMO', att), 'CRS-PMO-DESIGN').status, 'Skipped');
});
test('G: stated portfolio interest → portfolio prioritisation; stated agile interest → agile route', () => {
  assert.equal(sp({ interests: 'portfolio governance, PfMP' }, [attempt('ASM-READY-PM-001', STRONG)]).key, 'portfolio');
  assert.equal(sp({ interests: 'Scrum and agile teams' }, [attempt('ASM-READY-PM-001', STRONG)]).key, 'agile');
  assert.equal(pmIntent({ career_objectives: 'إدارة مكتب المشاريع' }), 'pmo');
});
test('H: recommendations suppress courses whose competencies are demonstrated', () => {
  const att = [attempt('ASM-READY-PM-001', { ...STRONG, 'RSK-01': 90, 'RSK-02': 88 })];
  const mastered = masteredCompetencies(ev(att));
  const profile = { target_role: 'ROLE-PM' };
  const gaps = calculateGaps({ role: byId(roles, 'ROLE-PM'), competencies: comps, selfLevels: {}, assessmentByCompetency: Object.fromEntries(Object.entries(ev(att)).map(([k, v]) => [k, v.percent])) });
  const recs = suppressDemonstrated(generateRecommendations(catalog, { profile, gaps, completedIds: [], assessmentByCompetency: {} }), mastered);
  for (const id of ['CRS-PM-101', 'CRS-PM-RISK']) assert.ok(!recs.some(r => r.target_id === id), id);
  assert.ok(recs.some(r => r.target_id === 'CRS-PMP-PREP'));
});
test('I: completing the foundations course counts as demonstrated; reading progress alone does not', () => {
  assert.equal(sp({ target_role: 'ROLE-PM' }, [], ['CRS-PM-101']).key, 'pmp');
  assert.equal(sp({ target_role: 'ROLE-PM' }, [attempt('ASM-READY-PM-001', { 'PM-01': 72, 'PM-02': 72 })]).key, 'foundation');  // PM-03 not assessed
});

test('calculators: domain hours follow the outline weights and keep a practice reserve; study weeks follow weekly hours', () => {
  const pmp = byId(certs, 'CERT-PMP');
  const p = domainHours(pmp.domains, 120);
  assert.equal(p.practice, 20);
  assert.deepEqual(p.domains.map(d => d.hours), [33, 41, 26]);
  const c = byId(courses, 'CRS-PM-SSC');
  const w4 = studyWeeks(c, 4), w10 = studyWeeks(c, 10);
  assert.ok(w4.length > w10.length);
  assert.equal(w4.flatMap(w => w.items).filter(x => x.id !== 'final').length, 4);
  assert.equal(w4.at(-1).items.at(-1).id, 'final');
  assert.ok(studyWeeks(c, 'abc').length >= 1, 'invalid hours fall back to a default');
});

test('Phase 8 drafts are governed: nothing published without a recorded approval', () => {
  const all = [...courses, ...questions, ...assessments, ...paths.filter(p => p.governance), ...certs, ...sources, ...roles];
  for (const r of all.filter(isPhase8)) governedPhase8(assert, r);
});
