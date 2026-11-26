/** Phase 18 — the owner's videos: catalogue, placements, ordering, search, progress. */
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as V from '../../src/domain/videos.mjs';
const doc = JSON.parse(readFileSync(new URL('../../data/seed/videos.json', import.meta.url), 'utf8'));
const courses = JSON.parse(readFileSync(new URL('../../data/seed/courses.json', import.meta.url), 'utf8')).items;
const lessonIds = new Set(courses.flatMap(c => c.modules.flatMap(m => m.lessons.map(l => l.id))));
const V0 = doc.items;

test('catalogue: 73 published owner videos, unique ids, every placement points at a real course / lesson', () => {
  assert.equal(V0.length, 73); assert.equal(new Set(V0.map(v => v.id)).size, 73);
  for (const v of V0) {
    assert.ok(v.title.ar && v.title.en && v.duration > 20, v.id);
    assert.equal(v.governance.content_status, 'published'); assert.equal(v.governance.content_source, 'owner');
    for (const p of v.placements) { assert.ok(courses.some(c => c.id === p.course_id), p.course_id); if (p.lesson_id) assert.ok(lessonIds.has(p.lesson_id), p.lesson_id); }
  }
  const placed = V0.filter(v => v.placements.length).length; assert.ok(placed >= 60, `${placed} placed`);
});

test('clause videos land on the matching lessons of the ISO 9001 requirements guide', () => {
  const g = courses.find(c => c.id === 'CRS-G-9001'); const ls = g.modules.flatMap(m => m.lessons);
  for (const l of ls) {
    const ref = l.source.ref; const vs = V.forLesson(V0, l.id).filter(v => v.series === 'iso9001-2026');
    assert.ok(vs.length >= 1, `${l.id} ${ref} has a video`);
    assert.ok(vs.every(v => ref === v.clause || ref.startsWith(v.clause + '.')), `${l.id}: ${vs.map(v => v.clause)}`);
  }
});

test('ordering by series and by clause number (8.5.6 before 8.6, 9.3 before 10.1); neighbours; search', () => {
  const iso = V.sortVideos(V0).filter(v => v.series === 'iso9001-2026').map(v => v.order);
  assert.ok(iso.indexOf('8.5.6') < iso.indexOf('8.6') && iso.indexOf('9.3') < iso.indexOf('10.1') && iso.indexOf('0.1') === 0);
  assert.deepEqual(V.bySeries(V0).map(g => g.series), V.SERIES_ORDER);
  const n = V.neighbours(V0, 'iso26-7-1'); assert.equal(n.prev.id, 'iso26-6-3'); assert.equal(n.next.id, 'iso26-7-2');
  assert.deepEqual(V.neighbours(V0, 'nope'), { prev: null, next: null });
  assert.deepEqual(V.search(V0, '7.1').map(v => v.id), ['iso26-7-1']); assert.deepEqual(V.search(V0, 'باريتو').map(v => v.id), ['joda-ep05']);
  assert.ok(V.search(V0, 'pareto').some(v => v.id === 'joda-ep05')); assert.equal(V.search(V0, '').length, 73);
  assert.equal(V.fmtTime(65.4), '1:05'); assert.ok(V.minutes(V0) > 200);
});

test('progress: saves every 5 s, watched at 90 % or the end, resume rules', () => {
  const a = V.progressAfter(null, { id: 'x', position: 12, duration: 100, now: 'T' }); assert.deepEqual(a, { id: 'x', position: 12, watched: false, updated_at: 'T' });
  assert.equal(V.progressAfter(a, { id: 'x', position: 14, duration: 100 }), null);
  assert.equal(V.progressAfter(a, { id: 'x', position: 91, duration: 100 }).watched, true);
  assert.deepEqual(V.progressAfter(a, { id: 'x', position: 100, duration: 100, ended: true, now: 'T' }), { id: 'x', position: 0, watched: true, updated_at: 'T' });
  assert.equal(V.resumeAt({ position: 40, watched: false }, 300), 40); assert.equal(V.resumeAt({ position: 5 }, 300), 0); assert.equal(V.resumeAt({ position: 295 }, 300), 0); assert.equal(V.resumeAt({ position: 40, watched: true }, 300), 0);
  assert.equal(V.watchedCount(V0, [{ id: 'iso26-7-1', watched: true }, { id: 'zz', watched: true }]), 1);
});

test('vd18 strings: same keys in Arabic and English; series labels for all five series', () => {
  const en = JSON.parse(readFileSync(new URL('../../data/i18n/en.json', import.meta.url), 'utf8')), ar = JSON.parse(readFileSync(new URL('../../data/i18n/ar.json', import.meta.url), 'utf8'));
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [p + k] : flat(v, p + k + '.'));
  assert.deepEqual(flat(en.vd18).sort(), flat(ar.vd18).sort());
  for (const s of V.SERIES_ORDER) assert.ok(en.vd18.ser[s] && ar.vd18.ser[s] && en.vd18.serAbout[s]);
  assert.match(en.vd18.voiceNote, /does not replace the standard/);
  const cfg = JSON.parse(readFileSync(new URL('../../data/config.json', import.meta.url), 'utf8')); assert.equal(cfg.videoBase, '../../cia-videos/');
});
