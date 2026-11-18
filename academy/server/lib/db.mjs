/**
 * Database access. Every request runs in its own transaction as a restricted role:
 *   asUser(uid, fn)  → SET LOCAL ROLE cia_app;  cia.uid() = uid   (row-level security applies)
 *   asAuth(fn)       → SET LOCAL ROLE cia_auth                    (users, sessions, reset tokens only)
 * The connection role (cia_api in production) must be a member of both roles and must NOT own the tables, so
 * row-level security is never bypassed by ownership.
 */
import pg from 'pg';

/* DATE columns stay ISO strings (YYYY-MM-DD): no time zone shift on the way to JSON. */
pg.types.setTypeParser(1082, v => v);

export class HttpError extends Error {
  constructor(status, code, detail = null) { super(code); this.status = status; this.code = code; this.detail = detail; }
}

/** PostgreSQL error → HTTP error (never forwards the database message to the client). */
export function mapPgError(err) {
  if (err instanceof HttpError) return err;
  switch (err?.code) {
    case '42501': return new HttpError(403, 'forbidden');           // insufficient privilege / RLS violation / our guards
    case '22023': case '22P02': case '23514': case '22007': case '22008': return new HttpError(400, 'invalid');
    case '23505': return new HttpError(409, 'exists');
    case '23503': return new HttpError(400, 'reference');
    case 'P0002': return new HttpError(404, 'not_found');
    case '55000': return new HttpError(409, 'state');
    default: return null;
  }
}

export function createDb({ connectionString, max = 10 } = {}) {
  const pool = new pg.Pool({ connectionString, max, application_name: 'cia-academy-api' });
  pool.on('error', () => { /* idle client errors are logged by the request that hits them */ });

  async function tx(role, uid, fn) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`set local role ${role === 'auth' ? 'cia_auth' : 'cia_app'}`);
      await c.query("select set_config('cia.uid', $1, true)", [uid || '']);
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (err) {
      try { await c.query('rollback'); } catch { /* ignore */ }
      throw mapPgError(err) || err;
    } finally { c.release(); }
  }

  return {
    pool,
    asUser: (uid, fn) => tx('app', uid, fn),
    asAuth: fn => tx('auth', null, fn),
    asAnon: fn => tx('app', null, fn),
    async ping() { const r = await pool.query('select 1 as ok'); return r.rows[0]?.ok === 1; },
    end: () => pool.end()
  };
}
