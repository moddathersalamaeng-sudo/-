/**
 * My Learning (#/me) — three tabs fed by the learner's own records (Phase 7):
 * in-progress courses, completed courses (all lessons + final passed) and saved items
 * (recommendations saved for later and library favourites).
 */
import { h } from '../core/dom.js';
import { Tabs, EmptyState, dataRegion, ProgressBar } from '../ui/components.js';
import { loadAll } from '../data/learner-state.js';
import { courseStatus } from '../domain/learner-model.mjs';
import { L, linkBtn, targetHref } from '../ui/academy.js';

export function meView(ctx) {
  const { t, i18n } = ctx;
  const data = (async () => {
    const all = await loadAll(ctx);
    const [recs, favs] = await Promise.all([ctx.repos.recommendations.list(), ctx.repos.libraryFavorites.list()]);
    return { ...all, recs, favs };
  })();
  const courseList = (pick, emptyKey) => ({ content, learner }) => {
    const rows = content.courses.map(c => ({ c, st: courseStatus(c, learner.progress, learner.attempts) })).filter(pick);
    if (!rows.length) return EmptyState({ title: t('me.empty.' + emptyKey), body: t('p7.me.emptyBody'), iconName: 'book', level: 2, action: linkBtn('#/academy/courses', t('courses.title')) });
    return h('ul', { class: 'plain' }, rows.map(({ c, st }) => h('li', { class: 'card', dataset: { course: c.id } },
      h('h2', { class: 'h-sm' }, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))),
      ProgressBar({ value: st.done, max: st.total, label: t('courses.progress'), valueText: t('p7.course.lessonsDone', { done: i18n.number(st.done), total: i18n.number(st.total) }) }),
      st.state === 'completed' ? h('p', { class: 'note' }, t('p7.readingNotCert')) : null)));
  };
  const savedList = ({ content, recs, favs }) => {
    const savedRecs = recs.filter(r => r.status === 'saved').map(r => ({ r, href: targetHref({ type: r.type, target_id: r.target_id }, content), x: content.byId(content.courses, r.target_id) || content.byId(content.assessments, r.target_id) || content.byId(content.articles, r.target_id) })).filter(x => x.x);
    const libs = favs.map(f => content.byId(content.library, f.id)).filter(Boolean);
    if (!savedRecs.length && !libs.length) return EmptyState({ title: t('me.empty.saved'), body: t('p7.me.savedEmpty'), level: 2, action: linkBtn('#/recommendations', t('nav.items.recommendations')) });
    return h('ul', { class: 'plain' },
      savedRecs.map(({ x, href }) => h('li', null, href ? h('a', { href }, L(ctx, x.title)) : L(ctx, x.title))),
      libs.map(x => h('li', null, h('a', { href: `#/library/${x.id}` }, L(ctx, x.title)))));
  };
  const tab = (key, render) => ({ label: t('me.tabs.' + key), content: () => dataRegion({ t, load: () => data, render }) });
  return h('div', null,
    h('div', { class: 'phead' }, h('h1', null, t('me.title')), h('p', null, t('me.lede'))),
    Tabs({ label: t('me.title'), tabs: [
      tab('progress', courseList(x => x.st.state === 'in_progress', 'progress')),
      tab('completed', courseList(x => x.st.state === 'completed', 'completed')),
      tab('saved', savedList)
    ] }),
    h('p', { class: 'note' }, t('me.storageNote')));
}
