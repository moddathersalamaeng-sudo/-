/**
 * My space (Phase 10A, plan §3.1) — #/my?tab=progress|path|recommendations|competencies|profile
 * One dashboard instead of five pages (My Learning, Profile, My competencies, Recommendations, Learning path; the old
 * addresses redirect here). A newcomer is offered the 60-second onboarding and a first course in every tab — never an
 * empty dead end. Everything is read from and saved to this device only (cia:v1:*).
 */
import { h, icon } from '../core/dom.js';
import { Tabs, dataRegion, ProgressBar, Button, toast } from '../ui/components.js';
import { loadLight } from '../data/learner-state.js';
import { L, linkBtn, setHashQuery, minutes, pageHead } from '../ui/academy.js';
import { embed } from '../ui/bookmark.js';
import { continueList, dashboardSummary, cardProgress, ACADEMIES, goalAcademy, academyByKey, weeklyPlan, planToIcs, WEEKDAYS } from '../domain/academies.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { starterCourse, lessonHref, progressLine } from './home.js';
import { profileView, myCompetenciesView } from './profile.js';
import { recommendationsView, learningPathView } from './recommendations.js';

export const MY_TABS = ['progress', 'path', 'recommendations', 'competencies', 'profile'];

function onboardingCard(ctx) {
  const { t } = ctx;
  return h('section', { class: 'panel feature ob-cta', 'aria-labelledby': 'obc-h', dataset: { onboarding: 'cta' } },
    h('h2', { id: 'obc-h' }, icon('compass'), ' ', t('x10a.my.obTitle')), h('p', null, t('x10a.my.obBody')),
    h('div', { class: 'btnrow' }, linkBtn('#/welcome', t('x10a.my.obCta'), 'primary', { 'data-action': 'start-onboarding' })));
}

/** First courses to open: the learner's goal academy first, then the others. */
function starters(ctx, content, learner) {
  const { t } = ctx;
  const first = learner.profile?.goal ? goalAcademy(learner.profile.goal, learner.profile.target_role) : null;
  const keys = [...ACADEMIES.map(a => a.key)].sort((a, b) => (b === first) - (a === first));
  const cs = keys.map(k => ({ k, c: starterCourse(content.courses, k) })).filter(x => x.c);
  return h('section', { class: 'section', 'aria-labelledby': 'st-h', dataset: { starters: String(cs.length) } },
    h('h2', { id: 'st-h' }, t('x10a.my.startHere')), h('p', { class: 'note' }, t('x10a.my.startHereBody')),
    h('ul', { class: 'cont-list' }, cs.map(({ k, c }) => {
      const l = c.modules?.[0]?.lessons?.[0];
      return h('li', { class: ['card', 'cont-card', k === first && 'card-current'], dataset: { course: c.id } }, h('p', { class: 'eyebrow' }, t('nav.items.' + academyByKey(k).navId)),
        h('h3', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))), h('p', { class: 'note' }, progressLine(ctx, cardProgress(c, learner.progress))),
        l ? linkBtn(lessonHref(c, l), t('x10a.home.startLesson'), 'primary', { 'data-action': 'start-lesson' }) : null);
    })));
}

function progressTab(ctx) {
  const { t, i18n } = ctx;
  const r = dataRegion({ t, load: async () => ({ ...(await loadLight(ctx)), favs: await ctx.repos.libraryFavorites.list().catch(() => []), library: await ctx.repos.library.listVisible(ctx.session.roles).catch(() => []) }), render: ({ content, learner, favs, library }) => {
    const s = dashboardSummary(content.courses, learner.progress, learner.attempts, learner.bookmarks);
    const stats = h('ul', { class: 'stats my-stats', 'aria-label': t('x10a.my.statsLabel') },
      [['play', s.inProgress, 'inProgress'], ['check', s.finished, 'finished'], ['book', s.lessons, 'lessons'], ['clock', Math.round(s.minutes), 'minutes'], ['award', s.passed, 'passed'], ['bookmark', s.bookmarks + favs.length, 'saved']]
        .map(([ic, v, k]) => h('li', { class: 'stat', dataset: { stat: k } }, icon(ic), h('strong', null, i18n.number(v)), h('span', null, t('x10a.my.stat.' + k)))));
    const cont = continueList(content.courses, learner.progress);
    const done = content.courses.filter(c => courseStatus(c, learner.progress, learner.attempts).state === 'completed');
    const contSec = cont.length ? h('section', { class: 'section', 'aria-labelledby': 'mc-h', dataset: { continue: String(cont.length) } }, h('h2', { id: 'mc-h' }, t('x10a.home.continue')),
      h('ul', { class: 'cont-list' }, cont.map(({ c, p }) => h('li', { class: 'card cont-card', dataset: { course: c.id } },
        h('h3', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))),
        ProgressBar({ value: p.done, max: p.total, label: t('courses.progress'), valueText: progressLine(ctx, p) }),
        p.next ? linkBtn(lessonHref(c, p.next), t('p7.course.continue'), 'primary', { 'data-action': 'continue-lesson' }) : null)))) : starters(ctx, content, learner);
    const doneSec = done.length ? h('section', { class: 'section', 'aria-labelledby': 'md-h' }, h('h2', { id: 'md-h' }, t('me.tabs.completed')),
      h('ul', { class: 'plain' }, done.map(c => h('li', null, icon('check'), ' ', h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))))), h('p', { class: 'note' }, t('p7.readingNotCert'))) : null;
    const libs = favs.map(f => library.find(x => x.id === f.id)).filter(Boolean);
    const saved = h('section', { class: 'section', 'aria-labelledby': 'ms-h', id: 'saved', dataset: { saved: String(learner.bookmarks.length + libs.length) } }, h('h2', { id: 'ms-h' }, icon('bookmark'), ' ', t('x10a.my.saved')),
      learner.bookmarks.length || libs.length ? h('ul', { class: 'plain bm-list' },
        [...learner.bookmarks].sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at))).map(b => h('li', { dataset: { bookmark: b.id } },
          h('span', { class: 'badge badge-neutral' }, t('x10a.bm.type.' + b.type)), ' ', h('a', { href: b.href }, L(ctx, b.title) || b.target_id), ' ',
          Button({ label: t('x10a.bm.remove'), variant: 'quiet', attrs: { 'data-action': 'remove-bookmark', 'aria-label': t('x10a.bm.removeNamed', { name: L(ctx, b.title) || b.target_id }) },
            onClick: async () => { await ctx.repos.bookmarks.remove(b.id); toast(t('x10a.bm.removed')); r.refresh(); } }))),
        libs.map(x => h('li', null, h('span', { class: 'badge badge-neutral' }, t('x10a.bm.type.template')), ' ', h('a', { href: `#/library/${x.id}` }, L(ctx, x.title)))))
        : h('p', { class: 'note' }, t('x10a.my.savedEmpty')));
    return h('div', null, stats, contSec, doneSec, saved,
      h('p', null, h('a', { href: '#/assessments/history' }, icon('chart'), ' ', t('assessments.history'))),
      h('p', { class: 'note' }, t('me.storageNote')));
  } });
  return r;
}

/* ------------------------------------------------------------------ weekly study plan (.ics) */

function planPanel(ctx) {
  const { t, i18n } = ctx;
  return dataRegion({ t, load: async () => ({ ...(await loadLight(ctx)), saved: await ctx.repos.studyPlan.get('me').catch(() => null) }), render: ({ content, learner, saved }) => {
    const inProg = continueList(content.courses, learner.progress).map(x => x.c);
    const goalKey = learner.profile?.goal ? goalAcademy(learner.profile.goal, learner.profile.target_role) : 'iso';
    const courses = inProg.length ? inProg.slice(0, 3) : [starterCourse(content.courses, goalKey)].filter(Boolean);
    const st = { days: saved?.days || ['SU', 'TU', 'TH'], time: saved?.time || '19:00', hours: saved?.weekly_hours || learner.profile?.weekly_hours || '4' };
    const out = h('div', { class: 'plan-out', 'aria-live': 'polite' });
    const err = h('p', { class: 'err', id: 'sp-err', 'aria-live': 'polite' });
    const dayNames = WEEKDAYS.map((_, k) => i18n.date(new Date(Date.UTC(2023, 0, 1 + k)), { weekday: 'long', timeZone: 'UTC' })); /* 1 Jan 2023 was a Sunday */
    const hoursIn = h('input', { class: 'input input-short', id: 'sp-hours', type: 'number', min: '1', max: '40', inputmode: 'numeric', value: st.hours, 'aria-describedby': 'sp-err' });
    const timeIn = h('input', { class: 'input input-short', id: 'sp-time', type: 'time', value: st.time });
    const days = h('fieldset', { class: 'fs days-pick' }, h('legend', null, t('x10a.plan.days')), WEEKDAYS.map((d, i) => h('label', { class: 'choice' },
      h('input', { type: 'checkbox', name: 'sp-day', value: d, checked: st.days.includes(d) }), dayNames[i])));
    const read = () => ({ days: [...days.querySelectorAll('input:checked')].map(x => x.value), time: timeIn.value || '19:00', hours: hoursIn.value });
    const valid = v => { const n = Number(v.hours); if (!v.days.length) return 'days'; if (!/^\d{1,2}$/.test(String(v.hours)) || n < 1 || n > 40) return 'hours'; return ''; };
    let plan = null;
    const paint = () => {
      const v = read(); const bad = valid(v);
      err.textContent = bad ? t('x10a.plan.err.' + bad) : '';
      hoursIn.setAttribute('aria-invalid', bad === 'hours' ? 'true' : 'false');
      if (bad) { plan = null; out.replaceChildren(); return; }
      plan = weeklyPlan({ courses, progress: learner.progress, weeklyHours: Number(v.hours), days: v.days, time: v.time, start: new Date() });
      out.replaceChildren(
        h('p', { dataset: { sessions: String(plan.sessions.length) } }, t('x10a.plan.summary', { n: i18n.number(plan.sessions.length), weeks: i18n.number(plan.weeks), mins: minutes(ctx, plan.sessionMinutes) })),
        plan.unplanned ? h('p', { class: 'note' }, t('x10a.plan.unplanned', { n: i18n.number(plan.unplanned) })) : null,
        h('ol', { class: 'plan-list' }, plan.sessions.slice(0, 6).map(s => h('li', null, h('strong', null, i18n.date(s.date, { weekday: 'long', day: 'numeric', month: 'long' })), ' · ', h('bdi', { dir: 'ltr' }, s.time), ' · ', minutes(ctx, s.minutes), ' — ',
          s.items.map((x, j) => [j ? ' · ' : '', L(ctx, x.lesson.title)])))),
        plan.sessions.length > 6 ? h('p', { class: 'note' }, t('x10a.plan.more', { n: i18n.number(plan.sessions.length - 6) })) : null);
    };
    [hoursIn, timeIn].forEach(el => el.addEventListener('input', paint)); days.addEventListener('change', paint);
    const save = async () => { const v = read(); if (valid(v)) { paint(); hoursIn.focus(); return; } await ctx.repos.studyPlan.save({ id: 'me', days: v.days, time: v.time, weekly_hours: String(Number(v.hours)), updated_at: new Date().toISOString() }); toast(t('x10a.plan.saved')); };
    const download = () => {
      if (!plan || !plan.sessions.length) { paint(); return; }
      const ics = planToIcs(plan, { lang: i18n.locale, baseUrl: location.href.split('#')[0] + '#/my?tab=path', uidSeed: ctx.session.user.id });
      const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })), download: 'cia-study-plan.ics' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(t('x10a.plan.downloaded'));
    };
    paint();
    return h('section', { class: 'panel feature study-plan', 'aria-labelledby': 'sp-h', dataset: { plan: 'weekly' } },
      h('h2', { id: 'sp-h' }, icon('calendar'), ' ', t('x10a.plan.title')),
      h('p', null, t('x10a.plan.body', { courses: courses.map(c => L(ctx, c.title)).join(' · ') || '—' })),
      h('div', { class: 'formgrid' },
        h('div', { class: 'field' }, h('label', { for: 'sp-hours' }, t('x10a.welcome.hoursLabel')), hoursIn),
        h('div', { class: 'field' }, h('label', { for: 'sp-time' }, t('x10a.plan.time')), timeIn)),
      days, err, out,
      h('div', { class: 'btnrow' }, Button({ label: t('x10a.plan.save'), variant: 'secondary', onClick: save, attrs: { 'data-action': 'save-plan' } }),
        Button({ label: t('x10a.plan.ics'), variant: 'primary', iconName: 'download', onClick: download, attrs: { 'data-action': 'download-ics' } })),
      h('p', { class: 'note' }, t('x10a.plan.note')));
  } });
}

/* ------------------------------------------------------------------ page */

export function mySpaceView(ctx, match) {
  const { t } = ctx;
  const q = match.query || {};
  const initial = Math.max(0, MY_TABS.indexOf(q.tab));
  const head = pageHead(ctx, { eyebrow: t('x10a.my.eyebrow'), title: t('nav.items.mySpace'), lede: t('x10a.my.lede') });
  const sub = { ...match, path: '/my' };
  const tabs = {
    progress: () => progressTab(ctx),
    path: () => h('div', null, planPanel(ctx), embed(learningPathView(ctx, sub))),
    recommendations: () => embed(recommendationsView(ctx, sub)),
    competencies: () => embed(myCompetenciesView(ctx, sub)),
    profile: () => embed(profileView(ctx, sub))
  };
  /* A newcomer sees the 60-second onboarding above every tab (no empty dead ends). */
  const ob = dataRegion({ t, load: () => ctx.repos.profile.get('me'), render: p => p ? h('span', { hidden: true }) : onboardingCard(ctx) });
  const node = h('div', { class: 'myspace' }, head, ob,
    Tabs({ label: t('nav.items.mySpace'), initial, lazy: true, tabs: MY_TABS.map(k => ({ key: k, label: t('x10a.my.tabs.' + k), content: tabs[k] })),
      onSelect: i => setHashQuery('/my', { tab: MY_TABS[i] }) }));
  if (q.saved === '1') setTimeout(() => document.getElementById('saved')?.scrollIntoView({ block: 'start' }), 600);
  return node;
}
