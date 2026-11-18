/**
 * Server test harness (Phase 14). Needs a PostgreSQL 15+ superuser connection in CIA_TEST_PG
 * (CI: the postgres service; locally e.g. postgres://postgres@localhost:54329/postgres).
 * Each harness creates a fresh database, applies the migrations as the owner, creates a NON-owner login role for the API
 * (so row-level security is never bypassed by ownership) and starts the API on a free port.
 */
import { pg } from '../../server/lib/pgdriver.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ACADEMY = path.resolve(HERE, '..', '..');
export const ADMIN_URL = process.env.CIA_TEST_PG || '';

const withDb = (url, db) => { const u = new URL(url); u.pathname = '/' + db; return u.toString(); };

export async function startHarness({ staticRoot = null, env = {} } = {}) {
  const { migrate } = await import(path.join(ACADEMY, 'server', 'scripts', 'migrate.mjs'));
  const { createServer } = await import(path.join(ACADEMY, 'server', 'server.mjs'));
  const name = 'cia_t_' + randomBytes(4).toString('hex');
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const ownerUrl = withDb(ADMIN_URL, name);
  const apiPassword = randomBytes(12).toString('hex');
  const apiRole = 'cia_api_' + name.slice(6);
  await migrate(ownerUrl, { apiRole, apiPassword, log: () => {} });
  const apiUrl = (() => { const u = new URL(ownerUrl); u.username = apiRole; u.password = apiPassword; return u.toString(); })();
  const logs = [];
  const { server, db, content } = createServer({ env: { DATABASE_URL: apiUrl, CIA_DATA_DIR: path.join(ACADEMY, 'data'), CIA_SITE_ORIGINS: 'http://site.test', CIA_DEV_OUTBOX: '1', CIA_DEBUG: '1', CIA_RATE_SCALE: '100', ...(staticRoot ? { CIA_STATIC_ROOT: staticRoot } : {}), ...env }, log: l => logs.push(l) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = new pg.Pool({ connectionString: ownerUrl, max: 3 });

  async function call(method, p, { token, body, headers = {} } = {}) {
    const res = await fetch(base + p, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }

  let n = 0;
  async function account({ roles = [], name: display = null } = {}) {
    n++;
    const email = `person${n}.${randomBytes(3).toString('hex')}@example.test`;
    const password = 'correct horse ' + randomBytes(4).toString('hex');
    const r = await call('POST', '/api/v1/auth/signup', { body: { email, password, display_name: display || `Person ${n}` } });
    if (r.status !== 201) { console.log(logs.filter(l=>l.includes('error'))); throw new Error('signup failed ' + JSON.stringify(r.body)); }
    for (const role of roles) await owner.query('insert into cia.user_roles (user_id, role) values ($1, $2) on conflict do nothing', [r.body.user.id, role]);
    return { id: r.body.user.id, email, password, token: r.body.token, name: display || `Person ${n}` };
  }

  async function stop() {
    await new Promise(r => server.close(r));
    await db.end(); await owner.end();
    const a = new pg.Client({ connectionString: ADMIN_URL });
    await a.connect();
    await a.query(`drop database if exists ${name} with (force)`);
    await a.query(`drop role if exists ${apiRole}`);
    await a.end();
  }
  return { base, call, account, owner, ownerUrl, apiUrl, apiRole, stop, logs, content, dbName: name };
}
