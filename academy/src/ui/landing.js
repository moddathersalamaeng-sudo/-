/**
 * Phase 10A (plan §3.4) — one template for every academy landing (ISO, PMI & PMO, Quality, Excellence):
 *   Hero (one primary, one secondary button) → Your next step → Routes (≤ 4) → Courses (6 + see all)
 *   → Certifications / recognition → Tools & labs → About this content (collapsible; the honesty statements, verbatim).
 * Each section carries data-tpl so the order can be tested; ids keep each academy's historic prefix (iso-, pm-, q-, ex-).
 */
import { h, icon } from '../core/dom.js';
import { academyBanner } from './art.js';
import { EmptyState } from './components.js';
import { linkBtn } from './academy.js';
import { courseStatus } from '../domain/learner-model.mjs';

export const TEMPLATE_ORDER = ['hero', 'next', 'routes', 'courses', 'certs', 'tools', 'about'];
export const MAX_ROUTES = 4;
export const MAX_COURSES = 6;

const sec = (tpl, id, title, ...kids) => h('section', { class: 'section', 'aria-labelledby': id, dataset: { tpl } }, h('h2', { id }, title), ...kids);

/** Courses to show first: the learner's in-progress courses, then the academy's own courses by level, then guide-built ones. */
export function orderCourses(courses, learner) {
  const st = c => courseStatus(c, learner.progress, learner.attempts).state;
  const rank = c => (st(c) === 'in_progress' ? 0 : st(c) === 'not_started' ? 1 : 2) * 100 + (c.guide ? 50 : 0) + (c.level || 9);
  return [...courses].sort((a, b) => rank(a) - rank(b));
}

/** Routes with the learner's own route first, at most MAX_ROUTES shown; the rest behind a disclosure. */
export function orderRoutes(routes, mineId) {
  return [...routes].sort((a, b) => (b.id === mineId) - (a.id === mineId));
}

/**
 * @param o {{ key, prefix, cls, family, iconName, eyebrow, title, lede, stats, primary:{href,label,action}, secondary:{href,label,action}|null,
 *   preview, next, routes:{items, card, title, mineId, pendingTitle}, courses:{items, card, title, seeAll, pendingTitle},
 *   certs:{title, body}|null, tools:{title, items:Node[]}, about:string[] }}
 */
export function academyLanding(ctx, o) {
  const { t, i18n } = ctx;
  const p = o.prefix;
  const btn = (b, variant) => b ? linkBtn(b.href, b.label, variant, b.action ? { 'data-action': b.action } : {}) : null;
  const hero = h('header', { class: ['iso-hero', ...(o.heroCls || [o.cls])], dataset: { family: o.family, tpl: 'hero' } }, academyBanner(o.family, o.iconName, o.cls),
    h('p', { class: 'eyebrow' }, icon(o.iconName), ' ', o.eyebrow), h('h1', null, o.title), h('p', null, o.lede),
    o.stats?.length ? h('ul', { class: 'stats', 'aria-label': o.statsLabel }, o.stats) : null,
    h('div', { class: 'btnrow' }, btn(o.primary, 'primary'), btn(o.secondary, 'secondary')));

  const next = o.next; next.dataset.tpl = 'next';

  const routes = orderRoutes(o.routes.items, o.routes.mineId);
  const shownR = routes.slice(0, MAX_ROUTES), moreR = routes.slice(MAX_ROUTES);
  const routesSec = sec('routes', `${p}-routes`, o.routes.title,
    routes.length ? h('div', { class: 'cards' }, shownR.map(o.routes.card)) : EmptyState({ title: o.routes.pendingTitle, body: t('p7.pendingBody'), iconName: 'lock', level: 3 }),
    moreR.length ? h('details', { class: 'more' }, h('summary', null, t('x10a.landing.moreRoutes', { n: i18n.number(moreR.length) })), h('div', { class: 'cards' }, moreR.map(o.routes.card))) : null);

  const cs = o.courses.items;
  const coursesSec = sec('courses', `${p}-courses`, o.courses.title,
    cs.length ? h('div', { class: 'cards' }, cs.slice(0, MAX_COURSES).map(o.courses.card)) : EmptyState({ title: o.courses.pendingTitle, body: t('p7.pendingBody'), iconName: 'lock', level: 3 }),
    cs.length ? h('p', { class: 'see-all' }, linkBtn(o.courses.seeAll, t('x10a.landing.seeAll', { n: i18n.number(cs.length) }), 'secondary', { 'data-action': 'see-all-courses' })) : null);

  const certsSec = o.certs ? sec('certs', `${p}-certs`, o.certs.title, o.certs.body) : null;
  const toolsSec = sec('tools', `${p}-tools`, o.tools.title, h('div', { class: 'tools-grid' }, o.tools.items.filter(Boolean)));
  const about = h('section', { class: 'section about-content', 'aria-labelledby': `${p}-about`, dataset: { tpl: 'about' } },
    h('details', { class: 'about' }, h('summary', null, h('h2', { id: `${p}-about`, class: 'h-sm' }, icon('info'), ' ', t('x10a.landing.about'))),
      o.about.filter(Boolean).map(x => h('p', null, x))));

  return h('div', { class: 'landing', dataset: { landing: o.key } }, hero, o.preview, next, routesSec, coursesSec, certsSec, toolsSec, about);
}

/** A small panel inside "Tools & labs". */
export const toolPanel = (title, iconName, body, ...kids) => h('div', { class: 'panel tool-panel' }, h('h3', null, icon(iconName), ' ', title), body ? h('p', null, body) : null, ...kids);
