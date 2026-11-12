/**
 * #/academies (Phase 10A) — the four academies on one page: what each covers, how many courses it has, and its
 * readiness check. The header's Academies panel shows the same four lines; this page is its phone and keyboard home.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion } from '../ui/components.js';
import { academyBanner } from '../ui/art.js';
import { loadLight } from '../data/learner-state.js';
import { ACADEMIES, academyOfCourse, goalAcademy } from '../domain/academies.mjs';
import { pageHead, linkBtn } from '../ui/academy.js';

export function academiesView(ctx) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('app.name'), title: t('nav.items.academies'), lede: t('x10a.acad.lede') });
  const region = dataRegion({ t, load: () => loadLight(ctx), render: ({ content, learner }) => {
    const mine = learner.profile?.goal ? goalAcademy(learner.profile.goal, learner.profile.target_role) : null;
    return h('ul', { class: 'acad-big' }, ACADEMIES.map(a => {
      const n = content.courses.filter(c => academyOfCourse(c) === a.key).length;
      return h('li', { class: ['card', 'acad-row', mine === a.key && 'card-current'], dataset: { academy: a.key, family: a.family } },
        h('div', { class: 'cover' }, academyBanner(a.family, a.icon, '#' + a.route)),
        h('div', { class: 'acad-body' },
          mine === a.key ? h('p', { class: 'eyebrow' }, icon('target'), ' ', t('x10a.acad.yours')) : null,
          h('h2', null, h('a', { href: '#' + a.route }, t('nav.items.' + a.navId))),
          h('p', null, t('x10a.acad.' + a.key + '.long')),
          h('p', { class: 'meta' }, icon('book'), ' ', t('p8.home.courses', { n: i18n.number(n) })),
          h('div', { class: 'btnrow' }, linkBtn('#' + a.route, t('x10a.acad.open'), 'primary'))));
    }));
  } });
  return h('div', null, head, region);
}
