#!/usr/bin/env node
/**
 * Make an existing account the first administrator and record it as the content owner (owner-approval basis, D-21).
 * Run once, by the owner, with the OWNER database connection:
 *   MIGRATE_DATABASE_URL=… node scripts/bootstrap-admin.mjs owner@example.com [--owner]
 */
import pg from 'pg';
const [email, flag] = process.argv.slice(2);
if (!email) { console.error('usage: bootstrap-admin.mjs <email> [--owner]'); process.exit(2); }
const c = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
await c.connect();
try {
  const u = (await c.query('select id from cia.users where lower(email) = lower($1)', [email])).rows[0];
  if (!u) throw new Error('no account with that e-mail: sign up first');
  await c.query("insert into cia.user_roles (user_id, role) values ($1, 'admin'), ($1, 'reviewer') on conflict do nothing", [u.id]);
  if (flag === '--owner') await c.query("update cia.settings set value = to_jsonb($1::text), updated_at = now() where key = 'owner_user_id'", [u.id]);
  await c.query("insert into cia.audit_log (actor, action, target, detail) values (null, 'role.bootstrap', $1, $2)", [u.id, { owner: flag === '--owner' }]);
  console.log(`administrator${flag === '--owner' ? ' and content owner' : ''} set`);
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await c.end(); }
