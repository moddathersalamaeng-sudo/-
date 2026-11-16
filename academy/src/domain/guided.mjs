/**
 * Phase 12B — guided experience (lessons from the Sumud Navigator study, deliverables/phase-12b/SUMUD_LESSONS_LEARNED.md).
 * Pure functions, no DOM: stages for the guided assessment player, draft (autosave) sanitising, and the rule-based
 * reading of a result with a 30 / 60 / 90-day plan. Every sentence the interface builds from this traces to a score.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */

export const STAGE_MAX = 4;
export const DRAFT_MAX_DAYS = 30;
export const PLAN_WINDOWS = ['30', '60', '90'];

/**
 * Split an ordered question list into stages (D-88).
 *  - Questions are grouped by competency in order of first appearance; a group larger than `max` is chunked.
 *  - When the questions carry fewer than two competencies, every question is its own stage (focus mode).
 * Returns [{ id, competency|null, question_ids[] }].
 */
export function buildStages(questions = [], { max = STAGE_MAX } = {}) {
  const qs = questions.filter(Boolean);
  if (!qs.length) return [];
  const order = [];
  const groups = new Map();
  for (const q of qs) {
    const key = q.competency || '__none__';
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(q.id);
  }
  const real = order.filter(k => k !== '__none__');
  if (real.length < 2) return qs.map((q, i) => ({ id: 's' + (i + 1), competency: q.competency || null, question_ids: [q.id] }));
  const stages = [];
  for (const key of order) {
    const ids = groups.get(key);
    for (let i = 0; i < ids.length; i += max) stages.push({ id: 's' + (stages.length + 1), competency: key === '__none__' ? null : key, question_ids: ids.slice(i, i + max) });
  }
  return stages;
}

/** Progress over stages. `isAnswered(questionId)` → boolean. */
export function stageProgress(stages = [], isAnswered = () => false) {
  const done = stages.map(s => s.question_ids.every(id => isAnswered(id)));
  const total = stages.reduce((n, s) => n + s.question_ids.length, 0);
  const answered = stages.reduce((n, s) => n + s.question_ids.filter(id => isAnswered(id)).length, 0);
  const firstOpen = done.indexOf(false);
  return { done, total, answered, percent: total ? Math.round(answered / total * 100) : 0, firstOpen: firstOpen < 0 ? stages.length : firstOpen, complete: total > 0 && answered === total };
}

/**
 * A saved draft is usable only for the same assessment version and attempt number, within DRAFT_MAX_DAYS (D-89).
 * Answers for questions that are no longer in the assessment are dropped. Returns { answers, stage } or null.
 */
export function sanitizeDraft(draft, { assessmentId, version = null, attemptNo, questionIds = [], now = Date.now(), maxDays = DRAFT_MAX_DAYS } = {}) {
  if (!draft || typeof draft !== 'object' || draft.assessment_id !== assessmentId) return null;
  if (attemptNo != null && draft.attempt_no !== attemptNo) return null;
  if (version != null && draft.version != null && String(draft.version) !== String(version)) return null;
  const t = Date.parse(draft.updated_at || '');
  if (!Number.isFinite(t) || now - t > maxDays * 864e5 || t - now > 864e5) return null;
  const allowed = new Set(questionIds);
  const answers = {};
  for (const [k, v] of Object.entries(draft.answers || {})) if (allowed.has(k) && v !== undefined && v !== null) answers[k] = v;
  if (!Object.keys(answers).length) return null;
  const stage = Number.isInteger(draft.stage) && draft.stage >= 0 ? draft.stage : 0;
  return { answers, stage, updated_at: draft.updated_at };
}

/** The band a competency percentage falls in (same thresholds as the learner model). */
export const bandOf = (pct, { mastery = 70, weak = 60 } = {}) => pct >= mastery ? 'mastered' : pct >= weak ? 'developing' : 'gap';

const isPublished = r => !r?.draft && (!r?.governance || r.governance.content_status === undefined || r.governance.content_status === 'published');

/**
 * Rule-based reading of an attempt (D-90). Pure and deterministic.
 * attempt.competency_breakdown: { [competencyId]: { percent, items, unknown } }
 * Returns { strengths[], developing[], gaps[], priorities[], plan: [{ window, items[] }], counts }.
 * Plan rules:
 *   days 1–30   the published course (not completed) that covers the first priority — lowest level first;
 *   days 31–60  a course for the next priority, else the practice lab for the first priority;
 *   days 61–90  a practice lab for a remaining priority (else any priority), then "retake this assessment".
 * Nothing is invented: a window with no matching content is left out; "retake" is always the last item.
 */
export function resultInsights(attempt, { courses = [], labs = [], completedIds = [], assessmentSlug = null, academy = null, academyOfCourse = c => c.ecosystem || null, mastery = 70, weak = 60 } = {}) {
  const rows = Object.entries(attempt?.competency_breakdown || {})
    .map(([id, v]) => ({ id, percent: Number(v?.percent) || 0, items: v?.items || 0, unknown: v?.unknown || 0, band: bandOf(Number(v?.percent) || 0, { mastery, weak }) }));
  const byPct = (a, b) => a.percent - b.percent || a.id.localeCompare(b.id);
  const strengths = rows.filter(r => r.band === 'mastered').sort((a, b) => b.percent - a.percent || a.id.localeCompare(b.id));
  const developing = rows.filter(r => r.band === 'developing').sort(byPct);
  const gaps = rows.filter(r => r.band === 'gap').sort(byPct);
  const priorities = [...gaps, ...developing];

  /* Candidates covering a competency are ranked by: weighted coverage of all priorities (gap 2, developing 1),
     +0.5 when they belong to the assessment's academy, then the share of their mappings that are priorities,
     then lower level, then code. Deterministic. */
  const weight = new Map([...gaps.map(r => [r.id, 2]), ...developing.map(r => [r.id, 1])]);
  const rank = (comps, home) => {
    const cover = comps.reduce((n, c) => n + (weight.get(c) || 0), 0);
    return { score: cover + (academy && home === academy ? 0.5 : 0), share: comps.length ? comps.filter(c => weight.has(c)).length / comps.length : 0 };
  };
  const order = (a, b) => b.r.score - a.r.score || b.r.share - a.r.share || (a.x.level || 0) - (b.x.level || 0) || String(a.x.code || a.x.id).localeCompare(String(b.x.code || b.x.id));
  const done = new Set(completedIds);
  const cs = courses.filter(c => isPublished(c) && !done.has(c.id)).map(x => ({ x, comps: (x.competency_mappings || []).map(m => m.competency), home: academyOfCourse(x) }));
  const ls = labs.filter(isPublished).map(x => ({ x, comps: x.competencies || [], home: x.academy || null }));
  const used = new Set();
  const best = (pool, cid) => pool.filter(e => e.comps.includes(cid) && !used.has(e.x.id)).map(e => ({ ...e, r: rank(e.comps, e.home) })).sort(order)[0]?.x || null;
  const pickCourse = cid => { const c = best(cs, cid); if (c) used.add(c.id); return c ? { type: 'course', id: c.id, slug: c.slug, title: c.title, competency: cid, hours: c.training_hours || null } : null; };
  const pickLab = cid => { const l = best(ls, cid); if (l) used.add(l.id); return l ? { type: 'lab', id: l.id, slug: l.slug, title: l.title, competency: cid, minutes: l.minutes || null } : null; };

  const plan = [];
  if (priorities.length) {
    const p0 = priorities[0].id, p1 = priorities[1]?.id;
    const w30 = pickCourse(p0) || pickLab(p0);
    const w60 = (p1 && pickCourse(p1)) || pickLab(p0) || (p1 && pickLab(p1));
    const rest = priorities.slice(1).map(p => p.id);
    let w90 = null;
    for (const cid of [...rest, p0]) { w90 = pickLab(cid); if (w90) break; }
    if (!w90) for (const cid of rest) { w90 = pickCourse(cid); if (w90) break; }
    if (w30) plan.push({ window: '30', items: [w30] });
    if (w60) plan.push({ window: '60', items: [w60] });
    plan.push({ window: '90', items: [...(w90 ? [w90] : []), { type: 'retake', slug: assessmentSlug }] });
  } else if (rows.length) {
    const top = strengths[0]?.id;
    const lab = top ? pickLab(top) : null;
    plan.push({ window: '90', items: [...(lab ? [lab] : []), { type: 'retake', slug: assessmentSlug }] });
  }
  const detail = attempt?.detail || [];
  const counts = {
    total: detail.length,
    correct: detail.filter(d => d.auto && d.correct).length,
    incorrect: detail.filter(d => d.auto && !d.correct && !d.unknown).length,
    unknown: detail.filter(d => d.unknown).length,
    pending: detail.filter(d => !d.auto && !d.reviewed).length
  };
  return { strengths, developing, gaps, priorities, plan, counts };
}

/** The interface paragraph clamp rule (L-B6): fold text with more than `words` words. */
export const shouldClamp = (text, words = 60) => String(text || '').trim().split(/\s+/).filter(Boolean).length > words;

/** Catalogue grouping (L-B2): groups in the given academy order, `per` visible each; unknown academies go last. */
export function groupByAcademy(items = [], academyOf = () => null, order = [], per = 6) {
  const groups = new Map(order.map(k => [k, []]));
  const other = [];
  for (const it of items) { const k = academyOf(it); if (k && groups.has(k)) groups.get(k).push(it); else other.push(it); }
  const out = [...groups.entries()].filter(([, xs]) => xs.length).map(([key, xs]) => ({ key, items: xs, visible: xs.slice(0, per), hidden: Math.max(0, xs.length - per) }));
  if (other.length) out.push({ key: 'other', items: other, visible: other.slice(0, per), hidden: Math.max(0, other.length - per) });
  return out;
}

/**
 * The first sentence of a text (L-B4 flip cards): up to the first . ! ? ؟ ; ؛ that ends a sentence, capped at `max`
 * words (then "…"). Abbreviations such as "e.g." and clause numbers such as "7.5" are not sentence ends.
 */
export function firstSentence(text, max = 30) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/^[\s\S]*?(?:[!?؟;؛]|\.(?!\d)(?<!\b(?:e\.g|i\.e|etc|vs|No|cl)\.))(?=\s|$)/);
  let out = (m ? m[0] : s).trim();
  const w = out.split(/\s+/);
  if (w.length > max) out = w.slice(0, max).join(' ') + '…';
  return out;
}
