/**
 * Minimal HTTP layer: router with :params, JSON bodies with a size limit, CORS for one configured site origin,
 * security headers, per-key rate limits and request logging without personal data (D-121).
 */
import { randomUUID } from 'node:crypto';
import { HttpError } from './db.mjs';

export class Router {
  constructor() { this.routes = []; }
  add(method, path, handler, opts = {}) {
    const names = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    this.routes.push({ method, re, names, handler, opts });
    return this;
  }
  match(method, path) {
    let allowed = false;
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (!m) continue;
      allowed = true;
      if (r.method === method) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
    }
    return allowed ? { methodNotAllowed: true } : null;
  }
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    /* Over the limit: stop keeping the body but drain it, so the client receives a clean 413 instead of a reset connection. */
    req.on('data', c => { size += c.length; if (size > limit) { over = true; chunks.length = 0; } else if (!over) chunks.push(c); });
    req.on('end', () => {
      if (over) return reject(new HttpError(413, 'too_large'));
      if (!chunks.length) return resolve(null);
      const ct = String(req.headers['content-type'] || '');
      if (!ct.startsWith('application/json')) return reject(new HttpError(415, 'json_only'));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'bad_json')); }
    });
    req.on('error', reject);
  });
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

export function send(res, status, body, extra = {}) {
  const data = body == null ? '' : JSON.stringify(body);
  res.writeHead(status, { ...SECURITY_HEADERS, ...(body == null ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...extra });
  res.end(data);
}

export function corsHeaders(req, allowedOrigins) {
  const o = req.headers.origin;
  if (!o || !allowedOrigins.includes(o)) return {};
  return { 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE', 'Access-Control-Max-Age': '600' };
}

/** Fixed-window rate limiter kept in memory (one API instance; use a shared store if the service is scaled out). */
export class RateLimiter {
  constructor() { this.buckets = new Map(); }
  hit(key, limit, windowMs, now = Date.now()) {
    const b = this.buckets.get(key);
    if (!b || now - b.start >= windowMs) { this.buckets.set(key, { start: now, n: 1 }); this.#gc(now); return true; }
    b.n++;
    return b.n <= limit;
  }
  #gc(now) { if (this.buckets.size > 50_000) for (const [k, b] of this.buckets) if (now - b.start > 3_600_000) this.buckets.delete(k); }
}

/** Log line: request id, method, route pattern, status, milliseconds. Never a body, query, e-mail, token or address. */
export function logLine({ id, method, route, status, ms, code }) {
  return JSON.stringify({ t: new Date().toISOString(), id, method, route, status, ms, ...(code ? { code } : {}) });
}

export const requestId = () => randomUUID().slice(0, 8);
