/** Phase 17 — daily review cards: deck from misses, Leitner scheduling, streak, practice set, lesson misses. */
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../../src/domain/review.mjs';

const QS = JSON.parse(readFileSync(new URL('../../data/seed/questions.json', import.meta.url), 'utf8')).items.filter(q => q.governance.content_status === 'published');
const SC = QS.filter(q => q.type === 'single_choice');
const byId = new Map(QS.map(q => [q.id, q]));
const T = '2026-11-26';
const att = (id, day, qs, correct = false) => ({ id, assessment_id: 'A', submitted_at: day + 'T08:00:00Z', detail: qs.map(q => ({ question_id: q.id, auto: true, correct })) });

test('deck from missed answers only; reviewable types only; each attempt used once', () => {
  const prac = QS.find(q => q.type === 'practical_assignment');
  const a = { ...att('a1', '2026-11-20', SC.slice(0, 3)), detail: [...att('a1', '2026-11-20', SC.slice(0, 3)).detail, { question_id: SC[3].id, auto: true, correct: true }, { question_id: prac.id, auto: false, correct: false }] };
  const r = R.cardsFromAttempts([a], byId, [], T);
  assert.deepEqual(r.add.map(c => c.id).sort(), SC.slice(0, 3).map(q => q.id).sort()); assert.equal(r.reset.length, 0);
  assert.ok(r.add.every(c => c.box === 1 && c.due === T && c.from_attempts[0] === 'a1'));
  const again = R.cardsFromAttempts([a], byId, r.add, T); assert.equal(again.add.length + again.reset.filter(c => c.box !== 1).length, 0);
});

test('Leitner: right moves up (1,3,7,16,35 days), wrong back to box 1, box 5 right → mastered 90 days', () => {
  let c = R.newCard(SC[0], { source: { kind: 'practice' }, today: T });
  const dues = [];
  for (let i = 0; i < 5; i++) { c = R.answerCard(c, true, T); dues.push([c.box, c.due, c.mastered]); }
  assert.deepEqual(dues, [[2, '2026-11-29', false], [3, '2026-12-03', false], [4, '2026-12-12', false], [5, '2026-12-31', false], [5, '2027-02-24', true]]);
  c = R.answerCard(c, false, T); assert.deepEqual([c.box, c.due, c.mastered, c.lapses], [1, '2026-11-27', false, 1]);
  assert.equal(c.history.length, 6);
});

test('a later miss resets a moved-up card; older attempts do not', () => {
  const [card] = R.cardsFromAttempts([att('a1', '2026-11-20', [SC[0]])], byId, [], '2026-11-20').add;
  const up = { ...R.answerCard(R.answerCard(card, true, '2026-11-21'), true, '2026-11-24') };
  assert.equal(up.box, 3);
  assert.equal(R.cardsFromAttempts([att('a1', '2026-11-20', [SC[0]])], byId, [up], T).reset.filter(c => c.box === 1).length, 0, 'same attempt ignored');
  const r = R.cardsFromAttempts([att('a1', '2026-11-20', [SC[0]]), att('a2', T, [SC[0]])], byId, [up], T);
  assert.equal(r.reset.length, 1); assert.deepEqual([r.reset[0].box, r.reset[0].due, r.reset[0].lapses], [1, T, 1]);
  const gone = R.removeCard(up, T); assert.equal(R.cardsFromAttempts([att('a1', '2026-11-20', [SC[0]])], byId, [gone], T).reset.filter(c => !c.removed).length, 0, 'removed stays removed');
  assert.equal(R.cardsFromAttempts([att('a3', T, [SC[0]])], byId, [gone], T).reset[0].removed, false, 'a new miss brings it back');
  assert.equal(R.dueCards([gone], '2030-01-01').length, 0);
  const old = R.cardsFromAttempts([att('a0', '2026-11-01', [SC[0]])], byId, [up], T); assert.ok(old.reset.every(c => c.box === 3));
});

test('grading uses the assessment rule; unknown is wrong; due order and session cap', () => {
  const q = SC[0]; assert.equal(R.gradeReview(q, q.correct_answer), true); assert.equal(R.gradeReview(q, '__unknown__'), false); assert.equal(R.gradeReview(q, null), false);
  const cards = SC.slice(0, 30).map((x, i) => ({ ...R.newCard(x, { source: {}, today: T }), due: i % 2 ? '2026-11-25' : T, box: 1 + (i % 3) }));
  const due = R.dueCards(cards, T); assert.equal(due.length, R.SESSION_MAX); assert.equal(due[0].due, '2026-11-25');
  assert.equal(R.dueCards(cards, '2026-11-24').length, 0);
});

test('streak, day log and summary', () => {
  let log = [];
  log = [R.logDay(log, '2026-11-24', { reviewed: 4, correct: 2 }), { id: '2026-11-25', reviewed: 3, correct: 3 }];
  assert.equal(R.streak(log, T), 2, 'yesterday keeps the streak alive'); assert.equal(R.streak([...log, { id: T, reviewed: 1, correct: 0 }], T), 3);
  assert.equal(R.streak([{ id: '2026-11-20', reviewed: 1 }], T), 0);
  assert.deepEqual(R.logDay([{ id: T, reviewed: 2, correct: 1 }], T, { reviewed: 1, correct: 1 }), { id: T, reviewed: 3, correct: 2 });
  const s = R.summary([{ ...R.newCard(SC[0], { source: {}, today: T }) }, { ...R.newCard(SC[1], { source: {}, today: T }), due: '2026-12-01', box: 3 }, { ...R.newCard(SC[2], { source: {}, today: T }), mastered: true, box: 5, due: '2027-02-01' }], log, T);
  assert.deepEqual([s.total, s.due, s.learning, s.mastered, s.next, s.boxes.join()], [3, 1, 2, 1, '2026-12-01', '1,0,1,0,0']); assert.equal(s.last14.length, 14);
});

test('practice set: 10 reviewable, no duplicates, deterministic per day; lesson miss adds or resets', () => {
  const pool = QS.filter(q => q.category === 'quality');
  const a = R.practiceSet(pool, [], { today: T, academy: 'quality' }), b = R.practiceSet(pool, [], { today: T, academy: 'quality' });
  assert.equal(a.length, 10); assert.deepEqual(a.map(c => c.id), b.map(c => c.id)); assert.ok(a.every(c => R.reviewable(byId.get(c.id)) && c.source.kind === 'practice'));
  const c2 = R.practiceSet(pool, a, { today: T, academy: 'quality' }); assert.ok(c2.every(c => !a.some(x => x.id === c.id)));
  assert.equal(R.practiceSet(pool.slice(0, 3), pool.slice(0, 3).map(q => ({ id: q.id })), { today: T }).length, 0);
  const q = SC[5]; const add = R.cardFromLessonMiss(q, [], { lessonId: 'L1', today: T }); assert.equal(add.source.kind, 'lesson');
  assert.equal(R.cardFromLessonMiss(q, [add], { lessonId: 'L1', today: T }), null, 'already due in box 1');
  const up = { ...add, box: 4, due: '2026-12-20' }; const back = R.cardFromLessonMiss(q, [up], { lessonId: 'L1', today: T }); assert.deepEqual([back.box, back.due], [1, T]);
  assert.equal(R.cardFromLessonMiss({ ...q, type: 'practical_assignment' }, [], { lessonId: 'L1', today: T }), null);
});

test('rv17 strings: same keys in Arabic and English; review is labelled practice', () => {
  const en = JSON.parse(readFileSync(new URL('../../data/i18n/en.json', import.meta.url), 'utf8')), ar = JSON.parse(readFileSync(new URL('../../data/i18n/ar.json', import.meta.url), 'utf8'));
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [p + k] : flat(v, p + k + '.'));
  assert.deepEqual(flat(en.rv17).sort(), flat(ar.rv17).sort()); assert.match(en.rv17.honest, /never change/); assert.ok(en.x10a.my.tabs.review && ar.x10a.my.tabs.review);
});
