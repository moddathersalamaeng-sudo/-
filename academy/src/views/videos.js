/**
 * Phase 18 — #/videos (library by series, search, watched filter) and #/videos/:id (one video, where it is used,
 * previous / next in the series). D-125.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion } from '../ui/components.js';
import { L, linkBtn, pageHead, notAvailable, setHashQuery } from '../ui/academy.js';
import { VideoPlayer, VideoCard } from '../ui/video.js';
import { bySeries, neighbours, search, minutes, watchedCount, SERIES_ORDER } from '../domain/videos.mjs';

export async function loadVideos(ctx) {
  const [items, progress] = await Promise.all([ctx.repos.videos.listVisible(ctx.session.roles).catch(() => []), ctx.repos.videoProgress.list().catch(() => [])]);
  return { items, progress };
}

export function videosView(ctx, match) {
  const { t, i18n } = ctx;
  const q = match.query || {};
  const head = pageHead(ctx, { eyebrow: t('vd18.eyebrow'), title: t('vd18.title'), lede: t('vd18.lede') });
  const region = dataRegion({ t, load: () => loadVideos(ctx), render: ({ items, progress }) => {
    const watched = new Set(progress.filter(p => p.watched).map(p => p.id));
    const series = SERIES_ORDER.includes(q.series) ? q.series : '';
    const show = q.show === 'unwatched' ? 'unwatched' : '';
    const input = h('input', { class: 'input', type: 'search', id: 'vd-q', value: q.q || '', 'aria-label': t('vd18.search'), placeholder: t('vd18.search') });
    const sel = h('select', { class: 'select', id: 'vd-series', 'aria-label': t('vd18.series') }, h('option', { value: '' }, t('vd18.all')),
      ...SERIES_ORDER.filter(k => items.some(v => v.series === k)).map(k => h('option', { value: k, selected: k === series }, t('vd18.ser.' + k))));
    const only = h('select', { class: 'select', id: 'vd-show', 'aria-label': t('vd18.filter') }, h('option', { value: '' }, t('vd18.allVideos')), h('option', { value: 'unwatched', selected: show === 'unwatched' }, t('vd18.unwatched')));
    const list = h('div', { class: 'vd-groups' });
    const paint = () => {
      let xs = search(items, input.value, i18n.locale);
      if (sel.value) xs = xs.filter(v => v.series === sel.value);
      if (only.value === 'unwatched') xs = xs.filter(v => !watched.has(v.id));
      const groups = bySeries(xs);
      list.dataset.count = String(xs.length);
      list.replaceChildren(...(groups.length ? groups.map(g => h('section', { class: 'vd-group', 'aria-labelledby': 'vg-' + g.series, dataset: { series: g.series } },
        h('header', { class: 'vd-ghead' }, h('h2', { id: 'vg-' + g.series }, t('vd18.ser.' + g.series)),
          h('p', { class: 'note' }, t('vd18.serAbout.' + g.series), ' · ', t('vd18.progress', { w: i18n.number(watchedCount(g.items, progress)), n: i18n.number(g.items.length) }))),
        h('ul', { class: 'vd-grid' }, ...g.items.map(v => VideoCard(ctx, v, { watched: watched.has(v.id) })))))
        : [h('p', { class: 'note', dataset: { empty: 'videos' } }, t('vd18.none'))]));
    };
    const sync = () => { setHashQuery('/videos', { series: sel.value || undefined, show: only.value || undefined, q: input.value || undefined }); };
    input.addEventListener('input', paint); input.addEventListener('change', sync);
    sel.addEventListener('change', () => { paint(); sync(); }); only.addEventListener('change', () => { paint(); sync(); });
    paint();
    return h('div', { class: 'vd-lib', dataset: { videos: String(items.length) } },
      h('p', { class: 'vd-total' }, icon('play'), ' ', t('vd18.count', { n: i18n.number(items.length), min: i18n.number(minutes(items)) }), ' · ', t('vd18.progress', { w: i18n.number(watchedCount(items, progress)), n: i18n.number(items.length) })),
      h('div', { class: 'vd-filters' }, input, sel, only), list,
      h('p', { class: 'note' }, icon('info'), ' ', t('vd18.voiceNote')));
  } });
  return h('div', null, head, region);
}

export function videoView(ctx, match) {
  const { t } = ctx;
  const id = match.params.id;
  const region = dataRegion({ t, load: async () => {
    const { items, progress } = await loadVideos(ctx);
    const idx = await (ctx.repos.coursesIndex || ctx.repos.courses).listVisible(ctx.session.roles).catch(() => []);
    return { items, progress, idx };
  }, render: ({ items, progress, idx }) => {
    const v = items.find(x => x.id === id);
    if (!v) return notAvailable(ctx, { title: t('vd18.notFound'), body: t('vd18.notFoundBody'), action: linkBtn('#/videos', t('vd18.title'), 'primary') });
    ctx.setTrail?.([{ label: t('nav.items.library'), href: '#/library' }, { label: t('vd18.title'), href: '#/videos' }], L(ctx, v.title));
    const { prev, next } = neighbours(items, v.id);
    const courses = new Map(idx.map(c => [c.id, c]));
    const used = v.placements.map(p => ({ p, c: courses.get(p.course_id) })).filter(x => x.c);
    const lessonHref = (c, lid) => `#/academy/courses/${c.slug}/${lid.startsWith(c.id + '-') ? lid.slice(c.id.length + 1) : lid}`;
    return h('div', { class: 'vd-page', dataset: { video: v.id } },
      h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('play'), ' ', t('vd18.ser.' + v.series), v.clause ? [' · ', t('vd18.clause', { c: v.clause })] : null), h('h1', null, L(ctx, v.title))),
      VideoPlayer(ctx, v, { progress: progress.find(p => p.id === v.id) || null, showTitle: false }),
      h('nav', { class: 'vd-pn btnrow', 'aria-label': t('vd18.series') },
        prev ? linkBtn(`#/videos/${prev.id}`, [icon('chevron'), ' ', t('vd18.prev')], 'secondary', { rel: 'prev', 'data-action': 'vd-prev' }) : null,
        next ? linkBtn(`#/videos/${next.id}`, [t('vd18.next'), ': ', L(ctx, next.title)], 'primary', { rel: 'next', 'data-action': 'vd-next' }) : null),
      h('section', { class: 'vd-used', 'aria-labelledby': 'vd-used-h' }, h('h2', { id: 'vd-used-h' }, t('vd18.usedIn')),
        used.length ? h('ul', { class: 'plain' }, ...used.map(({ p, c }) => h('li', null, icon('book'), ' ',
          h('a', { href: p.lesson_id ? lessonHref(c, p.lesson_id) : `#/academy/courses/${c.slug}`, dataset: { usedIn: p.lesson_id || c.id } }, L(ctx, c.title)),
          p.lesson_id ? h('span', { class: 'note' }, ' · ', p.lesson_id.split('-').pop()) : null)))
          : h('p', { class: 'note' }, t('vd18.notUsed'))),
      h('p', { class: 'note' }, icon('info'), ' ', t('vd18.voiceNote')));
  } });
  return h('div', null, region);
}
