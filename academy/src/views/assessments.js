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
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, Table, ProgressBar } from '../ui/components.js';
import { deterministicOrder, scoreAttempt, domainBreakdown, competencyBreakdown, optionFeedback, assessmentIntegrity, AUTO_TYPES, UNKNOWN } from '../domain/assessments.mjs';
import { MASTERY_THRESHOLD, WEAK_THRESHOLD, completedTargets } from '../domain/learner-model.mjs';
import { buildStages, stageProgress, sanitizeDraft, resultInsights } from '../domain/guided.mjs';
import { mistakesBlock } from '../ui/coach.js';
import { counterStrip, stepRail, competencyBars, scoreRing } from '../ui/guided.js';
import { loadAll, loadQuestions } from '../data/learner-state.js';
import { L, notAvailable, pageHead, govBadge, previewBanner, linkBtn, section, facts, minutes, hours, isReviewer } from '../ui/academy.js';
import { rubricTable } from './courses.js';
import { starterCourse, lessonHref } from './home.js';
import { academyByKey, ACADEMIES, academyOfAssessment, academyOfCourse, ASSESSMENT_TYPE } from '../domain/academies.mjs';
import { Tabs } from '../ui/components.js';
import { setHashQuery } from '../ui/academy.js';

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

/**
 * Phase 10A (plan §3.5): tabs by academy; inside each, diagnostics and readiness checks first, then the course finals
 * and practical tasks by course. Lesson quizzes are reached from inside their course and are not listed here.
 * The chosen academy and type are kept in the URL (?academy=&type=).
 */
export function assessmentsView(ctx, match = {}) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('assessments.eyebrow'), title: t('assessments.title'), lede: t('x10a.asm.lede'), actions: [linkBtn('#/assessments/history', t('assessments.history'))] });
  const q = { academy: match.query?.academy || '', type: match.query?.type === 'course' ? 'course' : 'diagnostic' };
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const xs = content.assessments;
    if (!xs.length) return EmptyState({ title: t('assessments.empty'), body: t('p7.asm.pendingBody'), iconName: 'lock', action: linkBtn('#/library', t('nav.items.library')) });
    const courseById = id => content.byId(content.courses, id);
    const keys = [...ACADEMIES.map(a => a.key), 'general'];
    const groups = Object.fromEntries(keys.map(k => [k, { diagnostic: [], course: [] }]));
    for (const a of xs) {
      const type = ASSESSMENT_TYPE(a);
      if (type === 'quiz') continue;
      const k = academyOfAssessment(a, courseById);
      (groups[k] || groups.general)[type].push(a);
    }
    const tabsKeys = keys.filter(k => groups[k].diagnostic.length || groups[k].course.length);
    const initial = Math.max(0, tabsKeys.indexOf(q.academy));
    const order = { final: 1, practical: 2 };
    const panel = k => () => {
      const g = groups[k];
      const box = h('div', { class: 'asm-panel', dataset: { academy: k } });
      const typePick = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('x10a.asm.type') }, ['diagnostic', 'course'].map(ty => h('label', { class: 'seg-opt' },
        h('input', { type: 'radio', name: 'asm-type-' + k, value: ty, checked: q.type === ty, onchange: () => { q.type = ty; paint(); setHashQuery('/assessments', { academy: k, type: ty }); } }),
        h('span', null, t('x10a.asm.types.' + ty), ' ', h('span', { class: 'note' }, '(', i18n.number(g[ty].length), ')')))));
      const list = h('div', { class: 'asm-list' });
      let paint = () => {
        if (q.type === 'diagnostic') {
          list.replaceChildren(g.diagnostic.length ? h('div', { class: 'cards' }, g.diagnostic.sort((a, b) => (a.kind === 'readiness' ? -1 : 0) - (b.kind === 'readiness' ? -1 : 0)).map(a => assessmentCard(ctx, a, learner)))
            : EmptyState({ title: t('x10a.asm.noneDiag'), body: t('x10a.asm.noneDiagBody'), level: 3 }));
        } else {
          const byCourse = new Map();
          for (const a of g.course) { const c = courseById(a.course_id); const key = c ? c.id : '_other'; if (!byCourse.has(key)) byCourse.set(key, []); byCourse.get(key).push(a); }
          list.replaceChildren(byCourse.size ? h('ul', { class: 'asm-rows' }, [...byCourse.entries()].map(([cid, as]) => {
            const c = courseById(cid);
            return h('li', { dataset: { course: cid } }, h('strong', null, c ? h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)) : t('p7.asm.other')),
              h('span', { class: 'asm-links' }, as.sort((a, b) => (order[a.kind] || 9) - (order[b.kind] || 9)).map(a => {
                const at = latest(learner.attempts, a.id);
                return h('a', { href: `#/assessments/${a.slug}`, dataset: { assessment: a.id } }, t('p7.asmKind.' + a.kind), at ? [' · ', at.pending_review ? t('assessments.pendingReview') : i18n.number(at.score) + '%'] : null);
              })));
          })) : EmptyState({ title: t('x10a.asm.noneCourse'), body: t('x10a.asm.noneCourseBody'), level: 3 }));
        }
      };
      paint();
      const typeHead = h('h2', { class: 'h-sm' });
      const paintHead = () => { typeHead.textContent = t('x10a.asm.types.' + q.type); };
      const repaint = paint; paint = () => { paintHead(); repaint(); };
      paintHead();
      box.append(typePick, typeHead, list, h('p', { class: 'note' }, icon('info'), ' ', t('x10a.asm.quizNote')));
      return box;
    };
    const label = k => k === 'general' ? t('x10a.asm.general') : t('nav.items.' + academyByKey(k).navId);
    return h('div', null, previewBanner(ctx, xs),
      Tabs({ label: t('x10a.asm.byAcademy'), initial, lazy: true, tabs: tabsKeys.map(k => ({ key: k, label: label(k), content: panel(k) })),
        onSelect: i => { q.academy = tabsKeys[i]; setHashQuery('/assessments', q); } }));
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
  const region = dataRegion({ t, load: async () => {
    const all = await loadAll(ctx);
    const a = all.content.assessments.find(x => x.slug === match.params.slug);
    /* Phase 10A: only this assessment's questions are fetched (from the shards that hold them). */
    if (a) all.content.questions = await loadQuestions(ctx, a.question_ids || []);
    /* Phase 12B (D-89): the learner's saved draft for this assessment, if any. */
    all.draft = a && ctx.repos.assessmentDrafts ? await ctx.repos.assessmentDrafts.get(a.id).catch(() => null) : null;
    return all;
  }, render: ({ content, learner, draft }) => {
    const a = content.assessments.find(x => x.slug === match.params.slug);
    if (!a) return notAvailable(ctx, { title: t('p7.asm.notFound'), body: t('p7.asm.pendingBody'), action: linkBtn('#/assessments', t('assessments.title')) });
    /* Phase 10A: arriving from onboarding — the profile is saved; offer the first lesson straight away (one click). */
    const ac = match.query?.from === 'welcome' ? academyByKey(match.query.academy) : null;
    const sc = ac ? starterCourse(content.courses, ac.key) : null;
    const first = sc?.modules?.[0]?.lessons?.[0];
    const welcome = ac ? h('div', { class: 'banner banner-ok welcome-next', role: 'status', dataset: { welcome: ac.key } },
      h('p', null, h('strong', null, t('x10a.welcome.doneTitle')), ' ', t('x10a.welcome.doneBody')),
      h('div', { class: 'btnrow' }, first ? linkBtn(lessonHref(sc, first), t('x10a.welcome.startNow', { course: L(ctx, sc.title) }), 'secondary', { 'data-action': 'welcome-first-lesson' }) : null,
        linkBtn('#' + ac.route, t('nav.items.' + ac.navId), 'quiet'))) : null;
    return h('div', null, welcome, takeAssessment(ctx, a, content, learner, region, { draft, view: match.query?.view === 'all' ? 'all' : 'guided' }));
  } });
  return h('div', null, region);
}

/** Restore a saved answer into a question card (guided-player resume, D-89). */
function applyAnswer(card, q, v) {
  if (!card || v === undefined || v === null) return;
  if (v === UNKNOWN) {
    const u = card.querySelector('input[data-unknown]');
    if (u && !u.checked) { u.checked = true; card.querySelectorAll('.opts input, .opts select').forEach(el => { el.disabled = true; }); }
    return;
  }
  if (q.type === 'single_choice' || q.type === 'true_false') {
    const r = [...card.querySelectorAll('input[type=radio]')].find(x => x.value === String(v)); if (r) r.checked = true;
  } else if (q.type === 'multiple_choice') {
    const set = new Set((Array.isArray(v) ? v : []).map(String));
    card.querySelectorAll('.opts input[type=checkbox]').forEach(x => { x.checked = set.has(x.value); });
  } else if (q.type === 'matching') {
    (q.pairs || []).forEach((p, i) => { const sel = card.querySelector(`#q-${q.id}-${i}`); if (sel && v[p.left]) sel.value = v[p.left]; });
  } else {
    const ta = card.querySelector('textarea'); if (ta && typeof v === 'string') ta.value = v;
  }
}

/**
 * Phase 12B (L-A1 … L-A7): the guided player. A start screen with counters → stages grouped by competency → a review
 * screen → submit. Answers are saved on the device after every change and offered back on return. `?view=all` (or the
 * "one page" switch) shows the earlier single-page form. The result replaces the questions at the top of the page.
 */
function takeAssessment(ctx, a, content, learner, region, { draft = null, view = 'guided' } = {}) {
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
  const stages = buildStages(ordered);
  const compName = cid => { const c = cid ? content.byId(content.competencies, cid) : null; return c ? L(ctx, c.name) : null; };
  const stageLabel = (s, i) => compName(s.competency) || t('g12b.asm.stageN', { n: i18n.number(i + 1) });
  const restored = sanitizeDraft(draft, { assessmentId: a.id, version: a.governance?.version ?? null, attemptNo, questionIds: ordered.map(q => q.id) });

  const head = pageHead(ctx, { eyebrow: t('p7.asmKind.' + a.kind), title: L(ctx, a.title), lede: a.description ? L(ctx, a.description) : null });
  const result = h('section', { class: 'result', id: 'asm-result', tabindex: '-1', 'aria-live': 'polite' });
  const previous = last ? renderResult(ctx, a, ordered, last, content, learner, true) : null;
  const factsPanel = h('details', { class: 'panel gx-facts' }, h('summary', null, t('g12b.asm.details')),
    facts([
      [t('p7.asm.questions'), i18n.number(ordered.length)],
      [t('p7.asm.passMark'), i18n.number(a.scoring.passing_score) + '%'],
      a.estimated_minutes ? [t('p7.course.time'), minutes(ctx, a.estimated_minutes)] : null,
      [t('p7.asm.attempts'), integ.attempt_limit != null ? t('p7.asm.attemptsOf', { n: i18n.number(mine.length), max: i18n.number(integ.attempt_limit) }) : i18n.number(mine.length)],
      course ? [t('p7.asm.course'), h('a', { href: `#/academy/courses/${course.slug}` }, L(ctx, course.title))] : null
    ]),
    h('p', null, t('assessments.instructions', { pass: i18n.number(a.scoring.passing_score) })),
    a.allow_unknown ? h('p', { class: 'note' }, t('p7.asm.unknownExplain')) : null);

  if (limitReached) {
    return h('article', { class: 'asm', dataset: { assessment: a.id } }, previewBanner(ctx, [a]), head, factsPanel,
      h('p', { class: 'banner banner-warn', role: 'note' }, t('p7.asm.limitReached')), previous);
  }

  const answers = { ...(restored?.answers || {}) };
  const isAnswered = id => answered(qmap.get(id), answers[id]);
  const summary = h('div', { class: 'errsum', role: 'alert', tabindex: '-1', hidden: true });
  const items = ordered.map((q, i) => {
    const card = h('section', { class: 'card qcard', id: 'qc-' + q.id, dataset: { question: q.id, type: q.type } },
      h('p', { class: 'eyebrow' }, t('p7.asm.qnum', { n: i18n.number(i + 1), total: i18n.number(ordered.length) }), ' · ', t('p7.qtype.' + q.type), ' · ', t('p7.asm.points', { n: i18n.number(q.weight || 1) })),
      q.scenario ? h('p', { class: 'scenario' }, L(ctx, q.scenario)) : null,
      h('h2', { class: 'qprompt', id: 'qp-' + q.id }, L(ctx, q.prompt)),
      answerInput(ctx, q, answers, a.allow_unknown === true),
      h('p', { class: 'err', id: 'qe-' + q.id, 'aria-live': 'polite' }));
    applyAnswer(card, q, answers[q.id]);
    return card;
  });
  const cardOf = id => items[ordered.findIndex(q => q.id === id)];
  const stageOfQ = id => stages.findIndex(s => s.question_ids.includes(id));

  /* ---- state */
  const st = { view: view === 'all' ? 'all' : 'guided', stage: Math.min(restored?.stage || 0, Math.max(0, stages.length - 1)), review: false, visited: new Set([0]), started: view === 'all' };
  if (restored) for (let i = 0; i <= st.stage; i++) st.visited.add(i);

  /* ---- autosave (D-89) */
  const saveLine = h('p', { class: 'note gx-save', role: 'status', 'aria-live': 'polite', dataset: { saved: restored ? 'restored' : 'idle' } }, restored ? t('g12b.asm.restored') : '');
  let saveTimer = null;
  const saveNow = async () => {
    if (!ctx.repos.assessmentDrafts) return;
    try {
      await ctx.repos.assessmentDrafts.save({ id: a.id, assessment_id: a.id, attempt_no: attemptNo, version: a.governance?.version ?? null, answers, stage: st.stage, updated_at: new Date().toISOString() });
      saveLine.dataset.saved = 'ok'; saveLine.textContent = t('g12b.asm.saved');
    } catch { saveLine.dataset.saved = 'error'; saveLine.textContent = t('g12b.asm.saveFailed'); }
  };
  const queueSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); };

  /* ---- progress, rail, navigation */
  const progressBox = h('div', { class: 'gx-progress' });
  const railBox = h('div', { class: 'gx-railbox' });
  const stageTitle = h('h2', { class: 'gx-stagetitle', tabindex: '-1' });
  const reviewBox = h('section', { class: 'gx-review', hidden: true, 'aria-labelledby': 'gx-review-h' });
  const back = Button({ label: t('g12b.asm.back'), variant: 'quiet', onClick: () => go(st.review ? stages.length - 1 : st.stage - 1), attrs: { 'data-action': 'asm-back' } });
  const next = Button({ label: t('g12b.asm.next'), variant: 'primary', onClick: () => advance(), attrs: { 'data-action': 'asm-next' } });
  const submitBtn = Button({ label: t('assessments.submit'), type: 'submit', attrs: { 'data-action': 'submit-assessment' } });
  const viewToggle = h('button', { type: 'button', class: 'linkish', dataset: { action: 'asm-view' }, onclick: () => { st.view = st.view === 'all' ? 'guided' : 'all'; st.started = true; render(); } });

  const stageStates = () => {
    const pr = stageProgress(stages, isAnswered);
    return { pr, rail: stages.map((s, i) => ({ label: stageLabel(s, i), state: !st.review && i === st.stage ? 'current' : pr.done[i] ? 'done' : 'todo', visited: st.visited.has(i) })) };
  };
  const clearErrors = ids => ids.forEach(id => { const el = cardOf(id); if (!el) return; el.classList.remove('invalid'); el.querySelector('.err').textContent = ''; });
  const markOpen = ids => ids.forEach(id => {
    const q = qmap.get(id); const el = cardOf(id); if (!el) return;
    el.classList.add('invalid');
    el.querySelector('.err').textContent = AUTO_TYPES.includes(q.type) ? (a.allow_unknown ? t('p7.asm.needAnswerOrUnknown') : t('p7.asm.needAnswer')) : t('p7.asm.needText');
  });

  function render() {
    const guided = st.view === 'guided';
    form.dataset.view = st.view;
    viewToggle.textContent = guided ? t('g12b.asm.viewAll') : t('g12b.asm.viewGuided');
    intro.hidden = st.started;
    factsPanel.hidden = st.started && guided;
    form.hidden = !st.started;
    const { pr, rail } = stageStates();
    progressBox.replaceChildren(ProgressBar({ value: pr.answered, max: pr.total || 1, label: guided && !st.review ? t('g12b.asm.stageOf', { n: i18n.number(st.stage + 1), total: i18n.number(stages.length) }) : t('g12b.asm.progress'),
      valueText: t('g12b.asm.answeredOf', { n: i18n.number(pr.answered), total: i18n.number(pr.total) }) }));
    railBox.hidden = !guided || stages.length < 2;
    railBox.replaceChildren(stages.length >= 2 ? stepRail(ctx, rail, { label: t('g12b.asm.rail'), onGo: i => go(i), reviewLabel: t('g12b.asm.review'), reviewState: st.review ? 'current' : pr.complete ? 'done' : 'todo', onReview: () => showReview() }) : '');
    const curIds = new Set(stages[st.stage]?.question_ids || []);
    items.forEach((el, i) => { el.hidden = guided && (st.review || !curIds.has(ordered[i].id)); });
    stageTitle.hidden = !guided || st.review;
    const s = stages[st.stage];
    if (s) stageTitle.textContent = stages.length > 1 ? t('g12b.asm.stageHead', { n: i18n.number(st.stage + 1), total: i18n.number(stages.length), name: stageLabel(s, st.stage) }) : stageLabel(s, st.stage);
    reviewBox.hidden = !guided || !st.review;
    if (guided && st.review) renderReview();
    back.hidden = !guided || (!st.review && st.stage === 0);
    next.hidden = !guided || st.review;
    next.textContent = st.stage >= stages.length - 1 ? t('g12b.asm.toReview') : t('g12b.asm.next');
    submitBtn.hidden = guided && !st.review;
  }
  function go(i) {
    if (i < 0) return;
    if (i >= stages.length) return showReview();
    st.review = false; st.stage = i; st.visited.add(i); summary.hidden = true;
    render(); queueSave();
    stageTitle.focus({ preventScroll: true }); form.scrollIntoView({ block: 'start', behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  function advance() {
    const ids = stages[st.stage].question_ids;
    const open = ids.filter(id => !isAnswered(id));
    clearErrors(ids);
    if (open.length) { markOpen(open); cardOf(open[0])?.querySelector('input:not([disabled]),textarea,select')?.focus(); return; }
    go(st.stage + 1);
  }
  function showReview() { st.review = true; summary.hidden = true; render(); queueSave(); document.getElementById('gx-review-h')?.focus(); form.scrollIntoView({ block: 'start' }); }
  function renderReview() {
    const pr = stageProgress(stages, isAnswered);
    reviewBox.replaceChildren(
      h('h2', { id: 'gx-review-h', tabindex: '-1' }, t('g12b.asm.reviewTitle')),
      h('p', { class: 'note' }, pr.complete ? t('g12b.asm.reviewReady') : t('g12b.asm.reviewOpen', { n: i18n.number(pr.total - pr.answered) })),
      h('ol', { class: 'gx-reviewlist' }, ordered.map((q, i) => {
        const v = answers[q.id]; const ok = isAnswered(q.id);
        const state = !ok ? 'open' : v === UNKNOWN ? 'unknown' : 'answered';
        return h('li', { class: 'is-' + state, dataset: { question: q.id, state } },
          h('span', { class: 'gx-rvq' }, h('strong', null, i18n.number(i + 1), '. '), L(ctx, q.prompt)),
          Badge({ label: t('g12b.asm.state.' + state), tone: state === 'open' ? 'warn' : state === 'unknown' ? 'neutral' : 'ok' }),
          h('button', { type: 'button', class: 'linkish', dataset: { action: 'asm-edit' }, onclick: () => go(stageOfQ(q.id)) }, t('g12b.asm.edit')));
      })));
  }

  const submit = async () => {
    const open = ordered.filter(q => !answered(q, answers[q.id]));
    clearErrors(ordered.map(q => q.id));
    if (open.length) {
      markOpen(open.map(q => q.id));
      const jump = q => { if (st.view === 'guided') go(stageOfQ(q.id)); cardOf(q.id)?.querySelector('input:not([disabled]),textarea,select')?.focus(); };
      summary.replaceChildren(h('p', null, t('p7.asm.unanswered', { n: i18n.number(open.length) })), h('ul', null, open.map(q => h('li', null,
        h('a', { href: '#qc-' + q.id, onclick: e => { e.preventDefault(); jump(q); } }, t('p7.asm.qnum', { n: i18n.number(ordered.indexOf(q) + 1), total: i18n.number(ordered.length) }))))));
      summary.hidden = false; summary.focus();
      return;
    }
    summary.hidden = true;
    clearTimeout(saveTimer);
    const s = scoreAttempt(a, ordered, answers);
    const attempt = {
      id: `${a.id}-${Date.now()}`, assessment_id: a.id, attempt_no: attemptNo, submitted_at: new Date().toISOString(), answers,
      score: s.percent, earned: s.earned, max: s.max, passed: s.passed, pending_review: s.pending_review, unknown: s.unknown,
      competency_breakdown: competencyBreakdown(ordered, s.detail), domain_breakdown: domainBreakdown(ordered, s.detail), detail: s.detail
    };
    await ctx.repos.assessmentAttempts.save(attempt);
    try { await ctx.repos.assessmentDrafts?.remove(a.id); } catch { /* a failed clean-up never blocks the result */ }
    /* The questions and the start screen leave the page; the result takes their place at the top (L-A3). */
    form.hidden = true; form.classList.add('is-submitted'); intro.hidden = true; prevBox?.remove(); factsPanel.hidden = true;
    learner.attempts = [...learner.attempts, attempt];
    result.replaceChildren(renderResult(ctx, a, ordered, attempt, content, learner, false));
    if (integ.attempt_limit == null || attemptNo < integ.attempt_limit)
      result.append(h('div', { class: 'btnrow' }, Button({ label: t('p7.asm.retake'), variant: 'secondary', onClick: () => region.refresh(), attrs: { 'data-action': 'retake' } })));
    result.focus({ preventScroll: true });
    window.scrollTo(0, Math.max(0, result.getBoundingClientRect().top + window.scrollY - 80));
  };

  const form = h('form', { class: 'asm-form', novalidate: true, dataset: { view: st.view }, onsubmit: e => { e.preventDefault(); submit(); },
    oninput: queueSave, onchange: () => { queueSave(); if (st.view === 'guided') { const { pr, rail } = stageStates(); railBox.querySelectorAll('.gx-step').forEach((el, i) => { if (rail[i]) el.className = 'gx-step is-' + rail[i].state; }); progressBox.querySelector('[role=progressbar]')?.setAttribute('aria-valuenow', String(pr.answered)); const fill = progressBox.querySelector('.pbar-fill'); if (fill) fill.style.inlineSize = (pr.total ? pr.answered / pr.total * 100 : 0).toFixed(1) + '%'; const meta = progressBox.querySelector('.pbar-meta span[aria-hidden]'); if (meta) meta.textContent = t('g12b.asm.answeredOf', { n: i18n.number(pr.answered), total: i18n.number(pr.total) }); } } },
    h('div', { class: 'gx-formtop' }, progressBox, viewToggle),
    railBox, summary, stageTitle, items, reviewBox,
    missingQ.length && isReviewer(ctx) ? h('p', { class: 'note' }, t('p7.asm.missingQuestions', { ids: missingQ.join(', ') })) : null,
    h('div', { class: 'btnrow gx-nav' }, back, next, submitBtn),
    saveLine);

  /* ---- start screen (L-A1, L-A6) */
  const pr0 = stageProgress(stages, isAnswered);
  const start = () => { st.started = true; if (restored && st.view === 'guided' && stageProgress(stages, isAnswered).complete) return showReview(); render(); stageTitle.focus({ preventScroll: true }); };
  const restart = async () => {
    for (const k of Object.keys(answers)) delete answers[k];
    items.forEach((card, i) => { card.querySelectorAll('input').forEach(x => { x.checked = false; x.disabled = false; }); card.querySelectorAll('select').forEach(x => { x.value = ''; }); card.querySelectorAll('textarea').forEach(x => { x.value = ''; }); });
    st.stage = 0; st.visited = new Set([0]); st.review = false;
    try { await ctx.repos.assessmentDrafts?.remove(a.id); } catch { /* ignore */ }
    saveLine.dataset.saved = 'idle'; saveLine.textContent = '';
    start();
  };
  const intro = h('section', { class: 'panel gx-intro', 'aria-labelledby': 'gx-intro-h' },
    h('h2', { id: 'gx-intro-h' }, t('g12b.asm.introTitle')),
    counterStrip(ctx, [
      [ordered.length, t('g12b.asm.cQuestions'), 'question'],
      [a.estimated_minutes ? i18n.number(a.estimated_minutes) : '—', t('g12b.asm.cMinutes'), 'clock'],
      [i18n.number(a.scoring.passing_score) + '%', t('g12b.asm.cPass'), 'target'],
      stages.length > 1 ? [stages.length, t('g12b.asm.cStages'), 'steps'] : null
    ], { label: t('g12b.asm.introTitle') }),
    h('ol', { class: 'gx-how' }, [t('g12b.asm.how1'), t('g12b.asm.how2'), t('g12b.asm.how3')].map(x => h('li', null, x))),
    h('p', { class: 'note gx-honest' }, icon('shield'), ' ', t('g12b.asm.honest')),
    restored && pr0.answered
      ? h('div', { class: 'btnrow' },
          Button({ label: t('g12b.asm.resume', { n: i18n.number(pr0.answered), total: i18n.number(pr0.total) }), onClick: start, attrs: { 'data-action': 'asm-resume' } }),
          Button({ label: t('g12b.asm.restart'), variant: 'quiet', onClick: restart, attrs: { 'data-action': 'asm-restart' } }))
      : h('div', { class: 'btnrow' }, Button({ label: t('g12b.asm.start'), onClick: start, attrs: { 'data-action': 'asm-start' } }),
          h('button', { type: 'button', class: 'linkish', dataset: { action: 'asm-start-all' }, onclick: () => { st.view = 'all'; start(); } }, t('g12b.asm.viewAll'))));

  const prevBox = previous ? h('details', { class: 'panel prev' }, h('summary', null, t('p7.asm.previousResult')), previous) : null;
  render();
  return h('article', { class: 'asm', dataset: { assessment: a.id } }, previewBanner(ctx, [a]), head, intro, factsPanel, prevBox, form, result);
}

/** Phase 12B result (L-A3 … L-A5): score ring, counters, competency bars, method, reading and a 30/60/90 plan; answers folded. */
function renderResult(ctx, a, questions, at, content, learner, isPrevious) {
  const { t, i18n } = ctx;
  const autoMax = (at.detail || []).filter(d => d.auto).reduce((s, d) => s + d.max, 0);
  const headline = at.pending_review && !autoMax ? t('p7.asm.allPending')
    : at.pending_review ? t('p7.asm.partPending', { pct: i18n.number(at.score) })
    : t('p7.asm.scoreLine', { pct: i18n.number(at.score), status: at.passed ? t('assessments.passed') : t('assessments.notPassed') });
  const completedIds = learner ? [...completedTargets({ courses: content.courses, progress: learner.progress || [], attempts: learner.attempts || [] })] : [];
  const ins = resultInsights(at, { courses: content.courses || [], labs: content.labs || [], completedIds, assessmentSlug: a.slug, academy: academyOfAssessment(a, id => content.byId(content.courses, id)), academyOfCourse, mastery: MASTERY_THRESHOLD, weak: WEAK_THRESHOLD });
  const compName = cid => { const c = content.byId(content.competencies, cid); return c ? L(ctx, c.name) : ''; };
  const comps = Object.entries(at.competency_breakdown || {});
  const rows = comps.map(([id, v]) => ({ id, percent: v.percent, unknown: v.unknown || 0, band: band(v.percent) }));

  const compTable = comps.length ? Table({ caption: t('p7.asm.byCompetency'), columns: [
    { key: 'c', label: t('pf.thCompetency') }, { key: 'p', label: t('p7.asm.percent'), num: true }, { key: 'n', label: t('p7.asm.items'), num: true }, { key: 'u', label: t('p7.asm.unknownCount'), num: true }, { key: 's', label: t('pf.thStatus') }],
  rows: comps.map(([cid, v]) => {
    const b = band(v.percent);
    return { c: h('span', null, h('span', { class: 'cid' }, cid), ' ', compName(cid)), p: i18n.number(v.percent) + '%', n: i18n.number(v.items), u: i18n.number(v.unknown || 0),
      s: Badge({ label: t('p7.asm.band.' + b), tone: b === 'mastered' ? 'ok' : b === 'developing' ? 'info' : 'warn' }) };
  }) }) : null;

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

  const tone = at.pending_review ? 'info' : at.passed ? 'ok' : 'warn';
  const c = ins.counts;
  const top = h('div', { class: 'gx-reshead' },
    scoreRing(ctx, { percent: at.score, tone, label: t('g12b.res.ringLabel', { pct: i18n.number(at.score) }) }),
    h('div', { class: 'gx-resmain' },
      h('p', { class: at.pending_review ? 'banner banner-info' : at.passed ? 'oksum' : 'errsum', dataset: { score: String(at.score), passed: String(at.passed) } }, headline),
      counterStrip(ctx, [
        [c.correct, t('g12b.res.cCorrect'), 'check'],
        [c.incorrect, t('g12b.res.cIncorrect'), 'alert'],
        a.allow_unknown ? [c.unknown, t('g12b.res.cUnknown'), 'question'] : null,
        c.pending ? [c.pending, t('g12b.res.cPending'), 'clock'] : null
      ], { label: t('g12b.res.counts') })));

  const sep = t('g12b.res.sep');
  const nameList = xs => xs.map(r => `${compName(r.id) || r.id} (${i18n.number(r.percent)}%)`).join(sep);
  const reading = rows.length ? h('section', { class: 'gx-reading', 'aria-labelledby': 'gx-read-h' },
    h('h3', { id: 'gx-read-h' }, t('g12b.res.readingTitle')),
    h('ul', null,
      ins.strengths.length ? h('li', { class: 'is-ok' }, h('strong', null, t('g12b.res.strengths')), ' ', nameList(ins.strengths)) : null,
      ins.gaps.length ? h('li', { class: 'is-gap' }, h('strong', null, t('g12b.res.gaps')), ' ', nameList(ins.gaps)) : null,
      ins.developing.length ? h('li', { class: 'is-dev' }, h('strong', null, t('g12b.res.developing')), ' ', nameList(ins.developing)) : null,
      !ins.priorities.length ? h('li', { class: 'is-ok' }, t('g12b.res.noGaps')) : null)) : null;

  const planItem = it => {
    if (it.type === 'retake') return h('li', { dataset: { plan: 'retake' } }, icon('refresh'), ' ', t('g12b.res.planRetake'));
    const href = it.type === 'course' ? `#/academy/courses/${it.slug}` : `#/labs/${it.slug}`;
    return h('li', { dataset: { plan: it.type, id: it.id } }, icon(it.type === 'course' ? 'book' : 'flask'), ' ',
      h('a', { href }, L(ctx, it.title)), ' ',
      h('span', { class: 'note' }, '— ', t('g12b.res.planFor', { name: compName(it.competency) || it.competency }),
        it.hours ? ' · ' + hours(ctx, it.hours) : it.minutes ? ' · ' + minutes(ctx, it.minutes) : ''));
  };
  const plan = ins.plan.length ? h('section', { class: 'gx-plan', 'aria-labelledby': 'gx-plan-h', dataset: { windows: ins.plan.map(p => p.window).join(',') } },
    h('h3', { id: 'gx-plan-h' }, t('g12b.res.planTitle')),
    h('p', { class: 'note' }, t('g12b.res.planLede')),
    h('ol', { class: 'gx-planlist' }, ins.plan.map(p => h('li', { dataset: { window: p.window } },
      h('span', { class: 'gx-planwin' }, t('g12b.res.window.' + p.window)),
      h('ul', { class: 'plain' }, p.items.map(planItem)))))) : null;

  const method = h('details', { class: 'gx-method' }, h('summary', null, t('g12b.res.methodTitle')),
    h('ul', null,
      h('li', null, t('g12b.res.m1')),
      a.allow_unknown ? h('li', null, t('g12b.res.m2')) : null,
      h('li', null, t('g12b.res.m3')),
      h('li', null, t('g12b.res.m4', { mastery: i18n.number(MASTERY_THRESHOLD), weak: i18n.number(WEAK_THRESHOLD) })),
      h('li', null, t('g12b.res.m5', { pass: i18n.number(a.scoring.passing_score) })),
      h('li', null, t('g12b.res.m6'))));

  return h('div', { class: 'stack gx-result', dataset: { result: at.id } },
    h('h2', null, isPrevious ? t('p7.asm.previousResult') : t('p7.asm.yourResult')),
    top,
    at.unknown ? h('p', { class: 'note' }, t('p7.asm.unknownSummary', { n: i18n.number(at.unknown) })) : null,
    h('h3', null, t('p7.asm.byCompetency')),
    rows.length ? competencyBars(ctx, rows, { nameOf: compName }) : h('p', { class: 'note' }, t('p7.asm.noEvidenceYet')),
    compTable ? h('details', { class: 'gx-tableview' }, h('summary', null, t('g12b.res.asTable')), compTable) : null,
    method,
    reading, plan,
    /* Phase 13: explain my mistakes — beside the reading and the plan, folded until asked; from the stored rationales only. */
    mistakesBlock(ctx, { attempt: at, questions, compName }),
    h('p', { class: 'note' }, t('p7.asm.evidenceNote')),
    h('details', { open: false }, h('summary', null, t('p7.asm.reviewAnswers')), h('ol', { class: 'plain review' }, review)),
    h('div', { class: 'btnrow no-print' }, linkBtn('#/my?tab=path', t('g12b.res.toPath'), 'primary'), linkBtn('#/recommendations', t('nav.items.recommendations')),
      Button({ label: t('g12b.res.print'), variant: 'quiet', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print-result' } }),
      linkBtn('#/assessments/history', t('assessments.history'), 'quiet')));
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
