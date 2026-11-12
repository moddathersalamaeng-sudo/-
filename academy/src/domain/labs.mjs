/**
 * Practice Lab engine (Phase 11). One engine, many labs: a lab is governed data (data/seed/labs.json, split per academy
 * into data/seed/split/labs-*.json) — scenario → tasks → learner response → rubric scoring → feedback → attempt record.
 *
 * Task types
 *   single_choice   one option is right; every option carries its own rationale (`why`)
 *   multi_select    several options are right; partial credit = (right picks − wrong picks) / right options, never below 0
 *   ordering        put the items in order; partial credit = share of item pairs in the right relative order
 *   classify        sort each item into a category; partial credit = share of items in the right category
 *   numeric         a calculated value, right within the stated tolerance (Arabic-Indic digits and decimal commas accepted)
 *   free_text       written work scored against a rubric by a person: always "pending human review" until reviewed
 * "I don't know" is allowed on every automatically scored task: it scores zero and is counted, never guessed.
 *
 * Evidence rule (extends ARCHITECTURE §8 "Evidence model"): only automatically scored or human-reviewed tasks count;
 * a competency receives lab evidence only from at least LAB_EVIDENCE_MIN_ITEMS such tasks in the same attempt; the newest
 * attempt replaces older evidence exactly like an assessment attempt; the learner's own self-check ticks never count.
 * Lab results are practice evidence, not a certification. Pure functions — no DOM, no storage.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { ACADEMY_KEYS } from './academies.mjs';

export const LAB_SCHEMA = 'cia.lab.v1';
export const LAB_ATTEMPT_SCHEMA = 'cia.lab-attempt.v1';
export const LAB_TASK_TYPES = ['single_choice', 'multi_select', 'ordering', 'classify', 'numeric', 'free_text'];
export const LAB_AUTO_TYPES = ['single_choice', 'multi_select', 'ordering', 'classify', 'numeric'];
export const LAB_KINDS = ['simulator', 'writing', 'review', 'analysis', 'builder'];
export const LAB_UNKNOWN = '__unknown__';
export const LAB_EVIDENCE_MIN_ITEMS = 2;
export const LAB_MIN_TASKS = 3;
export const MAX_FREE_TEXT = 4000;
export const LAB_LABEL = {
  en: 'Practice lab — your result is practice evidence, not a certification',
  ar: 'مختبر تطبيقي — نتيجتك دليل تدريب، وليست شهادة'
};

const bi = v => !!(v && typeof v.en === 'string' && v.en.trim() && typeof v.ar === 'string' && v.ar.trim());
const uniq = a => [...new Set(a)];
const isNum = n => typeof n === 'number' && Number.isFinite(n);
const round2 = n => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ validation */

/** Structural check of one task. Returns error codes (empty = valid). */
export function validateTask(task, labCompetencies = []) {
  const e = [];
  const t = task || {};
  if (typeof t.id !== 'string' || !/^T\d{1,2}$/.test(t.id)) e.push('bad_task_id');
  if (!LAB_TASK_TYPES.includes(t.type)) { e.push('bad_task_type'); return e; }
  if (!bi(t.prompt)) e.push('prompt_not_bilingual');
  if (!(isNum(t.weight) && t.weight > 0)) e.push('bad_weight');
  if (!labCompetencies.includes(t.competency)) e.push('competency_not_in_lab');
  if (!bi(t.model_answer)) e.push('missing_model_answer');
  if (!bi(t.reasoning)) e.push('missing_reasoning');
  const opts = Array.isArray(t.options) ? t.options : [];
  const ids = xs => xs.map(x => x?.id);
  switch (t.type) {
    case 'single_choice':
      if (opts.length < 3) e.push('too_few_options');
      if (!opts.some(o => o.id === t.correct)) e.push('correct_not_an_option');
      if (opts.some(o => !bi(o.text) || !bi(o.why))) e.push('option_not_bilingual');
      if (new Set(ids(opts)).size !== opts.length) e.push('duplicate_option');
      break;
    case 'multi_select':
      if (opts.length < 4) e.push('too_few_options');
      if (!opts.some(o => o.correct === true) || !opts.some(o => o.correct === false)) e.push('needs_right_and_wrong_options');
      if (opts.some(o => typeof o.correct !== 'boolean')) e.push('option_without_key');
      if (opts.some(o => !bi(o.text) || !bi(o.why))) e.push('option_not_bilingual');
      if (new Set(ids(opts)).size !== opts.length) e.push('duplicate_option');
      break;
    case 'ordering': {
      const items = Array.isArray(t.items) ? t.items : [];
      if (items.length < 3) e.push('too_few_items');
      if (new Set(ids(items)).size !== items.length) e.push('duplicate_item');
      if (items.some(x => !bi(x.text))) e.push('item_not_bilingual');
      break;
    }
    case 'classify': {
      const cats = Array.isArray(t.categories) ? t.categories : [];
      const items = Array.isArray(t.items) ? t.items : [];
      if (cats.length < 2) e.push('too_few_categories');
      if (items.length < 3) e.push('too_few_items');
      if (cats.some(c => !bi(c.label))) e.push('category_not_bilingual');
      if (items.some(x => !cats.some(c => c.id === x.category))) e.push('item_category_unknown');
      if (items.some(x => !bi(x.text) || !bi(x.why))) e.push('item_not_bilingual');
      if (new Set(ids(items)).size !== items.length || new Set(ids(cats)).size !== cats.length) e.push('duplicate_item');
      break;
    }
    case 'numeric':
      if (!isNum(t.answer)) e.push('bad_answer');
      if (!(isNum(t.tolerance) && t.tolerance >= 0)) e.push('bad_tolerance');
      break;
    case 'free_text': {
      const r = Array.isArray(t.rubric) ? t.rubric : [];
      if (t.review !== 'human') e.push('free_text_must_be_human_reviewed');
      if (r.length < 2) e.push('rubric_missing');
      if (r.some(c => !bi(c.text) || !(isNum(c.weight) && c.weight > 0))) e.push('rubric_not_bilingual');
      if (!(Number.isInteger(t.min_chars) && t.min_chars >= 20)) e.push('bad_min_chars');
      break;
    }
    default: break;
  }
  return uniq(e);
}

/**
 * Whole-lab check. `known` may hold sets of real ids (competencies, courses, lessons, figures, guide refs "slug#ref");
 * when given, every reference must resolve. A published lab needs at least one automatically scored task per competency.
 */
export function validateLab(lab, known = {}) {
  const e = [];
  const l = lab || {};
  if (typeof l.id !== 'string' || !/^LAB-[A-Z0-9-]+$/.test(l.id)) e.push('bad_id');
  if (typeof l.slug !== 'string' || !/^[a-z0-9-]+$/.test(l.slug)) e.push('bad_slug');
  if (!ACADEMY_KEYS.includes(l.academy)) e.push('bad_academy');
  if (!LAB_KINDS.includes(l.kind)) e.push('bad_kind');
  for (const k of ['title', 'summary', 'label']) if (!bi(l[k])) e.push(k + '_not_bilingual');
  if (!(Number.isInteger(l.minutes) && l.minutes > 0 && l.minutes <= 240)) e.push('bad_minutes');
  if (!(isNum(l.pass_mark) && l.pass_mark >= 0 && l.pass_mark <= 100)) e.push('bad_pass_mark');
  const comps = Array.isArray(l.competencies) ? l.competencies : [];
  if (!comps.length) e.push('no_competencies');
  if (known.competencies && comps.some(c => !known.competencies.has(c))) e.push('unknown_competency');
  if (!l.scenario || !bi(l.scenario.title) || !Array.isArray(l.scenario.context) || !l.scenario.context.length || !l.scenario.context.every(bi)) e.push('scenario_incomplete');
  for (const x of l.scenario?.exhibits || []) {
    if (!bi(x.title)) e.push('exhibit_not_bilingual');
    if (x.rows && (!Array.isArray(x.columns) || x.rows.some(r => !Array.isArray(r) || r.length !== x.columns.length))) e.push('exhibit_table_shape');
  }
  const tasks = Array.isArray(l.tasks) ? l.tasks : [];
  if (tasks.length < LAB_MIN_TASKS) e.push('too_few_tasks');
  if (new Set(tasks.map(t => t?.id)).size !== tasks.length) e.push('duplicate_task');
  tasks.forEach(t => validateTask(t, comps).forEach(x => e.push(`${t?.id || '?'}:${x}`)));
  if (!tasks.some(t => LAB_AUTO_TYPES.includes(t?.type))) e.push('no_auto_task');
  if (!tasks.some(t => t?.type === 'free_text')) e.push('no_written_task');
  if (!l.cover || typeof l.cover.motif !== 'string' || typeof l.cover.icon !== 'string') e.push('missing_cover');
  if (!Array.isArray(l.figures) || !l.figures.length) e.push('missing_figure');
  if (known.figures && (l.figures || []).some(f => !known.figures.has(f))) e.push('unknown_figure');
  if (known.courses && (l.courses || []).some(c => !known.courses.has(c))) e.push('unknown_course');
  if (known.lessons && (l.lessons || []).some(x => !known.lessons.has(x))) e.push('unknown_lesson');
  for (const r of l.refs || []) {
    if (typeof r.guide !== 'string' || typeof r.ref !== 'string') e.push('bad_ref');
    else if (known.guideRefs && !known.guideRefs.has(`${r.guide}#${r.ref}`)) e.push('unknown_ref:' + r.guide + '#' + r.ref);
  }
  return uniq(e);
}

/* ------------------------------------------------------------------ responses */

/** Parse a number typed by a learner: Arabic-Indic / Persian digits, Arabic decimal separator, decimal comma, spaces. */
export function parseNumber(input) {
  if (isNum(input)) return input;
  let s = String(input ?? '').trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  s = s.replace(/٫/g, '.').replace(/[\s  ٬]/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');   // 60,000 · 1,240.5 — thousands
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');              // 12,5 — decimal comma
  s = s.replace(/%$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Why a response cannot be submitted yet: '' (fine) · required · invalid_number · too_short · too_long · incomplete. */
export function validateResponse(task, answer) {
  if (answer === LAB_UNKNOWN) return LAB_AUTO_TYPES.includes(task.type) ? '' : 'required';
  switch (task.type) {
    case 'single_choice': return (task.options || []).some(o => o.id === answer) ? '' : 'required';
    case 'multi_select': return Array.isArray(answer) && answer.length && answer.every(a => (task.options || []).some(o => o.id === a)) ? '' : 'required';
    case 'ordering': {
      const want = (task.items || []).map(x => x.id);
      return Array.isArray(answer) && answer.length === want.length && want.every(id => answer.includes(id)) ? '' : 'required';
    }
    case 'classify': {
      const cats = new Set((task.categories || []).map(c => c.id));
      if (!answer || typeof answer !== 'object') return 'required';
      const missing = (task.items || []).filter(x => !cats.has(answer[x.id]));
      return missing.length === 0 ? '' : missing.length === (task.items || []).length ? 'required' : 'incomplete';
    }
    case 'numeric': {
      if (answer == null || String(answer).trim() === '') return 'required';
      return parseNumber(answer) === null ? 'invalid_number' : '';
    }
    case 'free_text': {
      const s = String(answer ?? '').trim();
      if (!s) return 'required';
      if (s.length < (task.min_chars || 20)) return 'too_short';
      if (s.length > MAX_FREE_TEXT) return 'too_long';
      return '';
    }
    default: return 'required';
  }
}

/** Every task's problem, in task order: [{ task_id, code }]. */
export function validateResponses(lab, answers = {}) {
  return (lab.tasks || []).map(t => ({ task_id: t.id, code: validateResponse(t, answers[t.id]) })).filter(x => x.code);
}

/* ------------------------------------------------------------------ scoring */

/** Share of item pairs whose relative order matches the key (1 = exact order). */
export function pairAgreement(expected, actual) {
  const pos = new Map(actual.map((id, i) => [id, i]));
  let ok = 0, n = 0;
  for (let i = 0; i < expected.length; i++) for (let j = i + 1; j < expected.length; j++) {
    n++; if (pos.get(expected[i]) < pos.get(expected[j])) ok++;
  }
  return n ? ok / n : 0;
}

/**
 * Score one task. Returns { earned, max, auto, unknown, pending, reviewed, correct, ratio, parts }.
 * `review` is a human score for a free_text task: { score (0…max), reviewer, date } — only then does it count.
 */
export function gradeTask(task, answer, review = null) {
  const max = Number(task.weight) || 1;
  const auto = LAB_AUTO_TYPES.includes(task.type);
  if (auto && answer === LAB_UNKNOWN) return { earned: 0, max, auto, unknown: true, pending: false, reviewed: false, correct: false, ratio: 0, parts: null };
  let ratio = 0, parts = null;
  switch (task.type) {
    case 'single_choice': ratio = answer === task.correct ? 1 : 0; break;
    case 'multi_select': {
      const picked = new Set(Array.isArray(answer) ? answer : []);
      const right = task.options.filter(o => o.correct);
      const hits = right.filter(o => picked.has(o.id)).length;
      const wrong = task.options.filter(o => !o.correct && picked.has(o.id)).length;
      ratio = Math.max(0, (hits - wrong) / right.length);
      parts = task.options.map(o => ({ id: o.id, picked: picked.has(o.id), correct: o.correct }));
      break;
    }
    case 'ordering': {
      const key = task.items.map(x => x.id);
      const valid = Array.isArray(answer) && answer.length === key.length && key.every(id => answer.includes(id));
      ratio = valid ? pairAgreement(key, answer) : 0;
      parts = key.map((id, i) => ({ id, expected: i, placed: valid ? answer.indexOf(id) : -1 }));
      break;
    }
    case 'classify': {
      const a = answer && typeof answer === 'object' ? answer : {};
      parts = task.items.map(x => ({ id: x.id, chosen: a[x.id] || null, expected: x.category, ok: a[x.id] === x.category }));
      ratio = parts.length ? parts.filter(p => p.ok).length / parts.length : 0;
      break;
    }
    case 'numeric': {
      const v = parseNumber(answer);
      ratio = v !== null && Math.abs(v - task.answer) <= task.tolerance + 1e-9 ? 1 : 0;
      parts = { value: v, expected: task.answer };
      break;
    }
    case 'free_text': {
      const ok = review && isNum(review.score) && typeof review.reviewer === 'string' && review.reviewer.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(review.date || '');
      if (!ok) return { earned: 0, max, auto: false, unknown: false, pending: true, reviewed: false, correct: false, ratio: 0, parts: null };
      const earned = Math.max(0, Math.min(max, review.score));
      return { earned, max, auto: false, unknown: false, pending: false, reviewed: true, correct: earned === max, ratio: earned / max, parts: null };
    }
    default: break;
  }
  const earned = round2(max * ratio);
  return { earned, max, auto, unknown: false, pending: false, reviewed: false, correct: ratio === 1, ratio, parts };
}

/** Verdict for feedback: correct · partial · incorrect · unknown · pending · reviewed. */
export const verdictOf = g => (g.pending ? 'pending' : g.unknown ? 'unknown' : g.reviewed ? 'reviewed' : g.correct ? 'correct' : g.ratio > 0 ? 'partial' : 'incorrect');

/**
 * Score a whole attempt. Percent is over tasks that count (auto + reviewed); tasks awaiting review are listed, not guessed.
 * `mark_met`: the counted tasks reach the lab's practice mark; `passed` additionally needs no task awaiting review
 * (a practice standard, not a certification).
 */
export function scoreLab(lab, answers = {}, reviews = {}) {
  let earned = 0, max = 0, pending = 0, unknown = 0, autoMax = 0;
  const detail = [];
  for (const t of lab.tasks || []) {
    const g = gradeTask(t, answers[t.id], reviews[t.id] || null);
    if (g.pending) pending++;
    else { earned += g.earned; max += g.max; }
    if (g.auto) autoMax += g.max;
    if (g.unknown) unknown++;
    detail.push({ task_id: t.id, type: t.type, competency: t.competency, earned: g.earned, max: g.max, auto: g.auto, unknown: g.unknown, pending: g.pending, reviewed: g.reviewed, correct: g.correct, verdict: verdictOf(g) });
  }
  const percent = max ? Math.round(earned / max * 100) : 0;
  const markMet = max > 0 && percent >= lab.pass_mark;
  return { earned: round2(earned), max, auto_max: autoMax, percent, pending_review: pending, unknown, mark_met: markMet, passed: pending === 0 && markMet,
    status: pending ? 'awaiting_review' : 'complete', detail };
}

/**
 * Per-competency evidence of one scored attempt, under the evidence rule above. Returns { breakdown, excluded } where
 * excluded lists competencies with too few counting items (reason 'too_few_items') or only pending items ('pending_review').
 */
export function labCompetencyEvidence(lab, detail, minItems = LAB_EVIDENCE_MIN_ITEMS) {
  const by = {};
  for (const c of lab.competencies || []) by[c] = { earned: 0, max: 0, percent: 0, unknown: 0, items: 0, pending: 0 };
  for (const d of detail) {
    const x = by[d.competency] || (by[d.competency] = { earned: 0, max: 0, percent: 0, unknown: 0, items: 0, pending: 0 });
    if (d.pending) { x.pending++; continue; }
    if (!d.auto && !d.reviewed) continue;
    x.earned += d.earned; x.max += d.max; x.items++; if (d.unknown) x.unknown++;
  }
  const breakdown = {}, excluded = [];
  for (const [c, x] of Object.entries(by)) {
    if (x.items >= minItems && x.max > 0) breakdown[c] = { earned: round2(x.earned), max: x.max, percent: Math.round(x.earned / x.max * 100), unknown: x.unknown, items: x.items };
    else if (x.items || x.pending) excluded.push({ competency: c, items: x.items, pending: x.pending, reason: x.items ? 'too_few_items' : 'pending_review' });
  }
  return { breakdown, excluded };
}

/** A saved attempt record (cia:v1:<user>:lab_attempts). Answers are copied; free text is trimmed and capped. */
export function makeLabAttempt(lab, answers, { attemptNo = 1, now = new Date().toISOString(), selfCheck = {}, reviews = {} } = {}) {
  const clean = {};
  for (const t of lab.tasks || []) {
    const a = answers[t.id];
    clean[t.id] = t.type === 'free_text' ? String(a ?? '').trim().slice(0, MAX_FREE_TEXT) : (Array.isArray(a) ? [...a] : a && typeof a === 'object' ? { ...a } : a ?? null);
  }
  const s = scoreLab(lab, clean, reviews);
  const ev = labCompetencyEvidence(lab, s.detail);
  const checks = {};
  for (const t of (lab.tasks || []).filter(x => x.type === 'free_text')) {
    const ids = new Set((t.rubric || []).map(c => c.id));
    checks[t.id] = (Array.isArray(selfCheck[t.id]) ? selfCheck[t.id] : []).filter(id => ids.has(id));
  }
  return {
    id: `${lab.id}#${attemptNo}`, schema: LAB_ATTEMPT_SCHEMA, lab_id: lab.id, lab_version: lab.governance?.version || null, attempt_no: attemptNo, submitted_at: now,
    answers: clean, score: s.percent, earned: s.earned, max: s.max, mark_met: s.mark_met, passed: s.passed, status: s.status, pending_review: s.pending_review, unknown: s.unknown,
    competency_breakdown: ev.breakdown, evidence_excluded: ev.excluded, detail: s.detail, self_check: checks, reviews: { ...reviews }
  };
}

export const attemptsFor = (attempts = [], labId) => attempts.filter(a => a.lab_id === labId).sort((a, b) => a.attempt_no - b.attempt_no);
export const nextAttemptNo = (attempts = [], labId) => attemptsFor(attempts, labId).reduce((m, a) => Math.max(m, a.attempt_no || 0), 0) + 1;

/**
 * Lab attempts as rows for the existing evidence model (learner-model.mjs assessmentEvidence): same shape as an
 * assessment attempt, so "latest attempt per competency wins" and "pending items excluded" apply unchanged.
 */
export function labEvidenceRows(attempts = []) {
  return attempts.filter(a => a && a.schema === LAB_ATTEMPT_SCHEMA && a.competency_breakdown && typeof a.submitted_at === 'string')
    .map(a => ({ assessment_id: a.lab_id, source: 'lab', submitted_at: a.submitted_at, competency_breakdown: a.competency_breakdown }));
}

/** One line per lab for My space: attempts, latest and best score, status of the latest attempt. */
export function labProgress(labs = [], attempts = []) {
  return labs.map(l => {
    const xs = attemptsFor(attempts, l.id);
    if (!xs.length) return null;
    const last = xs.at(-1);
    return { lab: l, attempts: xs.length, last, best: Math.max(...xs.map(a => a.score || 0)), passed: xs.some(a => a.passed || a.mark_met), awaiting: last.status === 'awaiting_review' };
  }).filter(Boolean).sort((a, b) => String(b.last.submitted_at).localeCompare(String(a.last.submitted_at)));
}

/* ------------------------------------------------------------------ presentation helpers (pure) */

/** Deterministic display order (so options do not always appear in key order); stable for one attempt number. */
export function shuffledIds(ids, seed) {
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const out = [...ids].sort((a, b) => hash(seed + a) - hash(seed + b) || String(a).localeCompare(String(b)));
  if (out.length > 2 && out.every((x, i) => x === ids[i])) out.push(out.shift());
  return out;
}

/** Move one item in an ordering answer; returns a new array (out-of-range moves are ignored). */
export function moveItem(list, index, delta) {
  const j = index + delta;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list]; [out[index], out[j]] = [out[j], out[index]]; return out;
}

/** The lab attempt as a file a learner can send to a reviewer (no other learner data). */
export function exportAttempt(lab, attempt, lang = 'en', now = new Date().toISOString()) {
  return {
    app: 'cia-academy', schema: 'cia.lab-attempt-export.v1', exported_at: now, label: LAB_LABEL[lang] || LAB_LABEL.en,
    lab: { id: lab.id, slug: lab.slug, version: lab.governance?.version || null, title: lab.title, pass_mark: lab.pass_mark },
    attempt: { ...attempt },
    for_reviewer: (lab.tasks || []).filter(t => t.type === 'free_text').map(t => ({ task_id: t.id, prompt: t.prompt, rubric: t.rubric, answer: attempt.answers?.[t.id] || '', max: t.weight }))
  };
}

/** Light lab record for lists, cards and the search index (no tasks, no keys, no model answers). */
export function labIndexRecord(l) {
  const { tasks, scenario, ...rest } = l;
  const { change_note, approved_hash, ...gov } = l.governance || {};
  return { ...rest, governance: gov, task_count: (tasks || []).length, task_types: uniq((tasks || []).map(t => t.type)),
    scenario: scenario ? { title: scenario.title } : null, split: { academy: l.academy, full: false } };
}
