/**
 * Phase 15 unit tests: lesson decks. Every published lesson (authored and guide-based) gets a deck in Arabic and English;
 * every sentence on a slide is quoted from that lesson's own text (no new content); icons exist; model diagrams carry only
 * standard step names and use known figure templates.
 */
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeck, sentences, shorten, quotedPair, iconFor, modelsFor, MODELS, MODEL_ORDER, ICON_RULES, MAX_SLIDES } from '../../src/domain/visuals.mjs';
import { findItem } from '../../src/domain/guides.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const courses = read('data/seed/courses.json').items.filter(c => c.governance?.content_status === 'published');
const guides = {}; const guide = s => (guides[s] ||= read(`data/guides/${s}.json`).guide);
const domSrc = readFileSync(path.join(ROOT, 'src/core/dom.js'), 'utf8');
const ICONS = new Set([...domSrc.matchAll(/^\s+([a-z]+):\s*'M/gm)].map(m => m[1]));
const TEMPLATES = readFileSync(path.join(ROOT, 'src/ui/figures.js'), 'utf8').match(/TEMPLATES = \[([^\]]+)\]/s)[1].match(/'([a-z]+)'/g).map(x => x.slice(1, -1));
const norm = s => String(s).replace(/\s+/g, ' ').replace(/ …$/, '').trim();

const lessons = [];
for (const c of courses) for (const m of c.modules || []) for (const l of m.lessons || []) lessons.push({ c, l, item: l.source ? findItem(guide(l.source.guide), l.source.ref) : null });

test('every published lesson gets a deck of 5 to 12 slides in Arabic and English; guide lessons find their item', () => {
  assert.ok(lessons.length > 900);
  for (const { c, l, item } of lessons) {
    if (l.source) assert.ok(item, `${l.id}: guide item ${l.source.guide}/${l.source.ref}`);
    for (const lang of ['ar', 'en']) {
      const d = buildDeck({ lesson: l, item, course: c, lang });
      assert.ok(d.length >= 5 && d.length <= MAX_SLIDES, `${l.id}/${lang}: ${d.length} slides`);
      assert.equal(d[0].kind, 'cover'); assert.equal(d.at(-1).kind, 'summary');
    }
  }
});

test('no new content: every sentence on every slide is quoted from the lesson or its guide item', () => {
  let checked = 0;
  for (const { c, l, item } of lessons) for (const lang of ['ar', 'en']) {
    const L = v => (v && typeof v === 'object' ? v[lang] || '' : String(v ?? ''));
    const source = norm([L(l.title), L(c.title), ...(l.objectives || []).map(L), ...(l.content_blocks || []).map(b => L(b.text)),
      ...(item ? [L(item.req), L(item.ex), ...[...(item.how || []), ...(item.ev || []), ...(item.gaps || []), ...(item.tips || []), ...(item.checks || [])].map(L)] : [])].join(' '));
    for (const s of buildDeck({ lesson: l, item, course: c, lang })) {
      const texts = [...(s.points || []).map(p => p.text), ...(s.avoid || []), ...(s.show || []), s.text, s.before, s.after, s.kind === 'cover' ? s.title : null].filter(Boolean);
      for (const t of texts) {
        const core = norm(t);
        assert.ok(source.includes(core.split(' … ')[0].slice(0, 60)), `${l.id}/${lang}/${s.kind}: "${core.slice(0, 60)}" not in the lesson`);
        checked++;
      }
    }
  }
  assert.ok(checked > 10000, String(checked));
});

test('icons used by the deck exist; model diagrams use known templates and both languages', () => {
  for (const [, name] of ICON_RULES) assert.ok(ICONS.has(name), name);
  for (const k of MODEL_ORDER) {
    assert.ok(TEMPLATES.includes(MODELS[k].spec.template), k);
    const s = JSON.stringify(MODELS[k]);
    assert.ok(MODELS[k].title.en && MODELS[k].title.ar, k);
    assert.ok(!/\d{2,}|%|shall|must/i.test(JSON.stringify(MODELS[k].spec).replace(/"template":"[a-z]+"|"rows":\d|"cols":\d/g, '')), `${k}: no numbers or requirement wording`);
    assert.equal((s.match(/"en":/g) || []).length, (s.match(/"ar":/g) || []).length, k);
  }
  for (const { c, l, item } of lessons.slice(0, 200)) for (const s of buildDeck({ lesson: l, item, course: c, lang: 'en' })) {
    assert.ok(ICONS.has(s.icon), `${s.kind}: ${s.icon}`);
    for (const p of s.points || []) if (p.icon) assert.ok(ICONS.has(p.icon), p.icon);
  }
});

test('text helpers: sentences in both languages, shortening, quoted before/after pairs, icons and models from words', () => {
  assert.deepEqual(sentences('One. Two! Three? Four. Five.', 3), ['One.', 'Two!', 'Three?']);
  assert.deepEqual(sentences('الأولى. الثانية؟ الثالثة.', 5), ['الأولى.', 'الثانية؟', 'الثالثة.']);
  assert.equal(shorten('a b c d e', 3), 'a b c …');
  assert.deepEqual(quotedPair('Says “ISO approved company”. The accurate version reads: “Certified to ISO 9001 by body X”.'), ['ISO approved company', 'Certified to ISO 9001 by body X']);
  assert.equal(quotedPair('no quotes here'), null);
  assert.equal(iconFor('the internal audit plan'), 'clipboard');
  assert.equal(iconFor('تقييم المخاطر'), 'shield');
  assert.equal(iconFor('nothing matches xyz'), 'bulb');
  assert.deepEqual(modelsFor(['Using the PDCA cycle', 'then a fishbone diagram']), ['pdca', 'fishbone']);
  assert.deepEqual(modelsFor(['دورة PDCA']), ['pdca']);
  assert.deepEqual(modelsFor(['nothing here']), []);
});

test('the first ISO lesson: the "say it right" example becomes a before / after comparison and the certification chain is drawn', () => {
  const { c, l } = lessons.find(x => x.l.id === 'CRS-ISO-101-L01');
  const d = buildDeck({ lesson: l, course: c, lang: 'en' });
  const cmp = d.find(s => s.kind === 'compare');
  assert.ok(cmp && /ISO approved company/.test(cmp.before) && /Certified to ISO 9001/.test(cmp.after));
  assert.ok(d.some(s => s.kind === 'model' && s.model === 'certification'));
  assert.ok(d.some(s => s.kind === 'avoid') && d.some(s => s.kind === 'scenario') && d.some(s => s.kind === 'goals'));
});
