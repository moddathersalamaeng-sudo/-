/**
 * Progress tracker foundation (ADD-4): completed vs remaining. Pure function —
 * returns `percent: null` when there is nothing to measure so the UI shows an
 * empty state rather than a misleading 0 %.
 */
export function summarizeProgress(enrollments = []) {
  const total = enrollments.length;
  const completed = enrollments.filter(e => e.status === 'completed').length;
  const inProgress = enrollments.filter(e => e.status === 'in_progress').length;
  return { total, completed, inProgress, remaining: total - completed, percent: total ? completed / total : null };
}

/** Weighted platform build completion (standing progress block). */
export function buildCompletion(phases) {
  const totalW = phases.reduce((s, p) => s + p.weight, 0);
  const done = phases.reduce((s, p) => s + p.weight * (p.status === 'complete' ? 1 : p.status === 'in_progress' ? (p.partial ?? 0.5) : 0), 0);
  return totalW ? done / totalW : 0;
}
