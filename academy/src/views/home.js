/**
 * Home (rebuilt in Phase 10A, plan §3.2): start from the visitor's goal.
 *  1. «ماذا تريد أن تحقق؟» — four goal cards; each opens the right academy (or the 60-second onboarding first).
 *  2. "Continue where you left off" — only when the learner has started a course; one click to the next lesson.
 *  3. How it works in three steps.  4. The four academies.  5. One row of featured courses (one per academy).
 * Loads only the light course index and the learner's own records (src/data/learner-state.js → loadLight).
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, ProgressBar } from '../ui/components.js';
import { academyBanner, courseCover, familyOf } from '../ui/art.js';
import { loadLight } from '../data/learner-state.js';
import { ACADEMIES, GOALS, goalAcademy, academyOfCourse, cardProgress, continueList, academyByKey } from '../domain/academies.mjs';
import { L, linkBtn, minutes, hours } from '../ui/academy.js';

const GOAL_ICON = { standard: 'shield', certification: 'award', improve: 'trend', team: 'users' };
const lessonKey = (c, l) => (l.id.startsWith(c.id + '-') ? l.id.slice(c.id.length + 1) : l.id);
export const lessonHref = (c, l) => `#/academy/courses/${c.slug}/${encodeURIComponent(lessonKey(c, l))}`;

/** Where a goal card goes: straight to the academy when the learner has a profile, else to onboarding with the goal chosen. */
export function goalHref(goal, profile) {
  if (profile?.target_role) return '#' + academyByKey(goalAcademy(goal, profile.target_role)).route;
  return `#/welcome?goal=${goal}`;
}

/** The first course a newcomer should open in an academy: lowest level, own lessons (not a guide course), catalogue order. */
export function starterCourse(courses, key) {
  const xs = courses.filter(c => academyOfCourse(c) === key && !c.guide && (c.modules || []).some(m => (m.lessons || []).length));
  return xs.sort((a, b) => (a.level || 9) - (b.level || 9))[0] || courses.find(c => academyOfCourse(c) === key) || null;
}

export function progressLine(ctx, p) {
  const { t, i18n } = ctx;
  return p.done ? t('x10a.card.progress', { done: i18n.number(p.done), total: i18n.number(p.total), left: minutes(ctx, p.minutesLeft) })
    : t('x10a.card.fresh', { total: i18n.number(p.total), mins: minutes(ctx, p.minutesTotal) });
}

export function homeView(ctx) {
  const { t, i18n } = ctx;
  const data = loadLight(ctx);

  const goals = h('section', { class: 'home-hero', 'aria-labelledby': 'goal-h' },
    h('p', { class: 'eyebrow' }, t('app.name')),
    h('h1', { id: 'goal-h' }, t('x10a.home.question')),
    h('p', { class: 'lede' }, t('x10a.home.lede')),
    dataRegion({ t, load: () => data, render: ({ learner }) => h('ul', { class: 'goal-cards' }, GOALS.map(g => h('li', null,
      h('a', { class: 'goal-card', href: goalHref(g, learner.profile), dataset: { goal: g } },
        h('span', { class: 'gi' }, icon(GOAL_ICON[g])),
        h('strong', null, t('x10a.goal.' + g + '.t')),
        h('span', null, t('x10a.goal.' + g + '.d')),
        h('span', { class: 'go' }, t(learner.profile?.target_role ? 'x10a.goal.open' : 'x10a.goal.start'), ' ', icon('chevron')))))) }));

  const cont = dataRegion({ t, load: () => data, render: ({ content, learner }) => {
    const xs = continueList(content.courses, learner.progress).slice(0, 3);
    if (!xs.length) return h('span', { hidden: true, dataset: { continue: 'none' } });
    return h('section', { class: 'section continue', 'aria-labelledby': 'cont-h', dataset: { continue: String(xs.length) } },
      h('h2', { id: 'cont-h' }, icon('play'), ' ', t('x10a.home.continue')),
      h('ul', { class: 'cont-list' }, xs.map(({ c, p }) => h('li', { class: 'card cont-card', dataset: { course: c.id } },
        h('h3', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))),
        ProgressBar({ value: p.done, max: p.total, label: t('courses.progress'), valueText: progressLine(ctx, p) }),
        p.next ? linkBtn(lessonHref(c, p.next), t('x10a.home.continueCta', { lesson: L(ctx, p.next.title) }), 'primary', { 'data-action': 'continue-lesson' }) : null))));
  } });

  const how = h('section', { class: 'section how', 'aria-labelledby': 'how-h' },
    h('h2', { id: 'how-h' }, t('x10a.how.title')),
    h('ol', { class: 'how-steps' }, [['find', 'gauge'], ['learn', 'book'], ['show', 'chart']].map(([k, ic], i) => h('li', { dataset: { step: k } },
      h('span', { class: 'num', 'aria-hidden': 'true' }, i18n.number(i + 1)), icon(ic),
      h('strong', null, t('x10a.how.' + k + '.t')), h('span', null, t('x10a.how.' + k + '.d'))))));

  const academies = h('section', { class: 'section', 'aria-labelledby': 'acad-h' },
    h('h2', { id: 'acad-h' }, t('p8.home.academies')),
    dataRegion({ t, load: () => data, render: ({ content }) => h('div', { class: 'acad-tiles acad-tiles-4' }, ACADEMIES.map(a => {
      const n = content.courses.filter(c => academyOfCourse(c) === a.key).length;
      return h('article', { class: 'acad-tile acad-card', dataset: { family: a.family, academy: a.key } },
        h('div', { class: 'cover' }, academyBanner(a.family, a.icon, '#' + a.route)),
        h('div', { class: 'acad-body' }, h('h3', null, icon(a.icon), ' ', h('a', { href: '#' + a.route }, t('nav.items.' + a.navId))),
          h('p', null, t('x10a.acad.' + a.key + '.line')), h('p', { class: 'meta' }, icon('book'), ' ', t('p8.home.courses', { n: i18n.number(n) }))));
    })) }));

  const featured = h('section', { class: 'section', 'aria-labelledby': 'feat-h' },
    h('div', { class: 'sec-head' }, h('h2', { id: 'feat-h' }, t('x10a.home.featured')), h('a', { href: '#/academy/courses', class: 'more-link' }, t('x10a.home.allCourses'), ' ', icon('chevron'))),
    dataRegion({ t, load: () => data, render: ({ content, learner }) => h('ul', { class: 'feat-row' }, ACADEMIES.map(a => starterCourse(content.courses, a.key)).filter(Boolean).map(c => {
      const p = cardProgress(c, learner.progress);
      const first = p.next || (c.modules?.[0]?.lessons?.[0]);
      return h('li', { class: 'card feat-card', dataset: { course: c.id, family: familyOf(c) } },
        h('div', { class: 'cover' }, courseCover(c)),
        h('div', { class: 'ccard-body' },
          h('p', { class: 'eyebrow' }, t('nav.items.' + academyByKey(academyOfCourse(c)).navId), ' · ', hours(ctx, c.training_hours)),
          h('h3', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))),
          h('p', { class: 'note' }, progressLine(ctx, p)),
          first ? linkBtn(lessonHref(c, first), t(p.done ? 'p7.course.continue' : 'x10a.home.startLesson'), 'primary', { 'data-action': 'start-lesson' }) : null));
    })) }));

  return h('div', { class: 'home' }, goals, cont, how, academies, featured);
}
