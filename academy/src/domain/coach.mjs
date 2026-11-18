/**
 * Phase 13 — AI Learning Coach and Interview Simulator (spec §16, §22.1, §23, §23.1 / ADD-12, ADD-20). Pure functions, no DOM, no storage.
 *
 * One engine contract (D-96):   context → retrieval → response parts with source labels → guardrail check
 *   - The GROUNDED coach (default, offline, no model) composes every answer from approved Academy content, the learner's own
 *     records and governed templates. It never invents a requirement.
 *   - The optional MODEL ADAPTER (D-98, off unless the owner configures an https endpoint) goes through the same labels and the
 *     same guardrail check. No key ever lives in the client; nothing is sent without an explicit, previewed opt-in.
 *
 * Source labels (D-97, ADD-20) — every part carries exactly one, and an unlabelled part cannot be rendered:
 *   platform   approved, published Academy content (or the Academy's own rules, e.g. a refusal)
 *   external   a link to someone else's official page (never restated text)
 *   user       the learner's own records and answers on this device
 *   ai         the coach's interpretation — always marked uncertain
 *
 * Practice rule (D-100): coach feedback, rubric checks and interview scores are practice feedback. They are never competency
 * evidence (`evidence: false`), never a status upgrade and never a verdict (`verdict: null`); the interview simulator gives no
 * hiring decision.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { normalizeText, searchIndex } from './search.mjs';
import { weeklyPlan, lessonsOf } from './academies.mjs';
import { firstSentence } from './guided.mjs';

export const COACH_SCHEMA = 'cia.coach.v1';
export const INTERVIEW_SCHEMA = 'cia.interview-session.v1';
export const LABELS = ['platform', 'external', 'user', 'ai'];
export const PART_KINDS = ['text', 'passage', 'link', 'list', 'question', 'refusal', 'note'];
export const DEPTHS = ['brief', 'standard', 'deep'];
export const REQUEST_TYPES = ['general', 'official_requirement', 'exam_content', 'authority_claim', 'hiring_verdict', 'grade_request', 'empty'];
export const MAX_QUESTION = 500;
export const MAX_ANSWER = 4000;
export const MIN_ANSWER_WORDS = 8;
export const INTERVIEW_DIMENSIONS = ['knowledge', 'depth', 'communication'];
export const INTERVIEW_DEFAULT_COUNT = 5;
/** The only fields of a learner's context the coach may read — and, with the model adapter, the only ones that may be sent (§23). */
export const CONTEXT_FIELDS = ['locale', 'goal', 'target_role', 'target_certification', 'weekly_hours', 'current_course', 'current_lesson',
  'gaps', 'weak_items', 'history', 'completed', 'milestone', 'assignments'];

const uniq = a => [...new Set(a)];
const isBi = v => !!(v && typeof v === 'object' && (typeof v.en === 'string' || typeof v.ar === 'string'));
const hasText = v => (typeof v === 'string' ? v.trim().length > 0 : isBi(v) && !!String(v.en || v.ar || '').trim());
const bi = (v, f) => (typeof v === 'string' ? f(v) : { en: f(v?.en || v?.ar || ''), ar: f(v?.ar || v?.en || '') });
const day = s => String(s || '').slice(0, 10);
export function hashSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);
const hasTerm = (norm, term) => { const t = normalizeText(term); return !!t && norm.includes(t); };

/* ------------------------------------------------------------------ labelled parts (ADD-20) */

export class CoachError extends Error { constructor(code, message) { super(message || code); this.name = 'CoachError'; this.code = code; } }

/**
 * One response part. A part needs a known label, a known kind and something to show (text, an i18n template key, or list
 * items). An `ai` part is always uncertain; an `external` part is a link to an https page and never carries restated text.
 * Throws CoachError('unlabelled_part' | 'bad_part') — callers never build a part without a label.
 */
export function makePart(input = {}) {
  const p = { ...input };
  if (!LABELS.includes(p.label)) throw new CoachError('unlabelled_part', 'A coach response part needs a source label');
  if (!p.kind) p.kind = 'text';
  if (!PART_KINDS.includes(p.kind)) throw new CoachError('bad_part', `Unknown part kind "${p.kind}"`);
  if (p.label === 'ai') p.uncertain = true;
  if (p.label === 'external') { p.kind = 'link'; delete p.text; }
  if (!renderable(p)) throw new CoachError('bad_part', 'A coach response part has nothing to show');
  return Object.freeze(p);
}

/** The render gate used by the interface: false means the part must not be shown. */
export function renderable(p) {
  if (!p || typeof p !== 'object' || !LABELS.includes(p.label) || !PART_KINDS.includes(p.kind)) return false;
  if (p.label === 'ai' && p.uncertain !== true) return false;
  if (p.label === 'external' && !(p.kind === 'link' && /^https:\/\//.test(String(p.href || '')))) return false;
  if (p.kind === 'link') return typeof p.href === 'string' && p.href.length > 0 && (hasText(p.title) || !!p.tkey);
  if (p.kind === 'list') return Array.isArray(p.items) && p.items.length > 0;
  return hasText(p.text) || (typeof p.tkey === 'string' && p.tkey.length > 0);
}

export const labelsOf = (parts = []) => uniq(parts.filter(renderable).map(p => p.label));

/* ------------------------------------------------------------------ context builder (§23) */

const trimTitle = v => (isBi(v) ? { en: String(v.en || v.ar || ''), ar: String(v.ar || v.en || '') } : typeof v === 'string' ? v : null);

/**
 * The learner's coaching context. Only the fields named in CONTEXT_FIELDS are ever produced; anything else in the profile
 * (name, employer, e-mail, country, free-text notes …) is left out. Lists are short on purpose.
 *   gaps        [{ competency_id, name, required, current, gap, evidence_source, verified? }]  (calculateGaps output)
 *   weakGroups  groupWeak() output
 *   assignments rows from loadMyAssignments()
 */
export function buildCoachContext({ locale = 'ar', profile = null, role = null, certification = null, course = null, lesson = null, gaps = [], verifiedLevels = {},
  weakGroups = [], attempts = [], labAttempts = [], assessments = [], completed = [], milestone = null, assignments = [], compName = () => null } = {}) {
  const ctx = { locale: locale === 'en' ? 'en' : 'ar' };
  if (profile?.goal) ctx.goal = String(profile.goal);
  if (role) ctx.target_role = { id: role.id, name: trimTitle(role.name) };
  if (certification) ctx.target_certification = { id: certification.id, code: String(certification.code || '') };
  const wh = Number(profile?.weekly_hours);
  if (Number.isFinite(wh) && wh >= 1 && wh <= 40) ctx.weekly_hours = wh;
  if (course) ctx.current_course = { id: course.id, title: trimTitle(course.title) };
  if (lesson) ctx.current_lesson = { id: lesson.id, title: trimTitle(lesson.title) };
  const g = gaps.filter(x => x.gap > 0).slice(0, 8).map(x => ({ competency: x.competency_id, name: trimTitle(x.name), required: x.required, current: x.current, gap: x.gap,
    source: verifiedLevels[x.competency_id] ? 'verified' : x.evidence_source || 'insufficient' }));
  if (g.length) ctx.gaps = g;
  const w = weakGroups.slice(0, 8).map(x => ({ competency: x.competency, name: trimTitle(compName(x.competency)), wrong: x.wrong, repeated: x.repeated }));
  if (w.length) ctx.weak_items = w;
  if (attempts.length || labAttempts.length) {
    const title = id => trimTitle(assessments.find(a => a.id === id)?.title) || id;
    ctx.history = { assessments: attempts.length, labs: labAttempts.length,
      last: [...attempts].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0, 5).map(a => ({ id: a.assessment_id, title: title(a.assessment_id), score: a.score, date: day(a.submitted_at) })) };
  }
  const done = uniq([...completed]).filter(x => typeof x === 'string').slice(0, 60);
  if (done.length) ctx.completed = done;
  if (milestone) ctx.milestone = { title: trimTitle(milestone.title), due: day(milestone.due) || null };
  const asg = assignments.filter(r => r.due_state !== 'completed').slice(0, 10).map(r => ({ title: trimTitle(r.item.title), type: r.item.type, due: day(r.item.due), state: r.state }));
  if (asg.length) ctx.assignments = asg;
  return ctx;
}

/** What the learner is shown before anything is sent — and exactly what `modelPayload` sends. */
export const contextPreview = (context = {}) => CONTEXT_FIELDS.filter(k => context[k] !== undefined && context[k] !== null).map(k => [k, context[k]]);

/* ------------------------------------------------------------------ weak items (repeated mistakes) */

/**
 * Items the learner still gets wrong. The LATEST attempt that contains an item decides: answered right there → not weak,
 * however often it was missed before. `wrong` counts every time it was missed; `repeated` means twice or more.
 * Items awaiting human review are never counted. Returns items sorted: repeated first, then most missed, newest, id.
 */
export function weakItems({ attempts = [], questions = [], labAttempts = [], labs = [] } = {}) {
  const qById = questions instanceof Map ? questions : new Map(questions.map(q => [q.id, q]));
  const labById = labs instanceof Map ? labs : new Map(labs.map(l => [l.id, l]));
  const hist = new Map();
  const push = (key, base, rec) => { if (!hist.has(key)) hist.set(key, { ...base, records: [] }); hist.get(key).records.push(rec); };
  for (const at of attempts) for (const d of at.detail || []) {
    if (!d.auto) continue;
    const q = qById.get(d.question_id);
    push('q:' + d.question_id, { kind: 'question', id: d.question_id, competency: d.competency || q?.competency || null, concept: q?.module_id || q?.course_id || null, source_id: at.assessment_id },
      { at: String(at.submitted_at || ''), ok: !!d.correct, unknown: !!d.unknown, answer: at.answers?.[d.question_id] });
  }
  for (const at of labAttempts) for (const d of at.detail || []) {
    if (!d.auto || d.pending) continue;
    const task = labById.get(at.lab_id)?.tasks?.find(t => t.id === d.task_id);
    push(`t:${at.lab_id}:${d.task_id}`, { kind: 'lab_task', id: d.task_id, lab_id: at.lab_id, competency: d.competency || task?.competency || null, concept: at.lab_id, source_id: at.lab_id },
      { at: String(at.submitted_at || ''), ok: !!d.correct, unknown: !!d.unknown, answer: at.answers?.[d.task_id] });
  }
  const out = [];
  for (const [key, h] of hist) {
    const recs = [...h.records].sort((a, b) => a.at.localeCompare(b.at));
    const last = recs.at(-1);
    if (last.ok) continue;
    const wrong = recs.filter(r => !r.ok).length;
    const { records, ...base } = h;
    out.push({ key, ...base, wrong, seen: recs.length, repeated: wrong >= 2, last_at: last.at, last_unknown: last.unknown, last_answer: last.answer });
  }
  return out.sort((a, b) => (b.repeated - a.repeated) || b.wrong - a.wrong || b.last_at.localeCompare(a.last_at) || a.key.localeCompare(b.key));
}

/** Weak items by competency: [{ competency, wrong, repeated, items[] }] — most repeated first. */
export function groupWeak(items = []) {
  const g = new Map();
  for (const it of items) {
    if (!it.competency) continue;
    if (!g.has(it.competency)) g.set(it.competency, { competency: it.competency, wrong: 0, repeated: 0, items: [] });
    const x = g.get(it.competency); x.wrong += it.wrong; x.repeated += it.repeated ? 1 : 0; x.items.push(it);
  }
  return [...g.values()].sort((a, b) => b.repeated - a.repeated || b.wrong - a.wrong || b.items.length - a.items.length || a.competency.localeCompare(b.competency));
}

/* ------------------------------------------------------------------ mistake explanation (stored rationales only) */

const GENERIC_EXPLANATION = /^(CIA original learning item|Scored by a named human reviewer)/;
const optionOf = (q, id) => (q.options || []).find(o => o.id === id) || null;

/**
 * Explain the wrong answers of ONE attempt from what the question bank already stores: the rationale of the option the
 * learner chose, the correct option with its rationale, and the item's explanation. Nothing is generated.
 * Only items in `attempt.detail` are used; an item the learner left blank is listed without its key.
 * Returns { groups: [{ competency, count, items: [{ question_id, prompt, parts[] }] }], total, summary: parts[] }.
 */
export function explainMistakes(attempt, questions = []) {
  const qById = questions instanceof Map ? questions : new Map(questions.map(q => [q.id, q]));
  const groups = new Map();
  let total = 0;
  for (const d of attempt?.detail || []) {
    if (!d.auto || d.correct) continue;
    const q = qById.get(d.question_id);
    if (!q) continue;
    const ans = attempt.answers?.[q.id];
    const parts = [];
    if (ans === undefined || ans === null || ans === '') {
      parts.push(makePart({ label: 'user', kind: 'note', tkey: 'mistakes.notAnswered' }));
    } else {
      if (d.unknown) parts.push(makePart({ label: 'user', kind: 'note', tkey: 'mistakes.saidUnknown' }));
      else if (q.type === 'single_choice' || q.type === 'true_false') {
        const chosen = optionOf(q, ans);
        if (chosen) parts.push(makePart({ label: 'user', lead: 'yourAnswer', text: chosen.text }));
        if (chosen?.why) parts.push(makePart({ label: 'platform', lead: 'whyNot', text: chosen.why }));
      } else if (q.type === 'multiple_choice') {
        const picked = (Array.isArray(ans) ? ans : []).map(id => optionOf(q, id)).filter(Boolean);
        if (picked.length) parts.push(makePart({ label: 'user', kind: 'list', lead: 'yourAnswer', items: picked.map(o => o.text) }));
      } else parts.push(makePart({ label: 'user', kind: 'note', tkey: 'mistakes.partly' }));
      if (q.type === 'single_choice' || q.type === 'true_false') {
        const right = optionOf(q, q.correct_answer);
        if (right) parts.push(makePart({ label: 'platform', lead: 'correctAnswer', text: right.text }));
        if (right?.why) parts.push(makePart({ label: 'platform', lead: 'why', text: right.why }));
      } else if (q.type === 'multiple_choice') {
        const right = (q.correct_answer || []).map(id => optionOf(q, id)).filter(Boolean);
        if (right.length) parts.push(makePart({ label: 'platform', kind: 'list', lead: 'correctAnswer', items: right.map(o => o.text) }));
      }
      if (hasText(q.explanation) && !GENERIC_EXPLANATION.test(q.explanation.en || '')) parts.push(makePart({ label: 'platform', lead: 'explanation', text: q.explanation }));
    }
    const cid = d.competency || q.competency || '—';
    if (!groups.has(cid)) groups.set(cid, { competency: cid, count: 0, items: [] });
    const g = groups.get(cid); g.count++; total++;
    g.items.push({ question_id: q.id, prompt: q.prompt, unknown: !!d.unknown, parts });
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count || a.competency.localeCompare(b.competency));
  const summary = [];
  if (list.length) {
    summary.push(makePart({ label: 'user', kind: 'note', tkey: 'mistakes.count', params: { n: total, groups: list.length } }));
    summary.push(makePart({ label: 'ai', kind: 'note', tkey: 'mistakes.startWith', params: { competency: list[0].competency, n: list[0].count } }));
  }
  return { groups: list, total, summary };
}

/** The same for one practice-lab attempt: the chosen option's rationale, the model answer and its reasoning. Pending written tasks are left out. */
export function explainLabMistakes(lab, attempt) {
  const groups = new Map();
  let total = 0;
  for (const d of attempt?.detail || []) {
    if (!d.auto || d.pending || d.correct) continue;
    const task = (lab?.tasks || []).find(t => t.id === d.task_id);
    if (!task) continue;
    const ans = attempt.answers?.[task.id];
    const parts = [];
    if (d.unknown) parts.push(makePart({ label: 'user', kind: 'note', tkey: 'mistakes.saidUnknown' }));
    else if (task.type === 'single_choice') {
      const chosen = optionOf(task, ans);
      if (chosen) parts.push(makePart({ label: 'user', lead: 'yourAnswer', text: chosen.text }));
      if (chosen?.why) parts.push(makePart({ label: 'platform', lead: 'whyNot', text: chosen.why }));
    } else if (task.type === 'multi_select') {
      const picked = (Array.isArray(ans) ? ans : []).map(id => optionOf(task, id)).filter(Boolean);
      if (picked.length) parts.push(makePart({ label: 'user', kind: 'list', lead: 'yourAnswer', items: picked.map(o => o.text) }));
      const wrongPicks = picked.filter(o => !o.correct && o.why);
      for (const o of wrongPicks.slice(0, 3)) parts.push(makePart({ label: 'platform', lead: 'whyNot', text: o.why }));
    } else parts.push(makePart({ label: 'user', kind: 'note', tkey: d.verdict === 'partial' ? 'mistakes.partly' : 'mistakes.notRight' }));
    if (hasText(task.model_answer)) parts.push(makePart({ label: 'platform', lead: 'modelAnswer', text: task.model_answer }));
    if (hasText(task.reasoning)) parts.push(makePart({ label: 'platform', lead: 'reasoning', text: task.reasoning }));
    const cid = d.competency || task.competency || '—';
    if (!groups.has(cid)) groups.set(cid, { competency: cid, count: 0, items: [] });
    const g = groups.get(cid); g.count++; total++;
    g.items.push({ task_id: task.id, prompt: task.prompt, unknown: !!d.unknown, verdict: d.verdict, parts });
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count || a.competency.localeCompare(b.competency));
  const summary = list.length ? [makePart({ label: 'user', kind: 'note', tkey: 'mistakes.countLab', params: { n: total, groups: list.length } }),
    makePart({ label: 'ai', kind: 'note', tkey: 'mistakes.startWith', params: { competency: list[0].competency, n: list[0].count } })] : [];
  return { groups: list, total, summary };
}

/* ------------------------------------------------------------------ weak-area practice */

/** Assessment kinds whose questions may be reused as untimed practice (a course's final test and practical tasks never are). */
export const PRACTICE_KINDS = ['diagnostic', 'readiness', 'knowledge_quiz', 'scenario'];
export const PRACTICE_TYPES = ['single_choice', 'true_false'];

/** Ids of the questions that may serve as practice: those of visible assessments of a practice kind. */
export const practicePoolIds = (assessments = []) => uniq(assessments.filter(a => PRACTICE_KINDS.includes(a.kind)).flatMap(a => a.question_ids || []));

/**
 * Practice questions for one competency — never from a final test, never one the learner's latest answer got right.
 * Order: questions the learner has not met yet first (fresh practice), then the ones still answered wrongly; ties are broken
 * by a hash of the seed, so the same seed gives the same pair. The answers are not recorded anywhere.
 */
export function practiceQuestions({ competency, pool = [], attempts = [], allowedIds = null, limit = 2, seed = '' } = {}) {
  const allowed = allowedIds ? new Set(allowedIds) : null;
  const last = new Map();
  for (const at of [...attempts].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)))) for (const d of at.detail || []) if (d.auto) last.set(d.question_id, !!d.correct);
  return pool.filter(q => q && q.competency === competency && PRACTICE_TYPES.includes(q.type) && (!allowed || allowed.has(q.id)) && last.get(q.id) !== true && (q.options || []).length >= 2)
    .map(q => ({ q, seen: last.has(q.id), k: hashSeed(`${seed}|${q.id}`) }))
    .sort((a, b) => (a.seen - b.seen) || a.k - b.k || a.q.id.localeCompare(b.q.id)).slice(0, Math.max(0, limit)).map(x => x.q);
}

/** Feedback for one practice answer, from the stored option rationales. Not an attempt: `evidence` is always false. */
export function practiceFeedback(question, answerId) {
  const chosen = optionOf(question, answerId);
  if (!chosen) return { answered: false, correct: false, evidence: false, parts: [] };
  const correct = answerId === question.correct_answer;
  const parts = [makePart({ label: 'user', lead: 'yourAnswer', text: chosen.text })];
  if (!correct && chosen.why) parts.push(makePart({ label: 'platform', lead: 'whyNot', text: chosen.why }));
  const right = optionOf(question, question.correct_answer);
  if (right && !correct) parts.push(makePart({ label: 'platform', lead: 'correctAnswer', text: right.text }));
  if (right?.why) parts.push(makePart({ label: 'platform', lead: 'why', text: right.why }));
  if (hasText(question.explanation) && !GENERIC_EXPLANATION.test(question.explanation.en || '')) parts.push(makePart({ label: 'platform', lead: 'explanation', text: question.explanation }));
  return { answered: true, correct, evidence: false, parts };
}

/** The stored reasoning for one question the learner still gets wrong (an attempted item — its key was already shown in the result). */
export function explainWeakItem(item, question) {
  if (!item || item.kind !== 'question' || !question) return [];
  const parts = [];
  if (PRACTICE_TYPES.includes(question.type)) {
    const chosen = item.last_unknown ? null : optionOf(question, item.last_answer);
    if (chosen) parts.push(makePart({ label: 'user', lead: 'yourAnswer', text: chosen.text }));
    if (chosen?.why) parts.push(makePart({ label: 'platform', lead: 'whyNot', text: chosen.why }));
    const right = optionOf(question, question.correct_answer);
    if (right) parts.push(makePart({ label: 'platform', lead: 'correctAnswer', text: right.text }));
    if (right?.why) parts.push(makePart({ label: 'platform', lead: 'why', text: right.why }));
  }
  if (hasText(question.explanation) && !GENERIC_EXPLANATION.test(question.explanation.en || '')) parts.push(makePart({ label: 'platform', lead: 'explanation', text: question.explanation }));
  return parts;
}

/* ------------------------------------------------------------------ retrieval (approved content only) */

/**
 * Search the build-time index (published records only, D-50) and re-rank for this learner:
 *   +4 the entry belongs to the learner's academy focus · +3 it is the current course or one of its lessons ·
 *   +2 for each weak competency it covers (at most +4). Ties keep the search order. Deterministic.
 * `allow(entry)` is the governance filter for this viewer — an entry it rejects is never returned.
 * focus: { academy, courseId, weak: Set|array of competency ids };  compsOf(entry) → competency ids.
 */
/* A learner asks in sentences ("what is the difference between correction and corrective action?"). The search index answers
   keywords and needs every word to match, so the question is reduced to its content words first (D-107). */
const Q_STOP = new Set([...'a an the is are was were be been do does did can could should would will shall may might must i me my we our you your it its this that these those of in on at to for from by with about into than then and or but not what which who whom whose when where why how difference between explain tell give show please define definition mean means meaning vs versus example examples'.split(' '),
  ...['ما', 'ماذا', 'ماهو', 'ماهي', 'هو', 'هي', 'هم', 'هل', 'من', 'في', 'على', 'علي', 'عن', 'الى', 'الي', 'مع', 'بين', 'او', 'ام', 'ثم', 'لكن', 'ان', 'انا', 'نحن', 'انت', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'كيف', 'لماذا', 'متى', 'متي', 'اين', 'كم', 'اي', 'الفرق', 'فرق', 'اشرح', 'اشرحي', 'وضح', 'عرف', 'عرفني', 'تعريف', 'معنى', 'معني', 'يعني', 'مثال', 'امثله', 'لي', 'لو', 'سمحت', 'فضلك', 'اريد', 'ابغى', 'ابغي', 'عايز', 'كل', 'عند', 'قبل', 'بعد', 'لا', 'لم', 'لن', 'قد', 'هناك', 'يكون', 'تكون', 'كان', 'كانت', 'و', 'ف', 'ب', 'ل', 'ك'].map(normalizeText)]);
/** Arabic one-letter particles written onto the article: "والإجراء" / "بالتدقيق" / "للمراجعة" → the bare word. */
const bare = tok => (tok.length > 5 && /^[وفبك]ال/.test(tok) ? tok.slice(3) : tok.length > 4 && tok.startsWith('لل') ? tok.slice(2) : tok.length > 4 && tok.startsWith('ال') ? tok.slice(2) : tok);
/** The content words of a question, in order, without duplicates (deterministic). A question made only of stop words keeps its words. */
export function questionTerms(question) {
  const toks = normalizeText(question).split(' ').filter(Boolean);
  const kept = uniq(toks.filter(t => !Q_STOP.has(t)).map(bare).filter(t => t.length > 1 && !Q_STOP.has(t)));
  return kept.length ? kept : uniq(toks);
}

export function retrieve(entries = [], query = '', { focus = {}, allow = () => true, compsOf = () => [], limit = 4, types = null } = {}) {
  const weak = new Set(focus.weak || []);
  /* Words the index does not hold at all are ignored by the search; the coach then says the match is partial, and gives no
     answer unless more than half of the content words are known. */
  const holds = t => entries.some(e => String(e.k || '').includes(t));
  /* An Arabic "و" (and) written onto a word the index does not hold: try the word without it ("ومنطق" → "منطق"). */
  const terms = uniq(questionTerms(query).map(t => (!holds(t) && t.length > 3 && t.startsWith('و') && holds(t.slice(1)) ? t.slice(1) : t)));
  const inIndex = terms.filter(holds);
  if (terms.length > 1 ? inIndex.length * 2 <= terms.length : !inIndex.length) return [];
  const short = inIndex.length < terms.length;
  let base = searchIndex(entries, terms.join(' '), { types, limit: 60 }).filter(e => allow(e)).map(e => ({ ...e, matched: inIndex.length, partial: short }));
  if (!base.length && terms.length > 1) {
    /* No entry holds every content word: keep the entries that hold at least half of the words the index knows, the ones
       holding more words first. The answer says it is a partial match (`partial`), never more than that. */
    const per = terms.map(t => searchIndex(entries, t, { types, limit: 400 }).filter(e => allow(e)));
    const known = per.filter(xs => xs.length).length;
    const acc = new Map();
    per.forEach(xs => xs.forEach((e, i) => { const k = e.t + ':' + e.id; const a = acc.get(k) || { e, score: 0, matched: 0, first: i }; a.score += e.score; a.matched++; acc.set(k, a); }));
    const need = Math.max(1, Math.ceil(known / 2));
    base = [...acc.values()].filter(a => a.matched >= need).sort((x, y) => y.matched - x.matched || y.score - x.score || x.first - y.first || String(x.e.id).localeCompare(String(y.e.id)))
      .slice(0, 60).map(a => ({ ...a.e, score: a.score, matched: a.matched, partial: short || a.matched < known }));
  }
  return base.map((e, i) => {
    const why = { academy: !!(focus.academy && e.a === focus.academy), course: !!(focus.courseId && (e.id === focus.courseId || String(e.id).startsWith(focus.courseId + '-'))),
      weak: uniq(compsOf(e) || []).filter(c => weak.has(c)) };
    const boost = (why.academy ? 4 : 0) + (why.course ? 3 : 0) + Math.min(4, why.weak.length * 2);
    return { ...e, base: e.score, boost, rank: e.score + boost, why, i };
  }).sort((a, b) => b.matched - a.matched || b.rank - a.rank || a.i - b.i).slice(0, limit).map(({ i, ...e }) => e);
}

/* ------------------------------------------------------------------ guardrails */

const N = list => list.map(normalizeText).filter(Boolean);
const RX = {
  exam_content: N(['real exam question', 'actual exam question', 'real questions', 'actual questions', 'exam dump', 'brain dump', 'braindump', 'leaked question', 'past exam question', 'questions from the exam',
    'أسئلة الاختبار الحقيقية', 'أسئلة الامتحان الحقيقية', 'أسئلة حقيقية', 'الأسئلة الفعلية', 'أسئلة مسربة', 'تسريب', 'دمب', 'أسئلة الاختبارات السابقة', 'أسئلة من الاختبار']),
  hiring_verdict: N(['will i get the job', 'would you hire', 'am i hireable', 'should they hire', 'will they hire me', 'am i good enough for the job',
    'هل سأحصل على الوظيفة', 'هل سيتم توظيفي', 'هل تنصح بتوظيفي', 'هل أصلح للوظيفة', 'هل سيقبلونني']),
  authority_claim: N(['will i pass', 'guarantee', 'are you accredited', 'is this accredited', 'is the academy accredited', 'certify me', 'official certificate', 'do you issue',
    'هل سأجتاز', 'هل سأنجح', 'تضمن', 'ضمان النجاح', 'هل أنتم معتمدون', 'هل الأكاديمية معتمدة', 'شهادة رسمية', 'تمنحون شهادة', 'هل الشهادة معتمدة']),
  grade_request: N(['grade my', 'score my answer', 'mark my answer', 'what is my grade', 'give me a grade', 'rate my answer',
    'صحح إجابتي', 'قيّم إجابتي', 'قيم إجابتي', 'ما درجتي', 'أعطني درجة', 'كم درجتي']),
  requirement: N(['fee', 'fees', 'cost', 'price', 'how much', 'eligibility', 'eligible', 'requirements to apply', 'prerequisite', 'renew', 'renewal', 'pdu', 'validity', 'expire', 'application',
    'رسوم', 'تكلفة', 'سعر', 'كم يكلف', 'شروط', 'متطلبات التقدم', 'أهلية', 'تجديد', 'صلاحية', 'ساعات التطوير', 'التقديم']),
  exam_fact: N(['how many questions', 'number of questions', 'passing score', 'pass mark', 'exam duration', 'how long is the exam', 'exam format',
    'عدد الأسئلة', 'كم سؤال', 'درجة النجاح', 'مدة الاختبار', 'مدة الامتحان', 'صيغة الاختبار']),
  body: N(['pmi', 'asq', 'efqm', 'irca', 'cqi', 'exemplar'])
};
const any = (norm, list) => list.some(p => (p.length <= 4 ? (' ' + norm + ' ').includes(' ' + p + ' ') : norm.includes(p)));

/** The certification a question names (by code or name), or null. Codes are matched as whole words. */
export function findCertification(text, certifications = []) {
  const norm = ' ' + normalizeText(text) + ' ';
  let best = null;
  for (const c of certifications) {
    const names = [c.code, c.slug, c.name?.en, c.name?.ar].map(normalizeText).filter(x => x && x.length >= 3);
    const hit = names.filter(n => norm.includes(' ' + n + ' ')).sort((a, b) => b.length - a.length)[0];
    if (hit && (!best || hit.length > best.len)) best = { cert: c, len: hit.length };
  }
  return best?.cert || null;
}

/**
 * What kind of request is this? Order matters: exam content → hiring verdict → authority claim → official requirement →
 * grade request → general. A requirement word alone is general (the Academy's lessons explain requirements); it becomes an
 * official-requirement request when it names a certification or a certifying body, or asks an exam fact.
 */
export function classifyRequest(text, { certifications = [] } = {}) {
  const norm = normalizeText(String(text || '').slice(0, MAX_QUESTION));
  if (!norm) return { type: 'empty', certification: null };
  const certification = findCertification(norm, certifications);
  if (any(norm, RX.exam_content)) return { type: 'exam_content', certification };
  if (any(norm, RX.hiring_verdict)) return { type: 'hiring_verdict', certification };
  if (any(norm, RX.authority_claim)) return { type: 'authority_claim', certification };
  if (any(norm, RX.exam_fact) || (any(norm, RX.requirement) && (certification || any(norm, RX.body)))) return { type: 'official_requirement', certification };
  if (any(norm, RX.grade_request)) return { type: 'grade_request', certification };
  return { type: 'general', certification };
}

const CERT_ROUTE = { PMI: '/academy/pmi/certifications', ASQ: '/academy/quality/certifications', EFQM: '/academy/excellence/recognition' };
export const certificationHref = c => (c && CERT_ROUTE[c.body] ? `#${CERT_ROUTE[c.body]}/${c.slug}` : null);

/** The refusal for a guarded request: the rule in plain words, the Academy page that holds the dated facts, and the official source. */
export function refusalParts(type, { certification = null } = {}) {
  const parts = [makePart({ label: 'platform', kind: 'refusal', tkey: 'refuse.' + type })];
  if (type === 'official_requirement' || type === 'authority_claim' || type === 'exam_content') {
    const href = certificationHref(certification);
    if (href) parts.push(makePart({ label: 'platform', kind: 'link', href, title: certification.name, tkey: 'refuse.certPage' }));
    if (certification && /^https:\/\//.test(certification.official_url || '')) parts.push(makePart({ label: 'external', kind: 'link', href: certification.official_url, tkey: 'refuse.official', title: certification.code || certification.name }));
    if (!certification) parts.push(makePart({ label: 'platform', kind: 'link', href: '#/search?q=' + encodeURIComponent('certification'), tkey: 'refuse.findCert' }));
  }
  if (type === 'grade_request') parts.push(makePart({ label: 'platform', kind: 'link', href: '#/my?tab=coach&p=scenario', tkey: 'refuse.toScenario' }));
  if (type === 'hiring_verdict') parts.push(makePart({ label: 'platform', kind: 'link', href: '#/coach/interview', tkey: 'refuse.toInterview' }));
  return parts;
}

/* Wording an interpretation must never contain (checked on every `ai` part — grounded templates and model output alike). */
const VIOLATIONS = [
  ['guarantee', /\b(guarantee[sd]?|you will (?:definitely )?pass|sure to pass)\b|نضمن|ستنجح حتم|مضمون النجاح/i],
  ['authority', /\b(accredited by|officially (?:certified|recogni[sz]ed|approved)|we certify|certified by (?:the )?(?:academy|cia)|awards? (?:pdus?|cpd))\b|معتمدة? من|نمنحك شهادة معتمدة|شهادة رسمية من الأكاديمية/i],
  ['exam_content', /\b(real exam question|actual exam question|from the (?:real|actual) exam|this (?:question )?(?:is|was) on the exam)\b|من الاختبار الحقيقي|سؤال حقيقي من الاختبار/i],
  ['hiring', /\b(you (?:are|would be|will be) hired|i would (?:hire|reject) you|you (?:are|would be) rejected|not hireable|hire(?:d)? (?:decision|verdict)\s*:|you (?:passed|failed) the interview)\b|سيتم توظيفك|لن يتم توظيفك|نجحت في المقابلة|رسبت في المقابلة/i],
  ['certainty', /\b(i am certain|100% (?:correct|sure)|without any doubt)\b|متأكد تمامًا|بلا أي شك/i]
];
export function textViolations(text) {
  const s = typeof text === 'string' ? text : `${text?.en || ''}\n${text?.ar || ''}`;
  return VIOLATIONS.filter(([, rx]) => rx.test(s)).map(([code]) => code);
}

/**
 * The guardrail check every response passes before it is shown — grounded coach and model adapter alike.
 * Drops parts that are not renderable (no label, an interpretation not marked uncertain, an external part that is not an
 * https link) and interpretations whose wording breaks a rule. Returns { ok, parts, dropped[] }.
 */
export function checkOutput(parts = []) {
  const kept = [], dropped = [];
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!renderable(p)) { dropped.push({ reason: !p || !LABELS.includes(p.label) ? 'unlabelled' : 'not_renderable', part: p }); continue; }
    if (p.label === 'ai') { const v = textViolations(p.text || ''); if (v.length) { dropped.push({ reason: 'violation:' + v.join(','), part: p }); continue; } }
    kept.push(p);
  }
  return { ok: dropped.length === 0, parts: kept, dropped };
}

/** checkOutput that never returns an empty answer: when nothing may be shown, the learner gets a plain "nothing safe to show". */
export function guardResponse(parts = []) {
  const r = checkOutput(parts);
  if (!r.parts.length) r.parts = [makePart({ label: 'platform', kind: 'refusal', tkey: 'refuse.nothingSafe' })];
  return r;
}

/* ------------------------------------------------------------------ ask the coach (grounded) */

/**
 * Answer a question from approved content. Returns { type, certification, parts, hits }.
 *  - a guarded request → the refusal with the Academy page and the official link;
 *  - otherwise the best passages for this learner (each a `platform` part linking to its source page), what the learner's own
 *    records say about the topic (`user`), and one sentence of interpretation saying why this order (`ai`, uncertain);
 *  - nothing found → an honest "not in approved content" with a way forward (never a dead end, never an invented answer).
 */
export function askCoach({ question = '', entries = [], certifications = [], focus = {}, allow = () => true, compsOf = () => [], weakGroups = [], courseTitle = null, limit = 3 } = {}) {
  const q = String(question || '').trim().slice(0, MAX_QUESTION);
  const c = classifyRequest(q, { certifications });
  if (c.type === 'empty') return { type: 'empty', certification: null, hits: [], parts: [makePart({ label: 'platform', kind: 'note', tkey: 'ask.empty' })] };
  if (c.type !== 'general') return { type: c.type, certification: c.certification, hits: [], parts: guardResponse(refusalParts(c.type, { certification: c.certification })).parts };
  const hits = retrieve(entries, q, { focus, allow, compsOf, limit });
  const parts = [];
  if (!hits.length) {
    parts.push(makePart({ label: 'ai', kind: 'note', tkey: 'ask.nothing' }));
    parts.push(makePart({ label: 'platform', kind: 'link', href: '#/search?q=' + encodeURIComponent(q), tkey: 'ask.trySearch' }));
    parts.push(makePart({ label: 'platform', kind: 'link', href: '#/library', tkey: 'ask.tryLibrary' }));
    return { type: 'general', certification: c.certification, hits, parts: guardResponse(parts).parts };
  }
  for (const hit of hits) parts.push(makePart({ label: 'platform', kind: 'passage', title: hit.ti, text: hit.su || hit.ti, href: hit.h, type: hit.t, id: hit.id, why: hit.why }));
  const weakHit = uniq(hits.flatMap(x => x.why.weak));
  const wg = weakGroups.find(g => weakHit.includes(g.competency));
  if (wg) parts.push(makePart({ label: 'user', kind: 'note', tkey: 'ask.weakTie', params: { n: wg.wrong, competency: wg.competency } }));
  const top = hits[0];
  const reason = top.why.course ? 'ask.focusCourse' : top.why.weak.length ? 'ask.focusWeak' : top.why.academy ? 'ask.focusAcademy' : 'ask.focusNone';
  parts.push(makePart({ label: 'ai', kind: 'note', tkey: reason, params: { title: top.ti, course: courseTitle || '', competency: top.why.weak[0] || '' } }));
  if (hits.some(x => x.partial)) parts.push(makePart({ label: 'ai', kind: 'note', tkey: 'ask.partial' }));
  return { type: 'general', certification: c.certification, hits, parts: guardResponse(parts).parts };
}

/* ------------------------------------------------------------------ lesson coach */

const BLOCK_ORDER = ['concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'];
const blockOf = (lesson, type) => (lesson?.content_blocks || []).find(b => b.type === type && hasText(b.text)) || null;

/**
 * Explain a lesson's idea at three depths — always the lesson's own approved text, never new claims:
 *   brief     the first sentence of the key idea
 *   standard  the key idea in full and the worked example
 *   deep      every block in order, the objectives and the exercise to try
 * A lesson rendered from a toolkit guide has no blocks of its own: its objectives are shown and the learner is sent to the text.
 */
export function explainLesson(lesson, depth = 'brief', { href = null } = {}) {
  const d = DEPTHS.includes(depth) ? depth : 'brief';
  const parts = [];
  const concept = blockOf(lesson, 'concept');
  const blocks = BLOCK_ORDER.map(t => blockOf(lesson, t)).filter(Boolean);
  if (!blocks.length) {
    const obj = (lesson?.objectives || []).filter(hasText);
    if (obj.length) parts.push(makePart({ label: 'platform', kind: 'list', lead: 'objectives', items: obj, href }));
    parts.push(makePart({ label: 'ai', kind: 'note', tkey: 'lesson.noBlocks' }));
    return { depth: d, parts };
  }
  if (d === 'brief') {
    const b = concept || blocks[0];
    parts.push(makePart({ label: 'platform', lead: 'block.' + b.type, text: bi(b.text, s => firstSentence(s)), href }));
    parts.push(makePart({ label: 'ai', kind: 'note', tkey: 'lesson.briefNote' }));
  } else if (d === 'standard') {
    for (const t of ['concept', 'worked_example']) { const b = blockOf(lesson, t); if (b) parts.push(makePart({ label: 'platform', lead: 'block.' + t, text: b.text, href })); }
    if (!parts.length) parts.push(makePart({ label: 'platform', lead: 'block.' + blocks[0].type, text: blocks[0].text, href }));
  } else {
    const obj = (lesson.objectives || []).filter(hasText);
    if (obj.length) parts.push(makePart({ label: 'platform', kind: 'list', lead: 'objectives', items: obj, href }));
    for (const b of blocks) parts.push(makePart({ label: 'platform', lead: 'block.' + b.type, text: b.text, href }));
    if (hasText(lesson.exercise?.prompt)) parts.push(makePart({ label: 'platform', lead: 'tryIt', text: lesson.exercise.prompt, href }));
  }
  return { depth: d, parts };
}

const SOCRATIC = { concept: 3, common_mistake: 2, evidence: 2, worked_example: 2, generic: 3 };
/** Two open questions about the lesson, chosen deterministically from governed templates (labelled as the coach's interpretation). */
export function socraticPrompts(lesson, { seed = '', count = 2 } = {}) {
  const types = BLOCK_ORDER.filter(t => SOCRATIC[t] && blockOf(lesson, t));
  const pool = [...types, 'generic'].flatMap(t => Array.from({ length: SOCRATIC[t] }, (_, i) => `socratic.${t}.${i}`));
  const base = hashSeed(`${seed}|${lesson?.id || ''}`);
  const picked = [];
  for (let i = 0; picked.length < Math.min(count, pool.length) && i < pool.length * 2; i++) {
    const k = pool[(base + i * 7) % pool.length];
    if (!picked.includes(k) && !picked.some(p => p.split('.')[1] === k.split('.')[1])) picked.push(k);
  }
  for (const k of pool) { if (picked.length >= Math.min(count, pool.length)) break; if (!picked.includes(k)) picked.push(k); }
  return picked.map(k => makePart({ label: 'ai', kind: 'question', tkey: k, params: { title: lesson?.title || '' } }));
}

/**
 * "What should I review first" for one course: the course's competencies where the learner has weak items, most repeated
 * first, each with the lessons that teach it and the practice lab that covers it. Empty when the records show nothing weak.
 */
export function reviewFirst({ course = null, weakGroups = [], labs = [] } = {}) {
  if (!course) return [];
  const comps = new Set((course.competency_mappings || []).map(m => m.competency));
  const lessons = lessonsOf(course);
  return weakGroups.filter(g => comps.has(g.competency)).map(g => ({
    competency: g.competency, wrong: g.wrong, repeated: g.repeated, items: g.items.length,
    lessons: lessons.filter(l => (l.competencies || []).includes(g.competency)).slice(0, 3).map(l => ({ id: l.id, title: l.title, order: l.order })),
    lab: labs.filter(l => (l.competencies || []).includes(g.competency)).sort((a, b) => (a.minutes || 0) - (b.minutes || 0) || a.id.localeCompare(b.id)).map(l => ({ id: l.id, slug: l.slug, title: l.title }))[0] || null
  }));
}

/* ------------------------------------------------------------------ rubric-based practice feedback (§16) */

const STOP = new Set(N(['which', 'their', 'there', 'about', 'would', 'should', 'could', 'these', 'those', 'where', 'while', 'being', 'other', 'after', 'before', 'without', 'within',
  'التي', 'الذي', 'هذا', 'هذه', 'ذلك', 'على', 'إلى', 'عند', 'حتى', 'لكن', 'وأن', 'كان', 'يكون', 'بين', 'كما', 'لدى', 'أما', 'حيث', 'منها', 'فيها', 'عليها']));

/** The key terms of a model answer (longest distinct words first appearance, stop-words left out). Used for a coverage hint only. */
export function modelKeyTerms(text, max = 8) {
  const toks = normalizeText(text).split(' ').map(t => (t.length > 4 && t.startsWith('ال') ? t.slice(2) : t)).filter(t => t.length >= 5 && !STOP.has(t) && !/^\d/.test(t));
  const seen = new Map();
  toks.forEach((t, i) => { if (!seen.has(t)) seen.set(t, { t, i, n: 0 }); seen.get(t).n++; });
  return [...seen.values()].sort((a, b) => b.n - a.n || b.t.length - a.t.length || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i).map(x => x.t);
}

/** Which of the model answer's key terms the learner's answer uses. A hint for self-checking — not a score. */
export function coverage(answer, modelAnswer, max = 8) {
  const norm = normalizeText(answer);
  const terms = modelKeyTerms(modelAnswer, max);
  const covered = terms.filter(t => norm.includes(t));
  return { terms, covered, missing: terms.filter(t => !covered.includes(t)), scored: false, evidence: false, verdict: null };
}

/**
 * Practice feedback on a written answer against a STORED rubric — criterion by criterion.
 *   No rubric → { graded: false, reason: 'no_rubric' }: a subjective answer is never graded without one.
 *   Too short → { graded: false, reason: 'too_short' }.
 * Each criterion carries key terms in both languages: two or more found → 'meets', one → 'partial', none → 'not_yet'.
 * A criterion without terms is an "avoid" check (e.g. blame or a prescribed solution): 'meets' when none of the phrases to
 * avoid appears. The method is keyword matching, so the result says so (`method: 'keyword'`, `uncertain: true`).
 * It is practice feedback only: evidence false, verdict null (D-58 / D-65 unchanged — written work counts only after a
 * named reviewer scores it).
 */
export function evaluateWithRubric(answer, rubric, { avoid = null } = {}) {
  const base = { evidence: false, verdict: null, method: 'keyword', uncertain: true };
  if (!Array.isArray(rubric) || !rubric.length) return { graded: false, reason: 'no_rubric', ...base };
  const text = String(answer || '').slice(0, MAX_ANSWER);
  if (words(text).length < MIN_ANSWER_WORDS) return { graded: false, reason: 'too_short', ...base };
  const norm = normalizeText(text);
  const criteria = rubric.map(r => {
    const terms = uniq([...(r.terms?.en || []), ...(r.terms?.ar || [])]);
    if (!terms.length) {
      const bad = uniq([...(avoid?.en || []), ...(avoid?.ar || [])]).filter(t => hasTerm(norm, t));
      return { id: r.id, level: bad.length ? 'not_yet' : 'meets', check: 'avoid', found: bad };
    }
    const found = terms.filter(t => hasTerm(norm, t));
    return { id: r.id, level: found.length >= 2 ? 'meets' : found.length === 1 ? 'partial' : 'not_yet', check: 'terms', found };
  });
  return { graded: true, criteria, met: criteria.filter(c => c.level === 'meets').length, partial: criteria.filter(c => c.level === 'partial').length, total: criteria.length, ...base };
}

/* ------------------------------------------------------------------ scenario generation (governed templates) */

const fill = (text, picks, lang) => String(text?.[lang] || '').replace(/\{(\w+)\}/g, (m, k) => (picks[k] ? picks[k][lang] : m));

/**
 * An original practice scenario from a governed template. Deterministic for a seed: the template (preferring the wanted
 * competency, then the academy) and every slot value are chosen by hashing the seed. Both languages use the same choices.
 * The result is labelled `generated_practice` — it is never an exam question.
 */
export function generateScenario(templates = [], { competency = null, academy = null, seed = '0' } = {}) {
  const all = [...templates].sort((a, b) => a.id.localeCompare(b.id));
  if (!all.length) return null;
  let pool = competency ? all.filter(t => (t.competencies || []).includes(competency)) : [];
  if (!pool.length && academy) pool = all.filter(t => t.academy === academy);
  if (!pool.length) pool = all;
  const tpl = pool[hashSeed('tpl|' + seed) % pool.length];
  const picks = {}, index = {};
  for (const name of Object.keys(tpl.slots || {}).sort()) {
    const opts = tpl.slots[name];
    index[name] = hashSeed(`${seed}|${tpl.id}|${name}`) % opts.length;
    picks[name] = opts[index[name]];
  }
  return { id: `${tpl.id}:${seed}`, template_id: tpl.id, seed: String(seed), label: 'generated_practice', academy: tpl.academy || null, competencies: [...(tpl.competencies || [])],
    title: tpl.title, text: { en: fill(tpl.text, picks, 'en'), ar: fill(tpl.text, picks, 'ar') }, task: tpl.task, rubric: tpl.rubric || [], avoid: tpl.avoid || null, picks: index };
}

/** Structural check of one scenario template (used by the builder, the pre-review and the unit tests). Error codes; empty = valid. */
export function validateScenarioTemplate(t, competencyIds = []) {
  const e = [];
  const both = v => !!(v && typeof v.en === 'string' && v.en.trim() && typeof v.ar === 'string' && v.ar.trim());
  if (!/^SCN-[A-Z0-9-]+$/.test(t?.id || '')) e.push('bad_id');
  for (const k of ['title', 'text', 'task']) if (!both(t?.[k])) e.push(k + '_not_bilingual');
  if (!Array.isArray(t?.competencies) || !t.competencies.length || t.competencies.some(c => competencyIds.length && !competencyIds.includes(c))) e.push('bad_competencies');
  const slots = t?.slots || {};
  for (const lang of ['en', 'ar']) {
    const used = uniq([...String(t?.text?.[lang] || '').matchAll(/\{(\w+)\}/g)].map(m => m[1])).sort();
    if (JSON.stringify(used) !== JSON.stringify(Object.keys(slots).sort())) e.push('slots_mismatch_' + lang);
  }
  for (const [k, opts] of Object.entries(slots)) if (!Array.isArray(opts) || opts.length < 2 || opts.some(o => !both(o))) e.push('slot_' + k);
  if (!Array.isArray(t?.rubric) || t.rubric.length < 3) e.push('rubric_too_short');
  for (const r of t?.rubric || []) {
    if (!r.id || !both(r.criterion) || !both(r.hint)) e.push('criterion_' + (r.id || '?'));
    const n = (r.terms?.en || []).length, m = (r.terms?.ar || []).length;
    if ((n === 0) !== (m === 0)) e.push('terms_one_language_' + r.id);
    if (n === 0 && !(t.avoid?.en?.length && t.avoid?.ar?.length)) e.push('avoid_missing_' + r.id);
  }
  return uniq(e);
}

/* ------------------------------------------------------------------ interview simulator (ADD-12) */

const nameTerms = v => ({ en: normalizeText(v?.en || '').split(' ').filter(w => w.length >= 5).slice(0, 4), ar: normalizeText(v?.ar || '').split(' ').filter(w => w.length >= 4).slice(0, 4) });

/** A question built from the published competency framework alone (used where the governed bank has no visible question). */
export function fallbackInterviewQuestion(competency) {
  return { id: 'IQF-' + competency.id, competency: competency.id, generated: true, prompt_key: 'interview.fallbackPrompt', follow_up_key: 'interview.fallbackFollow', params: { name: competency.name },
    key_points: (competency.sub_competencies || []).slice(0, 3).map(s => ({ t: s.name, terms: nameTerms(s.name) })) };
}

/**
 * The question set for a role — a CIA target role or a company-defined role: both are `{ id, name, targets }`.
 * Competencies the role needs (target > 0) are ordered: where the learner's records show weak items first, then the largest
 * gap, then the highest target, then id. Each gets its governed question, or a framework-based fallback.
 * The follow-up is asked where the competency is weak or the gap is two levels or more (adaptive).
 */
export function interviewQuestionsFor(role, bank = [], { competencies = [], gaps = [], weak = [], count = INTERVIEW_DEFAULT_COUNT } = {}) {
  if (!role?.targets) return [];
  const weakSet = new Set(weak);
  const gapOf = new Map(gaps.map(g => [g.competency_id || g.competency, g.gap || 0]));
  const byComp = new Map(bank.map(q => [q.competency, q]));
  const compById = new Map(competencies.map(c => [c.id, c]));
  return Object.entries(role.targets).filter(([, v]) => Number(v) > 0).map(([cid, target]) => ({ cid, target: Number(target), gap: gapOf.get(cid) || 0, weak: weakSet.has(cid) }))
    .sort((a, b) => (b.weak - a.weak) || b.gap - a.gap || b.target - a.target || a.cid.localeCompare(b.cid))
    .map(x => { const q = byComp.get(x.cid) || (compById.get(x.cid) ? fallbackInterviewQuestion(compById.get(x.cid)) : null); return q ? { ...q, target: x.target, gap: x.gap, weak: x.weak, ask_follow_up: x.weak || x.gap >= 2 } : null; })
    .filter(Boolean).slice(0, Math.max(1, Math.min(10, count)));
}

const EXAMPLE = N(['for example', 'for instance', 'e g', 'when i', 'in my', 'we had', 'i led', 'i was', 'last year', 'one case', 'project', 'مثلا', 'مثال', 'على سبيل', 'عندما', 'قمت', 'كنت', 'في مشروع', 'حالة', 'العام الماضي']);
const RESULT = N(['result', 'reduced', 'improved', 'increased', 'because', 'so that', 'as a result', 'outcome', 'learned', 'نتيجة', 'انخفض', 'تحسن', 'ارتفع', 'لأن', 'بحيث', 'تعلمت', 'أدى']);
const STRUCTURE = N(['first', 'second', 'then', 'finally', 'after that', 'next', 'أولا', 'ثانيا', 'ثم', 'أخيرا', 'بعد ذلك']);
const sentences = s => String(s || '').split(/[.!?؟\n]+/).map(x => x.trim()).filter(x => x.length > 3);

/**
 * Practice scores (0–3 each) for one interview answer:
 *   knowledge       how many of the question's key points the answer touches (key terms, both languages)
 *   depth           a real example and a result or reason, given enough substance
 *   communication   focused length and a structure a listener can follow
 * Keyword and length heuristics only — the result is marked uncertain and is not a judgement of the person.
 */
export function scoreInterviewAnswer(answer, question, extra = '') {
  const text = `${String(answer || '').slice(0, MAX_ANSWER)}\n${String(extra || '').slice(0, MAX_ANSWER)}`.trim();
  const norm = normalizeText(text);
  const n = words(text).length;
  const pts = question?.key_points || [];
  const covered = pts.map((p, i) => (uniq([...(p.terms?.en || []), ...(p.terms?.ar || [])]).some(t => hasTerm(norm, t)) ? i : -1)).filter(i => i >= 0);
  const knowledge = n < 5 ? 0 : pts.length ? Math.round(3 * covered.length / pts.length) : 0;
  const depth = n < 15 ? 0 : Math.min(3, 1 + (any(norm, EXAMPLE) || /\d/.test(norm) ? 1 : 0) + (any(norm, RESULT) ? 1 : 0));
  const sc = sentences(text).length;
  const communication = n < 10 ? 0 : Math.min(3, 1 + (n >= 40 && n <= 300 ? 1 : 0) + ((sc >= 2 && any(norm, STRUCTURE)) || sc >= 3 ? 1 : 0));
  return { knowledge, depth, communication, total: knowledge + depth + communication, max: 9, covered, missed: pts.map((_, i) => i).filter(i => !covered.includes(i)), words: n,
    method: 'keyword', uncertain: true, evidence: false, verdict: null };
}

/**
 * The saved record of a practice session (the learner's own data). It lists scores, the weak topics (knowledge ≤ 1) and
 * nothing else: no pass / fail, no verdict, no recommendation about hiring. Status is always `self_declared_practice`.
 */
export function makeInterviewSession({ id, role, items = [], now = new Date().toISOString(), lang = 'ar' } = {}) {
  if (!id || !role?.id) throw new CoachError('bad_session', 'An interview session needs an id and a role');
  const rows = items.map(it => {
    const scores = scoreInterviewAnswer(it.answer, it.question, it.follow_up_answer);
    return { question_id: it.question.id, competency: it.question.competency, generated: !!it.question.generated, asked_follow_up: !!it.question.ask_follow_up,
      answer: String(it.answer || '').slice(0, MAX_ANSWER), follow_up_answer: String(it.follow_up_answer || '').slice(0, MAX_ANSWER),
      scores: { knowledge: scores.knowledge, depth: scores.depth, communication: scores.communication, covered: scores.covered, missed: scores.missed, words: scores.words } };
  });
  const avg = k => (rows.length ? Math.round(rows.reduce((s, r) => s + r.scores[k], 0) / (rows.length * 3) * 100) : 0);
  return { id, schema: INTERVIEW_SCHEMA, role_id: role.id, role_name: trimTitle(role.name), custom_role: !!role.custom, created_at: now, lang: lang === 'en' ? 'en' : 'ar', items: rows,
    totals: Object.fromEntries(INTERVIEW_DIMENSIONS.map(k => [k, avg(k)])), weak_topics: uniq(rows.filter(r => r.scores.knowledge <= 1).map(r => r.competency)),
    method: 'keyword', status: 'self_declared_practice', evidence: false };
}

/** Summary of saved sessions for the passport: a count and the latest date — self-declared practice, never evidence. */
export function interviewSummary(sessions = []) {
  const xs = sessions.filter(s => s?.schema === INTERVIEW_SCHEMA).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { count: xs.length, last: xs[0] ? day(xs[0].created_at) : null, status: 'self_declared_practice', evidence: false, sessions: xs };
}

/* ------------------------------------------------------------------ plan my week */

/**
 * One weekly plan from everything that asks for the learner's time, in this order (D-99):
 *   1. courses the company assigned, soonest due date first
 *   2. the course from the latest 30 / 60 / 90-day plan
 *   3. courses already in progress
 *   4. the course of the current roadmap milestone
 * At most `maxCourses` courses with lessons left are planned (weeklyPlan, D-54). A short review of the weakest competency is
 * added to the first session of each week. `sources` records why each course is in the plan.
 */
export function planMyWeek({ assigned = [], planCourses = [], inProgress = [], milestoneCourses = [], progress = [], weeklyHours = 4, days = ['SU', 'TU', 'TH'], time = '19:00',
  start = new Date(), weakGroups = [], reviewMinutes = 20, maxCourses = 3, maxWeeks = 12 } = {}) {
  const order = [
    ...[...assigned].filter(a => a?.course).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')) || a.course.id.localeCompare(b.course.id)).map(a => ({ course: a.course, kind: 'assignment', due: a.due || null })),
    ...planCourses.filter(Boolean).map(course => ({ course, kind: 'plan30' })),
    ...inProgress.filter(Boolean).map(course => ({ course, kind: 'in_progress' })),
    ...milestoneCourses.filter(Boolean).map(course => ({ course, kind: 'milestone' }))
  ];
  const seen = new Set(), sources = [];
  for (const o of order) {
    if (seen.has(o.course.id)) continue;
    const done = new Set(progress.find(p => p.id === o.course.id)?.completed_lessons || []);
    if (!lessonsOf(o.course).some(l => !done.has(l.id))) continue;
    seen.add(o.course.id); sources.push(o);
    if (sources.length >= maxCourses) break;
  }
  const plan = weeklyPlan({ courses: sources.map(s => s.course), progress, weeklyHours, days, time, start, maxWeeks });
  let reviews = 0;
  if (weakGroups.length && plan.sessions.length) {
    const first = Date.parse(plan.sessions[0].date);
    const seenWeek = new Set();
    for (const s of plan.sessions) {
      const wk = Math.floor((Date.parse(s.date) - first) / (7 * 864e5));
      if (seenWeek.has(wk) || wk > 3) continue;
      seenWeek.add(wk);
      s.review = { competency: weakGroups[wk % weakGroups.length].competency, minutes: reviewMinutes };
      s.minutes += reviewMinutes; reviews++;
    }
  }
  return { ...plan, courses: sources.map(s => s.course), sources: sources.map(s => ({ course_id: s.course.id, kind: s.kind, due: s.due || null })), reviews };
}

/** The same plan in the shape `planToIcs` expects: a review becomes one more line in its session. */
export function planForIcs(plan, { reviewTitle = { ar: 'مراجعة نقطة ضعف', en: 'Weak-area review' }, compName = id => id } = {}) {
  return { ...plan, sessions: plan.sessions.map(s => ({ ...s, items: [...s.items, ...(s.review ? [{ course: { title: reviewTitle }, lesson: { title: compName(s.review.competency) || s.review.competency } }] : [])] })) };
}

/* ------------------------------------------------------------------ optional model adapter (D-98, owner decision D-13-1) */

/**
 * The adapter exists only when the owner configured it: `config.coach.enabled === true` and an https endpoint (a proxy the
 * owner runs). Anything that looks like a credential in the URL is rejected — a key never lives in the client.
 */
export function adapterConfig(config) {
  const c = config?.coach;
  if (!c || c.enabled !== true || typeof c.endpoint !== 'string') return null;
  let u;
  try { u = new URL(c.endpoint); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (/(key|token|secret|password|auth)=/i.test(u.search) || /(sk-|api[_-]?key)/i.test(c.endpoint)) return null;
  return { endpoint: u.toString(), name: typeof c.name === 'string' ? c.name.slice(0, 60) : null, timeout_ms: Math.max(2000, Math.min(60000, Number(c.timeout_ms) || 20000)) };
}

/** Exactly what would leave the device: the question and the previewed context fields — nothing else. */
export function modelPayload({ context = {}, question = '', locale = 'ar' } = {}) {
  return { schema: COACH_SCHEMA, locale: locale === 'en' ? 'en' : 'ar', question: String(question || '').trim().slice(0, MAX_QUESTION), context: Object.fromEntries(contextPreview(context)) };
}

/**
 * Call the owner's endpoint. Refuses without a configured adapter or without the learner's explicit opt-in.
 * Whatever comes back is treated as interpretation: every part is labelled `ai`, marked uncertain and passed through the same
 * guardrail check as the grounded coach. No cookies, no referrer.
 */
export async function callModel({ cfg, payload, optIn = false, fetchImpl = globalThis.fetch } = {}) {
  if (!cfg) throw new CoachError('adapter_absent', 'No model endpoint is configured');
  if (optIn !== true) throw new CoachError('opt_in_required', 'The learner has not agreed to send anything');
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), cfg.timeout_ms) : null;
  try {
    const res = await fetchImpl(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl?.signal });
    if (!res.ok) throw new CoachError('adapter_failed', 'The model endpoint answered ' + res.status);
    const data = await res.json();
    const texts = Array.isArray(data?.parts) ? data.parts.map(p => (typeof p === 'string' ? p : p?.text)) : [data?.text];
    const parts = texts.filter(t => typeof t === 'string' && t.trim()).slice(0, 6).map(t => ({ label: 'ai', kind: 'text', text: t.trim().slice(0, 2000), uncertain: true, source: 'model' }));
    return guardResponse(parts);
  } finally { if (timer) clearTimeout(timer); }
}
