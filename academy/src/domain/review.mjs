/**
 * Phase 17 — daily review cards (spaced repetition, Leitner boxes). Pure functions; dates are the learner's local calendar
 * days ("YYYY-MM-DD"), passed in, so every rule is testable.
 *
 *  - A card is one published, automatically gradable question (single choice, true/false, multiple choice).
 *  - Cards come from questions the learner missed or marked "I don't know" in an assessment, from a missed lesson check,
 *    or from a practice set the learner adds. Nothing here is assessment evidence: review answers never change a score,
 *    a competency level or the passport.
 *  - Boxes 1…5 wait 1, 3, 7, 16 and 35 days. A right answer moves the card up one box; a wrong one sends it back to box 1.
 *    A right answer in box 5 marks the card "mastered" (checked again after 90 days).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { gradeQuestion, UNKNOWN } from './assessments.mjs';

export const INTERVALS = [1, 3, 7, 16, 35];
export const MASTERED_INTERVAL = 90;
export const SESSION_MAX = 20;
export const PRACTICE_SET = 10;
export const REVIEWABLE = new Set(['single_choice', 'true_false', 'multiple_choice']);
export const reviewable = q => !!q && REVIEWABLE.has(q.type) && q.correct_answer != null && q.governance?.content_status === 'published';

export function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
const dayOf = ts => String(ts || '').slice(0, 10);

export function newCard(q, { source, today }) {
  return { id: q.id, question_id: q.id, box: 1, due: today, mastered: false, reviews: 0, lapses: 0, last_result: null,
    source, created_at: today, updated_at: today, history: [] };
}

/**
 * New or reset cards from assessment attempts: every auto-graded answer that was wrong or "I don't know". Each card remembers
 * the attempts that already touched it (`from_attempts`), so an attempt is used once. A later attempt (not older than the card)
 * that misses the question again sends a card that had moved up back to box 1, due today. Returns { add: [cards], reset: [cards] }.
 */
export function cardsFromAttempts(attempts = [], questionsById = new Map(), cards = [], today) {
  const work = new Map(cards.map(c => [c.id, c])), touched = new Map(), added = new Set();
  const sorted = [...attempts].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  for (const a of sorted) {
    for (const d of a.detail || []) {
      if (!d || !d.auto || d.correct) continue;
      const q = questionsById.get(d.question_id);
      if (!reviewable(q)) continue;
      const src = { kind: 'assessment', ref: a.assessment_id, at: dayOf(a.submitted_at) };
      const cur = work.get(q.id);
      if (!cur) { const c = { ...newCard(q, { source: src, today }), from_attempts: [a.id] }; work.set(q.id, c); touched.set(q.id, c); added.add(q.id); continue; }
      const seen = cur.from_attempts || [];
      if (seen.includes(a.id) || dayOf(a.submitted_at) < (cur.created_at || '')) continue;
      const moved = cur.box > 1 || cur.mastered || cur.removed;   // a removed card comes back only when a later attempt misses it again
      const c = { ...cur, from_attempts: [...seen, a.id].slice(-20), ...(moved ? { box: 1, due: today, mastered: false, removed: false, lapses: cur.lapses + 1, updated_at: today, source: src } : {}) };
      work.set(q.id, c); touched.set(q.id, c);
    }
  }
  const out = { add: [], reset: [] };
  for (const [id, c] of touched) (added.has(id) ? out.add : out.reset).push(c);
  return out;
}

/** Removing a card keeps a marker (so the same old miss does not bring it back); the deck ignores it. */
export const removeCard = (card, today) => ({ ...card, removed: true, updated_at: today });
export const activeCards = cards => cards.filter(c => !c.removed);

/** A missed lesson check adds (or resets) one card. Returns the card to save, or null when nothing changes. */
export function cardFromLessonMiss(q, cards = [], { lessonId, today }) {
  if (!reviewable(q)) return null;
  const cur = cards.find(c => c.id === q.id);
  const src = { kind: 'lesson', ref: lessonId, at: today };
  if (!cur) return newCard(q, { source: src, today });
  if (cur.box === 1 && !cur.mastered && !cur.removed && cur.due <= today) return null;
  return { ...cur, box: 1, due: today, mastered: false, removed: false, lapses: cur.lapses + 1, updated_at: today, source: src };
}

/** Deterministic practice set: up to n reviewable questions of the pool not yet in the deck, ordered by a hash of id + day. */
export function practiceSet(pool = [], cards = [], { n = PRACTICE_SET, today, academy }) {
  const have = new Set(cards.map(c => c.id));
  const h = s => { let x = 2166136261; for (const ch of s) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  return pool.filter(q => reviewable(q) && !have.has(q.id)).sort((a, b) => h(a.id + today) - h(b.id + today) || a.id.localeCompare(b.id)).slice(0, n)
    .map(q => newCard(q, { source: { kind: 'practice', ref: academy, at: today }, today }));
}

/** Cards due today or earlier (mastered cards included once their 90 days are up), oldest due and lowest box first. */
export function dueCards(cards = [], today, max = SESSION_MAX) {
  return cards.filter(c => !c.removed && c.due <= today).sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box || a.id.localeCompare(b.id)).slice(0, max);
}

/** Grade a review answer with the assessment engine's own rule. 'unknown' counts as wrong. */
export function gradeReview(q, answer) {
  if (answer == null || answer === UNKNOWN) return false;
  return gradeQuestion(q, answer).correct === true;
}

/** The card after one answer (Leitner). */
export function answerCard(card, correct, today) {
  const hist = [...(card.history || []), { day: today, ok: !!correct, box: card.box }].slice(-12);
  if (!correct) return { ...card, box: 1, due: addDays(today, INTERVALS[0]), mastered: false, reviews: card.reviews + 1, lapses: card.lapses + 1, last_result: 'wrong', updated_at: today, history: hist };
  if (card.box >= INTERVALS.length) return { ...card, box: INTERVALS.length, due: addDays(today, MASTERED_INTERVAL), mastered: true, reviews: card.reviews + 1, last_result: 'right', updated_at: today, history: hist };
  const box = card.box + 1;
  return { ...card, box, due: addDays(today, INTERVALS[box - 1]), mastered: false, reviews: card.reviews + 1, last_result: 'right', updated_at: today, history: hist };
}

/** Day log record after a session (one per calendar day). */
export function logDay(log = [], today, { reviewed, correct }) {
  const cur = log.find(x => x.id === today) || { id: today, reviewed: 0, correct: 0 };
  return { ...cur, reviewed: cur.reviewed + reviewed, correct: cur.correct + correct };
}

/** Consecutive review days ending today (or yesterday, so the streak is not lost before today's session). */
export function streak(log = [], today) {
  const days = new Set(log.filter(x => x.reviewed > 0).map(x => x.id));
  let d = days.has(today) ? today : addDays(today, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function summary(all = [], log = [], today) {
  const cards = all.filter(c => !c.removed);
  const future = cards.filter(c => c.due > today).map(c => c.due).sort();
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map(day => ({ day, reviewed: log.find(x => x.id === day)?.reviewed || 0 }));
  return {
    total: cards.length, due: cards.filter(c => c.due <= today).length,
    learning: cards.filter(c => !c.mastered).length, mastered: cards.filter(c => c.mastered).length,
    boxes: INTERVALS.map((_, i) => cards.filter(c => !c.mastered && c.box === i + 1).length),
    next: future[0] || null, streak: streak(log, today), last14
  };
}
