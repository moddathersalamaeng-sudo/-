/**
 * Toolkit integration: requirement and method guides mirrored from the hub toolkits, the courses generated from
 * them, the lesson → guide map, and the governance rules that keep owner publications and generated drafts apart.
 */
import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { json, text, ownerApproved, isPhase8, governedPhase8 } from './_util.mjs';
import { validateGuide, guideItems, findItem, itemNeighbours, searchItems, guideTabs, lessonsForItem, lessonGuideRefs, itemTeachable } from '../../src/domain/guides.mjs';
import { courseCompleteness, validateCourse } from '../../src/domain/courses.mjs';
import { validateQuestion, validateAssessment } from '../../src/domain/assessments.mjs';
import { validateGovernance, isVisible } from '../../src/data/governance.js';

const index = json('data/guides/index.json').items;
const guides = Object.fromEntries(index.map(g => [g.slug, json(`data/guides/${g.slug}.json`).guide]));
const seed = n => json(`data/seed/${n}.json`).items;
const courses = seed('courses'), questions = seed('questions'), assessments = seed('assessments'), modules = seed('platform-modules');
const sources = seed('sources'), catalog = seed('recommendation-catalog'), library = seed('library-items'), rels = seed('relationships');
const lessonMap = seed('lesson-guide-map');
const comps = json('data/seed/competency/competencies.json').items;
const genCourses = courses.filter(c => c.guide);
const qById = new Map(questions.map(q => [q.id, q]));
const n = s => String(s || '').toLowerCase().replace(/\W+/g, ' ').trim();

test('guide index: 9 standard and 14 method guides, unique ids and slugs, each with its file and a live toolkit', () => {
  assert.equal(index.filter(g => g.kind === 'standard').length, 9);
  assert.equal(index.filter(g => g.kind === 'method').length, 14);
  assert.equal(new Set(index.map(g => g.id)).size, index.length);
  assert.equal(new Set(index.map(g => g.slug)).size, index.length);
  const files = readdirSync(new URL('../../data/guides/', import.meta.url)).filter(f => f !== 'index.json').map(f => f.replace('.json', '')).sort();
  assert.deepEqual(files, index.map(g => g.slug).sort());
  for (const g of index) assert.ok(modules.some(m => m.id === g.module), `${g.slug}: unknown toolkit ${g.module}`);
});

test('guides are owner publications: never AI drafts, never credited to a named person as reviewer', () => {
  for (const g of index) {
    assert.deepEqual(validateGovernance(g), [], g.slug);
    assert.equal(g.governance.content_source, 'owner', g.slug);
    if (g.governance.content_status === 'published') {
      assert.equal(g.governance.reviewer, 'Owner publication (live toolkit)', g.slug);
      assert.match(g.governance.change_note, /live commit/, g.slug);
      assert.equal(isVisible(g, ['learner']), true, g.slug);
    }
  }
});

test('every guide file is valid: complete bilingual items, no duplicate refs, no dangling links; counts match the index', () => {
  for (const g of index) {
    const f = guides[g.slug];
    assert.deepEqual(validateGuide(f), [], g.slug);
    assert.equal(f.kind, g.kind, g.slug);
    assert.equal(guideItems(f).length, g.counts.items, g.slug);
    assert.equal(guideItems(f).reduce((a, i) => a + (i.checks?.length || 0), 0), g.counts.checks, g.slug);
    assert.ok(guideTabs(f).includes('items'), g.slug);
    for (const o of f.official || []) assert.match(o.url, /^https:\/\//, `${g.slug}: official source must be an https link`);
  }
});

test('requirement standards cover clauses 4–10 (guidance standards their principles), with evidence for every item', () => {
  const GUIDANCE = { 'iso-31000': ['4', '5', '6'], 'iso-37000': ['5', '6'] };  // ISO 31000 and ISO 37000 give guidance, not certifiable requirements
  for (const g of index.filter(x => x.kind === 'standard')) {
    const f = guides[g.slug];
    const tops = new Set(guideItems(f).map(i => i.ref.split('.')[0].replace(/[a-z]$/, '')));
    for (const t of GUIDANCE[g.slug] || ['4', '5', '6', '7', '8', '9', '10']) assert.ok(tops.has(t), `${g.slug}: no clause ${t}`);
    for (const i of guideItems(f)) assert.ok(i.ev.length >= 1 && i.how.length >= 1, `${g.slug} ${i.ref}`);
  }
});

test('domain helpers: search (both languages, by ref), neighbours, tabs', () => {
  const g = guides['iso-9001'];
  assert.ok(searchItems(g, '10.2.1').some(i => i.ref === '10.2.1'));
  assert.ok(searchItems(g, findItem(g, '6.1.2').title.ar.split(' ')[0]).some(i => i.ref === '6.1.2'));
  assert.ok(searchItems(g, 'CLIMATE').some(i => i.ref === '4.1'));
  assert.equal(searchItems(g, '').length, guideItems(g).length);
  const nb = itemNeighbours(g, '4.1');
  assert.equal(nb.prev, null); assert.equal(nb.index, 0); assert.ok(nb.next);
  assert.equal(itemNeighbours(g, guideItems(g).at(-1).ref).next, null);
  assert.ok(guideTabs(guides['rca']).indexOf('steps') === 0);
});

test('generated courses: one per guide, valid, complete, every lesson resolves to a teachable guide item', () => {
  assert.equal(genCourses.length, index.length);
  for (const c of genCourses) {
    assert.deepEqual(validateCourse(c), [], c.id);
    const g = guides[c.guide];
    assert.ok(g, c.id);
    const miss = courseCompleteness(c, { questionIds: questions.map(q => q.id), assessmentIds: assessments.map(a => a.id), resolveSource: s => itemTeachable(findItem(guides[s.guide], s.ref), guides[s.guide]?.kind) });
    assert.deepEqual(miss, [], c.id);
    const lessons = c.modules.flatMap(m => m.lessons);
    assert.equal(lessons.length, guideItems(g).length, `${c.id} teaches every item`);
    assert.equal(new Set(lessons.map(l => l.source.ref)).size, lessons.length, c.id);
    for (const l of lessons) assert.equal(l.content_blocks, undefined, `${l.id} must not copy guide text`);
  }
});

test('generated courses claim no accreditation and are published only on the owner\'s recorded approval', () => {
  for (const c of genCourses) {
    if (isPhase8(c)) governedPhase8(assert, c, 'system'); else ownerApproved(assert, c, 'system');
    assert.equal(c.external_accreditation_status, 'not_claimed', c.id);
    assert.equal(c.cpd_status, 'not_claimed', c.id);
    assert.equal(c.certificate_type, 'completion', c.id);
  }
  for (const c of genCourses) if (!isPhase8(c)) assert.equal(isVisible(c, ['learner']), true, c.id);
  for (const id of genCourses.flatMap(c => Object.values(c.assessments))) { const a = assessments.find(x => x.id === id); isPhase8(a) ? governedPhase8(assert, a, 'system') : ownerApproved(assert, a, 'system'); }
  for (const q of questions.filter(q => /^Q-(G|M)-/.test(q.id))) ownerApproved(assert, q, 'system');
  for (const q of questions.filter(q => /^Q-P-/.test(q.id))) governedPhase8(assert, q, 'system');
});

test('generated courses: hours, day plan, assessments, references and catalog entries are consistent', () => {
  for (const c of genCourses) {
    const planned = c.daily_schedule.reduce((a, d) => a + d.minutes, 0);
    assert.ok(Math.abs(c.training_hours * 60 - planned) <= 30, `${c.id}: ${c.training_hours} h vs ${planned} min`);
    assert.equal(c.duration_days, c.daily_schedule.length, c.id);
    assert.ok(c.daily_schedule.every(d => d.minutes <= 450), c.id);
    assert.ok(c.daily_schedule.at(-1).sessions.some(s => s.kind === 'practical'), c.id);
    for (const k of ['quiz', 'final', 'practical']) {
      const a = assessments.find(x => x.id === c.assessments[k]);
      assert.ok(a, `${c.id} ${k}`);
      assert.deepEqual(validateAssessment(a, questions.map(q => q.id)), [], a.id);
      assert.ok(a.question_ids.every(id => qById.get(id).course_id === c.id), `${a.id} only uses its own course's questions`);
    }
    assert.equal(assessments.find(x => x.id === c.assessments.final).scoring.passing_score, 70, c.id);
    for (const m of c.competency_mappings) assert.ok(comps.some(x => x.id === m.competency), `${c.id}: ${m.competency}`);
    for (const t of c.tools) assert.ok(modules.some(m => m.id === t), `${c.id}: ${t}`);
    for (const s of c.source_references) assert.ok(sources.some(x => x.id === s), `${c.id}: ${s}`);
    if (c.recommended_next_course) assert.ok(courses.some(x => x.id === c.recommended_next_course), c.id);
    assert.ok(catalog.some(r => r.target_id === c.id), `${c.id} is in the recommendation catalog`);
    assert.ok(rels.some(r => r.fromId === c.id && r.toType === 'platform_module'), `${c.id} links to its toolkit`);
  }
});

test('generated check questions: valid, four distinct options, the key comes from the item, distractors come from elsewhere', () => {
  for (const c of genCourses) for (const l of c.modules.flatMap(m => m.lessons)) {
    const q = qById.get(l.check_question_id);
    assert.ok(q, l.id);
    assert.deepEqual(validateQuestion(q), [], q.id);
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options.map(o => n(o.text.en))).size, 4, `${q.id}: duplicate options`);
    assert.ok(q.options.every(o => o.text.ar && o.text.en && o.why?.en && o.why?.ar), `${q.id}: bilingual text and rationale`);
    const g = guides[l.source.guide], it = findItem(g, l.source.ref);
    // Standard items ask for evidence; method items for a common gap — or, when an item has tips but no gaps, for the guide's advice;
    // practice items (Phase 8) for one of the actions the guide recommends for that practice.
    const keyList = (g.kind === 'standard' ? it.ev : g.kind === 'practice' ? it.how : it.gaps.length ? it.gaps : it.tips).map(x => n(x.en));
    const correct = q.options.find(o => o.id === q.correct_answer);
    assert.ok(keyList.includes(n(correct.text.en)), `${q.id}: key not from the item`);
    for (const o of q.options.filter(o => o.id !== q.correct_answer)) assert.ok(!keyList.includes(n(o.text.en)), `${q.id}: distractor ${o.id} is also a right answer`);
    assert.equal(q.reference, `guide:${g.slug}#${it.ref}`);
  }
  const keys = genCourses.flatMap(c => c.modules.flatMap(m => m.lessons)).map(l => qById.get(l.check_question_id).correct_answer);
  for (const k of 'abcd') assert.ok(keys.filter(x => x === k).length > keys.length / 8, `answer ${k} is used — keys are spread`);
});

test('lesson → guide map: every mapped lesson exists, every ref resolves, and lessonGuideRefs / lessonsForItem agree', () => {
  const lessons = new Map(courses.flatMap(c => c.modules.flatMap(m => m.lessons.map(l => [l.id, { c, l }]))));
  assert.ok(lessonMap.length >= 40);
  for (const m of lessonMap) {
    assert.ok(lessons.has(m.id), `unknown lesson ${m.id}`);
    for (const r of m.refs) assert.ok(findItem(guides[r.guide], r.ref), `${m.id} → ${r.guide}#${r.ref}`);
  }
  const { l } = lessons.get('CRS-ISO-NC-L01');
  const refs = lessonGuideRefs(l, lessonMap);
  assert.ok(refs.some(r => r.guide === 'iso-9001' && r.ref === '10.2.1' && !r.primary));
  const users = lessonsForItem('iso-9001', '10.2.1', { courses, lessonMap });
  assert.ok(users.some(x => x.lesson.id === 'CRS-ISO-NC-L01'));
  assert.ok(users.some(x => x.course.id === 'CRS-G-9001'));
});

test('Quality Mission is in the library as the owner\'s published game, linked from audit courses', () => {
  const sims = library.filter(x => x.kind === 'simulation');
  assert.equal(sims.length, 2);
  for (const x of sims) {
    assert.deepEqual(validateGovernance(x), [], x.id);
    assert.equal(x.governance.content_source, 'owner');
    assert.match(x.link, /^\.\.\/cia-quality-mission\//);
  }
  assert.ok(rels.some(r => r.fromId === 'CRS-ISO-AUD' && r.toId === 'LIB-SIM-02'));
});

test('guide UI strings exist in Arabic and English; routes and navigation are registered', () => {
  const ar = json('data/i18n/ar.json').gd, en = json('data/i18n/en.json').gd;
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? keys(v, p + k + '.') : [p + k]);
  assert.deepEqual(keys(ar).sort(), keys(en).sort());
  const main = text('src/main.js');
  for (const r of ["'/guides'", "'/guides/:slug'", "'/guides/:slug/:ref'"]) assert.ok(main.includes(r), r);
  assert.ok(json('data/seed/navigation.json').items.some(i => i.id === 'guides' && i.route === '/guides' && i.status === 'active'));
  const views = text('src/views/guides.js');
  assert.ok(!/innerHTML/.test(views), 'guides render through the safe DOM builder only');
});
