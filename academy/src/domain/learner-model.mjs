/**
 * Learner model (Phase 7): turns stored learner state into evidence for the deterministic
 * recommendation and ISO starting-point engines. Pure functions, no storage.
 * Years of experience are context only — they never create competency evidence.
 */
export const MASTERY_THRESHOLD = 70;
export const WEAK_THRESHOLD = 60;

/** Latest assessment evidence per competency: a newer attempt replaces an older one. */
export function assessmentEvidence(attempts = []) {
  const sorted = [...attempts].sort((a, b) => String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')));
  const out = {};
  for (const a of sorted) for (const [c, v] of Object.entries(a.competency_breakdown || {})) {
    if (!(v && v.max > 0)) continue;
    out[c] = { percent: v.percent, unknown: v.unknown || 0, items: v.items || 0, at: a.submitted_at || null, assessment_id: a.assessment_id };
  }
  return out;
}

export const percentMap = evidence => Object.fromEntries(Object.entries(evidence).map(([k, v]) => [k, v.percent]));
export const masteredCompetencies = (evidence, threshold = MASTERY_THRESHOLD) => new Set(Object.entries(evidence).filter(([, v]) => v.percent >= threshold).map(([k]) => k));

/** A course is complete when every lesson is marked done and, if it has a final assessment, that final is passed. */
export function courseStatus(course, progress = [], attempts = []) {
  const ids = (course.modules || []).flatMap(m => m.lessons || []).map(l => l.id);
  const saved = progress.find(p => p.id === course.id);
  const done = ids.filter(id => saved?.completed_lessons?.includes(id)).length;
  const finalId = course.assessments?.final;
  const finalPassed = !finalId || attempts.some(a => a.assessment_id === finalId && a.passed);
  const lessonsDone = ids.length > 0 && done === ids.length;
  const state = lessonsDone && finalPassed ? 'completed' : done > 0 ? 'in_progress' : 'not_started';
  return { state, done, total: ids.length, percent: ids.length ? Math.round(done / ids.length * 100) : null, finalPassed, lessonsDone };
}

/** IDs the learner has finished: completed courses and passed assessments. */
export function completedTargets({ courses = [], progress = [], attempts = [] } = {}) {
  const ids = new Set();
  for (const c of courses) if (courseStatus(c, progress, attempts).state === 'completed') ids.add(c.id);
  for (const p of progress) if (p.completed === true || p.percent === 100) ids.add(p.course_id || p.id);
  for (const a of attempts) if (a.passed) ids.add(a.assessment_id);
  return [...ids];
}
