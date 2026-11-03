/**
 * Hash router mounted under /academy/ (decision D-02). Routes are `#/path`.
 * The hub's own `#m=<module>` deep links live on a different page and never collide.
 */
export function normalize(hash) {
  let p = (hash || '').replace(/^#/, '');
  if (!p.startsWith('/')) p = '/' + p;
  p = p.split('?')[0].replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

/** Query string carried inside the hash (`#/path?a=1`) — used for shareable filters. */
export function parseQuery(hash) {
  const i = (hash || '').indexOf('?');
  return i < 0 ? {} : Object.fromEntries(new URLSearchParams(hash.slice(i + 1)));
}

/** Pure resolver: returns { route, params } or { route: notFound }. */
export function resolve(routes, hash) {
  const path = normalize(hash);
  for (const r of routes) {
    const names = [];
    const re = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    const m = path.match(re);
    if (m) return { route: r, path, query: parseQuery(hash), params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return { route: null, path, query: parseQuery(hash), params: {} };
}

/** Role guard: a route with `roles` is only for users holding one of them. */
export function canAccess(route, roles) {
  if (!route?.roles || route.roles.length === 0) return true;
  return route.roles.some(r => roles.includes(r));
}

export class Router {
  constructor({ routes, render, win = window }) {
    this.routes = routes; this.render = render; this.win = win;
    this.onHash = () => this.dispatch();
  }
  start() { this.win.addEventListener('hashchange', this.onHash); this.dispatch(); }
  stop() { this.win.removeEventListener('hashchange', this.onHash); }
  current() { return resolve(this.routes, this.win.location.hash); }
  navigate(path) { this.win.location.hash = '#' + path; }
  dispatch() { this.render(this.current()); }
}
