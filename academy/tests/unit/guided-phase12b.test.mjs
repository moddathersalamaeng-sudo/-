/**
 * Phase 12B — guided experience (src/domain/guided.mjs): stages, progress, draft sanitising, the rule-based reading
 * and 30/60/90 plan, clamp rule, catalogue grouping; strings present and balanced in both languages; CSS linked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../../src/domain/guided.mjs';

const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const q = (id, competency) => ({ id, competency });

test('stages: grouped by competency in first-appearance order, chunked at four', () => {
  const qs = [q('a', 'X'), q('b', 'Y'), q('c', 'X'), q('d', 'X'), q('e', 'X'), q('f', 'X'), q('g', 'Y')];
  const st = G.buildStages(qs);
  assert.deepEqual(st.map(s => [s.competency, s.question_ids]), [['X', ['a', 'c', 'd', 'e']], ['X', ['f']], ['Y', ['b', 'g']]]);
  assert.deepEqual(st.map(s => s.id), ['s1', 's2', 's3']);
});

test('stages: fewer than two competencies → one question per stage (focus mode); empty input → none', () => {
  assert.deepEqual(G.buildStages([q('a', 'X'), q('b', 'X'), q('c', 'X')]).map(s => s.question_ids), [['a'], ['b'], ['c']]);
  assert.deepEqual(G.buildStages([q('a'), q('b')]).map(s => s.question_ids), [['a'], ['b']]);
  assert.deepEqual(G.buildStages([]), []);
  const mixed = G.buildStages([q('a', 'X'), q('b'), q('c', 'Y')]);
  assert.equal(mixed.length, 3); assert.equal(mixed[1].competency, null);
});

test('stage progress counts answers and finds the first open stage', () => {
  const st = G.buildStages([q('a', 'X'), q('b', 'Y'), q('c', 'Y')]);
  const ans = new Set(['a', 'b']);
  const p = G.stageProgress(st, id => ans.has(id));
  assert.deepEqual(p.done, [true, false]); assert.equal(p.answered, 2); assert.equal(p.total, 3); assert.equal(p.percent, 67); assert.equal(p.firstOpen, 1); assert.equal(p.complete, false);
  ans.add('c');
  assert.equal(G.stageProgress(st, id => ans.has(id)).complete, true);
  assert.equal(G.stageProgress(st, id => ans.has(id)).firstOpen, 2);
});

test('drafts: only the same assessment, attempt and version, within 30 days; foreign questions dropped', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');
  const base = { assessment_id: 'A1', attempt_no: 2, version: '1.0', answers: { q1: 'b', q9: 'x', q2: null }, stage: 1, updated_at: '2026-11-13T10:00:00Z' };
  const ok = G.sanitizeDraft(base, { assessmentId: 'A1', version: '1.0', attemptNo: 2, questionIds: ['q1', 'q2'], now });
  assert.deepEqual(ok.answers, { q1: 'b' }); assert.equal(ok.stage, 1);
  assert.equal(G.sanitizeDraft(base, { assessmentId: 'A2', attemptNo: 2, questionIds: ['q1'], now }), null, 'other assessment');
  assert.equal(G.sanitizeDraft(base, { assessmentId: 'A1', attemptNo: 3, questionIds: ['q1'], now }), null, 'attempt already submitted');
  assert.equal(G.sanitizeDraft(base, { assessmentId: 'A1', version: '2.0', attemptNo: 2, questionIds: ['q1'], now }), null, 'questions changed version');
  assert.equal(G.sanitizeDraft({ ...base, updated_at: '2026-10-01T00:00:00Z' }, { assessmentId: 'A1', attemptNo: 2, questionIds: ['q1'], now }), null, 'older than 30 days');
  assert.equal(G.sanitizeDraft({ ...base, updated_at: 'nonsense' }, { assessmentId: 'A1', attemptNo: 2, questionIds: ['q1'], now }), null, 'bad date');
  assert.equal(G.sanitizeDraft({ ...base, answers: { q9: 'x' } }, { assessmentId: 'A1', attemptNo: 2, questionIds: ['q1'], now }), null, 'nothing usable');
  assert.equal(G.sanitizeDraft(null, { assessmentId: 'A1' }), null);
  assert.equal(G.sanitizeDraft({ ...base, stage: -3 }, { assessmentId: 'A1', attemptNo: 2, questionIds: ['q1'], now }).stage, 0);
});

const courses = [
  { id: 'C-GEN', code: 'C-GEN', slug: 'gen', level: 2, ecosystem: 'iso', title: { en: 'General audit' }, competency_mappings: [{ competency: 'AUD-01' }, { competency: 'AUD-02' }], governance: { content_status: 'published' } },
  { id: 'C-ENV', code: 'C-ENV', slug: 'env', level: 2, ecosystem: 'iso', title: { en: 'Env audit' }, competency_mappings: [{ competency: 'AUD-01' }, { competency: 'ENV-01' }], governance: { content_status: 'published' } },
  { id: 'C-ISO', code: 'C-ISO', slug: 'iso', level: 1, ecosystem: 'iso', title: { en: 'ISO basics' }, competency_mappings: [{ competency: 'ISO-01' }], governance: { content_status: 'published' } },
  { id: 'C-Q', code: 'C-Q', slug: 'q', level: 1, ecosystem: 'quality', title: { en: 'Quality audit' }, competency_mappings: [{ competency: 'AUD-01' }, { competency: 'AUD-02' }], governance: { content_status: 'published' } },
  { id: 'C-DRAFT', code: 'C-A', slug: 'd', level: 1, ecosystem: 'iso', title: { en: 'Draft' }, competency_mappings: [{ competency: 'AUD-01' }, { competency: 'AUD-02' }, { competency: 'ISO-01' }], governance: { content_status: 'draft' } }
];
const labs = [
  { id: 'L-NC', slug: 'nc', level: 1, academy: 'iso', title: { en: 'NC lab' }, competencies: ['AUD-02'], governance: { content_status: 'published' } },
  { id: 'L-ISO', slug: 'isolab', level: 1, academy: 'iso', title: { en: 'ISO lab' }, competencies: ['ISO-01'], governance: { content_status: 'published' } },
  { id: 'L-DRAFT', slug: 'x', level: 1, academy: 'iso', title: { en: 'x' }, competencies: ['AUD-01'], draft: true, governance: { content_status: 'published' } }
];
const at = (bd, detail = []) => ({ competency_breakdown: bd, detail });

test('reading: bands, order (weakest first) and counts', () => {
  const r = G.resultInsights(at({ 'AUD-01': { percent: 25 }, 'AUD-02': { percent: 50 }, 'ISO-01': { percent: 67 }, 'RSK-01': { percent: 100 } },
    [{ auto: true, correct: true }, { auto: true, correct: false }, { auto: true, correct: false, unknown: true }, { auto: false, reviewed: false }]), { courses, labs, academy: 'iso', assessmentSlug: 'iso-readiness' });
  assert.deepEqual(r.gaps.map(x => x.id), ['AUD-01', 'AUD-02']);
  assert.deepEqual(r.developing.map(x => x.id), ['ISO-01']);
  assert.deepEqual(r.strengths.map(x => x.id), ['RSK-01']);
  assert.deepEqual(r.priorities.map(x => x.id), ['AUD-01', 'AUD-02', 'ISO-01']);
  assert.deepEqual(r.counts, { total: 4, correct: 1, incorrect: 1, unknown: 1, pending: 1 });
});

test('plan: 30 = best course for the top gap (coverage, home academy, focus), 60 = next priority, 90 = lab + retake; drafts never used', () => {
  const r = G.resultInsights(at({ 'AUD-01': { percent: 25 }, 'AUD-02': { percent: 50 }, 'ISO-01': { percent: 67 } }), { courses, labs, academy: 'iso', assessmentSlug: 'iso-readiness' });
  const flat = r.plan.map(p => [p.window, p.items.map(i => i.type + ':' + (i.id || i.slug))]);
  // C-GEN covers AUD-01 + AUD-02 (score 4 + 0.5 home); C-Q covers the same but is another academy; C-ENV covers only AUD-01; C-DRAFT is excluded.
  assert.deepEqual(flat, [['30', ['course:C-GEN']], ['60', ['course:C-Q']], ['90', ['lab:L-NC', 'retake:iso-readiness']]]);
});

test('plan: completed courses are skipped; a window with nothing to offer is left out; no gaps → maintain + retake', () => {
  const r = G.resultInsights(at({ 'ISO-01': { percent: 40 } }), { courses, labs, completedIds: ['C-ISO'], academy: 'iso', assessmentSlug: 's' });
  assert.deepEqual(r.plan.map(p => [p.window, p.items.map(i => i.type + ':' + (i.id || i.slug))]), [['30', ['lab:L-ISO']], ['90', ['retake:s']]]);
  const none = G.resultInsights(at({ 'ISO-01': { percent: 90 } }), { courses, labs, assessmentSlug: 's' });
  assert.deepEqual(none.plan.map(p => [p.window, p.items.map(i => i.type + ':' + (i.id || i.slug))]), [['90', ['lab:L-ISO', 'retake:s']]]);
  assert.deepEqual(G.resultInsights(at({}), { courses, labs }).plan, []);
});

test('plan is deterministic and does not mutate its inputs', () => {
  const input = at({ 'AUD-01': { percent: 10 }, 'ISO-01': { percent: 61 } });
  const snap = JSON.stringify([input, courses, labs]);
  const a = G.resultInsights(input, { courses, labs, academy: 'iso' }); const b = G.resultInsights(input, { courses, labs, academy: 'iso' });
  assert.deepEqual(a, b); assert.equal(JSON.stringify([input, courses, labs]), snap);
});

test('band thresholds match the learner model (70 / 60)', () => {
  assert.equal(G.bandOf(70), 'mastered'); assert.equal(G.bandOf(69), 'developing'); assert.equal(G.bandOf(60), 'developing'); assert.equal(G.bandOf(59), 'gap');
});

test('clamp rule and catalogue grouping', () => {
  assert.equal(G.shouldClamp('one two three'), false);
  assert.equal(G.shouldClamp(Array(61).fill('w').join(' ')), true);
  assert.equal(G.shouldClamp(Array(60).fill('w').join(' ')), false);
  const items = Array.from({ length: 9 }, (_, i) => ({ id: i, a: i < 7 ? 'iso' : i === 7 ? 'pmi' : 'zzz' }));
  const g = G.groupByAcademy(items, x => x.a, ['iso', 'pmi', 'quality'], 6);
  assert.deepEqual(g.map(x => [x.key, x.items.length, x.visible.length, x.hidden]), [['iso', 7, 6, 1], ['pmi', 1, 1, 0], ['other', 1, 1, 0]]);
});

test('strings: g12b present in Arabic and English with the same keys and placeholders', () => {
  const ar = JSON.parse(read('data/i18n/ar.json')).g12b; const en = JSON.parse(read('data/i18n/en.json')).g12b;
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]);
  const A = new Map(flat(ar)); const E = new Map(flat(en));
  assert.deepEqual([...A.keys()].sort(), [...E.keys()].sort());
  for (const [k, v] of A) assert.deepEqual((v.match(/\{\w+\}/g) || []).sort(), (E.get(k).match(/\{\w+\}/g) || []).sort(), k);
  assert.ok(A.size >= 80, 'expected the full Phase 12B set');
});

test('the guided stylesheet is linked in the app and the review bundle; [hidden] beats display rules in the player', () => {
  assert.match(read('index.html'), /assets\/css\/guided\.css/);
  assert.match(read('tools/build_review_bundle.mjs'), /'guided\.css'/);
  assert.match(read('assets/css/guided.css'), /\.asm \[hidden\][^{]*\{ display: none !important; \}/);
});
