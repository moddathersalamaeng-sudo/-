/** Academy home / dashboard shell. No fake data: every widget shows a real empty state. */
import { h, icon } from '../core/dom.js';
import { EmptyState, ProgressBar, Button, dataRegion } from '../ui/components.js';
import { loadAll } from '../data/learner-state.js';
import { courseStatus } from '../domain/learner-model.mjs';
import { isoStartingPoint } from '../domain/iso.mjs';
import { L, linkBtn } from '../ui/academy.js';

/** Build phase the platform has reached; journey stages up to it are live (see data/seed/build-status.json). */
export const CURRENT_PHASE = 7;
/** Where each live journey stage takes the learner. */
const STAGE_HREF = { explore: '#/knowledge', understand: '#/knowledge', profile: '#/profile', assess: '#/assessments', gaps: '#/profile/competencies', recommend: '#/recommendations', learn: '#/academy/courses', test: '#/assessments' };

/** Spec §1 core journey, with the phase in which each stage opens. */
export const JOURNEY = [
  ['explore', 0], ['understand', 3], ['profile', 2], ['assess', 5], ['gaps', 6], ['recommend', 6], ['learn', 4],
  ['practice', 11], ['simulate', 11], ['test', 5], ['verify', 12], ['record', 12], ['develop', 12]
];

export function homeView(ctx) {
  const { t, i18n, repos, config } = ctx;
  const toolsHeadingId = 'tools-h';
  const goTools = () => { const el = document.getElementById(toolsHeadingId); el?.scrollIntoView({ block: 'start' }); el?.focus(); };

  const rail = h('section', { class: 'journey', 'aria-labelledby': 'jr-h' },
    h('h2', { id: 'jr-h' }, t('home.journeyTitle')),
    h('ol', { class: 'rail' }, JOURNEY.map(([k, phase]) => {
      const now = phase <= CURRENT_PHASE;
      const href = now ? STAGE_HREF[k] : null;
      const label = h('span', { class: 'nm' }, t('home.steps.' + k));
      return h('li', { class: ['stop', now && 'now'] },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        href ? h('a', { href }, label) : label,
        h('span', { class: 'when' }, now ? t('home.journeyNow') : t('home.journeySoon', { phase: i18n.digitize(phase) })));
    })));

  // The tool list loads first and on its own: if it fails, only that region shows an error (non-critical).
  const tools = h('section', { class: 'section', 'aria-labelledby': toolsHeadingId },
    h('h2', { id: toolsHeadingId, tabindex: '-1' }, t('home.toolsTitle')),
    dataRegion({ t, skeleton: true, load: () => repos.platformModules.listVisible(ctx.session.roles).then(items => ({ items, systems: ctx.platformSystems })),
      render: ({ items, systems }) => {
        const bySystem = {};
        for (const m of items) (bySystem[m.system] ||= []).push(m);
        return h('div', null,
          h('p', { class: 'note' }, t('home.toolsSub', { n: i18n.number(items.length) })),
          h('div', { class: 'tools' }, Object.entries(bySystem).map(([sid, mods]) => h('div', { class: 'tgroup' },
            h('h3', null, systems[sid]?.[i18n.locale] || sid),
            h('ul', null, mods.map(m => h('li', null,
              h('a', { class: 'tlink', href: m.href.replace(/^\.\.\//, config.platformBase), dataset: { module: m.id, access: m.access || 'open' }, 'aria-label': t('home.openTool', { name: m.name[i18n.locale] }) + (m.access === 'account' ? ' — ' + t('gd.account') : '') },
                h('span', { class: 'n' }, m.name[i18n.locale], m.access === 'account' ? h('span', { class: 'acc', 'aria-hidden': 'true' }, t('gd.accountShort')) : null),
                h('span', { class: 'd' }, m.note[i18n.locale]),
                icon('external')))))))));
      } }));


  // One load feeds the three dashboard panels (courses in progress, next step, recent activity).
  let pending = null;
  const learnerData = () => (pending ||= loadAll(ctx).catch(err => { pending = null; throw err; }));
  const progress = h('section', { class: 'panel feature', 'aria-labelledby': 'pg-h' },
    h('h2', { id: 'pg-h' }, t('home.progressTitle')),
    dataRegion({ t, skeleton: true, load: learnerData, render: ({ content, learner }) => {
      const started = content.courses.map(c => ({ c, st: courseStatus(c, learner.progress, learner.attempts) })).filter(x => x.st.done > 0);
      if (!started.length) return EmptyState({ title: t('home.progressEmptyTitle'), body: t('p7.home.progressEmptyBody'), iconName: 'book', action: linkBtn('#/academy/courses', t('courses.title')) });
      return h('ul', { class: 'plain' }, started.slice(0, 4).map(({ c, st }) => h('li', null,
        ProgressBar({ value: st.done, max: st.total, label: L(ctx, c.title), valueText: t('home.progressSummary', { done: i18n.number(st.done), total: i18n.number(st.total) }) }),
        h('a', { href: `#/academy/courses/${c.slug}` }, t('p7.course.continue')))));
    } }));

  const next = h('section', { class: 'panel', 'aria-labelledby': 'nx-h' },
    h('h2', { id: 'nx-h' }, t('home.nextTitle')),
    dataRegion({ t, load: learnerData, render: ({ content, learner }) => {
      const sp = isoStartingPoint({ profile: learner.profile, evidence: learner.evidence, completed: learner.completed, standards: content.standards });
      const visible = content.visibleIds.has(sp.target_id);
      return h('div', { class: 'state' }, h('h3', { class: 'state-title' }, L(ctx, sp.title)), h('p', null, L(ctx, sp.reason)),
        h('div', { class: 'btnrow' }, visible ? linkBtn(sp.href, t('p7.iso.startCta'), 'primary') : linkBtn('#/academy/iso', t('nav.items.isoAcademy'), 'primary'),
          Button({ label: t('home.nextAction'), variant: 'quiet', onClick: goTools, attrs: { 'data-action': 'go-tools' } })));
    } }));

  const activity = h('section', { class: 'panel', 'aria-labelledby': 'ac-h' },
    h('h2', { id: 'ac-h' }, t('home.activityTitle')),
    dataRegion({ t, load: learnerData, render: ({ content, learner }) => {
      const items = [...learner.attempts].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0, 5);
      return items.length
        ? h('ul', { class: 'plain' }, items.map(a => { const x = content.byId(content.assessments, a.assessment_id); return h('li', null, x ? h('a', { href: `#/assessments/${x.slug}` }, L(ctx, x.title)) : a.assessment_id, ' — ', h('span', { class: 'note' }, a.pending_review ? t('assessments.pendingReview') : i18n.number(a.score) + '%')); }))
        : EmptyState({ title: t('home.activityEmptyTitle'), body: t('home.activityEmptyBody') });
    } }));

  // Guides: the toolkits' requirement and method explanations, readable inside the Academy (non-critical region).
  const guides = h('section', { class: 'panel feature gteaser', 'aria-labelledby': 'gd-h' },
    h('h2', { id: 'gd-h' }, t('gd.homeTitle')),
    dataRegion({ t, load: learnerData, render: ({ content }) => {
      const gs = content.guides || [];
      if (!gs.length) return h('p', { class: 'note' }, t('gd.emptyBody'));
      const items = gs.reduce((a, g) => a + g.counts.items, 0);
      return h('div', null, h('p', null, t('gd.homeBody', { n: i18n.number(gs.length), items: i18n.number(items) })),
        h('div', { class: 'btnrow' }, linkBtn('#/guides', t('gd.openAll'), 'primary'), linkBtn('#/guides/iso-9001', 'ISO 9001')));
    } }));

  return h('div', null,
    h('div', { class: 'phead' }, h('h1', null, t('home.greeting')), h('p', null, t('home.lede'))),
    rail,
    h('div', { class: 'dash' }, progress, next, activity),
    guides,
    tools);
}
