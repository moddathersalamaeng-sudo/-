/**
 * Phase 13 — Learning Coach and interview practice (src/domain/coach.mjs): labelled parts, the context builder, weak items,
 * mistake explanation, retrieval, guardrails, rubric-based practice feedback, scenario generation, interview practice,
 * plan my week, weak-area practice and the optional model adapter; governed coach content; strings and wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/domain/coach.mjs';
import { makeEntry } from '../../src/domain/search.mjs';
import { validateRegistry, MAX_TOP } from '../../src/nav/registry.js';
import { json, text, walk } from './_util.mjs';

const T = (en, ar = en) => ({ en, ar });
const coach = json('data/seed/coach.json').items;
const SCN = coach.filter(x => x.kind === 'scenario'), IQ = coach.filter(x => x.kind === 'interview_question');
const COMPS = json('data/seed/competency/competencies.json').items;
const ROLES = json('data/seed/competency/target-roles.json').items;
const CERTS = json('data/seed/certifications.json').items;
const en = json('data/i18n/en.json'), ar = json('data/i18n/ar.json');
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);

/* ---------------------------------------------------------------- labels (ADD-20) */

test('labels: a part without a known label cannot be built or rendered', () => {
  assert.throws(() => C.makePart({ text: 'x' }), e => e.code === 'unlabelled_part');
  assert.throws(() => C.makePart({ label: 'expert', text: 'x' }), e => e.code === 'unlabelled_part');
  assert.throws(() => C.makePart({ label: 'platform' }), e => e.code === 'bad_part');
  assert.equal(C.renderable({ kind: 'text', text: 'x' }), false);
  assert.equal(C.renderable({ label: 'platform', kind: 'text', text: 'x' }), true);
  assert.equal(C.renderable(null), false);
});

test('labels: an interpretation is always uncertain; an external part is only an https link without restated text', () => {
  const ai = C.makePart({ label: 'ai', text: 'maybe' });
  assert.equal(ai.uncertain, true);
  assert.equal(C.renderable({ label: 'ai', kind: 'text', text: 'x' }), false, 'ai without the uncertainty mark is not rendered');
  const ext = C.makePart({ label: 'external', href: 'https://www.pmi.org/pmp', title: 'PMP', text: 'copied words' });
  assert.equal(ext.kind, 'link'); assert.equal(ext.text, undefined);
  assert.throws(() => C.makePart({ label: 'external', href: 'http://insecure.example', title: 'x' }));
  assert.deepEqual(C.labelsOf([ai, ext, { text: 'no label' }]), ['ai', 'external']);
});

test('labels: mixed responses are labelled per part and checkOutput drops what breaks a rule', () => {
  const parts = [C.makePart({ label: 'platform', text: 'a' }), { kind: 'text', text: 'unlabelled' }, { label: 'ai', kind: 'text', text: 'You will definitely pass, guaranteed.', uncertain: true },
    { label: 'ai', kind: 'text', text: 'I would hire you.', uncertain: true }, { label: 'ai', kind: 'text', text: 'هذا سؤال حقيقي من الاختبار', uncertain: true }, C.makePart({ label: 'user', text: 'mine' })];
  const r = C.checkOutput(parts);
  assert.equal(r.ok, false);
  assert.deepEqual(r.parts.map(p => p.label), ['platform', 'user']);
  assert.deepEqual(r.dropped.map(d => d.reason.split(':')[0]), ['unlabelled', 'violation', 'violation', 'violation']);
  assert.deepEqual(C.guardResponse([{ text: 'x' }]).parts.map(p => [p.label, p.kind, p.tkey]), [['platform', 'refusal', 'refuse.nothingSafe']]);
});

/* ---------------------------------------------------------------- context builder (§23) */

test('context: only the permitted fields, each from its source; nothing personal leaks', () => {
  const profile = { goal: 'certification', weekly_hours: '6', name: 'Sara', employer: 'ACME', country: 'SA', email: 'x@y.z', career_objectives: 'private text', current_role: 'QE' };
  const ctx = C.buildCoachContext({ locale: 'en', profile, role: { id: 'ROLE-QE', name: T('Quality Engineer'), targets: {} }, certification: { id: 'CERT-PMP', code: 'PMP®', fee: '405' },
    course: { id: 'C1', title: T('Course'), modules: [] }, lesson: { id: 'L1', title: T('Lesson'), content_blocks: [] },
    gaps: [{ competency_id: 'QM-01', name: T('Planning'), required: 4, current: 2, gap: 2, evidence_source: 'assessment' }, { competency_id: 'QM-02', name: T('Tools'), required: 2, current: 2, gap: 0 }],
    verifiedLevels: { 'QM-01': 2 }, weakGroups: [{ competency: 'QM-01', wrong: 3, repeated: 1, items: [{ last_answer: 'b' }] }],
    attempts: [{ assessment_id: 'A1', score: 40, submitted_at: '2026-11-01T10:00:00Z', answers: { q: 'b' } }], labAttempts: [], assessments: [{ id: 'A1', title: T('Check') }],
    completed: ['C0'], milestone: { title: T('M1'), due: '2026-12-01' }, assignments: [{ due_state: 'open', state: 'not_started', item: { title: T('Assigned'), type: 'course', due: '2026-11-30', company: 'ACME', note: 'secret' } }, { due_state: 'completed', item: { title: T('Done'), type: 'course', due: '2026-10-01' } }],
    compName: () => T('Planning') });
  assert.deepEqual(Object.keys(ctx).sort(), [...C.CONTEXT_FIELDS].sort());
  assert.equal(ctx.weekly_hours, 6);
  assert.deepEqual(ctx.gaps.map(g => [g.competency, g.gap, g.source]), [['QM-01', 2, 'verified']]);
  assert.deepEqual(ctx.weak_items, [{ competency: 'QM-01', name: T('Planning'), wrong: 3, repeated: 1 }]);
  assert.deepEqual(ctx.target_certification, { id: 'CERT-PMP', code: 'PMP®' });
  assert.equal(ctx.assignments.length, 1);
  const dump = JSON.stringify(ctx);
  for (const leak of ['Sara', 'ACME', 'x@y.z', 'private text', 'secret', '405', '"answers"', 'last_answer']) assert.ok(!dump.includes(leak), leak);
  assert.deepEqual(C.buildCoachContext({}), { locale: 'ar' });
  assert.deepEqual(C.contextPreview(ctx).map(([k]) => k), C.CONTEXT_FIELDS);
});

/* ---------------------------------------------------------------- weak items */

const at = (id, when, rows) => ({ assessment_id: id, submitted_at: when, answers: Object.fromEntries(rows.map(r => [r[0], r[2] || 'x'])),
  detail: rows.map(([question_id, correct, , extra]) => ({ question_id, auto: true, correct, competency: question_id.startsWith('a') ? 'X-01' : 'Y-01', ...(extra || {}) })) });

test('weak items: the latest attempt wins; repeated means missed twice or more; items awaiting review never count', () => {
  const attempts = [at('A', '2026-11-01', [['a1', false], ['a2', false], ['b1', false]]), at('A', '2026-11-02', [['a1', false], ['a2', true], ['b1', false, 'x', { auto: false }]]), at('A', '2026-11-03', [['a3', false]])];
  const items = C.weakItems({ attempts, questions: [] });
  assert.deepEqual(items.map(i => [i.id, i.wrong, i.repeated]), [['a1', 2, true], ['a3', 1, false], ['b1', 1, false]]);
  assert.ok(!items.some(i => i.id === 'a2'), 'answered right in the latest attempt → not weak');
  const g = C.groupWeak(items);
  assert.deepEqual(g.map(x => [x.competency, x.wrong, x.repeated, x.items.length]), [['X-01', 3, 1, 2], ['Y-01', 1, 0, 1]]);
});

test('weak items: lab tasks are included; pending written tasks are not', () => {
  const labAttempts = [{ lab_id: 'LAB-1', submitted_at: '2026-11-01', answers: { t1: 'a' }, detail: [{ task_id: 't1', auto: true, correct: false, competency: 'AUD-01' }, { task_id: 't2', auto: false, pending: true, competency: 'AUD-01' }, { task_id: 't3', auto: true, pending: true }] }];
  assert.deepEqual(C.weakItems({ labAttempts }).map(i => [i.kind, i.id, i.lab_id]), [['lab_task', 't1', 'LAB-1']]);
});

/* ---------------------------------------------------------------- mistake explanation */

const Q1 = { id: 'q1', type: 'single_choice', competency: 'QM-03', prompt: T('Which is corrective action?'), correct_answer: 'b', explanation: T('Corrective action removes the cause.'),
  options: [{ id: 'a', text: T('Rework the part'), why: T('That is correction: it fixes the case only.') }, { id: 'b', text: T('Remove the cause'), why: T('It prevents recurrence.') }] };
const Q2 = { ...Q1, id: 'q2', prompt: T('Unattempted question'), explanation: T('CIA original learning item; review the linked concept and evidence.') };

test('explain my mistakes: stored rationales only, grouped by competency, never for unattempted questions', () => {
  const attempt = { answers: { q1: 'a' }, detail: [{ question_id: 'q1', auto: true, correct: false, competency: 'QM-03' }, { question_id: 'q9', auto: true, correct: true }] };
  const r = C.explainMistakes(attempt, [Q1, Q2]);
  assert.equal(r.total, 1); assert.equal(r.groups[0].competency, 'QM-03');
  const parts = r.groups[0].items[0].parts;
  assert.deepEqual(parts.map(p => [p.label, p.lead]), [['user', 'yourAnswer'], ['platform', 'whyNot'], ['platform', 'correctAnswer'], ['platform', 'why'], ['platform', 'explanation']]);
  assert.ok(!JSON.stringify(r).includes('Unattempted'), 'a question outside the attempt is never explained');
  assert.deepEqual(r.summary.map(p => p.label), ['user', 'ai']);
  assert.ok(r.summary[1].uncertain);
  const blank = C.explainMistakes({ answers: {}, detail: [{ question_id: 'q1', auto: true, correct: false }] }, [Q1]);
  assert.deepEqual(blank.groups[0].items[0].parts.map(p => p.tkey), ['mistakes.notAnswered'], 'a blank answer is listed without its key');
  assert.equal(C.explainMistakes({ detail: [{ question_id: 'q1', auto: true, correct: true }] }, [Q1]).total, 0);
  const generic = C.explainMistakes({ answers: { q2: 'a' }, detail: [{ question_id: 'q2', auto: true, correct: false }] }, [Q2]);
  assert.ok(!generic.groups[0].items[0].parts.some(p => p.lead === 'explanation'), 'the generic placeholder explanation is not shown');
});

test('explain lab mistakes: model answer and reasoning; pending and correct tasks left out', () => {
  const lab = { tasks: [{ id: 't1', type: 'single_choice', competency: 'AUD-03', prompt: T('p'), options: [{ id: 'a', text: T('A'), why: T('no') }, { id: 'b', text: T('B'), correct: true }], model_answer: T('B'), reasoning: T('because') },
    { id: 't2', type: 'free_text', prompt: T('write'), model_answer: T('m') }] };
  const r = C.explainLabMistakes(lab, { answers: { t1: 'a' }, detail: [{ task_id: 't1', auto: true, correct: false }, { task_id: 't2', auto: false, pending: true }] });
  assert.equal(r.total, 1);
  assert.deepEqual(r.groups[0].items[0].parts.map(p => p.lead), ['yourAnswer', 'whyNot', 'modelAnswer', 'reasoning']);
});

/* ---------------------------------------------------------------- retrieval */

const E = [makeEntry({ type: 'course', id: 'C-ISO', href: '#/academy/courses/iso', title: T('Corrective action in ISO'), academy: 'iso' }),
  makeEntry({ type: 'course', id: 'C-PM', href: '#/academy/courses/pm', title: T('Corrective action in projects'), academy: 'pmi' }),
  makeEntry({ type: 'lesson', id: 'C-PM-L1', href: '#/academy/courses/pm/L1', title: T('Corrective action basics'), academy: 'pmi' }),
  makeEntry({ type: 'course', id: 'C-DRAFT', href: '#/academy/courses/draft', title: T('Corrective action draft'), academy: 'iso' })];

test('retrieval: only entries the viewer may see; ranking follows the focus of the learner and is deterministic', () => {
  const allow = e => e.id !== 'C-DRAFT';
  const iso = C.retrieve(E, 'corrective action', { focus: { academy: 'iso' }, allow });
  const pm = C.retrieve(E, 'corrective action', { focus: { academy: 'pmi', courseId: 'C-PM' }, allow });
  assert.equal(iso[0].id, 'C-ISO'); assert.ok(['C-PM', 'C-PM-L1'].includes(pm[0].id)); assert.notEqual(iso[0].id, pm[0].id);
  assert.ok(!iso.some(e => e.id === 'C-DRAFT') && !pm.some(e => e.id === 'C-DRAFT'), 'a record the governance filter rejects is never retrieved');
  assert.deepEqual(C.retrieve(E, 'corrective action', { focus: { academy: 'iso' }, allow }).map(e => e.id), iso.map(e => e.id));
  const weak = C.retrieve(E, 'corrective action', { focus: { weak: ['QM-03'] }, allow, compsOf: e => (e.id === 'C-PM' ? ['QM-03'] : []) });
  assert.equal(weak[0].id, 'C-PM'); assert.deepEqual(weak[0].why.weak, ['QM-03']);
  assert.deepEqual(C.retrieve(E, 'zzzz qqqq', { allow }), []);
});

test('ask: two learners with different context get different, grounded, per-part labelled answers', () => {
  const allow = e => e.id !== 'C-DRAFT';
  const a = C.askCoach({ question: 'corrective action', entries: E, focus: { academy: 'iso' }, allow });
  const b = C.askCoach({ question: 'corrective action', entries: E, focus: { academy: 'pmi', courseId: 'C-PM', weak: ['QM-03'] }, allow, compsOf: e => (e.id.startsWith('C-PM') ? ['QM-03'] : []),
    weakGroups: [{ competency: 'QM-03', wrong: 4, repeated: 2, items: [] }], courseTitle: 'PM course' });
  assert.notDeepEqual(a.parts.filter(p => p.kind === 'passage').map(p => p.id), b.parts.filter(p => p.kind === 'passage').map(p => p.id));
  assert.ok(a.parts.every(C.renderable) && b.parts.every(C.renderable));
  assert.ok(C.labelsOf(b.parts).length >= 3, 'platform + user + ai');
  assert.ok(a.parts.filter(p => p.kind === 'passage').every(p => p.label === 'platform' && p.href.startsWith('#/')), 'every passage links to its source page');
  assert.equal(b.parts.find(p => p.label === 'user').tkey, 'ask.weakTie');
  assert.equal(b.parts.at(-1).tkey, 'ask.focusCourse');
  const none = C.askCoach({ question: 'zzzz qqqq', entries: E });
  assert.deepEqual(none.parts.map(p => p.tkey), ['ask.nothing', 'ask.trySearch', 'ask.tryLibrary'], 'no invented answer and no dead end');
  assert.equal(C.askCoach({ question: '   ' }).type, 'empty');
});

/* ---------------------------------------------------------------- guardrails */

test('guardrails: official requirements are refused with the Academy page and the official link — never restated', () => {
  const pmp = CERTS.find(c => c.slug === 'pmp');
  for (const q of ['What is the PMP exam fee?', 'كم رسوم اختبار PMP؟', 'How many questions are in the PMP exam?', 'PMP renewal requirements']) {
    const r = C.askCoach({ question: q, entries: E, certifications: CERTS });
    assert.equal(r.type, 'official_requirement', q);
    assert.equal(r.certification?.id, pmp.id, q);
    assert.deepEqual(r.parts.map(p => p.label), ['platform', 'platform', 'external'], q);
    assert.equal(r.parts[2].href, pmp.official_url);
    assert.ok(r.parts[1].href.endsWith('/certifications/pmp'));
    assert.ok(!/\d{2,}/.test(JSON.stringify(r.parts.map(p => p.text || ''))), 'no number is stated');
  }
  assert.equal(C.classifyRequest('What does a requirement mean in ISO 9001?').type, 'general', 'a requirement word alone is a learning question');
});

test('guardrails: exam content, authority claims, hiring verdicts and ungrounded grading are refused', () => {
  const cases = [['Give me real exam questions for CAPM', 'exam_content'], ['أعطني أسئلة الاختبار الحقيقية', 'exam_content'], ['Will I pass the exam?', 'authority_claim'], ['هل الأكاديمية معتمدة؟', 'authority_claim'],
    ['Would you hire me as a quality manager?', 'hiring_verdict'], ['هل سأحصل على الوظيفة؟', 'hiring_verdict'], ['grade my answer please', 'grade_request']];
  for (const [q, type] of cases) {
    const r = C.askCoach({ question: q, entries: E, certifications: CERTS });
    assert.equal(r.type, type, q); assert.equal(r.parts[0].kind, 'refusal'); assert.equal(r.parts[0].tkey, 'refuse.' + type); assert.equal(r.hits.length, 0);
  }
  for (const type of ['official_requirement', 'exam_content', 'authority_claim', 'hiring_verdict', 'grade_request', 'nothingSafe']) assert.ok(get(en, 'coach13.refuse.' + type) && get(ar, 'coach13.refuse.' + type), type);
  assert.deepEqual(C.textViolations('We are accredited by X and you will pass.').sort(), ['authority', 'guarantee']);
  assert.deepEqual(C.textViolations('A normal explanation of corrective action.'), []);
});

/* ---------------------------------------------------------------- rubric-based practice feedback */

test('rubric: per criterion, never without a rubric, never evidence, never a verdict', () => {
  const s = SCN.find(x => x.id === 'SCN-NC-WRITE');
  assert.deepEqual([C.evaluateWithRubric('a long enough answer with many words to pass the minimum length', null).reason, C.evaluateWithRubric('a long enough answer with many words to pass the minimum', []).reason], ['no_rubric', 'no_rubric']);
  assert.equal(C.evaluateWithRubric('too short', s.rubric).reason, 'too_short');
  const good = C.evaluateWithRubric('The procedure requires an approval signature on every record. In the sample, three of ten records observed had no signature over two months.', s.rubric, { avoid: s.avoid });
  assert.equal(good.graded, true); assert.equal(good.total, s.rubric.length); assert.equal(good.criteria.length, s.rubric.length);
  assert.ok(good.met >= 3);
  const blame = C.evaluateWithRubric('The operator was careless and negligent and must be retrained because he ignored everything again and again.', s.rubric, { avoid: s.avoid });
  assert.equal(blame.criteria.find(c => c.check === 'avoid').level, 'not_yet');
  for (const r of [good, blame, C.evaluateWithRubric('x', s.rubric), C.evaluateWithRubric('x', null)]) { assert.equal(r.evidence, false); assert.equal(r.verdict, null); assert.equal(r.uncertain, true); assert.equal(r.method, 'keyword'); }
  const ar1 = C.evaluateWithRubric('ينص الإجراء على توقيع اعتماد لكل سجل، ولوحظ في العينة أن ثلاثة من أصل عشرة سجلات بلا توقيع منذ شهرين.', s.rubric, { avoid: s.avoid });
  assert.ok(ar1.graded && ar1.met >= 2, 'Arabic answers are checked with the Arabic terms');
  const cov = C.coverage('we set a measurable target', 'Set a measurable target with a baseline and an indicator');
  assert.equal(cov.scored, false); assert.equal(cov.evidence, false); assert.ok(cov.covered.includes('measurable') && cov.missing.includes('baseline'));
});

/* ---------------------------------------------------------------- scenario templates */

test('scenario templates: valid, bilingual, in the framework; generation is deterministic for a seed and labelled practice', () => {
  const ids = COMPS.map(c => c.id);
  assert.equal(SCN.length, 8);
  for (const t of SCN) assert.deepEqual(C.validateScenarioTemplate(t, ids), [], t.id);
  assert.ok(C.validateScenarioTemplate({ ...SCN[0], text: T('no slots') }, ids).includes('slots_mismatch_en'));
  assert.ok(C.validateScenarioTemplate({ ...SCN[0], rubric: [] }, ids).includes('rubric_too_short'));
  const a = C.generateScenario(SCN, { competency: 'AUD-03', seed: 'u1:0' }), b = C.generateScenario(SCN, { competency: 'AUD-03', seed: 'u1:0' });
  assert.deepEqual(a, b);
  assert.equal(a.label, 'generated_practice');
  assert.ok(a.competencies.includes('AUD-03'));
  assert.ok(!/\{\w+\}/.test(a.text.en + a.text.ar), 'every slot is filled in both languages');
  const texts = new Set(Array.from({ length: 12 }, (_, i) => C.generateScenario(SCN, { seed: 'u1:' + i }).text.en));
  assert.ok(texts.size >= 6, 'different seeds give different scenarios');
  assert.equal(C.generateScenario([], {}), null);
  assert.equal(C.generateScenario(SCN, { competency: 'NOPE', academy: 'pmi', seed: '1' }).academy, 'pmi');
});

/* ---------------------------------------------------------------- interview practice */

test('interview bank: one governed question per competency, three key points with terms in both languages, no verdict wording', () => {
  assert.deepEqual(IQ.map(q => q.competency).sort(), COMPS.map(c => c.id).sort());
  for (const q of IQ) {
    assert.equal(q.key_points.length, 3, q.id);
    for (const p of q.key_points) assert.ok(p.t.en && p.t.ar && p.terms.en.length && p.terms.ar.length, q.id);
  }
  const all = JSON.stringify(coach) + JSON.stringify(en.coach13) + JSON.stringify(ar.coach13);
  for (const bad of [/you (are|will be) hired/i, /pass(ed)? the interview/i, /failed the interview/i, /accredited by/i, /نجحت في المقابلة/, /سيتم توظيفك/]) assert.ok(!bad.test(all), String(bad));
  assert.match(en.coach13.interview.honesty, /no hiring decision/); assert.match(ar.coach13.interview.honesty, /لا تعطي قرار توظيف/);
});

test('interview: questions follow the role, weak competencies first, adaptive follow-ups; company-defined roles work', () => {
  const role = ROLES.find(r => r.id === 'ROLE-QE');
  const weakId = Object.entries(role.targets).filter(([, v]) => v > 0).map(([k]) => k).sort().at(-1);
  const qs = C.interviewQuestionsFor(role, IQ, { competencies: COMPS, weak: [weakId], gaps: [], count: 5 });
  assert.equal(qs.length, 5); assert.equal(qs[0].competency, weakId); assert.equal(qs[0].ask_follow_up, true); assert.equal(qs[1].ask_follow_up, false);
  assert.ok(qs.every(q => role.targets[q.competency] > 0));
  const gapped = C.interviewQuestionsFor(role, IQ, { competencies: COMPS, gaps: [{ competency_id: qs[3].competency, gap: 3 }], count: 3 });
  assert.equal(gapped[0].competency, qs[3].competency); assert.equal(gapped[0].ask_follow_up, true);
  const custom = C.interviewQuestionsFor({ id: 'CR-1', custom: true, name: T('Site QA'), targets: { 'QM-01': 3, 'AUD-01': 0 } }, [], { competencies: COMPS });
  assert.deepEqual(custom.map(q => [q.id, q.generated, q.prompt_key]), [['IQF-QM-01', true, 'interview.fallbackPrompt']], 'without a visible bank the question comes from the published framework');
  assert.ok(custom[0].key_points.length >= 1);
  assert.deepEqual(C.interviewQuestionsFor(null, IQ), []);
});

test('interview scoring: knowledge, depth and communication from the answer; a session is self-declared practice with no verdict', () => {
  const q = IQ.find(x => x.competency === 'QM-01');
  const strong = 'First, we linked the objective to a customer requirement and the strategy. Then we made it measurable with an indicator, a baseline and a target date. For example, in my last project we planned actions with an owner and resources, reviewed progress monthly, and as a result complaints reduced because the plan was followed.';
  const s = C.scoreInterviewAnswer(strong, q);
  assert.equal(s.knowledge, 3); assert.equal(s.depth, 3); assert.equal(s.communication, 3);
  const weak = C.scoreInterviewAnswer('I do not know much about this topic really sorry', q);
  assert.equal(weak.knowledge, 0); assert.ok(weak.depth <= 1);
  assert.equal(C.scoreInterviewAnswer('', q).total, 0);
  for (const r of [s, weak]) { assert.equal(r.verdict, null); assert.equal(r.evidence, false); assert.equal(r.uncertain, true); }
  const role = ROLES[0];
  const session = C.makeInterviewSession({ id: 'INT-1', role, items: [{ question: q, answer: strong }, { question: IQ[1], answer: 'short answer only here' }], now: '2026-11-16T10:00:00Z', lang: 'en' });
  assert.equal(session.status, 'self_declared_practice'); assert.equal(session.evidence, false);
  assert.deepEqual(Object.keys(session.totals), C.INTERVIEW_DIMENSIONS);
  assert.deepEqual(session.weak_topics, [IQ[1].competency]);
  const keys = JSON.stringify(Object.keys(session)) + JSON.stringify(Object.keys(session.items[0]));
  for (const k of ['verdict', 'passed', 'hire', 'recommendation', 'result']) assert.ok(!keys.includes(k), k);
  assert.throws(() => C.makeInterviewSession({ items: [] }), e => e.code === 'bad_session');
  const sum = C.interviewSummary([session, { schema: 'other' }]);
  assert.deepEqual([sum.count, sum.last, sum.status, sum.evidence], [1, '2026-11-16', 'self_declared_practice', false]);
});

/* ---------------------------------------------------------------- plan my week */

const course = (id, n = 3) => ({ id, title: T(id), modules: [{ lessons: Array.from({ length: n }, (_, i) => ({ id: `${id}-L${i + 1}`, title: T(`${id} lesson ${i + 1}`), estimated_minutes: 40 })) }] });

test('plan my week: company assignments by due date first, then the 30-day plan, in-progress and roadmap; weak-area reviews added', () => {
  const [a, b, c, d, e] = ['CA', 'CB', 'CC', 'CD', 'CE'].map(x => course(x));
  const plan = C.planMyWeek({ assigned: [{ course: b, due: '2026-12-20' }, { course: a, due: '2026-12-01' }], planCourses: [c, a], inProgress: [d], milestoneCourses: [e], progress: [],
    weeklyHours: 4, start: new Date('2026-11-16T08:00:00Z'), weakGroups: [{ competency: 'QM-03' }, { competency: 'AUD-01' }] });
  assert.deepEqual(plan.sources, [{ course_id: 'CA', kind: 'assignment', due: '2026-12-01' }, { course_id: 'CB', kind: 'assignment', due: '2026-12-20' }, { course_id: 'CC', kind: 'plan30', due: null }]);
  assert.equal(plan.sessions[0].items[0].course.id, 'CA', 'the soonest assignment leads the plan');
  assert.ok(plan.reviews >= 1 && plan.sessions[0].review.competency === 'QM-03');
  const done = C.planMyWeek({ assigned: [{ course: a, due: '2026-12-01' }], inProgress: [d], progress: [{ id: 'CA', completed_lessons: ['CA-L1', 'CA-L2', 'CA-L3'] }], start: new Date('2026-11-16T08:00:00Z') });
  assert.deepEqual(done.sources.map(s => [s.course_id, s.kind]), [['CD', 'in_progress']], 'a finished course is not planned');
  assert.equal(done.reviews, 0);
  assert.deepEqual(C.planMyWeek({}).sessions, []);
  const ics = C.planForIcs(plan, { compName: id => 'Name of ' + id });
  assert.equal(ics.sessions[0].items.at(-1).lesson.title, 'Name of QM-03');
});

/* ---------------------------------------------------------------- weak-area practice */

test('practice questions: never from a final test, never one already answered right, deterministic; feedback is not evidence', () => {
  const pool = ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => ({ ...Q1, id })).concat([{ ...Q1, id: 'pX', competency: 'OTHER' }, { ...Q1, id: 'pT', type: 'short_answer' }]);
  const assessments = [{ id: 'A', kind: 'readiness', question_ids: ['p1', 'p2', 'p3', 'pX', 'pT'] }, { id: 'F', kind: 'final', question_ids: ['p4'] }, { id: 'P', kind: 'practical', question_ids: ['p5'] }];
  const allowed = C.practicePoolIds(assessments);
  assert.deepEqual(allowed.sort(), ['p1', 'p2', 'p3', 'pT', 'pX']);
  const attempts = [{ submitted_at: '2026-11-01', detail: [{ question_id: 'p1', auto: true, correct: true }, { question_id: 'p2', auto: true, correct: false }] }];
  const qs = C.practiceQuestions({ competency: 'QM-03', pool, attempts, allowedIds: allowed, seed: 's' });
  assert.deepEqual(qs.map(q => q.id), ['p3', 'p2'], 'unseen first, then still wrong; mastered and final-test items excluded');
  assert.deepEqual(C.practiceQuestions({ competency: 'QM-03', pool, attempts, allowedIds: allowed, seed: 's' }).map(q => q.id), ['p3', 'p2']);
  const fb = C.practiceFeedback(Q1, 'a');
  assert.deepEqual([fb.correct, fb.evidence], [false, false]); assert.deepEqual(fb.parts.map(p => p.lead), ['yourAnswer', 'whyNot', 'correctAnswer', 'why', 'explanation']);
  assert.equal(C.practiceFeedback(Q1, 'b').correct, true); assert.equal(C.practiceFeedback(Q1, 'zz').answered, false);
  assert.deepEqual(C.explainWeakItem({ kind: 'question', last_answer: 'a' }, Q1).map(p => p.label), ['user', 'platform', 'platform', 'platform', 'platform']);
  assert.deepEqual(C.explainWeakItem({ kind: 'lab_task' }, Q1), []);
});

/* ---------------------------------------------------------------- optional model adapter (D-98) */

test('model adapter: absent without an https endpoint; no credential in the client; opt-in required; payload equals the preview', async () => {
  assert.equal(C.adapterConfig(json('data/config.json')), null, 'the shipped configuration has no adapter');
  for (const bad of [{}, { coach: { enabled: true } }, { coach: { enabled: false, endpoint: 'https://x.example/c' } }, { coach: { enabled: true, endpoint: 'http://x.example/c' } },
    { coach: { enabled: true, endpoint: 'https://x.example/c?api_key=abc' } }, { coach: { enabled: true, endpoint: 'https://user:pw@x.example/c' } }, { coach: { enabled: true, endpoint: 'https://x.example/sk-123' } }]) assert.equal(C.adapterConfig(bad), null, JSON.stringify(bad));
  const cfg = C.adapterConfig({ coach: { enabled: true, endpoint: 'https://coach.example.test/ask', name: 'Proxy' } });
  assert.equal(cfg.endpoint, 'https://coach.example.test/ask');
  const context = C.buildCoachContext({ locale: 'en', profile: { goal: 'improve', name: 'Sara' }, weakGroups: [{ competency: 'QM-03', wrong: 2, repeated: 1 }] });
  const payload = C.modelPayload({ context: { ...context, secret: 'x', name: 'Sara' }, question: ' What is CAPA? ', locale: 'en' });
  assert.deepEqual(payload.context, Object.fromEntries(C.contextPreview(context)), 'what is sent is exactly what is previewed');
  assert.deepEqual(Object.keys(payload).sort(), ['context', 'locale', 'question', 'schema']); assert.equal(payload.question, 'What is CAPA?');
  let calls = 0;
  const fetchImpl = async (url, init) => { calls++; assert.equal(init.credentials, 'omit'); assert.deepEqual(JSON.parse(init.body), payload); return { ok: true, json: async () => ({ parts: ['A helpful idea.', 'You will definitely pass, guaranteed.', { text: 'Another idea.' }] }) }; };
  await assert.rejects(C.callModel({ cfg: null, payload, optIn: true, fetchImpl }), e => e.code === 'adapter_absent');
  await assert.rejects(C.callModel({ cfg, payload, optIn: false, fetchImpl }), e => e.code === 'opt_in_required');
  assert.equal(calls, 0, 'nothing is sent without the opt-in');
  const res = await C.callModel({ cfg, payload, optIn: true, fetchImpl });
  assert.deepEqual(res.parts.map(p => [p.label, p.uncertain, p.text]), [['ai', true, 'A helpful idea.'], ['ai', true, 'Another idea.']], 'model output is labelled ai, uncertain, and passes the same guardrails');
  await assert.rejects(C.callModel({ cfg, payload, optIn: true, fetchImpl: async () => ({ ok: false, status: 500 }) }), e => e.code === 'adapter_failed');
});

test('no API key or third-party endpoint in any client file', () => {
  const files = [...walk('src', '.js'), ...walk('src', '.mjs'), 'index.html', 'data/config.json'];
  for (const f of files) {
    const s = text(f);
    assert.ok(!/sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}/i.test(s), f);
    assert.ok(!/api\.(openai|anthropic)\.com|generativelanguage\.googleapis/i.test(s), f);
  }
  assert.equal(json('data/config.json').coach, undefined);
});

/* ---------------------------------------------------------------- governed content, strings, wiring */

test('coach content is governed: needs_review until a person approves it; figures placed; collection reviewable', () => {
  assert.equal(json('data/seed/coach.json').schema, 'cia.coach.v1');
  for (const r of coach) {
    assert.equal(r.owner_phase, '13', r.id);
    if (r.governance.content_status === 'published') { assert.ok(r.governance.reviewer, r.id); assert.match(r.governance.approved_hash || '', /^[0-9a-f]{64}$/, r.id); }
    else { assert.equal(r.governance.content_status, 'needs_review', r.id); assert.equal(r.governance.reviewer, null, r.id); }
  }
  const figs = json('data/seed/figures.json').items.filter(f => f.owner_phase === '13');
  assert.deepEqual(figs.map(f => f.id).sort(), ['FIG-COACH-FLOW', 'FIG-COACH-INTERVIEW', 'FIG-COACH-LABELS']);
  const placed = Object.fromEntries(json('data/seed/lesson-figures.json').items.map(x => [x.id, x.figures]));
  assert.deepEqual([placed['coach:main'], placed['coach:labels'], placed['coach:interview']], [['FIG-COACH-FLOW'], ['FIG-COACH-LABELS'], ['FIG-COACH-INTERVIEW']]);
  assert.match(text('tools/apply_review_decisions.py'), /"coach"/);
  assert.match(text('src/views/review.js'), /\['coach', 'coach'\]/);
});

test('strings: coach13 is complete and balanced in both languages; every template key used by the engine exists', () => {
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]));
  const fe = Object.fromEntries(flat(en.coach13)), fa = Object.fromEntries(flat(ar.coach13));
  assert.deepEqual(Object.keys(fe).sort(), Object.keys(fa).sort());
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(fe)) { assert.ok(String(fa[k]).trim() && String(fe[k]).trim(), k); assert.equal(ph(fe[k]), ph(fa[k]), k); }
  const src = ['src/domain/coach.mjs', 'src/ui/coach.js', 'src/views/coach.js'].map(text).join('\n');
  const keys = new Set([...src.matchAll(/tkey: '([\w.]+)'/g)].map(m => m[1]));
  for (const m of src.matchAll(/tc\(ctx, '([\w.]+)'[,)]/g)) keys.add(m[1]);
  for (const m of src.matchAll(/lead: '(\w+)'/g)) if (!m[1].startsWith('block')) keys.add('lead.' + m[1]);
  for (const t of ['concept', 'common_mistake', 'evidence', 'worked_example', 'generic']) for (let i = 0; i < ({ concept: 3, generic: 3 }[t] || 2); i++) keys.add(`socratic.${t}.${i}`);
  for (const t of C.REQUEST_TYPES.filter(x => !['general', 'empty'].includes(x))) keys.add('refuse.' + t);
  for (const l of C.LABELS) { keys.add('label.' + l); keys.add('labelLong.' + l); }
  for (const f of C.CONTEXT_FIELDS) keys.add('model.field.' + f);
  for (const d of C.INTERVIEW_DIMENSIONS) { keys.add('interview.dim.' + d); keys.add('interview.dimHint.' + d); }
  const missing = [...keys].filter(k => !k.endsWith('.') && fe[k] === undefined);
  assert.deepEqual(missing, []);
  assert.ok(keys.size > 120);
  assert.equal(get(en, 'x10a.my.tabs.coach'), 'Coach'); assert.ok(get(ar, 'x10a.my.tabs.coach'));
});

test('wiring: a My space tab and a page, no new top-level item; stylesheet linked; storage stays in cia:v1', () => {
  const nav = json('data/seed/navigation.json').items;
  assert.deepEqual(validateRegistry(nav), []);
  assert.equal(nav.filter(e => e.placement === 'top').length, MAX_TOP);
  const c = nav.find(e => e.id === 'coach');
  assert.deepEqual([c.status, c.placement, c.mergedInto], ['active', 'hidden', 'mySpace']);
  assert.match(text('src/views/myspace.js'), /MY_TABS = \[[^\]]*'coach'\]/);
  const main = text('src/main.js');
  assert.match(main, /path: '\/coach\/interview'/);
  for (const col of ['interview_sessions', 'coach_prefs']) assert.match(main, new RegExp(`collection: '${col}'`));
  assert.match(text('index.html'), /assets\/css\/coach\.css/);
  for (const f of ['src/views/coach.js', 'src/ui/coach.js', 'src/domain/coach.mjs']) assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(text(f)), f + ' goes through the repositories only');
  assert.ok(!/\bfetch\(/.test(text('src/views/coach.js') + text('src/ui/coach.js')), 'views never call the network; the adapter is the only caller and is off by default');
  assert.match(text('src/views/assessments.js'), /mistakesBlock\(/); assert.match(text('src/views/labs.js'), /labMistakesBlock\(/);
  assert.match(text('src/views/courses.js'), /lessonCoachPanel\(/); assert.match(text('src/views/courses.js'), /courseCoachPanel\(/);
});

/* ---------------------------------------------------------------- questions asked in sentences (D-107) */

test('retrieval understands a question asked as a sentence, in Arabic and English: stop words dropped, attached particles removed, partial matches said to be partial', () => {
  assert.deepEqual(C.questionTerms('What is the difference between correction and corrective action?'), ['correction', 'corrective', 'action']);
  assert.deepEqual(C.questionTerms('ما الفرق بين التصحيح والإجراء التصحيحي؟'), ['تصحيح', 'اجراء', 'تصحيحي']);
  assert.deepEqual(C.questionTerms('what is it'), ['what', 'is', 'it'], 'a question made only of stop words keeps its words');
  const index = json('data/search-index.json').items;
  for (const q of ['What is the difference between correction and corrective action?', 'ما الفرق بين التصحيح والإجراء التصحيحي؟']) {
    const hits = C.retrieve(index, q, { limit: 3 });
    assert.equal(hits.length, 3, q);
    assert.ok(hits.every(h => !h.partial && /correcti/i.test(h.ti.en)), q + ' → ' + hits.map(h => h.ti.en).join(' | '));
    assert.deepEqual(C.retrieve(index, q, { limit: 3 }).map(h => h.id), hits.map(h => h.id), 'deterministic');
  }
  const loose = C.retrieve(index, 'How do I build a risk register for a project?', { limit: 3 });
  assert.ok(loose.length && loose.every(h => h.partial), 'no page holds every word → partial');
  const a = C.askCoach({ question: 'How do I build a risk register for a project?', entries: index });
  assert.ok(a.parts.some(p => p.tkey === 'ask.partial' && p.label === 'ai'));
  assert.ok(!C.askCoach({ question: 'corrective action', entries: index }).parts.some(p => p.tkey === 'ask.partial'));
  assert.deepEqual(C.retrieve(index, 'zzqq xxyy quantum weather forecast', {}), [], 'fewer than half of the words known → no answer');
  assert.ok(get(en, 'coach13.ask.partial') && get(ar, 'coach13.ask.partial'));
});

test('the single-file review build takes its stylesheets from index.html, so it cannot miss one (coach.css)', () => {
  const tool = text('tools/build_review_bundle.mjs');
  assert.match(tool, /read\('index\.html'\)\.matchAll/);
  assert.ok(!/\['tokens\.css', 'app\.css'/.test(tool), 'no hand-kept stylesheet list');
});
