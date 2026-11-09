/** Phase 10 — Excellence (EFQM-informed) Academy: completeness contract, EFQM explorer facts, the EFQM Assessment Lab data model
 *  (evidence, findings, ratings, analysis, plan, export / import), scenarios A–I for the excellence starting point, routes, labels and
 *  claims, question quality, figures and placement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json } from './_util.mjs';
import { validateCourse, courseCompleteness } from '../../src/domain/courses.mjs';
import { validateAssessment, validateQuestion } from '../../src/domain/assessments.mjs';
import { validateCertification, certFactState } from '../../src/domain/pmi.mjs';
import { excellenceStartingPoint, excellenceIntent, EX_ROUTES, EX_ROLE_ROUTE, newLab, addEvidence, addFinding, removeItem, setRating, setPlanField, validateEvidence,
  criterionRating, unsupported, labSummary, quadrant, priorityOf, planRows, exportLab, importLab, elementsFor, LAB_SCHEMA } from '../../src/domain/excellence.mjs';
import { lessonFigures, courseFigures, danglingFigureRefs } from '../../src/domain/figures.mjs';
import { validateFigure } from '../../src/ui/figures.js';
import { familyOf, topicOf } from '../../src/ui/art.js';
import { assessmentEvidence, masteredCompetencies } from '../../src/domain/learner-model.mjs';
import { buildLearningPath } from '../../src/domain/recommendations.mjs';
import { validateGovernance } from '../../src/data/governance.js';

const seed = n => json(`data/seed/${n}.json`).items;
const courses = seed('courses'), questions = seed('questions'), assessments = seed('assessments'), paths = seed('learning-paths'), catalog = seed('recommendation-catalog');
const allCerts = seed('certifications'), sources = seed('sources'), nav = seed('navigation'), rels = seed('relationships');
const figures = seed('figures'), placement = seed('lesson-figures'), labDoc = seed('excellence-lab');
const comps = json('data/seed/competency/competencies.json').items, roles = json('data/seed/competency/target-roles.json').items;
const en = json('data/i18n/en.json'), ar = json('data/i18n/ar.json');
const qIds = questions.map(q => q.id), aIds = assessments.map(a => a.id);
const byId = (list, id) => list.find(x => x.id === id);
const EX_COURSES = ['CRS-EFQM-101', 'CRS-EX-RADAR', 'CRS-EX-EVID', 'CRS-EX-SA', 'CRS-EX-PLAN', 'CRS-EX-AWARD', 'CRS-EX-SUSTAIN'];
const hand = EX_COURSES.map(id => byId(courses, id));
const efqm = allCerts.filter(c => c.body === 'EFQM');
const def = byId(labDoc, 'LAB-EFQM');

test('Phase 10 courses: seven, each meets the completeness contract, bilingual, validated, four-option checks with rationales', () => {
  assert.equal(hand.filter(Boolean).length, 7);
  for (const c of hand) {
    assert.deepEqual(validateCourse(c), [], c.id);
    assert.deepEqual(courseCompleteness(c, { questionIds: qIds, assessmentIds: aIds }), [], c.id);
    assert.equal(c.ecosystem, 'efqm'); assert.equal(c.professional_body_reference, 'EFQM'); assert.equal(familyOf(c), 'excellence');
    assert.equal(c.modules.flatMap(m => m.lessons).length, 4, c.id);
    for (const l of c.modules.flatMap(m => m.lessons)) {
      assert.equal(l.content_blocks.length, 5, l.id);
      for (const b of l.content_blocks) assert.ok(b.text.en.length > 30 && b.text.ar.length > 20, `${l.id}:${b.type}`);
      assert.ok(l.exercise.prompt.en && l.exercise.model_answer.ar, l.id);
      const q = byId(questions, l.check_question_id);
      assert.deepEqual(validateQuestion(q), [], q.id);
      assert.equal(q.options.length, 4, q.id);
      assert.ok(q.options.every(o => o.why?.en && o.why?.ar), `${q.id}: rationale per option`);
    }
    for (const k of ['quiz', 'final', 'practical']) assert.deepEqual(validateAssessment(byId(assessments, c.assessments[k]), qIds), [], c.assessments[k]);
    assert.equal(c.practical_task.rubric.reduce((a, r) => a + r.weight, 0), 100, `${c.id}: rubric weights add to 100`);
    assert.ok(c.tools.length > 0, c.id);
  }
  /* The seven covers differ from each other (distinct topic motif or icon). */
  assert.equal(new Set(hand.map(c => JSON.stringify(topicOf(c)))).size, 7);
});

test('generated-question quality: answer keys spread across positions, no repeated option text, diagnostics allow “I don\'t know”', () => {
  const qs = questions.filter(q => /^Q-(EX|EFQM-101)-/.test(q.id) && q.type === 'single_choice');
  assert.ok(qs.length >= 50, String(qs.length));
  const pos = {}; for (const q of qs) pos[q.correct_answer] = (pos[q.correct_answer] || 0) + 1;
  for (const k of ['a', 'b', 'c', 'd']) assert.ok((pos[k] || 0) >= qs.length * 0.15, `key ${k}: ${pos[k]} of ${qs.length}`);
  for (const q of qs) { const t = q.options.map(o => o.text.en.toLowerCase()); assert.equal(new Set(t).size, t.length, q.id); }
  const ready = byId(assessments, 'ASM-READY-EX-001');
  assert.deepEqual(validateAssessment(ready, qIds), []); assert.equal(ready.allow_unknown, true); assert.equal(ready.question_ids.length, 12); assert.equal(ready.slug, 'excellence-readiness');
  for (const k of ['FOUND', 'SA', 'AWARD', 'PLAN']) { const a = byId(assessments, `ASM-EX-${k}-DIAG`); assert.deepEqual(validateAssessment(a, qIds), [], k); assert.equal(a.allow_unknown, true); }
});

test('labels and claims: internal label only; no EFQM approval, licensed-assessor, recognition, accreditation, RU, PDU or CPD claim unless negated', () => {
  const CLAIM = /\b(EFQM[- ]approved|EFQM[- ]endorsed|EFQM[- ]recognised|recognised by EFQM|licensed assessor|licen[cs]e(?:d)? (?:EFQM )?assessors?|accredited|awards? (?:RUs|PDUs|CPD))\b/gi;
  const NEG = /(not|no|never|without|does not|doesn't|gives no|“|")/i;
  for (const c of hand) {
    assert.equal(c.status_label, 'CIA INTERNAL COURSE', c.id);
    assert.equal(c.external_accreditation_status, 'not_claimed'); assert.equal(c.cpd_status, 'not_claimed'); assert.equal(c.certificate_type, 'completion');
    assert.match(c.passing_criteria.en, /not an EFQM recognition, an assessor qualification or an award result/);
    const txt = JSON.stringify(c);
    for (const m of txt.matchAll(CLAIM)) { const ctx = txt.slice(Math.max(0, m.index - 90), m.index); assert.ok(NEG.test(ctx), `${c.id}: “${m[0]}” not negated`); }
  }
  for (const s of ['honesty', 'labLabel']) assert.match(en.ex10[s], /not/i, s);
});

test('EFQM explorer: five options, valid, dated, sourced on efqm.org, pending facts carry no figures, claims stated', () => {
  assert.deepEqual(efqm.map(c => c.id).sort(), ['CERT-EFQM-ADV', 'CERT-EFQM-ASSESSOR', 'CERT-EFQM-GA', 'CERT-EFQM-RAPID', 'CERT-EFQM-VALID']);
  const srcIds = new Set(sources.map(s => s.id));
  for (const c of efqm) {
    assert.deepEqual(validateCertification(c), [], c.id);
    assert.deepEqual(validateGovernance(c), [], c.id);
    assert.match(c.official_url, /^https:\/\/(www\.|shop\.)?efqm\.org\//);
    assert.equal(c.verified_date, '2026-11-06');
    for (const s of c.source_ids) { assert.ok(srcIds.has(s), `${c.id}: ${s}`); assert.match(byId(sources, s).official_url, /efqm\.org/); }
    const st = certFactState(c);
    assert.equal(st.fee, 'pending', c.id); assert.equal(c.fee, null, c.id);  // EFQM publishes no fees on these pages
    assert.equal(st.renewal, 'pending', c.id); assert.equal(c.renewal, null, c.id);  // validity only in a 2021 brochure — not stated as fact
    for (const g of ['eligibility', 'exam', 'domains']) if (st[g] === 'pending') assert.ok(!(g === 'exam' ? c.exam : c[g]?.length), `${c.id}:${g} pending but carries data`);
    assert.match(c.claims.en, /not an EFQM partner/); assert.match(c.claims.en, /does not train, certify or license EFQM assessors/); assert.match(c.claims.en, /not an EFQM assessment or score/);
    for (const id of c.cia_courses) assert.ok(byId(courses, id), `${c.id}: ${id}`);
    for (const id of c.cia_routes) assert.ok(byId(paths, id), `${c.id}: ${id}`);
  }
  const adv = byId(efqm, 'CERT-EFQM-ADV');
  assert.deepEqual(adv.domains.map(d => d.name.en), ['Purpose, Vision & Strategy', 'Organisational Culture & Leadership', 'Engaging Stakeholders', 'Creating Sustainable Value',
    'Driving Performance & Transformation', 'Stakeholder Perceptions', 'Strategic & Operational Performance']);
  assert.ok(adv.exam.rows.some(r => /1,000 points/.test(r.value.en)));
  const rapid = byId(efqm, 'CERT-EFQM-RAPID');
  assert.ok(rapid.exam.rows.some(r => /1 or 2 stars/.test(r.value.en))); assert.match(rapid.exam.note.en, /differ/);  // the 100 vs 200 point conflict is disclosed, not resolved
  const ga = byId(efqm, 'CERT-EFQM-GA');
  assert.ok(ga.exam.rows.some(r => /April 2027/.test(r.value.en))); assert.ok(ga.exam.rows.some(r => /701 points/.test(r.value.en)));
  for (const id of ['CERT-EFQM-VALID', 'CERT-EFQM-ASSESSOR']) assert.deepEqual(Object.values(certFactState(byId(efqm, id))), ['pending', 'pending', 'pending', 'pending', 'pending'], id);
  /* The brochure (© 2021) is used only as a dated note, never as a verified fact. */
  assert.match(byId(efqm, 'CERT-EFQM-VALID').extra[0].en, /© 2021.*not confirmed/);
});

test('certification validation is body-aware for EFQM', () => {
  const c = structuredClone(byId(efqm, 'CERT-EFQM-ADV'));
  assert.deepEqual(validateCertification(c), []);
  const u = structuredClone(c); u.official_url = 'https://example.com/efqm'; assert.ok(validateCertification(u).includes('official_url_not_efqm'));
  const r = structuredClone(c); r.exam.rows = []; assert.ok(validateCertification(r).includes('verified_without_exam'));
  const d = structuredClone(c); d.domains[0].name.ar = ''; assert.ok(validateCertification(d).includes('domain_name_missing'));
  const f = structuredClone(c); f.fee = { member: 1, non_member: 2 }; assert.ok(validateCertification(f).includes('pending_fee_has_figures'));
  for (const p of allCerts.filter(x => x.body !== 'EFQM')) assert.deepEqual(validateCertification(p), [], p.id);
});

test('Lab definition: the seven criterion names in three dimensions, original guidance with five bands per element, labelled', () => {
  assert.ok(def); assert.deepEqual(validateGovernance(def), []);
  assert.equal(def.criteria.length, 7);
  assert.deepEqual(def.criteria.map(c => c.group), ['direction', 'direction', 'execution', 'execution', 'execution', 'results', 'results']);
  assert.deepEqual(def.criteria.map(c => c.name.en), byId(efqm, 'CERT-EFQM-ADV').domains.map(d => d.name.en));
  for (const c of def.criteria) { assert.ok(c.prompt.en.endsWith('?') && c.prompt.ar, c.id); assert.equal(c.kind, c.group === 'results' ? 'results' : 'enabler'); }
  for (const [kind, els] of Object.entries(def.elements)) for (const e of els) { assert.equal(e.bands.length, 5, `${kind}:${e.id}`); assert.ok(e.bands.every(b => b.en && b.ar)); assert.ok(e.ask.en && e.ask.ar); }
  assert.deepEqual(def.scale.map(s => s.value), [0, 25, 50, 75, 100]);
  assert.equal(def.label.en, 'Self-assessment aid — not an EFQM assessment');
  assert.match(def.disclaimer.en, /not an EFQM assessment, gives no EFQM score/);
  for (const id of def.courses) assert.ok(byId(courses, id), id);
  const kaqa = byId(labDoc, 'REG-KAQA');
  for (const f of kaqa.facts) { assert.ok(byId(sources, f.source)?.official_url.match(/\.gov\.sa\//), f.source); assert.ok(f.text.en && f.text.ar); }
});

test('Lab data model: evidence validation, findings, ratings, unsupported flag, analysis by criterion and dimension', () => {
  const lab = newLab('2026-11-06T00:00:00Z');
  const today = '2026-11-06';
  assert.deepEqual(validateEvidence({ title: '', source: 'x' }, today), ['required']);
  assert.deepEqual(validateEvidence({ title: 'a', source: 'b', link: 'javascript:alert(1)' }, today), ['link']);
  assert.deepEqual(validateEvidence({ title: 'a', source: 'b', date: '2027-01-01' }, today), ['date']);
  assert.deepEqual(validateEvidence({ title: 'a', source: 'b', date: '2026-02-30' }, today).includes('date'), Number.isNaN(Date.parse('2026-02-30')));
  assert.deepEqual(addEvidence(lab, 'C1', { title: '', source: '' }, today).errors, ['required']);
  assert.deepEqual(addEvidence(lab, 'C1', { title: 'Strategy 2026–2030', source: 'Board-approved document', date: '2026-01-15', owner: 'Strategy office', link: 'https://intranet.example/strategy' }, today).errors, []);
  assert.equal(lab.criteria.C1.evidence.length, 1);
  assert.deepEqual(addFinding(lab, 'C1', 'strengths', 'short').errors, ['required']);
  addFinding(lab, 'C1', 'strengths', 'Strategy is built from a documented stakeholder and environment analysis, reviewed yearly.');
  addFinding(lab, 'C3', 'afis', 'There is limited evidence that partner feedback is collected, which may limit joint improvement.');
  addFinding(lab, 'C6', 'afis', 'There is limited evidence that employee survey results are segmented, which may hide hotspots.');
  const c1 = def.criteria[0], c3 = def.criteria[2], c6 = def.criteria[5];
  assert.deepEqual(elementsFor(def, c1), ['approach', 'deployment', 'refinement']); assert.deepEqual(elementsFor(def, c6), ['relevance', 'performance']);
  setRating(lab, 'C1', 'approach', 75); setRating(lab, 'C1', 'deployment', 50);
  assert.equal(criterionRating(lab, def, c1), null, 'not every element rated yet');
  setRating(lab, 'C1', 'refinement', 25); assert.equal(criterionRating(lab, def, c1), 50);
  setRating(lab, 'C1', 'refinement', 33); assert.equal(lab.criteria.C1.ratings.refinement, 25, 'only scale values are accepted');
  setRating(lab, 'C3', 'approach', 75); assert.equal(unsupported(lab, c3), true, 'rated above 25 without evidence');
  setRating(lab, 'C3', 'approach', 25); assert.equal(unsupported(lab, c3), false);
  setRating(lab, 'C6', 'relevance', 50); setRating(lab, 'C6', 'performance', 100);
  const s = labSummary(lab, def);
  assert.equal(s.withEvidence, 1); assert.equal(s.strengths, 1); assert.equal(s.afis, 2);
  assert.deepEqual(s.dims.map(d => d.rating), [50, null, 75]);
  assert.equal(s.rows.find(r => r.id === 'C6').flag, 'unsupported');
  assert.equal(s.rows.find(r => r.id === 'C2').flag, 'no_evidence');
  const afi = lab.criteria.C3.afis[0].id;
  removeItem(lab, 'C3', 'afis', afi); assert.equal(lab.plan[afi], undefined); assert.equal(labSummary(lab, def).afis, 1);
});

test('Lab plan: impact × ease priority, matrix zones, invalid scores rejected, sorted highest first; export / import round-trip', () => {
  assert.equal(quadrant(5, 5), 'quick'); assert.equal(quadrant(5, 2), 'major'); assert.equal(quadrant(2, 5), 'fill'); assert.equal(quadrant(1, 1), 'reconsider'); assert.equal(quadrant(null, 3), 'unscored');
  assert.equal(priorityOf(4, 3), 12); assert.equal(priorityOf(null, 3), null);
  const lab = newLab();
  for (const [c, t] of [['C2', 'There is limited evidence that leaders review culture indicators, which may slow change.'], ['C5', 'There is limited evidence that data quality is governed, which may mislead decisions.'],
    ['C4', 'There is limited evidence that new services are co-designed with users, which may reduce uptake.']]) addFinding(lab, c, 'afis', t);
  const [a2, a5, a4] = ['C2', 'C5', 'C4'].map(c => lab.criteria[c].afis[0].id);
  assert.equal(setPlanField(lab, a2, 'impact', '7').error, 'score'); assert.equal(setPlanField(lab, a2, 'impact', '2.5').error, 'score'); assert.equal(setPlanField(lab, a2, 'status', 'later').error, 'status');
  setPlanField(lab, a2, 'impact', '5'); setPlanField(lab, a2, 'ease', '2');
  setPlanField(lab, a5, 'impact', '4'); setPlanField(lab, a5, 'ease', '5');
  setPlanField(lab, a5, 'action', 'Name data owners for the top 20 KPIs'); setPlanField(lab, a5, 'owner', 'CIO'); setPlanField(lab, a5, 'due', '2027-03-31'); setPlanField(lab, a5, 'status', 'doing');
  const rows = planRows(lab, def);
  assert.deepEqual(rows.map(r => r.id), [a5, a2, a4]);
  assert.deepEqual(rows.map(r => r.zone), ['quick', 'major', 'unscored']); assert.deepEqual(rows.map(r => r.priority), [20, 10, null]);
  lab.org = { name: 'Example Utility', scope: 'Whole organisation', date: '2026-11-06' };
  addEvidence(lab, 'C5', { title: 'KPI dictionary', source: 'Strategy office register', date: '2026-10-01' }, '2026-11-06');
  setRating(lab, 'C5', 'approach', 50);
  const doc = exportLab(lab, def, '2026-11-06T10:00:00Z');
  assert.equal(doc.schema, LAB_SCHEMA); assert.equal(doc.app, 'cia-academy');
  assert.equal(doc.label.en, 'Self-assessment aid — not an EFQM assessment'); assert.ok(doc.label.ar);
  assert.equal(doc.prioritised_plan[0].id, a5); assert.equal(doc.analysis.afis, 3);
  assert.equal(JSON.stringify(doc).includes('1000'), false, 'no EFQM-style 1,000-point total');
  const back = importLab(JSON.stringify(doc), def);
  assert.equal(back.error, null);
  assert.deepEqual(back.lab.org, lab.org); assert.deepEqual(back.lab.criteria, lab.criteria); assert.deepEqual(back.lab.plan, lab.plan);
  assert.equal(importLab('not json', def).error, 'json');
  assert.equal(importLab(JSON.stringify({ app: 'cia-academy', schema: 'other', criteria: {} }), def).error, 'schema');
  const evil = structuredClone(doc); evil.criteria.C9 = { evidence: [{ title: 'x', source: 'y' }] }; evil.criteria.C5.evidence.push({ title: 'bad', source: 'link', link: 'javascript:alert(1)' });
  evil.plan[a2].impact = 99; evil.criteria.C5.ratings.approach = 60;
  const r = importLab(evil, def).lab;
  assert.equal(r.criteria.C9, undefined, 'unknown criteria dropped'); assert.equal(r.criteria.C5.evidence.length, 1, 'unsafe link dropped');
  assert.equal(r.plan[a2].impact, null, 'out-of-range score cleared'); assert.equal(r.criteria.C5.ratings.approach, undefined, 'off-scale rating dropped');
});

/* ------------------------------------------------------------------ acceptance scenarios A–I (excellence starting point) */
const at = n => `2026-11-0${n}T10:00:00Z`;
const attempt = (aid, breakdown, n = 1) => ({ assessment_id: aid, submitted_at: at(n), passed: false, competency_breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, { earned: v, max: 100, percent: v, unknown: 0, items: 2 }])) });
const ev = attempts => assessmentEvidence(attempts);
const sp = (profile, attempts = [], completed = [], lab = 0) => excellenceStartingPoint({ profile, evidence: ev(attempts), completed, labCriteriaWithEvidence: lab });
const route = (id, attempts = [], completed = []) => buildLearningPath(structuredClone(byId(paths, id)), { completedIds: completed, mastered: masteredCompetencies(ev(attempts)) });
const stepOf = (p, id) => p.steps.find(s => s.target_id === id);
const STRONG = { 'OE-01': 85, 'OE-02': 78, 'PERF-02': 80, 'LDR-01': 75 };

test('A: no profile → read what excellence means (no guessing)', () => {
  const r = sp(null); assert.equal(r.key, 'explore'); assert.equal(r.target_id, 'KA-019'); assert.equal(r.href, '#/knowledge/efqm/excellence-quality');
});
test('B: a profile without evidence → the excellence readiness diagnostic, even with 20 years of experience', () => {
  const r = sp({ target_role: 'ROLE-OEL', years_experience: 20 });
  assert.equal(r.key, 'assess'); assert.equal(r.href, '#/assessments/excellence-readiness'); assert.equal(r.route_id, 'ROUTE-EX-SA');
});
test('C: weak foundations → Organisational Excellence Foundations first, whatever the aim', () => {
  const r = sp({ target_role: 'ROLE-OEL', interests: 'award' }, [attempt('ASM-READY-EX-001', { 'OE-01': 40, 'OE-02': 80 })]);
  assert.equal(r.key, 'foundation'); assert.equal(r.target_id, 'CRS-EFQM-101'); assert.match(r.reason.en, /gaps/);
});
test('D: a self-assessment lead with demonstrated foundations goes to facilitation; the route skips the foundation courses', () => {
  const att = [attempt('ASM-READY-EX-001', STRONG)];
  const r = sp({ target_role: 'ROLE-OEL' }, att);
  assert.equal(r.key, 'selfassess'); assert.equal(r.target_id, 'CRS-EX-SA'); assert.equal(r.route_id, 'ROUTE-EX-SA');
  const p = route('ROUTE-EX-SA', att);
  for (const id of ['CRS-EFQM-101', 'CRS-EX-RADAR', 'CRS-EX-EVID']) { assert.equal(stepOf(p, id).status, 'Skipped', id); assert.equal(stepOf(p, id).skip_reason, 'demonstrated'); }
  assert.notEqual(stepOf(p, 'CRS-EX-SA').status, 'Skipped');
});
test('E: an award aim (English or Arabic) chooses the award route', () => {
  const att = [attempt('ASM-READY-EX-001', STRONG)];
  assert.equal(sp({ interests: 'King Abdulaziz Quality Award' }, att).key, 'award');
  assert.equal(sp({ career_objectives: 'الاستعداد لجائزة الملك عبدالعزيز للجودة' }, att).route_id, 'ROUTE-EX-AWARD');
});
test('F: an improvement-planning aim chooses the planning route; Arabic wording works', () => {
  const att = [attempt('ASM-READY-EX-001', STRONG)];
  const r = sp({ interests: 'improvement plan and prioritisation' }, att); assert.equal(r.key, 'plan'); assert.equal(r.target_id, 'CRS-EX-PLAN');
  assert.equal(excellenceIntent({ interests: 'خطة التحسين' }), 'plan'); assert.equal(excellenceIntent({ interests: 'التقييم الذاتي' }), 'selfassess');
});
test('G: demonstrated foundations without a specific aim → the EFQM Assessment Lab, with an explained reason', () => {
  const r = sp({ target_role: 'ROLE-QE' }, [attempt('ASM-READY-EX-001', STRONG)]);
  assert.equal(r.key, 'lab'); assert.equal(r.href, '#/academy/excellence/lab');
  assert.ok(r.factors.some(f => f.code === 'ex_evidence' && f.value === 78));
});
test('H: completing the foundations course counts as foundation evidence; the Lab progress is shown as a factor', () => {
  const r = sp({ target_role: 'ROLE-QE' }, [], ['CRS-EFQM-101'], 3);
  assert.equal(r.key, 'lab'); assert.match(r.title.en, /Continue your self-assessment/);
  assert.ok(r.factors.some(f => f.code === 'foundation_completed')); assert.ok(r.factors.some(f => f.code === 'lab_started' && f.value === 3));
});
test('I: evidence close to but below mastery stays on the foundation, and the newest attempt wins', () => {
  const r = sp({ target_role: 'ROLE-OEL' }, [attempt('ASM-READY-EX-001', { 'OE-01': 66, 'OE-02': 69 })]);
  assert.equal(r.key, 'foundation'); assert.match(r.reason.en, /below the 70% mastery mark/);
  const newer = sp({ target_role: 'ROLE-OEL' }, [attempt('ASM-READY-EX-001', { 'OE-01': 40, 'OE-02': 40 }, 1), attempt('ASM-READY-EX-001', STRONG, 3)]);
  assert.equal(newer.key, 'selfassess');
});

test('routes: four excellence routes, steps resolve, skip_if_mastered uses real competencies, role default, navigation entry', () => {
  const q = paths.filter(p => p.kind === 'excellence_route');
  assert.deepEqual(q.map(p => p.id).sort(), [...EX_ROUTES].sort());
  const compIds = new Set(comps.map(c => c.id)), ids = new Set([...courses, ...assessments].map(x => x.id));
  for (const p of q) {
    for (const s of p.steps) { assert.ok(ids.has(s.target_id) || /^KA-/.test(s.target_id), `${p.id}: ${s.target_id}`); for (const c of s.skip_if_mastered || []) assert.ok(compIds.has(c), `${p.id}: ${c}`); }
    for (const c of p.certification_ids) assert.ok(byId(allCerts, c), c);
  }
  for (const [role, rid] of Object.entries(EX_ROLE_ROUTE)) { assert.ok(byId(roles, role), role); assert.ok(byId(paths, rid), rid); }
  const n = byId(nav, 'excellenceAcademy'); assert.equal(n.status, 'active'); assert.equal(n.route, '/academy/excellence');
  const oel = byId(roles, 'ROLE-OEL'); assert.equal(Object.keys(oel.targets).length, comps.length);
  assert.equal(en.nav.items.excellenceAcademy, 'Excellence Academy'); assert.equal(ar.nav.items.excellenceAcademy, 'أكاديمية التميز');
});

test('catalog and relationships: one entry per course with suppression; Q-EFQM-001 reworked with an auto-scored twin', () => {
  for (const id of EX_COURSES) assert.equal(catalog.filter(x => x.target_id === id).length, 1, id);
  for (const id of ['CRS-EFQM-101', 'CRS-EX-RADAR', 'CRS-EX-EVID', 'CRS-EX-PLAN']) assert.ok(catalog.find(x => x.target_id === id).suppress_if_mastered?.length, id);
  assert.ok(rels.some(r => r.fromId === 'CRS-EX-AWARD' && r.relation === 'prepares_for' && r.toId === 'CERT-EFQM-ADV'));
  assert.ok(rels.some(r => r.fromId === 'ASM-READY-EX-001' && r.relation === 'assesses'));
  const demo = byId(questions, 'Q-EFQM-001');
  assert.equal(demo.course_id, 'CRS-EX-EVID'); assert.equal(demo.auto_scored_twin, 'Q-EX-RD-03'); assert.equal(demo.planned_phase, undefined); assert.equal(demo.competency, 'OE-01');
  assert.ok(byId(questions, 'Q-EX-RD-03'));
});

test('figures: every Phase 10 lesson has a valid figure, owned by Phase 10, placed without dangling references; examples say they are illustrative', () => {
  const mine = figures.filter(f => f.id.startsWith('FIG-EX-'));
  assert.ok(mine.length >= 28, String(mine.length));
  for (const f of mine) {
    assert.deepEqual(validateFigure(f), [], f.id); assert.equal(f.owner_phase, 10, f.id); assert.deepEqual(validateGovernance(f), [], f.id);
    if (['scurve', 'bars', 'pareto', 'histogram', 'control', 'scatter'].includes(f.template)) assert.match(f.read.en, /illustrative|lesson example|efqm\.org/i, f.id);
  }
  for (const c of hand) {
    for (const l of c.modules.flatMap(m => m.lessons)) assert.ok(lessonFigures(l, c, figures, placement).length >= 1, l.id);
    assert.ok(courseFigures(c, figures, placement).length >= 4, c.id);
  }
  assert.deepEqual(danglingFigureRefs(placement, figures, courses), []);
  assert.ok(placement.some(e => e.id === 'lab:efqm' && e.figures.includes('FIG-EX-LABFLOW')));
  /* Phase 9 figures are still all there after the Phase 10 build (D-38). */
  assert.ok(figures.filter(f => !f.owner_phase).length >= 102);
});
