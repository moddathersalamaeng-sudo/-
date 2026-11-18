/**
 * Phase 13 — the Learning Coach in My space (#/my?tab=coach&p=weak|ask|scenario|week|interview|about) and the interview
 * practice page (#/coach/interview). No new top-level item: the coach is a My space tab, a folded panel on lesson and course
 * pages and a block on assessment and lab results (src/ui/coach.js).
 *
 * Everything here is composed on the device from approved content and the learner's own records (src/domain/coach.mjs).
 * Every response part carries a visible source label; feedback is practice feedback — never evidence, never a verdict.
 * The optional model adapter appears only when the owner configured an endpoint (D-98) and is used only after an explicit,
 * previewed opt-in.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Tabs, dataRegion, Button, toast } from '../ui/components.js';
import { L, linkBtn, setHashQuery, minutes, pageHead } from '../ui/academy.js';
import { counterStrip, stepRail, numberedCards } from '../ui/guided.js';
import { Figure } from '../ui/figures.js';
import { loadQuestions } from '../data/learner-state.js';
import { loadPassport, roadmapModel } from './passport.js';
import { loadMyAssignments, newId, download } from './company-share.js';
import * as C from '../domain/coach.mjs';
import * as P from '../domain/passport.mjs';
import { tc, renderParts, labelLegend, askBox, loadWeak, sourceLabel } from '../ui/coach.js';
import { resultInsights } from '../domain/guided.mjs';
import { continueList, planToIcs, academyOfCourse, academyOfAssessment, goalAcademy } from '../domain/academies.mjs';
import { percentMap } from '../domain/learner-model.mjs';
import { calculateGaps } from '../domain/recommendations.mjs';

export const COACH_TABS = ['weak', 'ask', 'scenario', 'week', 'interview', 'about'];
const WEAK_SHOWN = 4;
const COUNTS = [3, 5, 7];
const num = (ctx, n) => ctx.i18n.number(n);
const fmtDate = (ctx, s) => (s ? ctx.i18n.date(String(s).slice(0, 10)) : '—');

/* ------------------------------------------------------------------ data */

/** Everything the coach reads: visible content, the learner's own records, weak items, governed coach content, own sessions. */
export async function loadCoach(ctx) {
  const d = await loadPassport(ctx);
  const r = ctx.repos;
  const roles = ctx.session.roles;
  const safe = p => p.catch(() => []);
  const [weak, coachItems, sessions, asg, prefs, customRoles] = await Promise.all([
    loadWeak(ctx, d.learner), safe(r.coach.listVisible(roles)), safe(r.interviewSessions.list()), loadMyAssignments(ctx).catch(() => ({ rows: [] })),
    r.coachPrefs.get('me').catch(() => null), safe(r.companyRoles.list())]);
  const { content, learner } = d;
  const compName = cid => { const c = content.byId(content.competencies, cid); return c ? L(ctx, c.name) : ''; };
  const rm = roadmapModel(ctx, d, null, d.career);
  const academy = learner.profile?.goal ? goalAcademy(learner.profile.goal, learner.profile.target_role) : null;
  return { ...d, weak, scenarios: coachItems.filter(x => x.kind === 'scenario'), bank: coachItems.filter(x => x.kind === 'interview_question'),
    sessions: C.interviewSummary(sessions), asg, prefs: prefs || { id: 'me' }, customRoles: customRoles.filter(x => x?.targets), compName, rm, academy };
}

/** The coaching context of this learner (the permitted fields only). */
function contextOf(ctx, d) {
  const { content, learner } = d;
  const wanted = String(learner.profile?.target_certifications || '');
  const certification = C.findCertification(wanted, content.certifications || []);
  const cont = continueList(content.courses, learner.progress)[0] || null;
  const milestone = d.rm?.rm?.milestones?.find(m => !m.done) || null;
  return C.buildCoachContext({ locale: ctx.i18n.locale, profile: learner.profile, role: d.rm?.role || null, certification, course: cont?.c || null, lesson: cont?.p?.next || null,
    gaps: d.rm?.gaps || [], verifiedLevels: P.verifiedLevels(d.verifications, d.today), weakGroups: d.weak.groups, attempts: learner.attempts, labAttempts: learner.labAttempts,
    assessments: content.assessments, completed: [...(learner.completed || [])], assignments: d.asg.rows || [], compName: cid => content.byId(content.competencies, cid)?.name || null,
    milestone: milestone ? { title: milestone.competencies[0]?.name || null, due: milestone.due } : null });
}

/* ------------------------------------------------------------------ the My space tab */

export function coachPanel(ctx, match) {
  const { t } = ctx;
  const q = match.query || {};
  const initial = Math.max(0, COACH_TABS.indexOf(q.p));
  const region = dataRegion({ t, load: () => loadCoach(ctx), render: d => {
    const go = key => setHashQuery('/my', { tab: 'coach', p: key });
    const tabs = {
      weak: () => weakPanel(ctx, d),
      ask: () => askPanel(ctx, d),
      scenario: () => scenarioPanel(ctx, d, q.c || ''),
      week: () => weekPanel(ctx, d),
      interview: () => interviewDoor(ctx, d, region),
      about: () => aboutPanel(ctx, d)
    };
    const repeated = d.weak.items.filter(x => x.repeated).length;
    return h('div', { class: 'coach', dataset: { coach: 'root', weak: String(d.weak.groups.length), repeated: String(repeated), sessions: String(d.sessions.count) } },
      h('section', { class: 'coach-hero', 'aria-labelledby': 'coach-h' },
        h('h2', { id: 'coach-h' }, icon('spark'), ' ', tc(ctx, 'title')),
        h('p', null, tc(ctx, 'lede')),
        h('p', { class: 'banner banner-info gx-honest', role: 'note', dataset: { coachHonesty: 'true' } }, icon('info'), h('span', null, tc(ctx, 'honesty'))),
        counterStrip(ctx, [[d.weak.groups.length, tc(ctx, 'kpi.weak'), 'target'], [repeated, tc(ctx, 'kpi.repeated'), 'refresh'], [d.sessions.count, tc(ctx, 'kpi.sessions'), 'users']], { label: tc(ctx, 'countsLabel') })),
      Tabs({ label: tc(ctx, 'tabsLabel'), initial: Math.max(0, COACH_TABS.indexOf(region.tab || q.p)), lazy: true,
        tabs: COACH_TABS.map(k => ({ key: 'coach-' + k, label: tc(ctx, 'tabs.' + k), content: tabs[k] })),
        onSelect: i => { region.tab = COACH_TABS[i]; go(COACH_TABS[i]); } }));
  } });
  region.tab = COACH_TABS[initial];
  return region;
}

/* ---------- weak areas: evidence, stored reasoning, two practice questions, the lab that practises it */

function practiceBlock(ctx, d, group) {
  const out = h('div', { class: 'coach-practice', 'aria-live': 'polite', dataset: { practice: group.competency } });
  let round = 0;
  const load = async () => {
    out.replaceChildren(h('p', { class: 'note' }, ctx.t('states.loading')));
    const { content, learner } = d;
    /* Practice comes from the visible readiness checks and quizzes of the academies where this competency was missed. */
    const courseById = id => content.byId(content.courses, id);
    const sources = new Set(group.items.map(it => it.source_id));
    const academies = new Set(content.assessments.filter(a => sources.has(a.id)).map(a => academyOfAssessment(a, courseById)));
    const allowed = C.practicePoolIds(content.assessments.filter(a => academies.has(academyOfAssessment(a, courseById))));
    const pool = await loadQuestions(ctx, allowed).catch(() => []);
    const qs = C.practiceQuestions({ competency: group.competency, pool, attempts: learner.attempts, allowedIds: allowed, seed: `${ctx.session.user.id}:${round++}` });
    out.dataset.questions = String(qs.length);
    if (!qs.length) { out.replaceChildren(renderParts(ctx, [C.makePart({ label: 'platform', kind: 'note', tkey: 'weak.practiceNone' })])); return; }
    out.replaceChildren(h('p', { class: 'note' }, tc(ctx, 'weak.practiceNote')), ...qs.map((q, i) => practiceQuestion(ctx, q, `${group.competency}-${round}-${i}`)));
  };
  return h('div', { class: 'coach-practicewrap' },
    Button({ label: tc(ctx, 'weak.practise'), variant: 'secondary', iconName: 'play', onClick: load, attrs: { 'data-action': 'coach-practise' } }), out);
}

function practiceQuestion(ctx, q, key) {
  const name = 'cp-' + key;
  const fb = h('div', { class: 'coach-out', 'aria-live': 'polite' });
  const err = h('span', { class: 'err', id: name + '-err', 'aria-live': 'polite' });
  const fs = h('fieldset', { class: 'fs coach-pq', dataset: { practiceQuestion: q.id }, 'aria-describedby': name + '-err' }, h('legend', null, L(ctx, q.prompt)),
    h('div', { class: 'coach-opts' }, (q.options || []).map(o => h('label', { class: 'choice' }, h('input', { type: 'radio', name, value: o.id }), ' ', L(ctx, o.text)))), err,
    h('div', { class: 'btnrow' }, Button({ label: tc(ctx, 'weak.check'), variant: 'secondary', attrs: { 'data-action': 'coach-practice-check' }, onClick: () => {
      const v = fs.querySelector('input:checked')?.value;
      if (!v) { err.textContent = tc(ctx, 'weak.choose'); return; }
      err.textContent = '';
      const r = C.practiceFeedback(q, v);
      fs.dataset.correct = String(r.correct);
      fb.replaceChildren(h('p', { class: r.correct ? 'oksum' : 'errsum' }, icon(r.correct ? 'check' : 'alert'), ' ', tc(ctx, r.correct ? 'weak.right' : 'weak.wrong')), renderParts(ctx, C.guardResponse(r.parts).parts));
    } })), fb);
  return fs;
}

function weakCard(ctx, d, g) {
  const { content } = d;
  const qById = new Map(d.weak.questions.map(q => [q.id, q]));
  const topItem = g.items.find(it => it.kind === 'question' && qById.has(it.id)) || null;
  const question = topItem ? qById.get(topItem.id) : null;
  const explain = question ? C.explainWeakItem(topItem, question) : [];
  const lab = (content.labs || []).filter(l => (l.competencies || []).includes(g.competency)).sort((a, b) => (a.minutes || 0) - (b.minutes || 0) || a.id.localeCompare(b.id))[0] || null;
  const courses = content.courses.filter(c => (c.competency_mappings || []).some(m => m.competency === g.competency)).sort((a, b) => (a.level || 9) - (b.level || 9) || a.id.localeCompare(b.id)).slice(0, 2);
  const hasQuestions = g.items.some(it => it.kind === 'question');
  return h('li', { class: 'card coach-weak', dataset: { weak: g.competency, wrong: String(g.wrong), items: String(g.items.length), repeated: String(g.repeated) } },
    h('h3', null, h('span', { class: 'cid' }, g.competency), ' ', d.compName(g.competency) || '', g.repeated ? [' ', h('span', { class: 'badge badge-warn', title: tc(ctx, 'weak.repeatedN', { n: num(ctx, g.repeated) }) }, icon('refresh'), ' ', tc(ctx, 'weak.repeated'))] : null),
    h('p', { class: 'coach-evidence' }, sourceLabel(ctx, 'user'), ' ', tc(ctx, 'weak.evidence', { items: num(ctx, g.items.length), n: num(ctx, g.wrong) }),
      g.repeated ? [' ', tc(ctx, 'weak.repeatedN', { n: num(ctx, g.repeated) }), '.'] : null),
    question && explain.length ? h('details', { class: 'coach-why' }, h('summary', null, tc(ctx, 'weak.explainTitle')),
      h('p', { class: 'coach-mprompt' }, L(ctx, question.prompt)), renderParts(ctx, C.guardResponse(explain).parts)) : null,
    hasQuestions ? practiceBlock(ctx, d, g) : null,
    lab || courses.length ? h('p', { class: 'coach-next' }, sourceLabel(ctx, 'platform'), ' ',
      lab ? [tc(ctx, 'weak.labLine'), ' ', h('a', { href: `#/labs/${lab.slug}`, dataset: { weakLab: lab.id } }, icon('flask'), ' ', L(ctx, lab.title))] : null,
      lab && courses.length ? ' · ' : null,
      courses.length ? [tc(ctx, 'weak.courseLine'), ' ', courses.map((c, i) => [i ? ' · ' : '', h('a', { href: `#/academy/courses/${c.slug}`, dataset: { weakCourse: c.id } }, L(ctx, c.title))])] : null) : null);
}

function weakPanel(ctx, d) {
  const groups = d.weak.groups;
  if (!groups.length) {
    const courseById = id => d.content.byId(d.content.courses, id);
    const check = d.content.assessments.find(a => a.kind === 'readiness' && (!d.academy || academyOfAssessment(a, courseById) === d.academy)) || d.content.assessments.find(a => a.kind === 'readiness');
    return h('section', { class: 'panel feature', 'aria-labelledby': 'cw-e-h', dataset: { empty: 'weak' } },
      h('h3', { id: 'cw-e-h' }, tc(ctx, 'weak.emptyTitle')), h('p', null, tc(ctx, 'weak.emptyBody')),
      h('div', { class: 'btnrow' }, linkBtn(check ? `#/assessments/${check.slug}` : '#/assessments', tc(ctx, 'weak.emptyAsm'), 'primary', { 'data-action': 'coach-take-check' }),
        linkBtn('#/labs', tc(ctx, 'weak.emptyLab'), 'secondary', { 'data-action': 'coach-open-labs' })));
  }
  const list = h('ul', { class: 'plain coach-weaklist' }, groups.slice(0, WEAK_SHOWN).map(g => weakCard(ctx, d, g)));
  const rest = groups.slice(WEAK_SHOWN);
  const more = rest.length ? Button({ label: tc(ctx, 'weak.more', { n: num(ctx, rest.length) }), variant: 'quiet', attrs: { 'data-action': 'coach-weak-more' },
    onClick: e => { list.append(...rest.map(g => weakCard(ctx, d, g))); e.currentTarget.remove(); } }) : null;
  return h('section', { class: 'section', 'aria-labelledby': 'cw-h', dataset: { weakGroups: String(groups.length) } },
    h('h3', { id: 'cw-h' }, tc(ctx, 'weak.title')), h('p', { class: 'note' }, tc(ctx, 'weak.lede')), list, more,
    h('p', { class: 'note' }, tc(ctx, 'practiceOnly')));
}

/* ---------- ask: grounded answers with per-part labels (and the optional model, only when configured) */

function previewValue(ctx, v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(x => previewValue(ctx, x)).join(' · ');
  if (typeof v === 'object' && ('en' in v || 'ar' in v) && Object.keys(v).every(k => k === 'en' || k === 'ar')) return L(ctx, v);
  return Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== '').map(([k, x]) => `${k}: ${previewValue(ctx, x)}`).join(', ');
}

function modelBox(ctx, d, inputId) {
  const cfg = C.adapterConfig(ctx.config);
  if (!cfg) return null;
  const context = contextOf(ctx, d);
  const rows = C.contextPreview(context);
  const out = h('div', { class: 'coach-out', 'aria-live': 'polite', dataset: { coachOut: 'model' } });
  const err = h('span', { class: 'err', id: 'cm-err', 'aria-live': 'polite' });
  const tick = h('input', { type: 'checkbox', id: 'cm-consent', 'aria-describedby': 'cm-err' });
  const send = async () => {
    const question = String(document.getElementById(inputId)?.value || '').trim();
    if (!question) { err.textContent = tc(ctx, 'model.needQuestion'); return; }
    if (!tick.checked) { err.textContent = tc(ctx, 'model.needConsent'); tick.focus(); return; }
    err.textContent = '';
    /* The same guardrails as the grounded coach: a guarded request is refused here and nothing is sent. */
    const kind = C.classifyRequest(question, { certifications: d.content.certifications || [] });
    if (kind.type !== 'general') { out.replaceChildren(renderParts(ctx, C.guardResponse(C.refusalParts(kind.type, { certification: kind.certification })).parts)); out.dataset.sent = 'false'; return; }
    out.replaceChildren(h('p', { class: 'note' }, ctx.t('states.loading')));
    try {
      const payload = C.modelPayload({ context, question, locale: ctx.i18n.locale });
      const res = await C.callModel({ cfg, payload, optIn: tick.checked });
      out.dataset.sent = 'true';
      out.replaceChildren(h('h4', null, tc(ctx, 'model.answerTitle')), renderParts(ctx, res.parts));
    } catch (e) {
      console.warn('[cia] model adapter failed:', e?.code || e?.message);
      out.dataset.sent = 'failed';
      out.replaceChildren(h('p', { class: 'errsum', role: 'alert' }, tc(ctx, 'model.failed')));
    }
  };
  return h('details', { class: 'panel coach-model', dataset: { coachModel: 'available', fields: rows.map(([k]) => k).join(',') } },
    h('summary', null, icon('spark'), ' ', tc(ctx, 'model.title', { name: cfg.name || tc(ctx, 'model.nameDefault') })),
    h('p', null, tc(ctx, 'model.body')),
    h('h4', null, tc(ctx, 'model.previewTitle')),
    rows.length ? h('dl', { class: 'facts coach-preview' }, rows.map(([k, v]) => h('div', { dataset: { field: k } }, h('dt', null, tc(ctx, 'model.field.' + k)), h('dd', null, previewValue(ctx, v))))) : h('p', { class: 'note' }, tc(ctx, 'model.nothing')),
    h('label', { class: 'choice', for: 'cm-consent' }, tick, ' ', tc(ctx, 'model.consent')), err,
    h('div', { class: 'btnrow' }, Button({ label: tc(ctx, 'model.send'), variant: 'secondary', iconName: 'spark', onClick: send, attrs: { 'data-action': 'coach-model-send' } })), out);
}

function askPanel(ctx, d) {
  const cont = continueList(d.content.courses, d.learner.progress)[0]?.c || null;
  return h('section', { class: 'section', 'aria-labelledby': 'ca-h', dataset: { coachAsk: 'true' } },
    h('h3', { id: 'ca-h' }, tc(ctx, 'ask.title')), h('p', { class: 'note' }, tc(ctx, 'ask.body')),
    askBox(ctx, { id: 'coach-ask-main', compName: d.compName, examples: ['ex1', 'ex2', 'ex3'].map(k => tc(ctx, 'ask.' + k)),
      state: async () => ({ content: d.content, learner: d.learner, course: cont, weakGroups: d.weak.groups }) }),
    modelBox(ctx, d, 'coach-ask-main'),
    h('details', { class: 'coach-legendbox' }, h('summary', null, icon('info'), ' ', tc(ctx, 'about.labelsTitle')), labelLegend(ctx)));
}

/* ---------- practice scenario: generated from governed templates, checked against stored criteria */

function scenarioPanel(ctx, d, wanted) {
  if (!d.scenarios.length) return h('section', { class: 'panel feature', 'aria-labelledby': 'cs-e-h', dataset: { empty: 'scenario' } },
    h('h3', { id: 'cs-e-h' }, tc(ctx, 'scenario.emptyTitle')), h('p', null, tc(ctx, 'scenario.emptyBody')),
    h('div', { class: 'btnrow' }, linkBtn('#/labs', tc(ctx, 'weak.emptyLab'), 'primary', { 'data-action': 'coach-open-labs' })));
  const comps = [...new Set(d.scenarios.flatMap(s => s.competencies || []))].sort();
  const sel = h('select', { class: 'select', id: 'cs-comp' }, h('option', { value: '' }, tc(ctx, 'scenario.any')),
    comps.map(c => h('option', { value: c, selected: c === wanted }, `${c} — ${d.compName(c) || c}`)));
  const out = h('div', { class: 'coach-scenario', 'aria-live': 'polite' });
  let n = Number(d.prefs.scenario_n) || 0;
  const make = async () => {
    const seed = `${ctx.session.user.id}:${n++}`;
    d.prefs = { ...d.prefs, id: 'me', scenario_n: n };
    ctx.repos.coachPrefs.save(d.prefs).catch(() => {});
    const sc = C.generateScenario(d.scenarios, { competency: sel.value || d.weak.groups.find(g => comps.includes(g.competency))?.competency || null, academy: d.academy, seed });
    if (!sc) return;
    const fb = h('div', { class: 'coach-out', 'aria-live': 'polite', dataset: { coachOut: 'rubric' } });
    const err = h('span', { class: 'err', id: 'cs-err', 'aria-live': 'polite' });
    const ta = h('textarea', { class: 'textarea', id: 'cs-answer', rows: '6', maxlength: String(C.MAX_ANSWER), 'aria-describedby': 'cs-hint cs-err' });
    const check = () => {
      const res = C.evaluateWithRubric(ta.value, sc.rubric, { avoid: sc.avoid });
      fb.dataset.graded = String(res.graded); fb.dataset.evidence = String(res.evidence);
      if (!res.graded) { err.textContent = tc(ctx, res.reason === 'too_short' ? 'scenario.tooShort' : 'scenario.noRubric'); ta.setAttribute('aria-invalid', 'true'); fb.replaceChildren(); if (res.reason === 'too_short') ta.focus(); return; }
      err.textContent = ''; ta.setAttribute('aria-invalid', 'false');
      fb.dataset.met = String(res.met);
      fb.replaceChildren(h('h4', { tabindex: '-1' }, tc(ctx, 'scenario.resultTitle')),
        h('p', null, sourceLabel(ctx, 'ai'), ' ', tc(ctx, 'scenario.summary', { met: num(ctx, res.met), total: num(ctx, res.total), partial: num(ctx, res.partial) })),
        h('ul', { class: 'plain coach-criteria' }, res.criteria.map(c => {
          const r = sc.rubric.find(x => x.id === c.id);
          return h('li', { class: 'coach-crit is-' + c.level, dataset: { criterion: c.id, level: c.level } },
            h('p', null, h('strong', null, L(ctx, r.criterion)), ' ', h('span', { class: `badge badge-${c.level === 'meets' ? 'ok' : c.level === 'partial' ? 'info' : 'warn'}` }, icon(c.level === 'meets' ? 'check' : c.level === 'partial' ? 'more' : 'alert'), ' ', tc(ctx, 'scenario.level.' + c.level))),
            c.level !== 'meets' ? h('p', { class: 'note' }, h('strong', null, tc(ctx, 'scenario.hint')), ' ', L(ctx, r.hint)) : null);
        })),
        h('p', { class: 'note coach-unc' }, icon('alert'), ' ', tc(ctx, 'scenario.method')),
        h('p', { class: 'note' }, tc(ctx, 'practiceOnly')));
      fb.querySelector('h4')?.focus();
    };
    out.dataset.scenario = sc.template_id; out.dataset.seed = sc.seed;
    out.replaceChildren(h('article', { class: 'card coach-sc', dataset: { label: sc.label } },
      h('p', { class: 'coach-generated', dataset: { generated: 'true' } }, sourceLabel(ctx, 'ai'), ' ', tc(ctx, 'scenario.generated')),
      h('h4', null, L(ctx, sc.title)), h('p', { class: 'coach-sctext' }, L(ctx, sc.text)),
      h('p', null, h('strong', null, tc(ctx, 'scenario.task'), ': '), L(ctx, sc.task)),
      h('details', null, h('summary', null, tc(ctx, 'scenario.criteria'), ' (', num(ctx, sc.rubric.length), ')'), h('ul', null, sc.rubric.map(r => h('li', null, L(ctx, r.criterion))))),
      h('div', { class: 'field' }, h('label', { for: 'cs-answer' }, tc(ctx, 'scenario.answer')), h('span', { class: 'hint note', id: 'cs-hint' }, tc(ctx, 'scenario.answerHint')), ta, err),
      h('div', { class: 'btnrow' }, Button({ label: tc(ctx, 'scenario.check'), variant: 'primary', iconName: 'check', onClick: check, attrs: { 'data-action': 'coach-rubric' } }),
        Button({ label: tc(ctx, 'scenario.another'), variant: 'secondary', iconName: 'refresh', onClick: make, attrs: { 'data-action': 'coach-scenario-next' } })), fb));
  };
  return h('section', { class: 'section', 'aria-labelledby': 'cs-h', dataset: { scenarios: String(d.scenarios.length) } },
    h('h3', { id: 'cs-h' }, tc(ctx, 'scenario.title')), h('p', { class: 'note' }, tc(ctx, 'scenario.lede')),
    h('div', { class: 'coach-scform' }, h('div', { class: 'field' }, h('label', { for: 'cs-comp' }, tc(ctx, 'scenario.competency')), sel),
      Button({ label: tc(ctx, 'scenario.generate'), variant: 'primary', iconName: 'spark', onClick: make, attrs: { 'data-action': 'coach-scenario-new' } })),
    out);
}

/* ---------- plan my week: assignments by due date, the latest 30-day plan, courses in progress, the roadmap */

function weekPanel(ctx, d) {
  const { i18n } = ctx;
  const { content, learner } = d;
  const byId = id => content.byId(content.courses, id);
  const assigned = (d.asg.rows || []).filter(r => r.item.type === 'course' && r.due_state !== 'completed').map(r => ({ course: byId(r.item.target_id), due: r.item.due })).filter(x => x.course);
  const last = [...learner.attempts].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0] || null;
  const lastAsm = last ? content.byId(content.assessments, last.assessment_id) : null;
  const ins = last && lastAsm ? resultInsights(last, { courses: content.courses, labs: content.labs || [], completedIds: [...(learner.completed || [])], assessmentSlug: lastAsm.slug,
    academy: academyOfAssessment(lastAsm, byId), academyOfCourse }) : null;
  const planCourses = (ins?.plan.find(p => p.window === '30')?.items || []).filter(x => x.type === 'course').map(x => byId(x.id)).filter(Boolean);
  const inProgress = continueList(content.courses, learner.progress).map(x => x.c);
  const milestone = d.rm?.rm?.milestones?.find(m => !m.done) || null;
  const milestoneCourses = (milestone?.actions || []).filter(a => a.type === 'course').map(a => byId(a.id)).filter(Boolean);
  const hours = Number(d.studyPlan?.weekly_hours || learner.profile?.weekly_hours) || 4;
  const plan = C.planMyWeek({ assigned, planCourses, inProgress, milestoneCourses, progress: learner.progress, weeklyHours: hours, days: d.studyPlan?.days || ['SU', 'TU', 'TH'],
    time: d.studyPlan?.time || '19:00', start: new Date(), weakGroups: d.weak.groups });
  if (!plan.courses.length || !plan.sessions.length) return h('section', { class: 'panel feature', 'aria-labelledby': 'ck-e-h', dataset: { empty: 'week' } },
    h('h3', { id: 'ck-e-h' }, tc(ctx, 'week.noneTitle')), h('p', null, tc(ctx, 'week.noneBody')),
    h('div', { class: 'btnrow' }, linkBtn('#/academy/courses', tc(ctx, 'week.noneCta'), 'primary', { 'data-action': 'coach-choose-course' }), linkBtn('#/assessments', tc(ctx, 'weak.emptyAsm'), 'secondary')));
  const dl = () => {
    const ics = planToIcs(C.planForIcs(plan, { compName: d.compName }), { lang: i18n.locale, baseUrl: location.href.split('#')[0] + '#/my?tab=coach&p=week', uidSeed: ctx.session.user.id + ':coach' });
    download('cia-coach-week.ics', ics, 'text/calendar;charset=utf-8');
    toast(tc(ctx, 'week.downloaded'));
  };
  return h('section', { class: 'section', 'aria-labelledby': 'ck-h', dataset: { week: 'plan', sessions: String(plan.sessions.length), sources: plan.sources.map(s => s.kind).join(','), reviews: String(plan.reviews) } },
    h('h3', { id: 'ck-h' }, icon('calendar'), ' ', tc(ctx, 'week.title')), h('p', { class: 'note' }, tc(ctx, 'week.lede')),
    counterStrip(ctx, [[plan.sessions.length, tc(ctx, 'week.c.sessions'), 'calendar'], [hours, tc(ctx, 'week.c.hours'), 'clock'], [plan.reviews, tc(ctx, 'week.c.reviews'), 'target']]),
    h('p', null, tc(ctx, 'week.summary', { n: num(ctx, plan.sessions.length), weeks: num(ctx, plan.weeks), mins: minutes(ctx, plan.sessionMinutes) })),
    h('h4', null, tc(ctx, 'week.why')),
    h('ol', { class: 'coach-sources' }, plan.sources.map(s => { const c = byId(s.course_id); return h('li', { dataset: { source: s.kind, course: s.course_id } },
      h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)), ' ', h('span', { class: `badge badge-${s.kind === 'assignment' ? 'warn' : 'neutral'}` }, sourceLabelText(ctx, s.kind)),
      s.due ? [' ', h('span', { class: 'note' }, tc(ctx, 'week.due', { date: fmtDate(ctx, s.due) }))] : null); })),
    h('ol', { class: 'plan-list coach-week' }, plan.sessions.slice(0, 6).map(s => h('li', { dataset: { session: s.date } }, h('strong', null, i18n.date(s.date, { weekday: 'long', day: 'numeric', month: 'long' })), ' · ', h('bdi', { dir: 'ltr' }, s.time), ' · ', minutes(ctx, s.minutes), ' — ',
      s.items.map((x, j) => [j ? ' · ' : '', L(ctx, x.lesson.title)]),
      s.review ? h('span', { class: 'coach-reviewline', dataset: { review: s.review.competency } }, ' · ', icon('target'), ' ', tc(ctx, 'week.review', { competency: d.compName(s.review.competency) || s.review.competency, mins: minutes(ctx, s.review.minutes) })) : null))),
    plan.sessions.length > 6 ? h('p', { class: 'note' }, tc(ctx, 'week.more', { n: num(ctx, plan.sessions.length - 6) })) : null,
    plan.unplanned ? h('p', { class: 'note' }, tc(ctx, 'week.unplanned', { n: num(ctx, plan.unplanned) })) : null,
    h('div', { class: 'btnrow' }, Button({ label: tc(ctx, 'week.download'), variant: 'primary', iconName: 'download', onClick: dl, attrs: { 'data-action': 'coach-week-ics' } }),
      linkBtn('#/my?tab=path', tc(ctx, 'week.settings'), 'secondary', { 'data-action': 'coach-week-settings' })));
}
const sourceLabelText = (ctx, kind) => tc(ctx, 'week.source.' + kind);

/* ---------- interview practice: the door inside the coach tab */

function sessionList(ctx, d, onChange) {
  const xs = d.sessions.sessions;
  if (!xs.length) return h('p', { class: 'note', dataset: { sessions: '0' } }, tc(ctx, 'interview.sessionsEmpty'));
  return h('ul', { class: 'plain coach-sessions', dataset: { sessions: String(xs.length) } }, xs.map(s => h('li', { dataset: { session: s.id } },
    h('a', { href: `#/coach/interview?s=${encodeURIComponent(s.id)}` }, tc(ctx, 'interview.sessionLine', { role: L(ctx, s.role_name) || s.role_id, date: fmtDate(ctx, s.created_at), n: num(ctx, s.items.length) })), ' ',
    Button({ label: tc(ctx, 'interview.delete'), variant: 'quiet', attrs: { 'data-action': 'delete-session', 'aria-label': tc(ctx, 'interview.deleteNamed', { date: fmtDate(ctx, s.created_at) }) },
      onClick: async () => { await ctx.repos.interviewSessions.remove(s.id); toast(tc(ctx, 'interview.deleted')); onChange(); } }))));
}

function interviewDoor(ctx, d, region) {
  const figs = d.figsFor('coach:interview');
  return h('section', { class: 'section', 'aria-labelledby': 'ci-h', dataset: { coachInterview: 'door' } },
    h('h3', { id: 'ci-h' }, icon('users'), ' ', tc(ctx, 'interview.title')), h('p', null, tc(ctx, 'interview.lede')),
    h('p', { class: 'banner banner-info', role: 'note' }, tc(ctx, 'interview.honesty')),
    h('div', { class: 'btnrow' }, linkBtn('#/coach/interview', tc(ctx, 'interview.start'), 'primary', { 'data-action': 'open-interview' })),
    h('h4', null, tc(ctx, 'interview.sessions')), sessionList(ctx, d, () => region.refresh()),
    h('p', { class: 'note' }, tc(ctx, 'interview.passportNote')), figs.map(f => Figure(ctx, f)));
}

/* ---------- how it works */

function aboutPanel(ctx, d) {
  const cfg = C.adapterConfig(ctx.config);
  const figs = [...d.figsFor('coach:main'), ...d.figsFor('coach:labels')];
  return h('section', { class: 'section', 'aria-labelledby': 'cb-h', dataset: { coachAbout: 'true', adapter: cfg ? 'on' : 'off' } },
    h('h3', { id: 'cb-h' }, tc(ctx, 'about.title')),
    numberedCards(ctx, ['how1', 'how2', 'how3', 'how4'].map(k => tc(ctx, 'about.' + k))),
    h('h4', null, tc(ctx, 'about.labelsTitle')), labelLegend(ctx),
    h('h4', null, tc(ctx, 'about.rulesTitle')), h('ul', null, ['rule1', 'rule2', 'rule3', 'rule4'].map(k => h('li', null, tc(ctx, 'about.' + k)))),
    h('h4', null, tc(ctx, 'about.privacyTitle')), h('p', { dataset: { coachPrivacy: cfg ? 'adapter' : 'device' } }, tc(ctx, 'about.privacy'), cfg ? [' ', tc(ctx, 'model.body')] : null),
    h('h4', null, tc(ctx, 'about.limitsTitle')), h('ul', null, ['limit1', 'limit2', 'limit3'].map(k => h('li', null, tc(ctx, 'about.' + k)))),
    figs.map(f => Figure(ctx, f)));
}

/* ------------------------------------------------------------------ interview practice page (#/coach/interview) */

const promptOf = (ctx, q) => (q.prompt ? L(ctx, q.prompt) : tc(ctx, q.prompt_key, { name: L(ctx, q.params?.name) }));
const followOf = (ctx, q) => (q.follow_up ? L(ctx, q.follow_up) : tc(ctx, q.follow_up_key));
const wordsIn = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;

function resolveQuestion(d, row) {
  const comp = d.content.byId(d.content.competencies, row.competency);
  return d.bank.find(q => q.id === row.question_id) || (comp ? C.fallbackInterviewQuestion(comp) : null);
}

function interviewResult(ctx, d, session, { fresh = false, onAgain }) {
  const { content } = d;
  const dims = h('ul', { class: 'coach-dims', 'aria-label': tc(ctx, 'interview.dimLabel') }, C.INTERVIEW_DIMENSIONS.map(k => h('li', { dataset: { dim: k, value: String(session.totals[k]) } },
    h('span', { class: 'coach-dimname' }, h('strong', null, tc(ctx, 'interview.dim.' + k)), h('span', { class: 'note' }, tc(ctx, 'interview.dimHint.' + k))),
    h('span', { class: 'gx-bartrack', 'aria-hidden': 'true' }, h('span', { class: 'gx-barfill', style: { inlineSize: Math.max(2, session.totals[k]) + '%' } })),
    h('span', { class: 'coach-dimval' }, num(ctx, session.totals[k]) + '%'))));
  const items = session.items.map((row, i) => {
    const q = resolveQuestion(d, row);
    const pts = q?.key_points || [];
    const parts = [C.makePart({ label: 'user', lead: 'yourAnswer', text: row.answer || '—' })];
    if (row.follow_up_answer) parts.push(C.makePart({ label: 'user', lead: 'yourAnswer', text: row.follow_up_answer }));
    const cov = row.scores.covered.map(j => pts[j]?.t).filter(Boolean), mis = row.scores.missed.map(j => pts[j]?.t).filter(Boolean);
    if (cov.length) parts.push(C.makePart({ label: 'platform', kind: 'list', lead: 'covered', items: cov }));
    if (mis.length) parts.push(C.makePart({ label: 'platform', kind: 'list', lead: 'missed', items: mis }));
    return h('li', { class: 'coach-iitem', dataset: { item: row.question_id, knowledge: String(row.scores.knowledge) } },
      h('details', { open: i === 0 }, h('summary', null, h('span', { class: 'cid' }, row.competency), ' ', q ? promptOf(ctx, q) : d.compName(row.competency)),
        renderParts(ctx, C.guardResponse(parts).parts),
        h('p', { class: 'note' }, C.INTERVIEW_DIMENSIONS.map((k, j) => [j ? ' · ' : '', tc(ctx, 'interview.dim.' + k), ' ', h('bdi', { dir: 'ltr' }, `${row.scores[k]}/3`)]))));
  });
  const weak = session.weak_topics.map(cid => {
    const lab = (content.labs || []).find(l => (l.competencies || []).includes(cid));
    const course = content.courses.filter(c => (c.competency_mappings || []).some(m => m.competency === cid)).sort((a, b) => (a.level || 9) - (b.level || 9) || a.id.localeCompare(b.id))[0];
    return h('li', { dataset: { weakTopic: cid } }, h('span', { class: 'cid' }, cid), ' ', d.compName(cid) || '',
      course || lab ? [' — ', tc(ctx, 'interview.suggested'), ' ', course ? h('a', { href: `#/academy/courses/${course.slug}` }, L(ctx, course.title)) : null, course && lab ? ' · ' : null,
        lab ? h('a', { href: `#/labs/${lab.slug}` }, icon('flask'), ' ', L(ctx, lab.title)) : null] : null);
  });
  return h('div', { class: 'coach-iresult', dataset: { interviewResult: session.id, status: session.status, evidence: String(session.evidence), items: String(session.items.length) } },
    h('h2', { tabindex: '-1', class: 'coach-ires-h' }, icon('chart'), ' ', tc(ctx, 'interview.resultTitle')),
    h('p', { class: 'note' }, tc(ctx, 'interview.sessionLine', { role: L(ctx, session.role_name) || session.role_id, date: fmtDate(ctx, session.created_at), n: num(ctx, session.items.length) })),
    h('p', { class: 'banner banner-info', role: 'note', dataset: { noVerdict: 'true' } }, tc(ctx, 'interview.honesty')),
    fresh ? h('p', { class: 'oksum', role: 'status' }, tc(ctx, 'interview.saved'), ' ', tc(ctx, 'interview.toPassport')) : null,
    dims,
    h('p', { class: 'note coach-unc' }, sourceLabel(ctx, 'ai'), ' ', tc(ctx, 'interview.method')),
    h('h3', null, tc(ctx, 'interview.weakTopics')), weak.length ? h('ul', { class: 'coach-topics' }, weak) : h('p', { class: 'note' }, tc(ctx, 'interview.weakNone')),
    h('h3', null, tc(ctx, 'interview.stepsLabel')), h('ol', { class: 'plain coach-iitems' }, items),
    h('p', { class: 'note' }, tc(ctx, 'practiceOnly')),
    h('div', { class: 'btnrow no-print' }, Button({ label: tc(ctx, 'interview.again'), variant: 'primary', onClick: onAgain, attrs: { 'data-action': 'interview-again' } }),
      linkBtn('#/my?tab=coach&p=interview', tc(ctx, 'interview.toCoach'), 'secondary'), linkBtn('#/my?tab=passport', ctx.t('pp12.title'), 'quiet')));
}

export function interviewView(ctx, match) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: tc(ctx, 'interview.eyebrow'), title: tc(ctx, 'interview.title'), lede: tc(ctx, 'interview.lede') });
  const region = dataRegion({ t, load: () => loadCoach(ctx), render: d => {
    const work = h('div', { class: 'coach-iwork' });
    const { content, learner } = d;
    const ciaRoles = content.roles || [];
    const allRoles = [...ciaRoles, ...d.customRoles.map(r => ({ ...r, custom: true }))];
    const showSetup = () => {
      setHashQuery('/coach/interview', {});
      if (!allRoles.length) { work.replaceChildren(h('p', { class: 'note', dataset: { empty: 'roles' } }, tc(ctx, 'interview.noRoles'), ' ', h('a', { href: '#/my?tab=coach' }, tc(ctx, 'interview.toCoach')))); return; }
      const opt = r => h('option', { value: r.id, selected: r.id === learner.profile?.target_role }, L(ctx, r.name));
      const roleSel = h('select', { class: 'select', id: 'ci-role', 'aria-describedby': 'ci-role-hint' },
        d.customRoles.length ? [h('optgroup', { label: tc(ctx, 'interview.ciaRoles') }, ciaRoles.map(opt)), h('optgroup', { label: tc(ctx, 'interview.customRoles') }, d.customRoles.map(opt))] : ciaRoles.map(opt));
      const countSel = h('select', { class: 'select select-sm', id: 'ci-count' }, COUNTS.map(n => h('option', { value: String(n), selected: n === C.INTERVIEW_DEFAULT_COUNT }, num(ctx, n))));
      const start = () => {
        const role = allRoles.find(r => r.id === roleSel.value);
        if (!role) return;
        const gaps = calculateGaps({ role, competencies: content.competencies, selfLevels: learner.selfLevels, assessmentByCompetency: percentMap(learner.evidence), verifiedLevels: P.verifiedLevels(d.verifications, d.today) });
        const qs = C.interviewQuestionsFor(role, d.bank, { competencies: content.competencies, gaps, weak: d.weak.groups.map(g => g.competency), count: Number(countSel.value) });
        if (qs.length) showSession(role, qs);
      };
      work.replaceChildren(h('section', { class: 'panel feature gx-intro', 'aria-labelledby': 'ci-s-h', dataset: { interview: 'setup', roles: String(allRoles.length), bank: String(d.bank.length) } },
        h('h2', { id: 'ci-s-h' }, icon('users'), ' ', tc(ctx, 'interview.start')),
        h('p', { class: 'banner banner-info gx-honest', role: 'note', dataset: { noVerdict: 'true' } }, icon('info'), h('span', null, tc(ctx, 'interview.honesty'))),
        h('div', { class: 'formgrid' },
          h('div', { class: 'field' }, h('label', { for: 'ci-role' }, tc(ctx, 'interview.role')), h('span', { class: 'hint note', id: 'ci-role-hint' }, tc(ctx, 'interview.roleHint')), roleSel),
          h('div', { class: 'field' }, h('label', { for: 'ci-count' }, tc(ctx, 'interview.count')), countSel)),
        h('div', { class: 'btnrow' }, Button({ label: tc(ctx, 'interview.start'), variant: 'primary', iconName: 'play', onClick: start, attrs: { 'data-action': 'interview-start' } }))),
        h('section', { class: 'section', 'aria-labelledby': 'ci-l-h' }, h('h2', { id: 'ci-l-h' }, tc(ctx, 'interview.sessions')), sessionList(ctx, d, () => region.refresh()),
          h('p', { class: 'note' }, tc(ctx, 'interview.passportNote'))),
        d.figsFor('coach:interview').map(f => Figure(ctx, f)));
    };
    const showSession = (role, qs) => {
      const answers = qs.map(() => ({ answer: '', follow_up_answer: '' }));
      let k = 0;
      const paint = (focus = true) => {
        const q = qs[k];
        const err = h('span', { class: 'err', id: 'ci-err', 'aria-live': 'polite' });
        const ta = h('textarea', { class: 'textarea', id: 'ci-answer', rows: '7', maxlength: String(C.MAX_ANSWER), 'aria-describedby': 'ci-hint ci-err' }, answers[k].answer);
        const fu = q.ask_follow_up ? h('textarea', { class: 'textarea', id: 'ci-follow', rows: '4', maxlength: String(C.MAX_ANSWER) }, answers[k].follow_up_answer) : null;
        const keep = () => { answers[k] = { answer: ta.value, follow_up_answer: fu ? fu.value : '' }; };
        const ok = () => { keep(); if (wordsIn(ta.value) < C.MIN_ANSWER_WORDS) { err.textContent = tc(ctx, 'interview.errShort'); ta.setAttribute('aria-invalid', 'true'); ta.focus(); return false; } return true; };
        const finish = async () => {
          if (!ok()) return;
          const session = C.makeInterviewSession({ id: newId('INT'), role, items: qs.map((question, i) => ({ question, ...answers[i] })), lang: ctx.i18n.locale });
          await ctx.repos.interviewSessions.save(session);
          d.sessions = C.interviewSummary([...d.sessions.sessions, session]);
          showResult(session, true);
        };
        const rail = stepRail(ctx, qs.map((x, i) => ({ label: x.competency, state: i === k ? 'current' : i < k ? 'done' : 'todo', visited: !!answers[i].answer })), { label: tc(ctx, 'interview.stepsLabel'), onGo: i => { keep(); k = i; paint(); } });
        const title = h('h2', { class: 'gx-stagetitle', tabindex: '-1' }, tc(ctx, 'interview.q', { n: num(ctx, k + 1), total: num(ctx, qs.length) }));
        work.replaceChildren(h('div', { class: 'coach-isession', dataset: { interview: 'session', question: q.id, index: String(k), total: String(qs.length), followUp: String(!!q.ask_follow_up), generated: String(!!q.generated) } },
          h('div', { class: 'gx-railbox' }, rail), title,
          h('article', { class: 'card coach-iq' },
            h('p', { class: 'note' }, h('span', { class: 'cid' }, q.competency), ' ', d.compName(q.competency) || '', q.generated ? [' · ', h('span', { class: 'badge badge-neutral' }, tc(ctx, 'interview.generatedQ'))] : null),
            h('p', { class: 'coach-iprompt' }, promptOf(ctx, q)),
            h('div', { class: 'field' }, h('label', { for: 'ci-answer' }, tc(ctx, 'interview.answer')), h('span', { class: 'hint note', id: 'ci-hint' }, tc(ctx, 'interview.answerHint')), ta, err),
            fu ? h('div', { class: 'coach-follow', dataset: { followUp: 'true' } }, h('p', null, h('strong', null, tc(ctx, 'interview.followUp'), ': '), followOf(ctx, q)), h('p', { class: 'note' }, tc(ctx, 'interview.followUpWhy')),
              h('div', { class: 'field' }, h('label', { for: 'ci-follow' }, tc(ctx, 'interview.followUpAnswer')), fu)) : null),
          h('div', { class: 'btnrow' }, k > 0 ? Button({ label: tc(ctx, 'interview.back'), variant: 'secondary', onClick: () => { keep(); k--; paint(); }, attrs: { 'data-action': 'interview-back' } }) : null,
            k < qs.length - 1 ? Button({ label: tc(ctx, 'interview.next'), variant: 'primary', onClick: () => { if (ok()) { k++; paint(); } }, attrs: { 'data-action': 'interview-next' } })
              : Button({ label: tc(ctx, 'interview.finish'), variant: 'primary', iconName: 'check', onClick: finish, attrs: { 'data-action': 'interview-finish' } }))));
        if (focus) title.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      };
      paint();
    };
    const showResult = (session, fresh = false) => {
      setHashQuery('/coach/interview', { s: session.id });
      work.replaceChildren(interviewResult(ctx, d, session, { fresh, onAgain: showSetup }));
      work.querySelector('.coach-ires-h')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    const saved = match.query?.s ? d.sessions.sessions.find(s => s.id === match.query.s) : null;
    if (saved) showResult(saved); else showSetup();
    return h('div', { class: 'coach-interview' }, work);
  } });
  return h('div', { class: 'coach-page' }, head, region);
}
