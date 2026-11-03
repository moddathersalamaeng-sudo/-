#!/usr/bin/env node
/**
 * Extract the structured, bilingual content the owner published inside the hub toolkits (../modules/*.html)
 * into plain JSON, so the Academy can teach from it instead of re-writing it.
 *
 * How: every inline <script> (vendor libraries skipped) is parsed with acorn. Its top-level function and variable
 * declarations run, in page order, inside one empty vm context per toolkit (no globals, no DOM, 500 ms limit per
 * statement); each `const NAME = { … } | [ … ]` is then read back and kept only if it survives a JSON round-trip.
 *
 *   npm install --no-save acorn@8.12.1        (once)
 *   node tools/extract_toolkit_content.mjs [platformRoot] [outDir]
 * Default output: tools/_extract/<module>.json (raw, not shipped) — tools/build_toolkit_courses.py turns it
 * into Academy collections.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as acorn from 'acorn';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.argv[2] || join(HERE, '..', '..'));
const OUT = resolve(process.argv[3] || join(HERE, '_extract'));
const VENDOR = /^\s*\/\*\s*(html2canvas|jsPDF)|^\s*\/\*!|@license/;
mkdirSync(OUT, { recursive: true });

const summary = {};
for (const f of readdirSync(join(ROOT, 'modules')).filter(f => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(ROOT, 'modules', f), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim() && !VENDOR.test(s.slice(0, 400)));
  const data = {}, failed = [];
  // One shared, empty context per toolkit: helper functions and constants defined earlier (for example the bilingual
  // helper B(ar, en)) are available to later data, exactly as in the page. Statements that need the page (document,
  // window, localStorage) simply fail and are skipped.
  const ctx = vm.createContext(Object.create(null));
  const wanted = [];
  for (const src of scripts) {
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); }
    catch { continue; }
    for (const st of ast.body) {
      if (st.type !== 'VariableDeclaration' && st.type !== 'FunctionDeclaration') continue;
      try { vm.runInContext(src.slice(st.start, st.end), ctx, { timeout: 500 }); } catch { /* needs the page: skipped */ }
      if (st.type === 'VariableDeclaration') for (const d of st.declarations)
        if (d.id.type === 'Identifier' && d.init && ['ObjectExpression', 'ArrayExpression'].includes(d.init.type) && d.init.end - d.init.start >= 400) wanted.push(d.id.name);
    }
  }
  for (const name of [...new Set(wanted)]) {
    try {
      const v = vm.runInContext(name, ctx, { timeout: 500 });
      const j = JSON.parse(JSON.stringify(v));
      if (j !== undefined && j !== null) data[name] = j; else failed.push(name);
    } catch { failed.push(name); }
  }
  const key = f.replace(/\.html$/, '');
  writeFileSync(join(OUT, key + '.json'), JSON.stringify({ module: key, file: 'modules/' + f, data }, null, 1));
  summary[key] = { kept: Object.keys(data), failed };
}
writeFileSync(join(OUT, '_summary.json'), JSON.stringify(summary, null, 1));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(32), v.kept.length, 'kept', v.failed.length ? '· failed: ' + v.failed.join(',') : '');
