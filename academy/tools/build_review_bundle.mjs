#!/usr/bin/env node
/**
 * Single-file review build of the Academy (Phase 7, with the toolkit guides).
 *
 * Produces one self-contained HTML file (code, styles, fonts and all data inlined) that the content owner and
 * reviewers can open anywhere — no server needed. It starts in the reviewer role (config.reviewBuild = true), keeps
 * the role switcher, and links toolkits to the live platform. It is a preview for review, not the production site.
 *
 *   node tools/build_review_bundle.mjs [out.html] [--fragment]
 * --fragment writes the page without <!DOCTYPE>/<html>/<head>/<body> (for hosts that wrap the page in their own skeleton).
 * Requires network access to npm once (esbuild 0.24.2 via npx). Default output: ../../deliverables/phase-11/CIA_ACADEMY_REVIEW_BUILD.html
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const FRAGMENT = ARGS.includes('--fragment');
const OUT = resolve(ARGS.find(a => !a.startsWith('--')) || join(ROOT, '..', '..', 'deliverables', 'phase-11', 'CIA_ACADEMY_REVIEW_BUILD.html'));
const LIVE = 'https://moddathersalamaeng-sudo.github.io/-/';
const read = p => readFileSync(join(ROOT, p), 'utf8');

// 1. Bundle the ES modules into one script.
const js = execFileSync('npx', ['--yes', 'esbuild@0.24.2', 'src/main.js', '--bundle', '--format=iife', '--minify', '--target=es2020', '--charset=utf8'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// 2. Inline every JSON file the app fetches.
const files = {};
const addDir = dir => { for (const f of readdirSync(join(ROOT, dir))) if (f.endsWith('.json')) files[`./${dir}/${f}`] = JSON.parse(read(`${dir}/${f}`)); };
addDir('data/i18n'); addDir('data/seed'); addDir('data/seed/competency'); addDir('data/guides');
/* Phase 10A: the browser reads courses and questions from the per-academy split, and search from the build-time index;
   the master files (courses.json, questions.json) are for the builders only, so they are not inlined twice. */
addDir('data/seed/split'); files['./data/search-index.json'] = JSON.parse(read('data/search-index.json'));
delete files['./data/seed/courses.json']; delete files['./data/seed/questions.json']; delete files['./data/seed/labs.json']; /* Phase 11: labs come from the split too */
files['./data/config.json'] = { ...JSON.parse(read('data/config.json')), reviewBuild: true, platformBase: LIVE, version: JSON.parse(read('data/config.json')).version + '-review' };

// 3. Inline styles and fonts.
const font = f => 'data:font/woff2;base64,' + readFileSync(join(ROOT, 'assets/fonts', f)).toString('base64');
const css = ['tokens.css', 'app.css', 'academy.css', 'visual.css', 'phase10a.css', 'labs.css'].map(f => read('assets/css/' + f)).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("${font(f)}")`);

const safeJson = JSON.stringify(files).replace(/</g, '\\u003c');
const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>CIA Academy Review</title>
<style>${css}</style>
<script>
/* Review build: serve the Academy's JSON from this file instead of the network. */
(function () {
  var DATA = ${safeJson};
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    var key = String(url).split('?')[0];
    if (key.indexOf('./') !== 0) key = './' + key.replace(/^\\//, '');
    if (Object.prototype.hasOwnProperty.call(DATA, key)) return Promise.resolve(new Response(JSON.stringify(DATA[key]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    return realFetch ? realFetch(url, opts) : Promise.reject(new Error('offline'));
  };
  var l = new URLSearchParams(location.search).get('lang');
  try { if (l !== 'ar' && l !== 'en') l = localStorage.getItem('cia-lang'); } catch (e) {}
  if (l !== 'ar' && l !== 'en') l = 'ar';
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  /* Links to the live platform open in a new tab. */
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="http"]'); if (a) { a.target = '_blank'; a.rel = 'noopener'; } }, true);
})();
</script>
</head>
<body>
<div id="app"><main class="main"><p class="loading" role="status"><span class="spinner" aria-hidden="true"></span> …</p></main></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
const out = FRAGMENT
  ? html.replace(/<!DOCTYPE html>\n<html[^>]*>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport"[^>]*>\n/, '').replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '')
  : html;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`${OUT} — ${(out.length / 1024 / 1024).toFixed(2)} MB${FRAGMENT ? ' (fragment)' : ''}`);
