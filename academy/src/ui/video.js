/**
 * Phase 18 — the video player block and the video card. Native <video> (no third-party player, no tracking); the files are
 * served from the cia-videos repository on the same origin (config.videoBase). Resume position and "watched" are saved
 * to the learner's own video_progress records. Transcript and worksheet load only when asked for.
 */
import { h, icon } from '../core/dom.js';
import { L } from './academy.js';
import { fmtTime, progressAfter, resumeAt } from '../domain/videos.mjs';

export const videoBase = ctx => new URL(ctx.config?.videoBase || '../../cia-videos/', location.href).href;
export const videoUrl = (ctx, kind, v) => videoBase(ctx) + ({ v: `v/${v.id}.mp4`, p: `p/${v.id}.jpg`, s: `s/${v.id}.html`, t: `t/${v.id}.txt` })[kind];
export const durLabel = (ctx, v) => v.duration >= 90 ? ctx.t('vd18.minutes', { n: ctx.i18n.number(Math.round(v.duration / 60)) }) : ctx.t('vd18.seconds', { n: ctx.i18n.number(Math.round(v.duration)) });

export function VideoPlayer(ctx, v, { progress = null, headingLevel = 3, showTitle = true } = {}) {
  const { t } = ctx;
  let saved = progress;
  const err = h('p', { class: 'vd-err', role: 'alert', hidden: true }, icon('alert'), ' ', t('vd18.loadFail'));
  const video = h('video', { class: 'vd-video', controls: true, preload: 'none', playsinline: true, poster: videoUrl(ctx, 'p', v), 'aria-label': L(ctx, v.title), dataset: { video: v.id } },
    h('source', { src: videoUrl(ctx, 'v', v), type: 'video/mp4' }));
  const start = resumeAt(saved, v.duration);
  if (start) video.addEventListener('loadedmetadata', () => { try { video.currentTime = start; } catch { /* ignore */ } }, { once: true });
  const badge = h('span', { class: 'vd-watched badge badge-ok', hidden: !saved?.watched }, icon('check'), ' ', t('vd18.watched'));
  let busy = false, again = false;
  const save = async (ended = false) => {
    if (busy) { again = again || (ended ? 'end' : true); return; }
    if (!ended && !saved && video.currentTime < 1) return;            // nothing worth keeping yet
    const next = progressAfter(saved, { id: v.id, position: video.currentTime, duration: video.duration || v.duration, ended });
    if (!next) return;
    busy = true;
    try { await ctx.repos.videoProgress.save(next); saved = next; badge.hidden = !next.watched; } catch { /* storage full: playback continues */ }
    finally { busy = false; if (again) { const e = again === 'end'; again = false; save(e); } }
  };
  video.addEventListener('timeupdate', () => save(false));
  video.addEventListener('pause', () => save(false));
  video.addEventListener('ended', () => save(true));
  video.addEventListener('error', () => { err.hidden = false; }, true);
  video.querySelector('source').addEventListener('error', () => { err.hidden = false; });
  const H = 'h' + headingLevel;
  const extras = [];
  if (v.sheet) extras.push(h('a', { class: 'btn btn-secondary btn-sm', href: videoUrl(ctx, 's', v), target: '_blank', rel: 'noopener', dataset: { action: 'vd-sheet' }, 'aria-describedby': `vd-sn-${v.id}` },
    icon('doc'), ' ', t('vd18.worksheet')), h('span', { class: 'sr-only', id: `vd-sn-${v.id}` }, t('vd18.worksheetNote')));
  let transcript = null;
  if (v.transcript) {
    const body = h('div', { class: 'vd-tr', lang: v.transcript, dir: v.transcript === 'ar' ? 'rtl' : 'ltr' });
    transcript = h('details', { class: 'vd-trbox', ontoggle: async e => {
      if (!e.target.open || body.dataset.loaded) return;
      body.dataset.loaded = '1';
      try { const r = await fetch(videoUrl(ctx, 't', v)); if (!r.ok) throw new Error(r.status); body.replaceChildren(...(await r.text()).split('\n').filter(Boolean).map(x => h('p', null, x))); }
      catch { body.replaceChildren(h('p', { class: 'note' }, t('vd18.transcriptFail'))); }
    } }, h('summary', null, icon('doc'), ' ', t(v.transcript === 'ar' ? 'vd18.transcriptAr' : 'vd18.transcriptEn')), body);
  }
  return h('figure', { class: 'vd-player', dataset: { videoBlock: v.id } },
    h('div', { class: 'vd-frame' }, video),
    err,
    h('figcaption', { class: 'vd-cap' },
      showTitle ? h(H, { class: 'vd-title' }, L(ctx, v.title)) : null,
      h('p', { class: 'vd-meta' }, h('span', { class: 'vd-series' }, t('vd18.ser.' + v.series)), ' · ', icon('clock'), ' ', durLabel(ctx, v),
        start ? [' · ', t('vd18.resume', { t: fmtTime(start) })] : null, ' ', badge),
      extras.length ? h('p', { class: 'btnrow vd-extras' }, ...extras) : null,
      transcript));
}

export function VideoCard(ctx, v, { watched = false, href = null } = {}) {
  const { t } = ctx;
  return h('li', { class: 'vd-card' + (watched ? ' is-watched' : ''), dataset: { videoCard: v.id } },
    h('a', { class: 'vd-cardlink', href: href || `#/videos/${encodeURIComponent(v.id)}` },
      h('span', { class: 'vd-thumb' }, h('img', { src: videoUrl(ctx, 'p', v), alt: '', loading: 'lazy', decoding: 'async' }), h('span', { class: 'vd-play', 'aria-hidden': 'true' }, icon('play')),
        h('span', { class: 'vd-dur' }, fmtTime(v.duration)), watched ? h('span', { class: 'vd-tick', 'aria-hidden': 'true' }, icon('check')) : null),
      h('span', { class: 'vd-ctitle' }, L(ctx, v.title)),
      h('span', { class: 'vd-cmeta' }, t('vd18.ser.' + v.series), watched ? [' · ', t('vd18.watched')] : null)));
}

/** Async blocks for the lesson player and the course page: fill themselves after render; empty (hidden) when there is no video. */
async function _load(ctx) {
  const [items, progress] = await Promise.all([ctx.repos.videos.listVisible(ctx.session.roles).catch(() => []), ctx.repos.videoProgress.list().catch(() => [])]);
  return { items, progress };
}
export function lessonVideos(ctx, lessonId, { forLesson }) {
  const host = h('section', { class: 'vd-lesson', hidden: true, 'aria-labelledby': 'vd-lh', dataset: { lessonVideos: '0' } });
  _load(ctx).then(({ items, progress }) => {
    const vs = forLesson(items, lessonId);
    if (!vs.length) return;
    host.dataset.lessonVideos = String(vs.length); host.hidden = false;
    host.replaceChildren(h('h2', { id: 'vd-lh' }, icon('play'), ' ', ctx.t(vs.length > 1 ? 'vd18.watch' : 'vd18.inLesson')),
      ...vs.slice(0, 2).map(v => VideoPlayer(ctx, v, { progress: progress.find(p => p.id === v.id) || null })),
      vs.length > 2 ? h('ul', { class: 'vd-grid vd-more' }, ...vs.slice(2).map(v => VideoCard(ctx, v, { watched: progress.some(p => p.id === v.id && p.watched) }))) : null);
  });
  return host;
}
export function courseVideos(ctx, courseId, { forCourse }) {
  const host = h('section', { class: 'section vd-course', hidden: true, 'aria-labelledby': 'vd-ch', dataset: { courseVideos: '0' } });
  _load(ctx).then(({ items, progress }) => {
    const vs = forCourse(items, courseId);
    if (!vs.length) return;
    host.dataset.courseVideos = String(vs.length); host.hidden = false;
    host.replaceChildren(h('h2', { id: 'vd-ch' }, icon('play'), ' ', ctx.t('vd18.inCourse')),
      h('ul', { class: 'vd-grid' }, ...vs.map(v => VideoCard(ctx, v, { watched: progress.some(p => p.id === v.id && p.watched) }))));
  });
  return host;
}
