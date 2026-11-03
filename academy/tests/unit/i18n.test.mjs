import test from 'node:test'; import assert from 'node:assert/strict';
import { I18n, flattenKeys, resolveInitialLocale, intlTag, interpolate } from '../../src/core/i18n.js';
import { json, text, walk, MockStorage } from './_util.mjs';
const ar = json('data/i18n/ar.json'), en = json('data/i18n/en.json');

test('AR and EN dictionaries have identical key sets', () => {
  const a = new Set(flattenKeys(ar)), e = new Set(flattenKeys(en));
  assert.deepEqual([...a].filter(k => !e.has(k)), []); assert.deepEqual([...e].filter(k => !a.has(k)), []);
});
test('no empty strings in dictionaries', () => {
  for (const [name, d] of [['ar', ar], ['en', en]]) for (const k of flattenKeys(d)) {
    const v = k.split('.').reduce((o, x) => o[x], d); assert.ok(typeof v === 'string' && v.trim(), `${name}:${k}`);
  }
});
test('every literal t("key") used in src exists in both dictionaries', () => {
  const i = new I18n({ dictionaries: { ar, en } });
  const missing = [];
  for (const f of walk('src', '.js')) for (const m of text(f).matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*[,)]/g)) {
    for (const l of ['ar', 'en']) { i.locale = l; if (!i.has(m[1])) missing.push(`${f}:${l}:${m[1]}`); }
  }
  assert.deepEqual(missing, []);
});
test('no hardcoded Arabic UI text in components/views (endonyms and boot fallback excepted)', () => {
  const allowed = ['العربية'];
  for (const f of [...walk('src/ui', '.js'), ...walk('src/views', '.js')]) {
    const src = text(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const hits = (src.match(/[\u0600-\u06FF][\u0600-\u06FF\s]*/g) || []).map(s => s.trim()).filter(s => s && !allowed.includes(s));
    assert.deepEqual(hits, [], f);
  }
});
test('interpolation and fallback', () => {
  const i = new I18n({ dictionaries: { ar, en }, locale: 'en' });
  assert.equal(i.t('nav.phase', { phase: 4 }), 'Phase 4');
  assert.equal(interpolate('{a}-{b}', { a: 1 }), '1-{b}');
  let missed = null; const j = new I18n({ dictionaries: { ar, en: {} }, locale: 'en', onMissing: k => { missed = k; } });
  assert.equal(j.t('home.title'), ar.home.title); assert.equal(missed, 'home.title');
  assert.equal(j.t('does.not.exist'), 'does.not.exist');
});
test('initial locale precedence: ?lang → shared cia-lang → Arabic default', () => {
  assert.equal(resolveInitialLocale({ search: '?lang=en', storage: new MockStorage({ 'cia-lang': 'ar' }) }), 'en');
  assert.equal(resolveInitialLocale({ search: '', storage: new MockStorage({ 'cia-lang': 'en' }) }), 'en');
  assert.equal(resolveInitialLocale({ search: '?lang=fr', storage: new MockStorage() }), 'ar');
  assert.equal(resolveInitialLocale({ storage: { getItem() { throw new Error('blocked'); } } }), 'ar');
});
test('dates are Gregorian in Arabic; digits follow preference', () => {
  assert.match(intlTag('ar', 'latn'), /ca-gregory-nu-latn$/);
  const i = new I18n({ dictionaries: { ar, en }, locale: 'ar', digits: 'latn' });
  assert.match(i.date('2026-09-27'), /2026/); assert.doesNotMatch(i.date('2026-09-27'), /1448/);
  i.setDigits('arab'); assert.match(i.number(2026, { useGrouping: false }), /^٢٠٢٦$/); assert.doesNotMatch(i.date('2026-09-27'), /[0-9]/); assert.equal(i.digitize('12A'), '١٢A');
  i.setDigits('latn'); assert.equal(i.number(5), '5');
  assert.equal(new I18n({ dictionaries: { ar, en }, locale: 'en' }).dir, 'ltr'); assert.equal(i.dir, 'rtl');
});
