/** Phase 9 — Quality (ASQ-informed) Academy and the visual layer: completeness contract, ASQ explorer facts, CMQ/OE Center
 *  calculations, routes, scenarios A–I for the quality starting point, labels and claims, question quality, figures and covers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, isPhase8, governedPhase8 } from './_util.mjs';
import { validateCourse, courseCompleteness } from '../../src/domain/courses.mjs';
import { validateAssessment, validateQuestion, scoreAttempt } from '../../src/domain/assessments.mjs';
import { validateCertification, certFactState, showsFacts, renewalUnits, domainHours } from '../../src/domain/pmi.mjs';
import { qualityStartingPoint, qualityIntent, Q_ROUTES, Q_ROLE_ROUTE, bokAreaResults, readinessIndex, weightedStudyHours, weakAreas, readinessBand, CMQOE_AREA_COURSES } from '../../src/domain/quality.mjs';
import { lessonFigures, courseFigures, danglingFigureRefs } from '../../src/domain/figures.mjs';
import { validateFigure, figureText, wrap, TEMPLATES } from '../../src/ui/figures.js';
import { familyOf, topicOf, seeded, FAMILIES } from '../../src/ui/art.js';
import { assessmentEvidence, masteredCompetencies } from '../../src/domain/learner-model.mjs';
import { calculateGaps, generateRecommendations, buildLearningPath, suppressDemonstrated } from '../../src/domain/recommendations.mjs';
import { validateGovernance, isVisible } from '../../src/data/governance.js';

const seed = n => json(`data/seed/${n}.json`).items;
const courses = seed('courses'), questions = seed('questions'), assessments = seed('assessments'), paths = seed('learning-paths'), catalog = seed('recommendation-catalog');
const allCerts = seed('certifications'), sources = seed('sources'), nav = seed('navigation'), rels = seed('relationships'), programs = seed('programs');
const figures = seed('figures'), placement = seed('lesson-figures');
const comps = json('data/seed/competency/competencies.json').items, roles = json('data/seed/competency/target-roles.json').items;
const en = json('data/i18n/en.json'), ar = json('data/i18n/ar.json');
const qIds = questions.map(q => q.id), aIds = assessments.map(a => a.id);
const byId = (list, id) => list.find(x => x.id === id);
const Q_COURSES = ['CRS-QMS-201', 'CRS-Q-TOOLS', 'CRS-Q-CAPA', 'CRS-Q-SPC', 'CRS-Q-AUDIT', 'CRS-LSS-GB', 'CRS-CMQOE-PREP', 'CRS-Q-COQ', 'CRS-Q-SUPPLIER'];
const hand = Q_COURSES.map(id => byId(courses, id));
const asq = allCerts.filter(c => c.body === 'ASQ');

test('Phase 9 courses: nine, each meets the completeness contract, bilingual, validated, four-option checks with rationales', () => {
  assert.equal(hand.filter(Boolean).length, 9);
  for (const c of hand) {
    assert.deepEqual(validateCourse(c), [], c.id);
    assert.deepEqual(courseCompleteness(c, { questionIds: qIds, assessmentIds: aIds }), [], c.id);
    assert.equal(c.ecosystem, 'quality'); assert.equal(c.professional_body_reference, 'ASQ');
    for (const l of c.modules.flatMap(m => m.lessons)) {
      assert.equal(l.content_blocks.length, 5, l.id);
      for (const b of l.content_blocks) assert.ok(b.text.en.length > 30 && b.text.ar.length > 20, `${l.id}:${b.type}`);
      const q = byId(questions, l.check_question_id);
      assert.deepEqual(validateQuestion(q), [], q.id);
      assert.equal(q.options.length, 4, q.id);
      assert.ok(q.options.every(o => o.why?.en && o.why?.ar), `${q.id}: rationale per option`);
    }
    for (const k of ['quiz', 'final', 'practical']) assert.deepEqual(validateAssessment(byId(assessments, c.assessments[k]), qIds), [], c.assessments[k]);
    assert.ok(c.practical_task.rubric.reduce((a, r) => a + r.weight, 0) === 100, `${c.id}: rubric weights add to 100`);
  }
});

test('generated-question quality: answer keys are spread across positions and no option text repeats within a question', () => {
  const qs = questions.filter(q => /^Q-(Q|LSS|CMQOE|QMS-201|CMQ|QF|QE|QA|QS)-/.test(q.id) && q.type === 'single_choice');
  assert.ok(qs.length >= 60, String(qs.length));
  const pos = {}; for (const q of qs) pos[q.correct_answer] = (pos[q.correct_answer] || 0) + 1;
  for (const k of ['a', 'b', 'c', 'd']) assert.ok((pos[k] || 0) >= qs.length * 0.12, `key ${k}: ${pos[k]} of ${qs.length}`);
  for (const q of qs) { const t = q.options.map(o => o.text.en.toLowerCase()); assert.equal(new Set(t).size, t.length, q.id); }
});

test('labels and claims: internal or exam-prep label only; no ASQ approval, RU, accreditation or CPD claim unless negated', () => {
  const CLAIM = /\b(ASQ[- ]approved|certified by ASQ|ASQ[- ]endorsed|awards? (?:RUs|recertification units)|accredited)\b/i;
  const NEG = /(not|no|never|without|does not|doesn't)/i;
  for (const c of hand) {
    assert.ok(['CIA INTERNAL COURSE', 'EXAM PREPARATION COURSE'].includes(c.status_label), c.id);
    assert.equal(c.external_accreditation_status, 'not_claimed'); assert.equal(c.cpd_status, 'not_claimed'); assert.equal(c.certificate_type, 'completion');
    const txt = JSON.stringify(c);
    for (const m of txt.matchAll(new RegExp(CLAIM.source, 'gi'))) {
      const ctx = txt.slice(Math.max(0, m.index - 80), m.index); assert.ok(NEG.test(ctx), `${c.id}: “${m[0]}” not negated`);
    }
  }
  assert.equal(byId(courses, 'CRS-CMQOE-PREP').status_label, 'EXAM PREPARATION COURSE');
  assert.match(byId(courses, 'CRS-CMQOE-PREP').passing_criteria.en, /does not award an ASQ certification or recertification units/);
  assert.equal(hand.filter(c => c.status_label === 'EXAM PREPARATION COURSE').length, 1);
});

test('ASQ explorer: nine certifications, valid, dated, sourced on asq.org, secondary only for BoK counts, pending facts carry no figures', () => {
  assert.deepEqual(asq.map(c => c.code).sort(), ['CCQM', 'CMQ/OE', 'CQA', 'CQE', 'CQI', 'CQIA', 'CQT', 'CSSBB', 'CSSGB']);
  const srcIds = new Set(sources.map(s => s.id));
  for (const c of asq) {
    assert.deepEqual(validateCertification(c), [], c.id);
    assert.deepEqual(validateGovernance(c), [], c.id);
    assert.match(c.official_url, /^https:\/\/(www\.)?asq\.org\/cert\//);
    assert.equal(c.verified_date, '2026-11-04');
    for (const s of c.source_ids) assert.ok(srcIds.has(s), `${c.id}: ${s}`);
    const st = certFactState(c);
    for (const g of ['eligibility', 'exam', 'fee', 'renewal']) assert.notEqual(st[g], 'secondary', `${c.id}:${g}`);
    if (st.domains === 'secondary') assert.ok(c.source_ids.some(s => byId(sources, s).source_type === 'secondary_summary_of_official'), `${c.id}: secondary needs a labelled provider source`);
    assert.match(c.claims.en, /not an ASQ partner/); assert.match(c.claims.en, /award no recertification units/);
    for (const id of c.cia_courses) assert.ok(byId(courses, id), `${c.id}: ${id}`);
    for (const id of c.cia_routes) assert.ok(byId(paths, id), `${c.id}: ${id}`);
  }
  const cmq = byId(asq, 'CERT-CMQOE');
  assert.deepEqual([cmq.exam.questions, cmq.exam.scored, cmq.exam.minutes], [180, 165, 258]);
  assert.deepEqual([cmq.fee.member, cmq.fee.non_member, cmq.fee.retake], [485, 585, 385]);
  assert.equal(cmq.domains.reduce((a, d) => a + d.questions, 0), 165); assert.equal(cmq.domains.length, 7);
  assert.equal(renewalUnits(cmq.renewal), 18); assert.equal(cmq.renewal.years, 3);
  for (const id of ['CERT-CQIA', 'CERT-CQT', 'CERT-CQI', 'CERT-CSSGB']) assert.equal(byId(asq, id).renewal.lifetime, true, id);
  assert.equal(certFactState(byId(asq, 'CERT-CQIA')).fee, 'pending'); assert.equal(byId(asq, 'CERT-CQIA').fee, null);
  for (const c of asq.filter(c => certFactState(c).domains === 'pending')) assert.equal(c.domains.length, 0, c.id);
});

test('certification validation is body-aware and catches broken ASQ records', () => {
  const c = structuredClone(byId(asq, 'CERT-CQA'));
  assert.deepEqual(validateCertification(c), []);
  c.official_url = 'https://www.pmi.org/x'; assert.ok(validateCertification(c).includes('official_url_not_asq'));
  const d = structuredClone(byId(asq, 'CERT-CQA')); d.domains[0].questions += 5; assert.ok(validateCertification(d).some(e => e.startsWith('domain_questions_not_scored')));
  const f = structuredClone(byId(asq, 'CERT-CQA')); f.facts_status.renewal = 'pending'; assert.ok(validateCertification(f).includes('pending_renewal_has_figures'));
  const g = structuredClone(byId(asq, 'CERT-CCQM')); g.domains = [{ name: { en: 'x', ar: 'س' }, questions: 150, weight: 100 }]; assert.ok(validateCertification(g).includes('pending_domains_have_figures'));
  const h = structuredClone(byId(asq, 'CERT-CQA')); h.facts_status.fee = 'secondary'; assert.equal(certFactState(h).fee, 'pending');
  assert.equal(showsFacts('secondary'), true); assert.equal(showsFacts('pending'), false);
  const pmi = allCerts.filter(c => (c.body || 'PMI') === 'PMI'); for (const p of pmi) assert.deepEqual(validateCertification(p), [], p.id);
});

test('CMQ/OE Center diagnostic: two original items per BoK area, tagged, “I don\'t know” allowed, scored per area', () => {
  const a = byId(assessments, 'ASM-CMQOE-DIAG');
  assert.deepEqual(validateAssessment(a, qIds), []);
  assert.equal(a.allow_unknown, true); assert.equal(a.question_ids.length, 14);
  const cmq = byId(asq, 'CERT-CMQOE');
  for (let i = 0; i < cmq.domains.length; i++) assert.equal(Object.values(a.bok_areas).filter(x => x === i).length, 2, `area ${i}`);
  const qs = a.question_ids.map(id => byId(questions, id));
  const answers = Object.fromEntries(qs.map(q => [q.id, a.bok_areas[q.id] === 3 ? '__unknown__' : q.correct_answer]));
  const s = scoreAttempt(a, qs, answers);
  const r = bokAreaResults([{ assessment_id: a.id, submitted_at: '2026-11-04T10:00:00Z', detail: s.detail, score: s.percent }], a, cmq.domains);
  assert.equal(r.areas.length, 7); assert.equal(r.areas[3].percent, 0); assert.equal(r.areas[3].state, 'weak'); assert.equal(r.areas[3].unknown, 2);
  for (const x of r.areas.filter(x => x.index !== 3)) assert.equal(x.state, 'ok');
  const ri = readinessIndex(r.areas); assert.equal(ri, Math.round(100 * (165 - 31) / 165));
  assert.equal(readinessBand(ri), 'high'); assert.equal(readinessBand(50), 'low'); assert.equal(readinessBand(null), null);
  assert.equal(weakAreas(r.areas)[0].index, 3);
  for (const ids of Object.values(CMQOE_AREA_COURSES)) for (const id of ids) assert.ok(byId(courses, id), id);
});

test('CMQ/OE calculators: no evidence → no readiness; study hours by weight × weakness always add up; latest attempt wins', () => {
  const cmq = byId(asq, 'CERT-CMQOE'), a = byId(assessments, 'ASM-CMQOE-DIAG');
  const none = bokAreaResults([], a, cmq.domains);
  assert.equal(none.attempt, null); assert.equal(readinessIndex(none.areas), null); assert.deepEqual(weakAreas(none.areas), []);
  for (const total of [20, 100, 137, 400]) {
    const p = weightedStudyHours(none.areas, total);
    assert.equal(p.practice + p.areas.reduce((x, y) => x + y.hours, 0), total, String(total));
  }
  const rows = none.areas.map((r, i) => ({ ...r, state: i === 6 ? 'weak' : 'ok', percent: i === 6 ? 40 : 90 }));
  const w = weightedStudyHours(rows, 100), base = weightedStudyHours(none.areas, 100);
  assert.ok(w.areas[6].hours > base.areas[6].hours, 'a weak area gets more hours');
  const mk = (n, ok) => ({ assessment_id: a.id, submitted_at: `2026-11-0${n}T10:00:00Z`, detail: a.question_ids.map(id => ({ question_id: id, earned: ok ? 1 : 0, max: 1, auto: true })) });
  assert.equal(readinessIndex(bokAreaResults([mk(1, false), mk(3, true)], a, cmq.domains).areas), 100);
  assert.equal(readinessIndex(bokAreaResults([mk(3, false), mk(1, true)], a, cmq.domains).areas), 0);
  const plan = domainHours(cmq.domains, 120); assert.equal(plan.domains.length, 7);
});

test('routes: five quality routes, steps resolve, skip_if_mastered uses real competencies, role defaults, navigation entry', () => {
  const q = paths.filter(p => p.kind === 'quality_route');
  assert.deepEqual(q.map(p => p.id).sort(), [...Q_ROUTES].sort());
  const compIds = new Set(comps.map(c => c.id)), ids = new Set([...courses, ...assessments].map(x => x.id));
  for (const p of q) {
    for (const s of p.steps) { assert.ok(ids.has(s.target_id) || /^KA-/.test(s.target_id), `${p.id}: ${s.target_id}`); for (const c of s.skip_if_mastered || []) assert.ok(compIds.has(c), `${p.id}: ${c}`); }
    for (const c of p.certification_ids) assert.ok(byId(allCerts, c), c);
  }
  for (const [role, rid] of Object.entries(Q_ROLE_ROUTE)) { assert.ok(byId(roles, role), role); assert.ok(byId(paths, rid), rid); }
  const n = byId(nav, 'qualityAcademy'); assert.equal(n.status, 'active'); assert.equal(n.route, '/academy/quality');
  const cis = byId(roles, 'ROLE-CIS'); assert.equal(Object.keys(cis.targets).length, comps.length); assert.equal(cis.governance.content_status === 'needs_review' || cis.governance.content_status === 'published', true);
});

test('catalog and relationships: one entry per course with suppression; courses prepare for ASQ certifications', () => {
  for (const id of Q_COURSES) { const r = catalog.filter(x => x.target_id === id); assert.equal(r.length, 1, id); }
  for (const id of ['CRS-QMS-201', 'CRS-Q-TOOLS', 'CRS-Q-CAPA', 'CRS-Q-SPC', 'CRS-LSS-GB']) assert.ok(catalog.find(x => x.target_id === id).suppress_if_mastered?.length, id);
  assert.ok(rels.some(r => r.fromId === 'CRS-CMQOE-PREP' && r.relation === 'prepares_for' && r.toId === 'CERT-CMQOE'));
  assert.ok(rels.some(r => r.fromId === 'ASM-CMQOE-DIAG' && r.relation === 'assesses'));
  const prg = byId(programs, 'PRG-CIA-FOUNDATIONS'); assert.deepEqual(prg.stages.map(s => s.course_id), ['CRS-ISO-101', 'CRS-QMS-201', 'CRS-PM-101', 'CRS-ISO-RISK']);
  const demo = byId(questions, 'Q-QMS-001'); assert.equal(demo.course_id, 'CRS-QMS-201'); assert.equal(demo.auto_scored_twin, 'Q-Q-RD-03'); assert.equal(demo.planned_phase, undefined);
});

/* ------------------------------------------------------------------ acceptance scenarios A–I (quality starting point) */
const at = n => `2026-11-0${n}T10:00:00Z`;
const attempt = (aid, breakdown, n = 1) => ({ assessment_id: aid, submitted_at: at(n), passed: false, competency_breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, { earned: v, max: 100, percent: v, unknown: 0, items: 2 }])) });
const ev = attempts => assessmentEvidence(attempts);
const sp = (profile, attempts = [], completed = []) => qualityStartingPoint({ profile, evidence: ev(attempts), completed });
const route = (id, attempts = [], completed = []) => buildLearningPath(structuredClone(byId(paths, id)), { completedIds: completed, mastered: masteredCompetencies(ev(attempts)) });
const stepOf = (p, id) => p.steps.find(s => s.target_id === id);
const STRONG = { 'QM-01': 85, 'QM-02': 80, 'QM-03': 78 };

test('A: no profile → read what quality means (no guessing)', () => {
  const r = sp(null); assert.equal(r.key, 'explore'); assert.equal(r.target_id, 'KA-015');
});
test('B: a profile without evidence → the quality readiness diagnostic, even with 20 years of experience', () => {
  const r = sp({ target_role: 'ROLE-QMGR', years_experience: 20 });
  assert.equal(r.key, 'assess'); assert.equal(r.href, '#/assessments/quality-readiness'); assert.equal(r.route_id, 'ROUTE-Q-CMQOE');
  assert.ok(byId(assessments, 'ASM-READY-Q-001').slug === 'quality-readiness');
});
test('C: a quality manager who demonstrates the foundations goes to the CMQ/OE Center, and the route skips the foundations course', () => {
  const att = [attempt('ASM-READY-Q-001', STRONG)];
  const r = sp({ target_role: 'ROLE-QMGR' }, att);
  assert.equal(r.key, 'cmqoe'); assert.equal(r.href, '#/academy/quality/cmqoe');
  const p = route('ROUTE-Q-CMQOE', att);
  assert.equal(stepOf(p, 'CRS-QMS-201').status, 'Skipped'); assert.equal(stepOf(p, 'CRS-QMS-201').skip_reason, 'demonstrated');
  assert.notEqual(stepOf(p, 'CRS-CMQOE-PREP').status, 'Skipped');
});
test('D: weak foundations → Quality Management Foundations first, whatever the target', () => {
  const r = sp({ target_role: 'ROLE-QE' }, [attempt('ASM-READY-Q-001', { 'QM-01': 45, 'QM-02': 80, 'QM-03': 75 })]);
  assert.equal(r.key, 'foundation'); assert.equal(r.target_id, 'CRS-QMS-201');
});
test('E: a quality engineer with demonstrated foundations continues with SPC', () => {
  const r = sp({ target_role: 'ROLE-QE' }, [attempt('ASM-READY-Q-001', STRONG)]);
  assert.equal(r.key, 'engineer'); assert.equal(r.target_id, 'CRS-Q-SPC'); assert.equal(r.route_id, 'ROUTE-Q-ENGINEER');
});
test('F: stated Lean Six Sigma or audit aims choose the Green Belt or auditor route (Arabic and English)', () => {
  assert.equal(sp({ interests: 'Lean Six Sigma Green Belt' }, [attempt('ASM-READY-Q-001', STRONG)]).key, 'ssgb');
  assert.equal(sp({ career_objectives: 'مدقق جودة معتمد CQA' }, [attempt('ASM-READY-Q-001', STRONG)]).key, 'auditor');
  assert.equal(qualityIntent({ target_role: 'ROLE-CIS' }), 'ssgb');
  assert.equal(qualityIntent({ interests: 'excel and travel' }), null);
});
test('G: the Green Belt route skips tools when QM-02 is demonstrated but keeps the required Green Belt course', () => {
  const att = [attempt('ASM-Q-SSGB-DIAG', { 'QM-02': 90 })];
  const p = route('ROUTE-Q-SSGB', att);
  assert.equal(stepOf(p, 'CRS-Q-TOOLS').status, 'Skipped'); assert.notEqual(stepOf(p, 'CRS-LSS-GB').status, 'Skipped');
});
test('H: recommendations suppress quality courses whose competencies are demonstrated', () => {
  const att = [attempt('ASM-READY-Q-001', { ...STRONG, 'QM-04': 88, 'PERF-01': 90 })];
  const mastered = masteredCompetencies(ev(att));
  const gaps = calculateGaps({ role: byId(roles, 'ROLE-QMGR'), competencies: comps, selfLevels: {}, assessmentByCompetency: Object.fromEntries(Object.entries(ev(att)).map(([k, v]) => [k, v.percent])) });
  const recs = suppressDemonstrated(generateRecommendations(catalog, { profile: { target_role: 'ROLE-QMGR' }, gaps, completedIds: [], assessmentByCompetency: {} }), mastered);
  for (const id of ['CRS-QMS-201', 'CRS-Q-TOOLS', 'CRS-Q-COQ', 'CRS-Q-SUPPLIER']) assert.ok(!recs.some(r => r.target_id === id), id);
});
test('I: completing the foundations course counts as demonstrated; partial evidence does not', () => {
  assert.equal(sp({ target_role: 'ROLE-QE' }, [], ['CRS-QMS-201']).key, 'engineer');
  assert.equal(sp({ target_role: 'ROLE-QE' }, [attempt('ASM-READY-Q-001', { 'QM-01': 80, 'QM-02': 80 })]).key, 'foundation');
  assert.equal(sp({}, [attempt('ASM-READY-Q-001', STRONG)]).key, 'tools');
});

/* ------------------------------------------------------------------ figures and covers (D-31, D-32) */
test('figures: every record is valid (known template, bilingual caption and how-to-read, label parity) and governed', () => {
  assert.ok(figures.length >= 90, String(figures.length));
  for (const f of figures) {
    assert.deepEqual(validateFigure(f), [], f.id);
    assert.deepEqual(validateGovernance(f), [], f.id);
    assert.ok(isPhase8(f), f.id); governedPhase8(assert, f, 'ai_draft');
  }
  assert.deepEqual(TEMPLATES.filter(t => !figures.some(f => f.template === t)), [], 'every template is used');
});
test('figure placement: every target resolves; every hand-authored lesson of ISO, PMI and Quality has at least one figure', () => {
  assert.deepEqual(danglingFigureRefs(placement, figures, courses), []);
  const handCourses = courses.filter(c => !c.guide && !c.planned_phase);
  const lessons = handCourses.flatMap(c => c.modules.flatMap(m => m.lessons.map(l => [c, l])));
  const missing = lessons.filter(([c, l]) => !lessonFigures(l, c, figures, placement).length).map(([, l]) => l.id);
  assert.deepEqual(missing, []);
  assert.ok(courseFigures(byId(courses, 'CRS-Q-SPC'), figures, placement).length >= 4);
  const g = courses.find(c => c.guide === 'pareto');
  assert.ok(lessonFigures(g.modules[0].lessons[0], g, figures, placement).some(f => f.id === 'FIG-Q-PARETO'), 'guide figure on the first lesson');
  assert.equal(lessonFigures(g.modules[0].lessons[1], g, figures, placement).length, 0);
  const hidden = figures.map(f => ({ ...f, governance: { ...f.governance, content_status: 'needs_review' } })).filter(f => isVisible(f, ['learner']));
  assert.equal(hidden.length, 0, 'unapproved figures are never shown to learners');
});
test('figure text helpers: wrapping keeps words whole; text alternative lists labels in the chosen language', () => {
  assert.deepEqual(wrap('one two three four', 9), ['one two', 'three', 'four']);
  assert.deepEqual(wrap('', 5), ['']);
  const f = byId(figures, 'FIG-M-PDCA');
  assert.match(figureText(f, 'en'), /Plan/); assert.match(figureText(f, 'ar'), /خطط/);
  assert.doesNotMatch(figureText(f, 'en'), /Go round the cycle/, 'how-to-read text is not repeated in the label list');
  assert.ok(validateFigure({ id: 'X', template: 'nope', caption: { en: 'a', ar: 'ب' }, read: { en: 'a', ar: 'ب' } }).some(e => e.startsWith('unknown_template')));
});
test('covers: family and topic follow the record; the seed is deterministic; every family has a palette', () => {
  assert.equal(familyOf(byId(courses, 'CRS-Q-SPC')), 'quality'); assert.equal(familyOf(byId(courses, 'CRS-ISO-101')), 'iso');
  assert.equal(familyOf(byId(courses, 'CRS-PM-101')), 'pmi'); assert.equal(familyOf(byId(courses, 'CRS-PMO-KPI')), 'pmo');
  assert.equal(familyOf(courses.find(c => c.guide === 'rca')), 'method');
  assert.equal(topicOf(byId(courses, 'CRS-Q-SPC')).motif, 'control'); assert.equal(topicOf(byId(courses, 'CRS-Q-COQ')).motif, 'iceberg');
  const a = seeded('CRS-Q-SPC'), b = seeded('CRS-Q-SPC'); assert.equal(a(), b()); assert.notEqual(seeded('x')(), seeded('y')());
  for (const c of courses) assert.ok(FAMILIES[familyOf(c)], c.id);
});
test('i18n: every Phase 9 string exists in Arabic and English with the same placeholders', () => {
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]));
  const E = Object.fromEntries(flat({ p9: en.p9, q9: en.q9 })), A = Object.fromEntries(flat({ p9: ar.p9, q9: ar.q9 }));
  assert.deepEqual(Object.keys(E).sort(), Object.keys(A).sort());
  for (const k of Object.keys(E)) assert.deepEqual((E[k].match(/\{\w+\}/g) || []).sort(), (A[k].match(/\{\w+\}/g) || []).sort(), k);
  assert.ok(en.nav.items.qualityAcademy && ar.nav.items.qualityAcademy);
});
test('Phase 9 drafts are governed: nothing published without a recorded approval', () => {
  const recs = [...hand, ...questions.filter(isPhase8), ...assessments.filter(isPhase8), ...asq, ...paths.filter(p => p.kind === 'quality_route'), ...figures, byId(roles, 'ROLE-CIS'), byId(programs, 'PRG-CIA-FOUNDATIONS')];
  for (const r of recs) governedPhase8(assert, r, ['ai_draft', 'system', 'external_public', 'owner']);
});
