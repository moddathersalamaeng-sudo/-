/**
 * Assessment engine (Phase 5, extended in Phase 7).
 * Pure functions: validation, grading, scoring, breakdowns. Subjective items are never
 * auto-graded — they stay `pending_review` until a named human reviewer scores them.
 * "I don't know" answers (UNKNOWN) are allowed where an assessment sets `allow_unknown`.
 */
export const QUESTION_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'matching', 'scenario', 'case_study', 'short_answer', 'professional_judgment', 'evidence_review', 'document_review', 'practical_assignment', 'ai_evaluated_response'];
export const ASSESSMENT_KINDS = ['diagnostic', 'readiness', 'knowledge_quiz', 'scenario', 'practical', 'final'];
export const AUTO_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'matching'];
export const UNKNOWN = '__unknown__';
const uniq = a => [...new Set(a)];

export function validateQuestion(q) {
  const e = [];
  for (const k of ['id', 'category', 'competency', 'difficulty', 'type', 'prompt', 'weight', 'version', 'status', 'governance']) if (q?.[k] == null) e.push('missing_' + k);
  if (!QUESTION_TYPES.includes(q?.type)) e.push('bad_question_type');
  if (!(Number(q?.weight) > 0)) e.push('bad_weight');
  if (!['easy', 'medium', 'hard'].includes(q?.difficulty)) e.push('bad_difficulty');
  if (['single_choice', 'multiple_choice', 'true_false'].includes(q?.type) && (!Array.isArray(q.options) || q.options.length < 2)) e.push('missing_options');
  if (q?.type === 'matching' && (!Array.isArray(q.pairs) || q.pairs.length < 2)) e.push('missing_pairs');
  if (q?.type === 'single_choice' && Array.isArray(q.options) && !q.options.some(o => o.id === q.correct_answer)) e.push('correct_answer_not_an_option');
  if (q?.type === 'practical_assignment' && q.rubric && !q.rubric.length) e.push('empty_rubric');
  return uniq(e);
}

export function validateAssessment(a, questionIds = []) {
  const e = [];
  for (const k of ['id', 'slug', 'title', 'kind', 'question_ids', 'scoring', 'governance']) if (a?.[k] == null) e.push('missing_' + k);
  if (!ASSESSMENT_KINDS.includes(a?.kind)) e.push('bad_kind');
  if (!Array.isArray(a?.question_ids) || !a.question_ids.length) e.push('no_questions');
  if (a?.question_ids?.some(x => !questionIds.includes(x))) e.push('dangling_question');
  if (Array.isArray(a?.question_ids) && new Set(a.question_ids).size !== a.question_ids.length) e.push('duplicate_question');
  if (!(a?.scoring?.passing_score >= 0 && a.scoring.passing_score <= 100)) e.push('bad_passing_score');
  return uniq(e);
}

export function deterministicOrder(ids, seed = '') { return [...ids].sort((a, b) => hash(seed + a) - hash(seed + b) || a.localeCompare(b)); }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function gradeQuestion(q, answer) {
  const max = Number(q.weight) || 1;
  if (answer === UNKNOWN) return { earned: 0, max, auto: true, unknown: true, correct: false, feedback: 'unknown' };
  let earned = 0, auto = true, feedback = '';
  switch (q.type) {
    case 'single_choice': case 'true_false': earned = answer === q.correct_answer ? max : 0; break;
    case 'multiple_choice': {
      const a = uniq(Array.isArray(answer) ? answer : []).sort(), b = uniq(q.correct_answer || []).sort();
      earned = JSON.stringify(a) === JSON.stringify(b) ? max : 0; break;
    }
    case 'matching': {
      const exp = q.correct_answer || {}; const keys = Object.keys(exp);
      earned = keys.length ? max * keys.filter(k => answer?.[k] === exp[k]).length / keys.length : 0; break;
    }
    default: auto = false; earned = 0; feedback = 'manual_review_required';
  }
  return { earned, max, auto, unknown: false, correct: auto && earned === max, feedback };
}

/** The option the learner chose and the correct option, each with its authored rationale (`why`). */
export function optionFeedback(q, answer) {
  if (!Array.isArray(q.options)) return null;
  return { chosen: q.options.find(o => o.id === answer) || null, correct: q.options.find(o => o.id === q.correct_answer) || null };
}

export function scoreAttempt(assessment, questions, answers, manualScores = {}) {
  let earned = 0, max = 0, pending = 0, unknown = 0;
  const detail = [];
  for (const q of questions) {
    const g = gradeQuestion(q, answers[q.id]);
    let e = g.earned;
    const reviewed = !g.auto && Number.isFinite(manualScores[q.id]);
    if (!g.auto) { if (reviewed) e = Math.max(0, Math.min(g.max, manualScores[q.id])); else pending++; }
    if (g.unknown) unknown++;
    earned += e; max += g.max;
    detail.push({ question_id: q.id, competency: q.competency, earned: e, max: g.max, auto: g.auto, unknown: g.unknown, correct: g.correct, reviewed });
  }
  const percent = max ? Math.round(earned / max * 100) : 0;
  return { earned, max, percent, pending_review: pending, unknown, passed: pending === 0 && percent >= assessment.scoring.passing_score, detail };
}

export function domainBreakdown(questions, detail) {
  const out = {};
  for (const q of questions) {
    const d = out[q.category] || (out[q.category] = { earned: 0, max: 0, percent: 0 });
    const x = detail.find(z => z.question_id === q.id);
    d.earned += x?.earned || 0; d.max += x?.max || 0;
  }
  for (const d of Object.values(out)) d.percent = d.max ? Math.round(d.earned / d.max * 100) : 0;
  return out;
}

/** Per-competency evidence from one attempt. Items still awaiting human review are not evidence yet. */
export function competencyBreakdown(questions, detail) {
  const out = {};
  for (const q of questions) {
    const x = detail.find(z => z.question_id === q.id);
    if (!x || (!x.auto && !x.reviewed)) continue;
    const d = out[q.competency] || (out[q.competency] = { earned: 0, max: 0, percent: 0, unknown: 0, items: 0 });
    d.earned += x.earned; d.max += x.max; d.items++; if (x.unknown) d.unknown++;
  }
  for (const d of Object.values(out)) d.percent = d.max ? Math.round(d.earned / d.max * 100) : 0;
  return out;
}

export function assessmentIntegrity(a) {
  return { randomize_questions: a.integrity?.randomize_questions !== false, randomize_options: a.integrity?.randomize_options === true,
    attempt_limit: a.integrity?.attempt_limit ?? null, time_limit_minutes: a.integrity?.time_limit_minutes ?? null, show_answers: a.integrity?.show_answers || 'after_submission' };
}
