/**
 * Phase 18 — the owner's videos: lookups and viewing progress. Pure.
 * A video record: { id, series, order, title{ar,en}, clause, duration (s), sheet (bool), transcript ('en'|'ar'|null), placements[{course_id, lesson_id|null}] }.
 * Progress record (video_progress, the learner's own): { id, position (s), watched (bool), updated_at }.
 * Watched = played to 90 % or to the end; the position is kept to resume.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
export const SERIES_ORDER = ['iso9001-start', 'iso9001-2026', 'joda', 'masaa', 'shorts'];
export const WATCHED_AT = 0.9;
const clauseKey = c => String(c || '').split('.').map(n => String(n).padStart(3, '0')).join('.');

export function sortVideos(items = []) {
  return [...items].sort((a, b) => SERIES_ORDER.indexOf(a.series) - SERIES_ORDER.indexOf(b.series) ||
    (a.series === 'iso9001-2026' ? clauseKey(a.order).localeCompare(clauseKey(b.order)) : String(a.order).localeCompare(String(b.order))));
}
export const forLesson = (items, lessonId) => sortVideos(items.filter(v => v.placements?.some(p => p.lesson_id === lessonId)));
export const forCourse = (items, courseId) => sortVideos(items.filter(v => v.placements?.some(p => p.course_id === courseId)));
export function bySeries(items) {
  const s = sortVideos(items);
  return SERIES_ORDER.map(k => ({ series: k, items: s.filter(v => v.series === k) })).filter(g => g.items.length);
}
export function neighbours(items, id) {
  const s = sortVideos(items), v = s.find(x => x.id === id);
  if (!v) return { prev: null, next: null };
  const same = s.filter(x => x.series === v.series), i = same.indexOf(v);
  return { prev: same[i - 1] || null, next: same[i + 1] || null };
}
export function search(items, q, lang = 'ar') {
  const n = s => String(s || '').toLowerCase().replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const terms = n(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return items;
  return items.filter(v => { const hay = n([v.title?.ar, v.title?.en, v.clause, v.id].join(' ')); return terms.every(t => hay.includes(t)); });
}
export const minutes = items => Math.round(items.reduce((s, v) => s + (v.duration || 0), 0) / 60);
export function fmtTime(sec) { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; }

/** Progress after a time update; returns null when nothing worth saving changed (saves at most every 5 s of play). */
export function progressAfter(prev, { id, position, duration, ended = false, now = new Date().toISOString() }) {
  const pos = Math.max(0, Math.min(position || 0, duration || position || 0));
  const watched = !!prev?.watched || ended || (duration > 0 && pos / duration >= WATCHED_AT);
  if (prev && prev.watched === watched && Math.abs((prev.position || 0) - pos) < 5 && !ended) return null;
  return { id, position: ended ? 0 : Math.round(pos), watched, updated_at: now };
}
export const resumeAt = (p, duration) => p && !p.watched && p.position > 10 && (!duration || p.position < duration - 10) ? p.position : 0;
export const watchedCount = (items, progress = []) => { const w = new Set(progress.filter(p => p.watched).map(p => p.id)); return items.filter(v => w.has(v.id)).length; };
