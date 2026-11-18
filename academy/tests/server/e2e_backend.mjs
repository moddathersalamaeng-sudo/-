#!/usr/bin/env node
/**
 * Backend for tests/e2e/run_e2e_phase14.py: a fresh database, the API, and the static site served from the same origin
 * (CIA_STATIC_ROOT), so `config.backend.apiBase` = "/api/v1". Prints one JSON line { base } and then answers commands on
 * stdin, one per line (test set-up only — there is no such door in the product):
 *   role <uid> <role>        grant an account role (as the database owner)
 *   owner <uid>              record the content owner
 *   sql <query>              owner query, prints the rows as JSON
 *   reload                   re-read published content after the publishing script ran
 *   quit
 */
import readline from 'node:readline';
import { startHarness } from './_harness.mjs';

const staticRoot = process.argv[2];
const dataDir = process.argv[3];
const H = await startHarness({ staticRoot, env: { CIA_DATA_DIR: dataDir } });
process.stdout.write(JSON.stringify({ base: H.base }) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(' ');
  try {
    if (cmd === 'role') await H.owner.query('insert into cia.user_roles (user_id, role) values ($1, $2) on conflict do nothing', [rest[0], rest[1]]);
    else if (cmd === 'owner') await H.owner.query("update cia.settings set value = to_jsonb($1::text) where key = 'owner_user_id'", [rest[0]]);
    else if (cmd === 'sql') { process.stdout.write(JSON.stringify((await H.owner.query(rest.join(' '))).rows) + '\n'); return; }
    else if (cmd === 'reload') await H.content?.reload?.();
    else if (cmd === 'quit') { rl.close(); await H.stop(); process.exit(0); }
    process.stdout.write('ok\n');
  } catch (e) { process.stdout.write(JSON.stringify({ error: e.message }) + '\n'); }
});
process.on('SIGTERM', async () => { await H.stop(); process.exit(0); });
