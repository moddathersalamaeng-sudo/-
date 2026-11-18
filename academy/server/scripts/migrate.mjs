#!/usr/bin/env node
/**
 * Apply (or roll back) the Academy migrations. Run with the database OWNER connection (not cia_api):
 *   MIGRATE_DATABASE_URL=postgres://owner@host/db node scripts/migrate.mjs            # apply pending *.up.sql
 *   MIGRATE_DATABASE_URL=… node scripts/migrate.mjs --down 001_init                    # roll back one migration (backup first)
 *   MIGRATE_DATABASE_URL=… node scripts/migrate.mjs --api-role cia_api                 # create / refresh the API login role
 *     (its password is read from CIA_API_PASSWORD and never printed)
 */
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function migrate(connectionString, { down = null, apiRole = null, apiPassword = null, log = console.log } = {}) {
  const c = new pg.Client({ connectionString });
  await c.connect();
  try {
    if (down) {
      await c.query(await readFile(path.join(DIR, `${down}.down.sql`), 'utf8'));
      log(`rolled back ${down}`);
      return;
    }
    const has = (await c.query("select to_regclass('cia.schema_migrations') as t")).rows[0].t;
    const done = new Set(has ? (await c.query('select version from cia.schema_migrations')).rows.map(r => r.version) : []);
    for (const f of (await readdir(DIR)).filter(f => f.endsWith('.up.sql')).sort()) {
      const v = f.replace('.up.sql', '');
      if (done.has(v)) continue;
      await c.query(await readFile(path.join(DIR, f), 'utf8'));
      log(`applied ${v}`);
    }
    if (apiRole) {
      if (!/^[a-z_][a-z0-9_]{1,40}$/.test(apiRole)) throw new Error('bad role name');
      const exists = (await c.query('select 1 from pg_roles where rolname = $1', [apiRole])).rowCount;
      const pw = apiPassword ? `password '${String(apiPassword).replace(/'/g, "''")}'` : '';
      await c.query(`${exists ? 'alter' : 'create'} role ${apiRole} login noinherit nobypassrls ${pw}`);
      await c.query(`grant cia_app, cia_auth to ${apiRole}`);
      log(`api role ${apiRole} ready (member of cia_app, cia_auth; no table ownership)`);
    }
  } finally { await c.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  migrate(process.env.MIGRATE_DATABASE_URL, { down: opt('--down'), apiRole: opt('--api-role'), apiPassword: process.env.CIA_API_PASSWORD })
    .catch(e => { console.error('migration failed:', e.message); process.exit(1); });
}
