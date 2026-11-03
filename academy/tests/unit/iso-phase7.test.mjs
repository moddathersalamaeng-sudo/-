/** Phase 7 — ISO Academy: curriculum contract, data integrity, governance and acceptance scenarios A–I. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, ownerApproved, futureDraft, FUTURE_DRAFTS } from './_util.mjs';
import { validateCourse, courseCompleteness, prerequisiteState, LESSON_BLOCKS } from '../../src/domain/courses.mjs';
import { validateAssessment, validateQuestion, scoreAttempt, competencyBreakdown, gradeQuestion, UNKNOWN } from '../../src/domain/assessments.mjs';
import { validateGovernance, isVisible } from '../../src/data/governance.js';
import { RelationshipIndex } from '../../src/data/relationships.js';
import { isoStartingPoint, standardBundle, ISO_ROUTES } from '../../src/domain/iso.mjs';
import { assessmentEvidence, masteredCompetencies, completedTargets, courseStatus, percentMap } from '../../src/domain/learner-model.mjs';
import { calculateGaps, generateRecommendations, buildLearningPath, suppressDemonstrated, prerequisiteStatus } from '../../src/domain/recommendations.mjs';

const seed = n => json(`data/seed/${n}.json`).items;
const standards = seed('iso-standards'), courses = seed('courses'), questions = seed('questions'), assessments = seed('assessments');
const tools = seed('platform-modules'), sources = seed('sources'), articles = seed('knowledge-articles'), library = seed('library-items');
const paths = seed('learning-paths'), catalog = seed('recommendation-catalog'), rels = seed('relationships');
const comps = json('data/seed/competency/competencies.json').items, roles = json('data/seed/competency/target-roles.json').items;
/* Hand-authored Phase 7 ISO courses. Courses generated from a toolkit guide (c.guide) have their own contract in guides.test.mjs. */
const isoCourses = courses.filter(c => c.ecosystem === 'iso' && !c.guide);
const qIds = questions.map(q => q.id), aIds = assessments.map(a => a.id);
const byId = (list, id) => list.find(x => x.id === id);
const bi = v => v && v.en?.trim() && v.ar?.trim();

test('the 15 ISO courses required by the Phase 7 prompt exist, with unique ids and slugs', () => {
  const need = ['CRS-ISO-101', 'CRS-ISO-READ', 'CRS-ISO-9001-F', 'CRS-ISO-9001-IMP', 'CRS-ISO-9001-AUD', 'CRS-ISO-14001-F', 'CRS-ISO-14001-AUD', 'CRS-ISO-45001-F', 'CRS-ISO-45001-AUD',
    'CRS-ISO-27001-F', 'CRS-ISO-27001-AUD', 'CRS-ISO-IMS', 'CRS-ISO-AUD', 'CRS-ISO-NC', 'CRS-ISO-RISK'];
  assert.deepEqual(isoCourses.map(c => c.id).sort(), need.sort());
  assert.equal(new Set(courses.map(c => c.id)).size, courses.length);
  assert.equal(new Set(courses.map(c => c.slug)).size, courses.length);
});

test('every ISO course meets the completion contract (outcomes, modules, five teaching blocks, exercise, check, practical rubric, assessments, day plan)', () => {
  for (const c of isoCourses) {
    assert.deepEqual(validateCourse(c), [], c.id);
    assert.deepEqual(courseCompleteness(c, { questionIds: qIds, assessmentIds: aIds }), [], c.id);
  }
});

test('lesson teaching blocks are distinct, bilingual and substantial', () => {
  const seen = new Set();
  for (const c of isoCourses) for (const l of c.modules.flatMap(m => m.lessons)) {
    assert.deepEqual(l.content_blocks.map(b => b.type), LESSON_BLOCKS, l.id);
    for (const b of l.content_blocks) {
      assert.ok(b.text.en.length > 60 && b.text.ar.length > 50, `${l.id}:${b.type} too short`);
      assert.ok(!seen.has(b.text.en), `${l.id}:${b.type} duplicates another lesson`); seen.add(b.text.en);
    }
    assert.ok(bi(l.exercise.prompt) && bi(l.exercise.model_answer), l.id);
  }
});

test('training hours and day plan are consistent with the lesson content', () => {
  for (const c of isoCourses) {
    const planned = c.daily_schedule.reduce((a, d) => a + d.minutes, 0);
    const lessons = c.modules.flatMap(m => m.lessons).reduce((a, l) => a + l.estimated_minutes, 0);
    assert.ok(planned > lessons, c.id);
    assert.ok(Math.abs(c.training_hours * 60 - planned) <= 30, `${c.id}: ${c.training_hours} h vs ${planned} min`);
    assert.equal(c.duration_days, c.daily_schedule.length, c.id);
    assert.ok(c.daily_schedule.every(d => d.minutes <= 450), c.id);
    assert.ok(c.daily_schedule.at(-1).sessions.some(s => s.kind === 'practical') && c.daily_schedule.at(-1).sessions.some(s => s.kind === 'assessment'), c.id);
  }
});

test('no ISO course or item claims accreditation or certification; publication only on the owner\'s recorded approval', () => {
  for (const c of isoCourses) {
    assert.equal(c.status_label, 'CIA INTERNAL COURSE'); assert.equal(c.certificate_type, 'completion');
    assert.equal(c.external_accreditation_status, 'not_claimed'); assert.equal(c.related_certification, null);
    assert.deepEqual(validateGovernance(c), [], c.id);
    ownerApproved(assert, c, 'ai_draft');
    assert.match(c.passing_criteria.en, /not a professional certification/);
  }
  for (const x of [...standards, ...questions.filter(q => q.category === 'iso'), ...assessments.filter(a => a.id.includes('ISO'))])
    if (x.governance.content_status === 'published') ownerApproved(assert, x); else assert.ok(FUTURE_DRAFTS.has(x.id), x.id);
});

test('course references resolve: prerequisites, competencies, knowledge, toolkits, templates, sources, next course', () => {
  const ok = (list, id, what, owner) => assert.ok(list.some(x => x.id === id), `${owner}: unknown ${what} ${id}`);
  for (const c of isoCourses) {
    for (const p of c.prerequisites) if (p.course_id) ok(courses, p.course_id, 'prerequisite', c.id);
    for (const m of c.competency_mappings) { ok(comps, m.competency, 'competency', c.id); assert.ok(m.target_level >= 1 && m.target_level <= 5); }
    for (const k of c.related_knowledge_pages) ok(articles, k, 'article', c.id);
    for (const t of c.tools) ok(tools, t, 'toolkit', c.id);
    for (const t of c.templates) ok(library, t, 'template', c.id);
    for (const s of c.source_references) ok(sources, s, 'source', c.id);
    if (c.recommended_next_course) ok(courses, c.recommended_next_course, 'next course', c.id);
    for (const l of c.modules.flatMap(m => m.lessons)) { for (const r of l.resources) ok(articles, r, 'lesson resource', l.id); for (const k of l.competencies) ok(comps, k, 'lesson competency', l.id); }
  }
});

test('prerequisite graph has no cycles', () => {
  const edges = new Map(courses.map(c => [c.id, (c.prerequisites || []).map(p => p.course_id).filter(Boolean)]));
  const state = new Map();
  const visit = id => { if (state.get(id) === 1) throw new Error('cycle at ' + id); if (state.get(id) === 2) return; state.set(id, 1); (edges.get(id) || []).forEach(visit); state.set(id, 2); };
  for (const id of edges.keys()) visit(id);
});

test('questions are valid, bilingual, explained, unique; single-choice items have a rationale per option', () => {
  assert.equal(new Set(qIds).size, qIds.length);
  for (const q of questions) {
    assert.deepEqual(validateQuestion(q), [], q.id);
    assert.ok(bi(q.prompt) && bi(q.explanation), q.id);
  }
  for (const q of questions.filter(q => /^Q-(ISO-|RD-|DG-)/.test(q.id) && q.type === 'single_choice' && q.version === '0.8.0'))
    for (const o of q.options) assert.ok(bi(o.text) && bi(o.why), `${q.id}:${o.id}`);
  for (const q of questions.filter(q => q.type === 'practical_assignment' && Array.isArray(q.rubric) && q.version === '0.8.0')) {
    assert.equal(q.rubric.reduce((a, r) => a + r.weight, 0), 100, q.id);
    for (const r of q.rubric) for (const lv of ['meets', 'partial', 'not_yet']) assert.ok(bi(r.levels[lv]), `${q.id}:${lv}`);
  }
});

test('assessments resolve, diagnostics are balanced and allow “I don’t know”', () => {
  for (const a of assessments) assert.deepEqual(validateAssessment(a, qIds), [], a.id);
  for (const s of standards) {
    const a = byId(assessments, s.assessment_id);
    assert.ok(a.question_ids.length >= 8, `${a.id} has ${a.question_ids.length} items`);
    assert.equal(a.allow_unknown, true);
    const fmts = new Set(a.question_ids.map(id => byId(questions, id)).map(q => q.format || 'knowledge'));
    assert.ok(fmts.size >= 2, `${a.id} formats ${[...fmts]}`);
    assert.ok(new Set(a.competencies).size >= 3, a.id);
  }
  const rd = byId(assessments, 'ASM-READY-ISO-001');
  assert.ok(rd.question_ids.length >= 12 && rd.allow_unknown);
  for (const c of isoCourses) { assert.equal(byId(assessments, c.assessments.practical).kind, 'practical'); assert.equal(byId(assessments, c.assessments.final).scoring.passing_score, 70); }
});

test('“I don’t know” scores zero, is counted, and pending human-review items are not treated as evidence', () => {
  const q = byId(questions, 'Q-RD-01');
  assert.deepEqual([gradeQuestion(q, UNKNOWN).earned, gradeQuestion(q, UNKNOWN).unknown], [0, true]);
  const pt = byId(questions, 'Q-ISO-AUD-PT');
  const a = byId(assessments, 'ASM-ISO-AUD-PRACT');
  const s = scoreAttempt(a, [pt], { [pt.id]: 'my audit pack' });
  assert.equal(s.pending_review, 1); assert.equal(s.passed, false);
  assert.deepEqual(competencyBreakdown([pt], s.detail), {});
  const reviewed = scoreAttempt(a, [pt], { [pt.id]: 'x' }, { [pt.id]: 3 });
  assert.equal(reviewed.passed, true); assert.equal(competencyBreakdown([pt], reviewed.detail)[pt.competency].percent, 75);
  const mixed = [byId(questions, 'Q-RD-01'), byId(questions, 'Q-RD-02')];
  const m = scoreAttempt(byId(assessments, 'ASM-READY-ISO-001'), mixed, { 'Q-RD-01': 'a', 'Q-RD-02': UNKNOWN });
  assert.equal(m.unknown, 1); assert.deepEqual(competencyBreakdown(mixed, m.detail)['ISO-01'], { earned: 1, max: 2, percent: 50, unknown: 1, items: 2 });
});

test('standards: verified edition facts with dated official sources; toolkits, courses and diagnostics resolve', () => {
  const expected = { 'STD-9001': 'ISO 9001:2026', 'STD-14001': 'ISO 14001:2026', 'STD-45001': 'ISO 45001:2018 + Amd 1:2024', 'STD-27001': 'ISO/IEC 27001:2022 + Amd 1:2024' };
  for (const s of standards) {
    assert.equal(s.edition.label, expected[s.id]);
    assert.match(s.edition.verified_date, /^\d{4}-\d{2}-\d{2}$/);
    for (const id of s.edition.source_ids) { const src = byId(sources, id); assert.ok(src?.official_url?.startsWith('https://'), id); assert.equal(src.verification_status, 'verified_by_lookup', id); }
    assert.deepEqual(validateGovernance(s), []); assert.equal(isVisible(s, ['learner']), true); assert.equal(isVisible(s, ['reviewer']), true);
    assert.ok(byId(tools, s.toolkit_id)); assert.ok(byId(courses, s.foundation_course_id)); assert.ok(byId(courses, s.auditor_course_id));
    assert.equal(new Set(s.competencies).size, s.competencies.length, `${s.id} duplicate competencies`);
    const b = standardBundle(s, { courses, assessments, articles, tools, paths });
    assert.ok(b.tool && b.diagnostic && b.specificCourses.length >= 2 && b.articles.length >= 5, s.id);
  }
});

test('six ISO learning routes use the Phase 6 path engine and every step target exists', () => {
  const routes = paths.filter(p => p.kind === 'iso_route');
  assert.deepEqual(routes.map(r => r.id).sort(), [...ISO_ROUTES].sort());
  const targets = new Set([...courses, ...assessments, ...articles].map(x => x.id));
  for (const r of routes) {
    assert.ok(bi(r.title) && bi(r.goal), r.id);
    r.steps.forEach((s, i) => { assert.equal(s.order, i + 1); assert.ok(targets.has(s.target_id), `${r.id}:${s.target_id}`); });
  }
  assert.ok(!paths.some(p => ['PATH-ISO-Q', 'PATH-ISO-IMS'].includes(p.id)), 'superseded checkpoint paths removed');
});

test('typed relationships: valid, no duplicates, no dangling endpoints, cross-type links for every ISO course', () => {
  const idx = new RelationshipIndex(rels);
  assert.equal(idx.items.length, rels.length);
  for (const c of isoCourses) {
    const t = new Set([...idx.from('course', c.id).map(r => r.toType), ...idx.to('course', c.id).map(r => r.fromType)]);
    for (const need of ['standard_family', 'competency', 'article', 'platform_module', 'assessment']) assert.ok(t.has(need), `${c.id} lacks ${need}`);
  }
  for (const s of standards) assert.ok(idx.from('standard_family', s.id).some(r => r.toType === 'platform_module' && r.toId === s.toolkit_id), s.id);
});

/* ---------------- acceptance scenarios (Phase 7 prompt §23) ---------------- */
const at = (n) => `2026-10-2${n}T10:00:00Z`;
const attempt = (aid, breakdown, n = 1, passed = false) => ({ assessment_id: aid, submitted_at: at(n), passed, competency_breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, { earned: v, max: 100, percent: v, unknown: 0, items: 2 }])) });
const recsFor = (profile, attempts = [], completed = []) => {
  const evidence = assessmentEvidence(attempts);
  const gaps = calculateGaps({ role: byId(roles, profile.target_role), competencies: comps, assessmentByCompetency: percentMap(evidence) });
  const iso = catalog.filter(x => (x.standard_ids || []).length || ['REC-ISO-FOUND', 'REC-AUD-READ', 'REC-AUD-ASSESS', 'REC-AUD-PRACT'].includes(x.id));
  return suppressDemonstrated(generateRecommendations(iso, { profile, gaps, assessmentByCompetency: percentMap(evidence), completedIds: completed }), masteredCompetencies(evidence));
};
const route = (id, attempts = [], completed = []) => buildLearningPath(structuredClone(byId(paths, id)), { completedIds: completed, mastered: masteredCompetencies(assessmentEvidence(attempts)) });
const stepOf = (p, id) => p.steps.find(s => s.target_id === id);

test('A: new Quality Engineer with weak fundamentals gets the foundation first', () => {
  const profile = { target_role: 'ROLE-QE', years_experience: 1 };
  const atts = [attempt('ASM-READY-ISO-001', { 'ISO-01': 35, 'ISO-02': 40, 'AUD-01': 30 })];
  const sp = isoStartingPoint({ profile, evidence: assessmentEvidence(atts), completed: [], standards });
  assert.equal(sp.key, 'foundation'); assert.equal(sp.target_id, 'CRS-ISO-101');
  const recs = recsFor(profile, atts).map(r => r.target_id);
  assert.ok(recs.includes('CRS-ISO-101'));
  assert.ok(recs.indexOf('CRS-ISO-101') < recs.indexOf('CRS-ISO-9001-AUD'));
  assert.equal(stepOf(route('ROUTE-IMPL', atts), 'CRS-ISO-101').status === 'Skipped', false);
});

test('B: strong fundamentals, weak auditing → audit route without the foundation course', () => {
  const profile = { target_role: 'ROLE-QE', years_experience: 6 };
  const atts = [attempt('ASM-READY-ISO-001', { 'ISO-01': 90, 'ISO-02': 85, 'AUD-01': 40, 'AUD-02': 50, 'AUD-03': 45 })];
  const sp = isoStartingPoint({ profile, evidence: assessmentEvidence(atts), completed: [], standards });
  assert.equal(sp.key, 'audit'); assert.equal(sp.target_id, 'CRS-ISO-AUD');
  const recs = recsFor(profile, atts).map(r => r.target_id);
  assert.ok(!recs.includes('CRS-ISO-101'), 'foundation suppressed'); assert.ok(recs.includes('CRS-ISO-AUD'));
  const p = route('ROUTE-IA', atts);
  assert.equal(stepOf(p, 'CRS-ISO-101').status, 'Skipped'); assert.equal(stepOf(p, 'CRS-ISO-101').skip_reason, 'demonstrated');
  assert.notEqual(stepOf(p, 'CRS-ISO-AUD').status, 'Locked');
});

test('C: HSEQ Manager targeting integrated systems gets IMS-oriented content', () => {
  const profile = { target_role: 'ROLE-HSEQM', years_experience: 12 };
  const atts = [attempt('ASM-READY-ISO-001', { 'ISO-01': 85, 'ISO-02': 80, 'ISO-03': 40 })];
  const sp = isoStartingPoint({ profile, evidence: assessmentEvidence(atts), completed: [], standards });
  assert.equal(sp.key, 'ims'); assert.equal(sp.route_id, 'ROUTE-IMS');
  assert.ok(recsFor(profile, atts).slice(0, 5).some(r => r.target_id === 'CRS-ISO-IMS'));
  assert.equal(stepOf(route('ROUTE-IMS', atts), 'CRS-ISO-101').status, 'Skipped');
});

test('D: learner selecting ISO 45001 gets standard-specific content and the matching toolkit', () => {
  const profile = { target_role: 'ROLE-HSEQM', iso_focus: 'STD-45001' };
  const atts = [attempt('ASM-READY-ISO-001', { 'ISO-01': 80, 'ISO-02': 75 })];
  const sp = isoStartingPoint({ profile, evidence: assessmentEvidence(atts), completed: [], standards });
  assert.equal(sp.key, 'standard'); assert.equal(sp.href, '#/academy/iso/45001');
  const b = standardBundle(byId(standards, 'STD-45001'), { courses, assessments, articles, tools, paths });
  assert.equal(b.tool.id, 'iso45001'); assert.deepEqual(b.specificCourses.map(c => c.id).sort(), ['CRS-G-45001', 'CRS-ISO-45001-AUD', 'CRS-ISO-45001-F']);
});

test('E: a missing prerequisite gives a clear locked state and the course that unlocks it', () => {
  const c = byId(courses, 'CRS-ISO-9001-AUD');
  const st = prerequisiteState(c, []);
  assert.equal(st.eligible, false); assert.deepEqual(st.missing.map(m => m.course_id), ['CRS-ISO-AUD']);
  assert.equal(prerequisiteStatus(byId(catalog, 'REC-CRS-ISO-9001-AUD'), []).status, 'Not Met');
  const p = route('ROUTE-IA');
  assert.equal(stepOf(p, 'CRS-ISO-AUD').status, 'Locked');
  assert.equal(prerequisiteState(c, ['CRS-ISO-AUD']).eligible, true);
});

test('F: a completed foundation is suppressed from recommendations and shown as done in the route', () => {
  const f = byId(courses, 'CRS-ISO-101');
  const progress = [{ id: f.id, completed_lessons: f.modules.flatMap(m => m.lessons).map(l => l.id) }];
  const atts = [{ assessment_id: f.assessments.final, passed: true, submitted_at: at(1) }];
  assert.equal(courseStatus(f, progress, atts).state, 'completed');
  assert.equal(courseStatus(f, progress, []).state, 'in_progress', 'lessons alone do not complete a course with a final');
  const done = completedTargets({ courses, progress, attempts: atts });
  assert.ok(done.includes('CRS-ISO-101'));
  assert.ok(!recsFor({ target_role: 'ROLE-QE' }, [], done).some(r => r.target_id === 'CRS-ISO-101'));
  assert.equal(stepOf(route('ROUTE-IMPL', [], done), 'CRS-ISO-101').status, 'Skipped');
  assert.equal(isoStartingPoint({ profile: { target_role: 'ROLE-QE' }, evidence: {}, completed: done, standards }).key, 'audit');
});

test('G: a newer assessment replaces older evidence and refreshes the route', () => {
  const profile = { target_role: 'ROLE-IA' };
  const old = attempt('ASM-READY-ISO-001', { 'ISO-01': 40, 'ISO-02': 45 }, 1);
  const fresh = attempt('ASM-ISO-9001-DIAG', { 'ISO-01': 88, 'ISO-02': 82 }, 3);
  assert.equal(isoStartingPoint({ profile, evidence: assessmentEvidence([old]), standards }).key, 'foundation');
  assert.equal(assessmentEvidence([fresh, old])['ISO-01'].percent, 88, 'order of storage does not matter');
  assert.equal(isoStartingPoint({ profile, evidence: assessmentEvidence([old, fresh]), standards }).key, 'audit');
  assert.equal(stepOf(route('ROUTE-IA', [old, fresh]), 'CRS-ISO-101').status, 'Skipped');
  assert.notEqual(stepOf(route('ROUTE-IA', [old]), 'CRS-ISO-101').status, 'Skipped');
});

test('years of experience alone never create evidence', () => {
  const sp = isoStartingPoint({ profile: { target_role: 'ROLE-LA', years_experience: 25 }, evidence: {}, standards });
  assert.equal(sp.key, 'assess');
  const g1 = calculateGaps({ role: byId(roles, 'ROLE-LA'), competencies: comps }), g2 = g1;
  assert.ok(g1.every(g => g.current === 0)); assert.deepEqual(g1, g2);
});

test('I: learners see the published ISO courses; future-phase drafts stay visible only to reviewers', () => {
  for (const c of isoCourses) { assert.equal(isVisible(c, ['learner']), true, c.id); assert.equal(isVisible(c, ['reviewer']), true, c.id); }
  for (const c of courses.filter(c => FUTURE_DRAFTS.has(c.id))) { futureDraft(assert, c); assert.equal(isVisible(c, ['learner']), false, c.id); assert.equal(isVisible(c, ['admin']), true, c.id); }
  const published = articles.filter(a => a.ecosystem === 'iso' && isVisible(a, ['learner']));
  assert.ok(published.length >= 10, 'learners still have published ISO fundamentals to read');
  assert.equal(isoStartingPoint({ profile: null, standards: [] }).href, '#/knowledge/iso/what-is-iso');
});
