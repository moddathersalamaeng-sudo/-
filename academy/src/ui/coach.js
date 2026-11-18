/**
 * Phase 13 — coach UI pieces shared by the lesson, course, assessment-result and lab-result pages and by the coach tab.
 *   renderParts        every response part with its visible source label (ADD-20); a part that fails the gate is not rendered
 *   labelLegend        what the four labels mean
 *   askBox             a question → a grounded, labelled answer (or a refusal with the official link)
 *   lessonCoachPanel   explain at three depths · a question to think about · what to review first · practice
 *   courseCoachPanel   what to review first in this course
 *   mistakesBlock      "explain my mistakes" for an assessment attempt;  labMistakesBlock for a practice-lab attempt
 * Nothing here talks to a network: answers are composed on the device from approved content and the learner's own records.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Button } from './components.js';
import { L, linkBtn } from './academy.js';
import { loadQuestions } from '../data/learner-state.js';
import * as C from '../domain/coach.mjs';
import { academyOfCourse, goalAcademy } from '../domain/academies.mjs';

const lessonHrefOf = (c, l) => `#/academy/courses/${c.slug}/${encodeURIComponent(l.id.startsWith(c.id + '-') ? l.id.slice(c.id.length + 1) : l.id)}`;
const LABEL_ICON = { platform: 'book', external: 'external', user: 'user', ai: 'spark' };
const LABEL_TONE = { platform: 'ok', external: 'info', user: 'neutral', ai: 'warn' };

export const tc = (ctx, k, p) => ctx.t('coach13.' + k, p);
const text = (ctx, v) => (typeof v === 'string' ? v : L(ctx, v));
/** Template parameters may hold bilingual values and competency ids — resolve them for the current language. */
function params(ctx, p = {}, compName = null) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'competency' && compName) out[k] = compName(v) || v;
    else if (typeof v === 'number') out[k] = ctx.i18n.number(v);
    else out[k] = text(ctx, v);
  }
  return out;
}

/** Index summaries are cut at build time: show that the text continues on the source page. */
const cut = s => (s.length >= 120 && !/[.!?\u061F…:]$/.test(s.trim()) ? s.trim() + ' …' : s);

export function sourceLabel(ctx, label) {
  return h('span', { class: `coach-label badge badge-${LABEL_TONE[label] || 'neutral'}`, dataset: { label } }, icon(LABEL_ICON[label] || 'info'), ' ', tc(ctx, 'label.' + label));
}

/**
 * Render response parts. Each part is one block with its label first. The render gate (`renderable`) is applied here again,
 * so a part without a label can never reach the page whatever built it.
 */
export function renderParts(ctx, parts = [], { compName = null, cls = '' } = {}) {
  const ok = parts.filter(C.renderable);
  return h('ul', { class: ('coach-parts plain ' + cls).trim(), dataset: { parts: String(ok.length), labels: C.labelsOf(ok).join(',') } }, ok.map(p => {
    const lead = p.lead ? h('strong', { class: 'coach-lead' }, p.lead.startsWith('block.') ? ctx.t('p7.' + p.lead) : tc(ctx, 'lead.' + p.lead), ' ') : null;
    const body = p.tkey ? tc(ctx, p.tkey, params(ctx, p.params, compName)) : text(ctx, p.text);
    let inner;
    if (p.kind === 'link') {
      const ext = p.label === 'external';
      const named = text(ctx, p.title);
      inner = h('p', null, p.tkey && named ? [body, ' '] : null,
        h('a', { href: p.href, ...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {}), dataset: { coachLink: p.label } }, named || body, ext ? [' ', icon('external')] : null));
    } else if (p.kind === 'passage') {
      inner = h('div', null, h('p', { class: 'coach-ptitle' }, h('span', { class: 'badge badge-neutral' }, ctx.t('x10a.search.types.' + p.type)), ' ',
        h('a', { href: p.href, dataset: { coachSource: p.id || '' } }, text(ctx, p.title))), p.text && text(ctx, p.text) !== text(ctx, p.title) ? h('p', { class: 'coach-ptext' }, cut(text(ctx, p.text))) : null);
    } else if (p.kind === 'list') {
      inner = h('div', null, lead ? h('p', null, lead) : null, h('ul', null, p.items.map(x => h('li', null, text(ctx, x)))));
    } else {
      inner = h('p', { class: p.kind === 'question' ? 'coach-q' : null }, lead, body,
        p.href && p.label === 'platform' && p.kind === 'text' ? [' ', h('a', { class: 'note', href: p.href }, tc(ctx, 'openSource'))] : null);
    }
    return h('li', { class: ['coach-part', 'is-' + p.label, 'kind-' + p.kind], dataset: { label: p.label, kind: p.kind } }, sourceLabel(ctx, p.label),
      h('div', { class: 'coach-body' }, inner, p.uncertain ? h('p', { class: 'note coach-unc' }, icon('alert'), ' ', tc(ctx, 'uncertain')) : null));
  }));
}

export function labelLegend(ctx) {
  return h('dl', { class: 'coach-legend', dataset: { legend: 'labels' } }, C.LABELS.map(l => h('div', null, h('dt', null, sourceLabel(ctx, l)), h('dd', null, tc(ctx, 'labelLong.' + l)))));
}

/* ------------------------------------------------------------------ shared data */

/** Weak items of this learner (questions answered wrongly are loaded from their shards; latest attempt wins). */
export async function loadWeak(ctx, learner) {
  const ids = [...new Set((learner.attempts || []).flatMap(a => (a.detail || []).filter(d => d.auto && !d.correct).map(d => d.question_id)))];
  const questions = await loadQuestions(ctx, ids).catch(() => []);
  const items = C.weakItems({ attempts: learner.attempts || [], questions, labAttempts: learner.labAttempts || [] });
  return { items, groups: C.groupWeak(items), questions };
}

/** Governance filter and competency lookup for retrieval, built from the lists this viewer may see. */
export function retrievalScope(content) {
  const ids = { course: new Set(content.courses.map(c => c.id)), lab: new Set((content.labs || []).map(l => l.id)), certification: new Set((content.certifications || []).map(c => c.id)),
    article: new Set((content.articles || []).map(a => a.id)), standard: new Set((content.standards || []).map(s => s.id)) };
  const guides = new Set((content.guides || []).map(g => g.slug));
  const courseOf = e => content.courses.find(c => e.id === c.id || String(e.id).startsWith(c.id + '-')) || null;
  const allow = e => {
    if (ids[e.t]) return ids[e.t].has(e.id);
    if (e.t === 'lesson') return !!courseOf(e);
    if (e.t === 'guide' || e.t === 'guide_item') { const m = /^#\/guides\/([a-z0-9-]+)/.exec(e.h || ''); return !m || guides.has(m[1]); }
    return true;
  };
  const compsOf = e => {
    if (e.t === 'course' || e.t === 'lesson') return (courseOf(e)?.competency_mappings || []).map(m => m.competency);
    if (e.t === 'lab') return content.labs.find(l => l.id === e.id)?.competencies || [];
    if (e.t === 'certification') return content.certifications.find(c => c.id === e.id)?.competencies || [];
    return [];
  };
  return { allow, compsOf };
}

/** The learner's focus for ranking: the academy of the current course (else of their goal), the course, and weak competencies. */
export function focusOf({ course = null, profile = null, weakGroups = [] } = {}) {
  return { academy: course ? academyOfCourse(course) : profile?.goal ? goalAcademy(profile.goal, profile.target_role) : null, courseId: course?.id || null, weak: weakGroups.map(g => g.competency) };
}

/* ------------------------------------------------------------------ ask */

/**
 * The question box. `state()` returns { content, learner, weakGroups, course } at the time of asking.
 * Guarded requests are answered with the rule and the official link; everything else from approved content.
 */
export function askBox(ctx, { state, id = 'coach-ask', examples = [], compName = null, onAnswer = null }) {
  const out = h('div', { class: 'coach-out', 'aria-live': 'polite', dataset: { coachOut: id } });
  const input = h('input', { class: 'input', id, type: 'text', maxlength: String(C.MAX_QUESTION), autocomplete: 'off', 'aria-describedby': id + '-hint', placeholder: tc(ctx, 'ask.placeholder') });
  const run = async (q) => {
    const question = String(q ?? input.value).trim();
    out.replaceChildren(h('p', { class: 'note' }, ctx.t('states.loading')));
    try {
      const s = await state();
      const entries = question ? await ctx.loadSearchIndex().catch(() => []) : [];
      const scope = retrievalScope(s.content);
      const res = C.askCoach({ question, entries, certifications: s.content.certifications || [], focus: focusOf({ course: s.course, profile: s.learner.profile, weakGroups: s.weakGroups }), ...scope,
        weakGroups: s.weakGroups, courseTitle: s.course ? L(ctx, s.course.title) : null });
      out.replaceChildren(h('div', { class: 'coach-answer', dataset: { answer: res.type, hits: String(res.hits.length) } },
        question ? h('p', { class: 'coach-asked' }, sourceLabel(ctx, 'user'), ' ', h('span', null, question)) : null,
        renderParts(ctx, res.parts, { compName })));
      onAnswer?.(res);
    } catch (err) {
      console.warn('[cia] coach answer failed:', err?.message);
      out.replaceChildren(h('p', { class: 'errsum', role: 'alert' }, ctx.t('states.errorBody')));
    }
  };
  const form = h('form', { class: 'coach-ask', novalidate: true, onsubmit: e => { e.preventDefault(); run(); } },
    h('div', { class: 'field' }, h('label', { for: id }, tc(ctx, 'ask.label')), h('span', { class: 'hint', id: id + '-hint' }, tc(ctx, 'ask.hint')),
      h('div', { class: 'coach-askrow' }, input, Button({ label: tc(ctx, 'ask.send'), type: 'submit', variant: 'primary', iconName: 'search', attrs: { 'data-action': 'coach-ask' } }))),
    examples.length ? h('p', { class: 'coach-examples' }, h('span', { class: 'note' }, tc(ctx, 'ask.try'), ' '),
      examples.map(x => h('button', { type: 'button', class: 'chipbtn', dataset: { action: 'coach-example' }, onclick: () => { input.value = x; run(x); } }, x))) : null);
  return h('div', { class: 'coach-askbox' }, form, out);
}

/* ------------------------------------------------------------------ lesson and course panels */

function reviewList(ctx, rows, course, compName) {
  if (!rows.length) return h('div', { dataset: { review: '0' } }, renderParts(ctx, [C.makePart({ label: 'user', kind: 'note', tkey: 'review.none' }),
    ...(course?.assessments?.quiz || course?.assessments?.final ? [C.makePart({ label: 'platform', kind: 'link', href: '#/assessments', tkey: 'review.takeQuiz' })] : [])]));
  return h('ol', { class: 'coach-review', dataset: { review: String(rows.length) } }, rows.map(r => h('li', { dataset: { competency: r.competency } },
    h('p', null, sourceLabel(ctx, 'user'), ' ', h('strong', null, compName(r.competency) || r.competency), ' — ', tc(ctx, r.repeated ? 'review.lineRepeated' : 'review.line', { n: ctx.i18n.number(r.wrong), items: ctx.i18n.number(r.items) })),
    r.lessons.length || r.lab ? h('p', null, sourceLabel(ctx, 'platform'), ' ', tc(ctx, 'review.open'), ' ',
      r.lessons.map((l, i) => [i ? ' · ' : '', h('a', { href: lessonHrefOf(course, l), dataset: { reviewLesson: l.id } }, L(ctx, l.title))]),
      r.lab ? [r.lessons.length ? ' · ' : '', h('a', { href: `#/labs/${r.lab.slug}`, dataset: { reviewLab: r.lab.id } }, icon('flask'), ' ', L(ctx, r.lab.title))] : null) : null)));
}

/** The coach on a lesson page: a folded panel placed after the key-idea cards (D-95 keeps the page calm until it is opened). */
export function lessonCoachPanel(ctx, { course, lesson, content, learner, href }) {
  const compName = cid => { const c = content.byId(content.competencies, cid); return c ? L(ctx, c.name) : ''; };
  const out = h('div', { class: 'coach-out', 'aria-live': 'polite', dataset: { coachOut: 'lesson' } });
  let weakP = null;
  const weak = () => (weakP ||= loadWeak(ctx, learner));
  const show = (kind, node) => { out.dataset.shown = kind; out.replaceChildren(node); };
  const depthBtn = d => h('button', { type: 'button', class: 'btn btn-secondary', 'aria-pressed': 'false', dataset: { action: 'coach-explain', depth: d }, onclick: e => {
    e.currentTarget.parentElement.querySelectorAll('[data-depth]').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
    show('explain-' + d, renderParts(ctx, C.guardResponse(C.explainLesson(lesson, d, { href }).parts).parts));
  } }, tc(ctx, 'lesson.depth.' + d));
  let turn = 0;
  const socratic = () => show('socratic', renderParts(ctx, C.guardResponse(C.socraticPrompts(lesson, { seed: ctx.session.user.id + ':' + (turn++) })).parts));
  const review = async () => { const w = await weak(); show('review', reviewList(ctx, C.reviewFirst({ course, weakGroups: w.groups, labs: content.labs || [] }), course, compName)); };
  /* "Check me": the exercise on this page has a model answer but no stored criteria, so it is never graded — the coach only
     says which of the model answer's key terms the learner's own notes use (a self-check hint, marked uncertain). */
  const check = () => {
    const model = L(ctx, lesson.exercise?.model_answer);
    const answer = String(document.getElementById('ex-notes')?.value || '').trim();
    if (!model) return show('check-none', renderParts(ctx, [C.makePart({ label: 'platform', kind: 'note', tkey: 'lesson.checkNoExercise' })]));
    if (!answer) return show('check-empty', renderParts(ctx, [C.makePart({ label: 'platform', kind: 'note', tkey: 'lesson.checkEmpty' })]));
    const cov = C.coverage(answer, model);
    const parts = [C.makePart({ label: 'user', lead: 'yourAnswer', text: answer.length > 400 ? answer.slice(0, 400) + '…' : answer }),
      C.makePart({ label: 'platform', kind: 'note', tkey: 'lesson.checkNoRubric' }),
      C.makePart({ label: 'ai', kind: 'note', tkey: 'lesson.checkResult', params: { a: cov.covered.length, n: cov.terms.length } }),
      ...(cov.missing.length ? [C.makePart({ label: 'ai', kind: 'list', lead: 'missingTerms', items: cov.missing })] : []),
      C.makePart({ label: 'platform', lead: 'modelAnswer', text: lesson.exercise.model_answer })];
    const node = renderParts(ctx, C.guardResponse(parts).parts);
    node.dataset.covered = String(cov.covered.length); node.dataset.terms = String(cov.terms.length);
    show('check', node);
  };
  const comp = (lesson.competencies || [])[0] || (course.competency_mappings || [])[0]?.competency || '';
  return h('details', { class: 'panel coach-panel', dataset: { coach: 'lesson' } },
    h('summary', null, h('h2', { class: 'h-sm' }, icon('spark'), ' ', tc(ctx, 'lesson.title'))),
    h('p', { class: 'note' }, tc(ctx, 'honesty')),
    h('div', { class: 'coach-actions' },
      h('div', { class: 'btnrow', role: 'group', 'aria-label': tc(ctx, 'lesson.depthLabel') }, C.DEPTHS.map(depthBtn)),
      h('div', { class: 'btnrow' },
        Button({ label: tc(ctx, 'lesson.socratic'), variant: 'secondary', iconName: 'question', onClick: socratic, attrs: { 'data-action': 'coach-socratic' } }),
        Button({ label: tc(ctx, 'lesson.review'), variant: 'secondary', iconName: 'target', onClick: review, attrs: { 'data-action': 'coach-review' } }),
        Button({ label: tc(ctx, 'lesson.check'), variant: 'secondary', iconName: 'check', onClick: check, attrs: { 'data-action': 'coach-check' } }),
        linkBtn(`#/my?tab=coach&p=scenario${comp ? '&c=' + encodeURIComponent(comp) : ''}`, tc(ctx, 'lesson.scenario'), 'quiet', { 'data-action': 'coach-scenario' }))),
    out,
    askBox(ctx, { id: 'coach-ask-lesson', compName, state: async () => ({ content, learner, course, weakGroups: (await weak()).groups }) }),
    h('p', { class: 'note' }, tc(ctx, 'practiceOnly'), ' ', h('a', { href: '#/my?tab=coach', dataset: { action: 'open-coach' } }, tc(ctx, 'openCoach'))));
}

/** The coach on a course page: what to review first, from the learner's own wrong answers in this course's competencies. */
export function courseCoachPanel(ctx, { course, content, learner }) {
  const compName = cid => { const c = content.byId(content.competencies, cid); return c ? L(ctx, c.name) : ''; };
  const out = h('div', { class: 'coach-out', 'aria-live': 'polite', dataset: { coachOut: 'course' } });
  let weakP = null;
  const weak = () => (weakP ||= loadWeak(ctx, learner));
  const panel = h('details', { class: 'panel coach-panel', dataset: { coach: 'course' }, ontoggle: async e => {
    if (!e.currentTarget.open || out.dataset.shown) return;
    out.dataset.shown = 'review';
    const w = await weak();
    out.replaceChildren(reviewList(ctx, C.reviewFirst({ course, weakGroups: w.groups, labs: content.labs || [] }), course, compName));
  } },
    h('summary', null, h('h2', { class: 'h-sm' }, icon('spark'), ' ', tc(ctx, 'course.title'))),
    h('p', { class: 'note' }, tc(ctx, 'honesty')),
    h('h3', { class: 'h-sm' }, tc(ctx, 'lesson.review')), out,
    askBox(ctx, { id: 'coach-ask-course', compName, state: async () => ({ content, learner, course, weakGroups: (await weak()).groups }) }),
    h('p', { class: 'note' }, h('a', { href: '#/my?tab=coach', dataset: { action: 'open-coach' } }, tc(ctx, 'openCoach'))));
  return panel;
}

/* ------------------------------------------------------------------ explain my mistakes */

function mistakeGroups(ctx, res, compName, idKey) {
  return h('div', { class: 'coach-mistakes', dataset: { mistakes: String(res.total), groups: String(res.groups.length) } },
    renderParts(ctx, res.summary, { compName, cls: 'coach-summary' }),
    res.groups.map(g => h('section', { class: 'coach-mgroup', dataset: { competency: g.competency } },
      h('h4', null, h('span', { class: 'cid' }, g.competency), ' ', compName(g.competency) || '', ' ', h('span', { class: 'note' }, '· ', tc(ctx, 'mistakes.n', { n: ctx.i18n.number(g.count) }))),
      h('ol', { class: 'plain' }, g.items.map(it => h('li', { class: 'coach-mitem', dataset: { item: it[idKey] } }, h('p', { class: 'coach-mprompt' }, L(ctx, it.prompt)), renderParts(ctx, it.parts, { compName })))))));
}

function mistakesShell(ctx, { build, total, kind }) {
  if (!total) return null;
  const body = h('div', { class: 'coach-out', id: 'coach-mis-' + kind, hidden: true });
  const btn = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-expanded': 'false', 'aria-controls': body.id, dataset: { action: 'explain-mistakes' }, onclick: () => {
    const open = body.hidden;
    if (open && !body.firstChild) body.append(build());
    body.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    btn.replaceChildren(icon('spark'), ' ', tc(ctx, open ? 'mistakes.hide' : 'mistakes.show', { n: ctx.i18n.number(total) }));
  } }, icon('spark'), ' ', tc(ctx, 'mistakes.show', { n: ctx.i18n.number(total) }));
  return h('section', { class: 'gx-coach no-print', 'aria-labelledby': 'coach-mis-h-' + kind, dataset: { coach: 'mistakes', kind } },
    h('h3', { id: 'coach-mis-h-' + kind }, tc(ctx, 'mistakes.title')), h('p', { class: 'note' }, tc(ctx, 'mistakes.lede')),
    h('div', { class: 'btnrow' }, btn, linkBtn('#/my?tab=coach&p=weak', tc(ctx, 'mistakes.toWeak'), 'quiet', { 'data-action': 'coach-weak' })), body,
    h('p', { class: 'note' }, tc(ctx, 'practiceOnly')));
}

/** Assessment result: wrong answers grouped by competency, each explained from the stored rationale. */
export function mistakesBlock(ctx, { attempt, questions, compName }) {
  const res = C.explainMistakes(attempt, questions);
  return mistakesShell(ctx, { total: res.total, kind: 'assessment', build: () => mistakeGroups(ctx, res, compName, 'question_id') });
}

/** Practice-lab result: the same from the task's option rationales, model answer and reasoning. */
export function labMistakesBlock(ctx, { lab, attempt, compName = () => '' }) {
  const res = C.explainLabMistakes(lab, attempt);
  return mistakesShell(ctx, { total: res.total, kind: 'lab', build: () => mistakeGroups(ctx, res, compName, 'task_id') });
}
