/**
 * Phase 10A — every page that was merged keeps its old address. The router consults this table before matching
 * routes, replaces the URL (history.replaceState, so Back still works) and renders the new place.
 * Query strings are carried over; the table adds the tab that now holds the old page.
 */
export const REDIRECTS = [
  { from: '/me', to: '/my', query: { tab: 'progress' } },
  { from: '/my-library', to: '/my', query: { tab: 'progress', saved: '1' } },
  { from: '/profile', to: '/my', query: { tab: 'profile' } },
  { from: '/profile/competencies', to: '/my', query: { tab: 'competencies' } },
  { from: '/recommendations', to: '/my', query: { tab: 'recommendations' } },
  { from: '/learning-path', to: '/my', query: { tab: 'path' } },
  { from: '/knowledge', to: '/library', query: { tab: 'articles' } },
  { from: '/guides', to: '/library', query: { tab: 'guides' } },
  { from: '/academy/programs', to: '/academy/courses', query: { programme: 'all' } }
];

/** @returns {{path:string, query:object}|null} */
export function redirectFor(path, query = {}) {
  const r = REDIRECTS.find(x => x.from === path);
  if (!r) return null;
  return { path: r.to, query: { ...query, ...r.query } };
}

export function hashFor({ path, query }) {
  const q = new URLSearchParams(Object.entries(query || {}).filter(([, v]) => v !== '' && v != null)).toString();
  return '#' + path + (q ? '?' + q : '');
}
