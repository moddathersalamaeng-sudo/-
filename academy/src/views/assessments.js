/**
 * Assessment engine views (Phase 5, rebuilt in Phase 7).
 *
 *  #/assessments              assessmentsView        — diagnostics first, then course assessments by course
 *  #/assessments/:slug        assessmentDetailView   — take an assessment; explained results; evidence saved
 *  #/assessments/history      assessmentHistoryView
 *
 * Attempt record (`assessment_attempts`): { id, assessment_id, attempt_no, submitted_at, answers, score, earned, max,
 *   passed, pending_review, unknown, competency_breakdown, domain_breakdown, detail[] }.
 * "I don't know" is a first-class answer (UNKNOWN): it scores zero and is reported separately, so learners are not
 * pushed to guess. Items that need human review are excluded from competency evidence until reviewed.
 */
import { h } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, Table } from '../ui/components.js';
import { deterministicOrder, scoreAttempt, domainBreakdown, competencyBreakdown, optionFeedback, assessmentIntegrity, AUTO_TYPES, UNKNOWN } from '../domain/assessments.mjs';
import { MASTERY_THRESHOLD, WEAK_THRESHOLD } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, notAvailable, pageHead, govBadge, previewBanner, linkBtn, section, facts, minutes, isReviewer } from '../ui/academy.js';
import { rubricTable } from './courses.js';

const latest = (attempts, id) => attempts.filter(x => x.assessment_id === id).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0] || null;
const resultBadge = (ctx, at) => !at ? Badge({ label: ctx.t('p7.asm.notTaken'), tone: 'neutral' })
  : at.pending_review ? Badge({ label: ctx.t('assessments.pendingReview'), tone: 'info' })
  : Badge({ label: ctx.t('p7.asm.lastScore', { pct: ctx.i18n.number(at.score), status: at.passed ? ctx.t('assessments.passed') : ctx.t('assessments.notPassed') }), tone: at.passed ? 'ok' : 'warn' });
const band = pct => pct >= MASTERY_THRESHOLD ? 'mastered' : pct >= WEAK_THRESHOLD ? 'developing' : 'gap';

/* ------------------------------------------------------------------ list */

function assessmentCard(ctx, a, learner) {
  const { t, i18n } = ctx;
  const at = latest(learner.attempts, a.id);
  return h('article', { class: 'card', dataset: { assessment: a.id } },
    h('p', { class: 'eyebrow' }, t('p7.asmKind.' + a.kind)),
    h('h3', null, h('a', { href: `#/assessments/${a.slug}` }, L(ctx, a.title))),
    a.description ? h('p', null, L(ctx, a.description)) : null,
    h('p', { class: 'note' }, t('p7.asm.meta', { n: i18n.number(a.question_ids.length), pass: i18n.number(a.scoring.passing_score) }), a.estimated_minutes ? ' · ' + minutes(ctx, a.estimated_minutes) : ''),
    h('div', { class: 'badges' }, resultBadge(ctx, at), a.allow_unknown ? Badge({ label: t('p7.asm.unknownAllowed'), tone: 'neutral' }) : null, isReviewer(ctx) ? govBadge(ctx, a) : null));
}

export function assessmentsView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('assessments.eyebrow'), title: t('assessments.title'), lede: t('assessments.intro'), actions: [linkBtn('#/assessments/history', t('assessments.history'))] });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const xs = content.assessments;
    if (!xs.length) return EmptyState({ title: t('assessments.empty'), body: t('p7.asm.pendingBody'), iconName: 'lock', action: linkBtn('#/knowledge', t('knowledge.title')) });
    const diag = xs.filter(a => ['diagnostic', 'readiness'].includes(a.kind));
    const byCourse = new Map();
    for (const a of xs.filter(x => !diag.includes(x))) {
      const key = a.course_id && content.byId(content.courses, a.course_id) ? a.course_id : '_other';
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key).push(a);
    }
    const order = { knowledge_quiz: 1, scenario: 2, final: 3, practical: 4 };
    return h('div', null, previewBanner(ctx, xs),
      diag.length ? section('as-diag', t('p7.asm.diagnostics'), h('p', { class: 'note' }, t('p7.asm.diagnosticsNote')), h('div', { class: 'cards' }, diag.map(a => assessmentCard(ctx, a, learner)))) : null,
      [...byCourse.entries()].map(([cid, list]) => {
        const c = content.byId(content.courses, cid);
        return section('as-' + cid, c ? L(ctx, c.title) : t('p7.asm.other'),
          h('div', { class: 'cards' }, list.sort((a, b) => (order[a.kind] || 9) - (order[b.kind] || 9)).map(a => assessmentCard(ctx, a, learner))));
      }));
  } });
  return h('div', null, head, region);
}

/* ------------------------------------------------------------------ take an assessment */

function answerInput(ctx, q, answers, allowUnknown) {
  const { t } = ctx;
  const name = 'q-' + q.id;
  const auto = AUTO_TYPES.includes(q.type);
  let control;
  if (q.type === 'single_choice' || q.type === 'true_false') {
    control = h('div', { class: 'opts' }, (q.options || []).map(o => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value: String(o.id), onchange: () => { answers[q.id] = o.id; } }), h('span', null, L(ctx, o.text)))));
  } else if (q.type === 'multiple_choice') {
    control = h('div', { class: 'opts' }, h('p', { class: 'note' }, t('p7.asm.selectAll')), (q.options || []).map(o => h('label', { class: 'choice' },
      h('input', { type: 'checkbox', name, value: String(o.id), onchange: e => {
        const s = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
        e.target.checked ? s.add(o.id) : s.delete(o.id); answers[q.id] = [...s];
      } }), h('span', null, L(ctx, o.text)))));
  } else if (q.type === 'matching') {
    control = h('div', { class: 'opts' }, (q.pairs || []).map((p, i) => h('div', { class: 'field' },
      h('label', { for: `${name}-${i}` }, t('p7.asm.term.' + p.left)),
      h('select', { class: 'select', id: `${name}-${i}`, onchange: e => { answers[q.id] = { ...(answers[q.id] || {}), [p.left]: e.target.value }; } },
        h('option', { value: '' }, t('pf.choose')), p.right.map(x => h('option', { value: x }, t('p7.asm.term.' + x)))))));
  } else {
    const rub = Array.isArray(q.rubric) && q.rubric.length ? (q.rubric[0].criterion ? rubricTable(ctx, q.rubric, t('p7.course.rubric')) : h('ul', null, q.rubric.map(r => h('li', null, L(ctx, r))))) : null;
    control = h('div', null,
      q.deliverable ? h('p', null, h('strong', null, t('p7.course.deliverable')), ' ', L(ctx, q.deliverable)) : null,
      rub ? h('details', null, h('summary', null, t('p7.asm.howReviewed')), rub) : null,
      h('label', { class: 'sr-only', for: name }, t('p7.asm.yourResponse')),
      h('textarea', { class: 'textarea', id: name, rows: '6', 'aria-describedby': name + '-hint', oninput: e => { answers[q.id] = e.target.value; } }),
      h('span', { class: 'hint note', id: name + '-hint' }, t('p7.asm.manualHint')));
  }
  let unknown = null;
  if (auto && allowUnknown) {
    unknown = h('label', { class: 'choice choice-unknown' }, h('input', { type: 'checkbox', name: name + '-unknown', dataset: { unknown: q.id }, onchange: e => {
      control.querySelectorAll('input,select').forEach(el => { el.disabled = e.target.checked; });
      if (e.target.checked) answers[q.id] = UNKNOWN;
      else delete answers[q.id];
    } }), h('span', null, t('p7.asm.unknown')));
  }
  return h('div', { class: 'answer' }, control, unknown);
}

const answered = (q, v) => {
  if (v === UNKNOWN) return true;
  if (q.type === 'multiple_choice') return Array.isArray(v) && v.length > 0;
  if (q.type === 'matching') return (q.pairs || []).every(p => v?.[p.left]);
  if (AUTO_TYPES.includes(q.type)) return v !== undefined && v !== null && v !== '';
  return typeof v === 'string' && v.trim().length >= 20;
};

export function assessmentDetailView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const a = content.assessments.find(x => x.slug === match.params.slug);
    if (!a) return notAvailable(ctx, { title: t('p7.asm.notFound'), body: t('p7.asm.pendingBody'), action: linkBtn('#/assessments', t('assessments.title')) });
    return takeAssessment(ctx, a, content, learner, region);
  } });
  return h('div', null, region);
}

function takeAssessment(ctx, a, content, learner, region) {
  const { t, i18n } = ctx;
  const integ = assessmentIntegrity(a);
  const mine = learner.attempts.filter(x => x.assessment_id === a.id);
  const attemptNo = mine.length + 1;
  const qmap = new Map(content.questions.map(q => [q.id, q]));
  const missingQ = a.question_ids.filter(id => !qmap.has(id));
  const ordered = (integ.randomize_questions ? deterministicOrder(a.question_ids, ctx.session.user.id + a.id + attemptNo) : a.question_ids).map(id => qmap.get(id)).filter(Boolean);
  const course = content.byId(content.courses, a.course_id);
  const limitReached = integ.attempt_limit != null && mine.length >= integ.attempt_limit;
  const last = latest(learner.attempts, a.id);

  const head = pageHead(ctx, { eyebrow: t('p7.asmKind.' + a.kind), title: L(ctx, a.title), lede: a.description ? L(ctx, a.description) : null });
  const info = h('section', { class: 'panel', 'aria-label': t('p7.asm.about') },
    facts([
      [t('p7.asm.questions'), i18n.number(ordered.length)],
      [t('p7.asm.passMark'), i18n.number(a.scoring.passing_score) + '%'],
      a.estimated_minutes ? [t('p7.course.time'), minutes(ctx, a.estimated_minutes)] : null,
      [t('p7.asm.attempts'), integ.attempt_limit != null ? t('p7.asm.attemptsOf', { n: i18n.number(mine.length), max: i18n.number(integ.attempt_limit) }) : i18n.number(mine.length)],
      course ? [t('p7.asm.course'), h('a', { href: `#/academy/courses/${course.slug}` }, L(ctx, course.title))] : null
    ]),
    h('p', null, t('assessments.instructions', { pass: i18n.number(a.scoring.passing_score) })),
    a.allow_unknown ? h('p', { class: 'note' }, t('p7.asm.unknownExplain')) : null,
    h('p', { class: 'note' }, t('p7.asm.notCert')));

  const result = h('section', { class: 'result', id: 'asm-result', tabindex: '-1', 'aria-live': 'polite' });
  const previous = last ? renderResult(ctx, a, ordered, last, content, true) : null;

  if (limitReached) {
    return h('article', { class: 'asm', dataset: { assessment: a.id } }, previewBanner(ctx, [a]), head, info,
      h('p', { class: 'banner banner-warn', role: 'note' }, t('p7.asm.limitReached')), previous);
  }

  const answers = {};
  const summary = h('div', { class: 'errsum', role: 'alert', tabindex: '-1', hidden: true });
  const items = ordered.map((q, i) => h('section', { class: 'card qcard', id: 'qc-' + q.id, dataset: { question: q.id, type: q.type } },
    h('p', { class: 'eyebrow' }, t('p7.asm.qnum', { n: i18n.number(i + 1), total: i18n.number(ordered.length) }), ' · ', t('p7.qtype.' + q.type), ' · ', t('p7.asm.points', { n: i18n.number(q.weight || 1) })),
    q.scenario ? h('p', { class: 'scenario' }, L(ctx, q.scenario)) : null,
    h('h2', { class: 'qprompt', id: 'qp-' + q.id }, L(ctx, q.prompt)),
    answerInput(ctx, q, answers, a.allow_unknown === true),
    h('p', { class: 'err', id: 'qe-' + q.id, 'aria-live': 'polite' })));

  const submit = async () => {
    const open = ordered.filter(q => !answered(q, answers[q.id]));
    items.forEach(el => { el.querySelector('.err').textContent = ''; el.classList.remove('invalid'); });
    if (open.length) {
      for (const q of open) {
        const el = document.getElementById('qc-' + q.id);
        el?.classList.add('invalid');
        const err = document.getElementById('qe-' + q.id);
        if (err) err.textContent = AUTO_TYPES.includes(q.type) ? (a.allow_unknown ? t('p7.asm.needAnswerOrUnknown') : t('p7.asm.needAnswer')) : t('p7.asm.needText');
      }
      summary.replaceChildren(h('p', null, t('p7.asm.unanswered', { n: i18n.number(open.length) })), h('ul', null, open.map(q => h('li', null,
        h('a', { href: '#qc-' + q.id, onclick: e => { e.preventDefault(); document.getElementById('qc-' + q.id)?.querySelector('input,textarea,select')?.focus(); } }, t('p7.asm.qnum', { n: i18n.number(ordered.indexOf(q) + 1), total: i18n.number(ordered.length) }))))));
      summary.hidden = false; summary.focus();
      return;
    }
    summary.hidden = true;
    const s = scoreAttempt(a, ordered, answers);
    const attempt = {
      id: `${a.id}-${Date.now()}`, assessment_id: a.id, attempt_no: attemptNo, submitted_at: new Date().toISOString(), answers,
      score: s.percent, earned: s.earned, max: s.max, passed: s.passed, pending_review: s.pending_review, unknown: s.unknown,
      competency_breakdown: competencyBreakdown(ordered, s.detail), domain_breakdown: domainBreakdown(ordered, s.detail), detail: s.detail
    };
    await ctx.repos.assessmentAttempts.save(attempt);
    form.hidden = true;
    result.replaceChildren(renderResult(ctx, a, ordered, attempt, content, false));
    if (integ.attempt_limit == null || attemptNo < integ.attempt_limit)
      result.append(h('div', { class: 'btnrow' }, Button({ label: t('p7.asm.retake'), variant: 'secondary', onClick: () => region.refresh(), attrs: { 'data-action': 'retake' } })));
    result.focus();
    window.scrollTo(0, result.getBoundingClientRect().top + window.scrollY - 80);
  };

  const form = h('form', { class: 'asm-form', novalidate: true, onsubmit: e => { e.preventDefault(); submit(); } },
    summary, items,
    missingQ.length && isReviewer(ctx) ? h('p', { class: 'note' }, t('p7.asm.missingQuestions', { ids: missingQ.join(', ') })) : null,
    h('div', { class: 'btnrow' }, Button({ label: t('assessments.submit'), type: 'submit', attrs: { 'data-action': 'submit-assessment' } })));

  return h('article', { class: 'asm', dataset: { assessment: a.id } }, previewBanner(ctx, [a]), head, info,
    previous ? h('details', { class: 'panel prev' }, h('summary', null, t('p7.asm.previousResult')), previous) : null,
    form, result);
}

/** Result panel: score, pass state, competency evidence and explained answers. */
function renderResult(ctx, a, questions, at, content, isPrevious) {
  const { t, i18n } = ctx;
  const autoMax = (at.detail || []).filter(d => d.auto).reduce((s, d) => s + d.max, 0);
  const headline = at.pending_review && !autoMax ? t('p7.asm.allPending')
    : at.pending_review ? t('p7.asm.partPending', { pct: i18n.number(at.score) })
    : t('p7.asm.scoreLine', { pct: i18n.number(at.score), status: at.passed ? t('assessments.passed') : t('assessments.notPassed') });
  const comps = Object.entries(at.competency_breakdown || {});
  const compTable = comps.length ? Table({ caption: t('p7.asm.byCompetency'), columns: [
    { key: 'c', label: t('pf.thCompetency') }, { key: 'p', label: t('p7.asm.percent'), num: true }, { key: 'n', label: t('p7.asm.items'), num: true }, { key: 'u', label: t('p7.asm.unknownCount'), num: true }, { key: 's', label: t('pf.thStatus') }],
  rows: comps.map(([cid, v]) => {
    const comp = content.byId(content.competencies, cid);
    const b = band(v.percent);
    return { c: h('span', null, h('span', { class: 'cid' }, cid), ' ', comp ? L(ctx, comp.name) : ''), p: i18n.number(v.percent) + '%', n: i18n.number(v.items), u: i18n.number(v.unknown || 0),
      s: Badge({ label: t('p7.asm.band.' + b), tone: b === 'mastered' ? 'ok' : b === 'developing' ? 'info' : 'warn' }) };
  }) }) : h('p', { class: 'note' }, t('p7.asm.noEvidenceYet'));

  const review = questions.map((q, i) => {
    const d = (at.detail || []).find(x => x.question_id === q.id);
    const ans = at.answers?.[q.id];
    if (!d) return null;
    let verdict, tone;
    if (!d.auto) { verdict = d.reviewed ? t('p7.asm.reviewed') : t('assessments.pendingReview'); tone = 'info'; }
    else if (d.unknown) { verdict = t('p7.asm.markedUnknown'); tone = 'neutral'; }
    else { verdict = d.correct ? t('p7.asm.correct') : t('p7.asm.incorrect'); tone = d.correct ? 'ok' : 'bad'; }
    const f = (q.type === 'single_choice' || q.type === 'true_false') ? optionFeedback(q, ans) : null;
    return h('li', { class: 'rv', dataset: { question: q.id } },
      h('p', null, h('strong', null, i18n.number(i + 1), '. '), L(ctx, q.prompt), ' ', Badge({ label: verdict, tone })),
      f?.chosen && !d.correct ? h('p', null, h('strong', null, t('p7.asm.yourChoice')), ' ', L(ctx, f.chosen.text), f.chosen.why ? ' — ' + L(ctx, f.chosen.why) : '') : null,
      f?.correct ? h('p', null, h('strong', null, t('p7.asm.correctAnswer')), ' ', L(ctx, f.correct.text), f.correct.why ? ' — ' + L(ctx, f.correct.why) : '') : null,
      q.explanation ? h('p', { class: 'note' }, L(ctx, q.explanation)) : null);
  }).filter(Boolean);

  return h('div', { class: 'stack', dataset: { result: at.id } },
    h('h2', null, isPrevious ? t('p7.asm.previousResult') : t('p7.asm.yourResult')),
    h('p', { class: at.pending_review ? 'banner banner-info' : at.passed ? 'oksum' : 'errsum', dataset: { score: String(at.score), passed: String(at.passed) } }, headline),
    at.unknown ? h('p', { class: 'note' }, t('p7.asm.unknownSummary', { n: i18n.number(at.unknown) })) : null,
    h('h3', null, t('p7.asm.byCompetency')), compTable,
    h('p', { class: 'note' }, t('p7.asm.evidenceNote')),
    h('details', { open: !isPrevious }, h('summary', null, t('p7.asm.reviewAnswers')), h('ol', { class: 'plain review' }, review)),
    h('div', { class: 'btnrow' }, linkBtn('#/academy/iso', t('p7.asm.seeStart'), 'primary'), linkBtn('#/recommendations', t('nav.items.recommendations')), linkBtn('#/assessments/history', t('assessments.history'))));
}

/* ------------------------------------------------------------------ history */

export function assessmentHistoryView(ctx) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('assessments.eyebrow'), title: t('assessments.history'), lede: t('p7.asm.historyLede') });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const xs = [...learner.attempts].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
    if (!xs.length) return EmptyState({ title: t('assessments.emptyHistory'), body: t('assessments.emptyHistoryBody'), action: linkBtn('#/assessments', t('assessments.title'), 'primary') });
    return Table({ caption: t('assessments.history'), columns: [
      { key: 'a', label: t('assessments.assessment') }, { key: 'd', label: t('p7.asm.date') }, { key: 's', label: t('assessments.scoreLabel'), num: true }, { key: 'u', label: t('p7.asm.unknownCount'), num: true }, { key: 'st', label: t('assessments.status') }],
    rows: xs.map(x => {
      const a = content.byId(content.assessments, x.assessment_id);
      return { a: a ? h('a', { href: `#/assessments/${a.slug}` }, L(ctx, a.title)) : x.assessment_id, d: i18n.date(x.submitted_at), s: i18n.number(x.score) + '%', u: i18n.number(x.unknown || 0),
        st: x.pending_review ? t('assessments.pendingReview') : x.passed ? t('assessments.passed') : t('assessments.notPassed') };
    }) });
  } });
  return h('div', null, head, region);
}
