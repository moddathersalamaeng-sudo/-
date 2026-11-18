#!/usr/bin/env node
/**
 * Switch accounts on (or off) for a deployment — owner step after D-14-1.
 *   node tools/configure_backend.mjs https://api.example.org/api/v1     # accounts on: config.json + Content-Security-Policy
 *   node tools/configure_backend.mjs --off                              # accounts off (the default; signed-out Academy only)
 * Only an https address is accepted (or a same-origin path such as /api/v1). No key or secret is ever written to the client.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) { console.error('usage: configure_backend.mjs <https://…/api/v1 | /api/v1 | --off>'); process.exit(2); }
const apiBase = arg === '--off' ? '' : arg;
if (apiBase && !/^https:\/\/[a-z0-9.-]+(:\d+)?\/[A-Za-z0-9/_-]*$/i.test(apiBase) && !/^\/[A-Za-z0-9/_-]+$/.test(apiBase)) {
  console.error('refused: the API address must be https://host/path (or a same-origin path) with no credentials or query'); process.exit(1);
}
const cfgPath = path.join(ROOT, 'data', 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.backend = { ...(cfg.backend || {}), apiBase };
writeFileSync(cfgPath, JSON.stringify(cfg));
execFileSync('python3', [path.join(ROOT, 'tools', 'build_phase14.py')], { stdio: 'inherit' });
console.log(apiBase ? `accounts ON → ${apiBase}` : 'accounts OFF (signed-out Academy only)');
