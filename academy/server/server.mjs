#!/usr/bin/env node
/**
 * Continual Improvement Academy — API service (Phase 14).
 *
 * Environment
 *   DATABASE_URL        PostgreSQL connection for the login role cia_api (member of cia_app and cia_auth, not the table owner)
 *   CIA_SITE_ORIGINS    comma-separated site origins allowed by CORS, e.g. https://moddathersalamaeng-sudo.github.io
 *   CIA_SITE_URL        address of the Academy used in reset links, e.g. https://…/-/academy/
 *   CIA_DATA_DIR        the Academy's data folder (published labs, framework, certifications); default ../data
 *   PORT                default 8787
 *   CIA_STATIC_ROOT     development / tests only: also serve the static site from this folder (same origin) and inject
 *                       { backend: { apiBase: "/api/v1" } } into /academy/data/config.json
 *   CIA_DEV_OUTBOX=1    development / tests only: expose the outbox (reset and invitation links) at /api/v1/dev/outbox
 * Nothing secret is ever written to a log line.
 */
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDb, HttpError } from './lib/db.mjs';
import { createContent } from './lib/content.mjs';
import { buildApi } from './lib/api.mjs';
import { readBody, send, corsHeaders, RateLimiter, logLine, requestId } from './lib/http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Rate limits per minute window unless stated: [limit, windowMs]. */
export const LIMITS = { auth: [10, 600_000], write: [120, 60_000], events: [60, 60_000], read: [600, 60_000] };

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

export function createServer(opts = {}) {
  const env = { ...process.env, ...opts.env };
  const db = opts.db || createDb({ connectionString: env.DATABASE_URL });
  const content = createContent(path.resolve(env.CIA_DATA_DIR || path.join(HERE, '..', 'data')));
  const origins = String(env.CIA_SITE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const staticRoot = env.CIA_STATIC_ROOT ? path.resolve(env.CIA_STATIC_ROOT) : null;
  const limiter = new RateLimiter();
  /* CIA_RATE_SCALE multiplies every limit (tests only; production leaves it unset = 1). */
  const rateScale = Number(env.CIA_RATE_SCALE) > 0 ? Number(env.CIA_RATE_SCALE) : 1;
  const cfg = { siteUrl: env.CIA_SITE_URL || '', devOutbox: env.CIA_DEV_OUTBOX === '1', rateLimiter: limiter };
  const { router, sessionFrom } = buildApi({ db, content, config: cfg });
  const log = opts.log || (line => process.stdout.write(line + '\n'));

  async function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(staticRoot, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(staticRoot)) return send(res, 403, { code: 'forbidden' });
    try {
      if ((await stat(file)).isDirectory()) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
      let body = await readFile(file);
      if (p === '/academy/data/config.json') {
        const c = JSON.parse(body.toString('utf8'));
        c.backend = { analytics: true, ...(c.backend || {}), apiBase: '/api/v1', ...(opts.backendConfig || {}) };
        body = Buffer.from(JSON.stringify(c));
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
  }

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now(), id = requestId();
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith('/api/')) {
      if (staticRoot && (req.method === 'GET' || req.method === 'HEAD')) return serveStatic(req, res, url);
      return send(res, 404, { code: 'not_found' });
    }
    const cors = corsHeaders(req, origins);
    if (req.method === 'OPTIONS') { res.writeHead(cors['Access-Control-Allow-Origin'] ? 204 : 403, cors); return res.end(); }
    const m = router.match(req.method, url.pathname);
    let status = 500, code;
    try {
      if (!m) throw new HttpError(404, 'not_found');
      if (m.methodNotAllowed) throw new HttpError(405, 'method');
      const { route, params } = m;
      const ip = req.socket.remoteAddress || 'x';
      const kind = route.opts.limit || (req.method === 'GET' ? 'read' : 'write');
      const [base, win] = LIMITS[kind];
      const lim = Math.max(1, Math.round(base * rateScale));
      if (!limiter.hit(`${kind}:ip:${ip}`, lim * (kind === 'auth' ? 1 : 4), win)) throw new HttpError(429, 'rate_limited');
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req, route.opts.bodyLimit || 1_000_000) : null;
      const user = await sessionFrom(req);
      if (user && !limiter.hit(`${kind}:u:${user.uid}`, lim, win)) throw new HttpError(429, 'rate_limited');
      const out = await route.handler({ req, body, params, query: Object.fromEntries(url.searchParams), user, config: cfg });
      const result = out && typeof out === 'object' && 'status' in out && 'body' in out ? out : { status: 200, body: out };
      status = result.status;
      send(res, status, result.body, cors);
    } catch (err) {
      const e = err instanceof HttpError ? err : null;
      status = e?.status || 500; code = e?.code || 'server_error';
      /* Unexpected errors: only the error class and database code are logged (CIA_DEBUG=1 adds the message, development only). */
      if (!e) log(JSON.stringify({ t: new Date().toISOString(), id, error: err?.name || 'Error', pg: err?.code || null, ...(env.CIA_DEBUG === '1' ? { message: String(err?.message || '').slice(0, 300), at: String(err?.stack || '').split('\n')[1]?.trim() } : {}) }));
      send(res, status, { code, ...(e?.detail ? { detail: e.detail } : {}), request_id: id }, cors);
    } finally {
      log(logLine({ id, method: req.method, route: m?.route ? m.route.re.source.replace(/\\\//g, '/').replace(/\(\[\^\/\]\+\)/g, ':p').replace(/^\^|\$$/g, '') : url.pathname.split('/').slice(0, 4).join('/'), status, ms: Date.now() - t0, code }));
    }
  });
  return { server, db, content };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createServer();
  const port = Number(process.env.PORT || 8787);
  server.listen(port, () => process.stdout.write(JSON.stringify({ t: new Date().toISOString(), msg: 'cia-academy-api listening', port }) + '\n'));
}
