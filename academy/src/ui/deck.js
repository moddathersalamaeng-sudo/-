/**
 * Phase 15 — the lesson deck: slides that turn like pages (src/domain/visuals.mjs builds them; this file draws them).
 * Accessible carousel: one slide visible, the others hidden; buttons, dots, keyboard (arrows follow the reading direction,
 * Home / End), swipe, "Present" (full screen). Page-turn animation only when the person allows motion.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon, nextId } from '../core/dom.js';
import { figureSvg } from './figures.js';
import { buildDeck } from '../domain/visuals.mjs';

const KIND_TONE = { cover: 'navy', goals: 'gold', idea: 'navy', model: 'paper', figure: 'paper', steps: 'paper', example: 'gold', compare: 'paper', scenario: 'navy', avoid: 'paper', evidence: 'paper', tips: 'gold', summary: 'navy' };

/** A person at a desk: the scenario illustration (original drawing, no people's likeness). */
function personArt() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('class', 'dk-person'); svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.appendChild(e); return e; };
  add('circle', { cx: 60, cy: 36, r: 18, class: 'dk-skin' });
  add('path', { d: 'M26 102c2-22 16-34 34-34s32 12 34 34z', class: 'dk-body' });
  add('rect', { x: 14, y: 96, width: 92, height: 10, rx: 3, class: 'dk-desk' });
  add('rect', { x: 70, y: 74, width: 30, height: 22, rx: 3, class: 'dk-doc' });
  add('path', { d: 'M75 81h20M75 86h20M75 91h12', class: 'dk-lines' });
  return svg;
}

const points = (list, cls = '') => h('ul', { class: ['dk-points', cls] }, list.map(p => h('li', null,
  p.n ? h('span', { class: 'dk-n' }, String(p.n)) : h('span', { class: 'dk-pi' }, icon(p.icon || 'check')), h('span', { class: 'dk-pt' }, p.text))));

function slideBody(ctx, s) {
  const { t, i18n } = ctx;
  const lang = i18n.locale;
  switch (s.kind) {
    case 'cover': return [h('p', { class: 'dk-kicker' }, s.kicker), h('div', { class: 'dk-cover-ico' }, icon(s.icon)), h('p', { class: 'dk-big' }, s.title),
      s.minutes ? h('p', { class: 'dk-meta' }, icon('clock'), ' ', t('p7.minutes', { n: i18n.number(s.minutes) })) : null];
    case 'goals': return [points(s.points)];
    case 'idea': return [h('div', { class: 'dk-hero-ico' }, icon(s.icon)), points(s.points, 'dk-points-lg')];
    case 'model': case 'figure': return [h('div', { class: 'dk-figure' }, figureSvg(s.kind === 'model' ? { ...s.spec, caption: { en: s.title, ar: s.title } } : s.figure, lang)),
      h('p', { class: 'dk-note' }, icon('info'), ' ', t(s.kind === 'model' ? 'sl15.modelNote' : 'sl15.figureNote'))];
    case 'steps': return [h('ol', { class: 'dk-steps' }, s.points.map(p => h('li', null, h('span', { class: 'dk-n' }, String(p.n)), h('span', { class: 'dk-pi' }, icon(p.icon)), h('span', { class: 'dk-pt' }, p.text))))];
    case 'example': return [h('div', { class: 'dk-hero-ico' }, icon(s.icon)), points(s.points)];
    case 'compare': return [h('div', { class: 'dk-compare' },
      h('div', { class: 'dk-col dk-bad' }, h('p', { class: 'dk-col-h' }, icon('close'), ' ', t('sl15.before')), h('blockquote', null, s.before)),
      h('div', { class: 'dk-arrow', 'aria-hidden': 'true' }, icon('chevron')),
      h('div', { class: 'dk-col dk-good' }, h('p', { class: 'dk-col-h' }, icon('check'), ' ', t('sl15.after')), h('blockquote', null, s.after))),
    h('p', { class: 'dk-note' }, icon('info'), ' ', t('sl15.compareNote'))];
    case 'scenario': return [h('div', { class: 'dk-scene' }, personArt(), h('div', { class: 'dk-bubble' }, h('p', null, s.text))), h('p', { class: 'dk-ask' }, icon('question'), ' ', t('sl15.askYourself'))];
    case 'avoid': return [h('div', { class: 'dk-compare' },
      h('div', { class: 'dk-col dk-bad' }, h('p', { class: 'dk-col-h' }, icon('close'), ' ', t('sl15.avoid')), h('ul', null, s.avoid.map(x => h('li', null, x)))),
      h('div', { class: 'dk-col dk-good' }, h('p', { class: 'dk-col-h' }, icon('check'), ' ', t('sl15.show')), h('ul', null, s.show.map(x => h('li', null, x)))))];
    case 'evidence': return [points(s.points, s.warn ? 'dk-warn' : 'dk-checks')];
    case 'tips': return [points(s.points)];
    case 'summary': return [points(s.points, 'dk-points-lg'), h('p', { class: 'dk-note' }, icon('book'), ' ', t('sl15.fullBelow'))];
    default: return [];
  }
}

const TITLE_KEY = { cover: null, goals: 'sl15.k.goals', idea: 'sl15.k.idea', model: null, figure: null, steps: 'sl15.k.steps', example: 'sl15.k.example', compare: 'sl15.k.compare',
  scenario: 'sl15.k.scenario', avoid: 'sl15.k.avoid', evidence: 'sl15.k.evidence', tips: 'sl15.k.tips', summary: 'sl15.k.summary' };

/** The deck for one lesson; `item` is the guide item for guide lessons. Returns null when there is nothing to show. */
export function LessonDeck(ctx, { lesson, item = null, course, figures = [] }) {
  const { t, i18n } = ctx;
  const slides = buildDeck({ lesson, item, course, figures, lang: i18n.locale });
  if (slides.length < 3) return null;
  const id = nextId('deck');
  const n = slides.length;
  let cur = 0;
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const counter = h('span', { class: 'dk-count' });
  const els = slides.map((s, i) => h('section', {
    class: ['dk-slide', 'dk-k-' + s.kind, 'dk-tone-' + (KIND_TONE[s.kind] || 'paper')], id: `${id}-s${i}`, role: 'group', 'aria-roledescription': t('sl15.slide'),
    'aria-label': t('sl15.of', { n: i18n.number(i + 1), total: i18n.number(n) }), hidden: i !== 0, dataset: { slide: s.kind, src: s.src }
  },
  h('header', { class: 'dk-head' }, h('span', { class: 'dk-badge' }, icon(s.icon)), h('h2', { class: 'dk-title' }, s.kind === 'cover' ? t('sl15.k.cover') : (TITLE_KEY[s.kind] ? t(TITLE_KEY[s.kind]) : s.title))),
  h('div', { class: 'dk-body' }, slideBody(ctx, s)),
  h('footer', { class: 'dk-foot' }, h('span', null, i18n.number(i + 1), ' / ', i18n.number(n)))));
  const dots = h('div', { class: 'dk-dots', role: 'group', 'aria-label': t('sl15.jump') }, slides.map((s, i) => h('button', { type: 'button', class: 'dk-dot', 'aria-controls': `${id}-s${i}`,
    'aria-label': t('sl15.goTo', { n: i18n.number(i + 1) }), dataset: { dot: String(i) }, onclick: () => go(i) })));
  const prevBtn = h('button', { type: 'button', class: 'btn btn-secondary dk-prev', 'aria-label': t('sl15.prev'), dataset: { action: 'deck-prev' }, 'aria-controls': id, onclick: () => go(cur - 1) }, icon('chevron'), h('span', null, t('sl15.prev')));
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary dk-next', 'aria-label': t('sl15.next'), dataset: { action: 'deck-next' }, 'aria-controls': id, onclick: () => go(cur + 1) }, h('span', null, t('sl15.next')), icon('chevron'));
  const stage = h('div', { class: 'dk-stage', id, tabindex: '0', 'aria-label': t('sl15.stage') }, els);
  const presentBtn = h('button', { type: 'button', class: 'btn btn-quiet dk-present', dataset: { action: 'deck-present' }, onclick: () => present() }, icon('grid'), ' ', h('span', null, t('sl15.present')));
  const root = h('section', { class: 'deck', 'aria-roledescription': t('sl15.carousel'), 'aria-label': t('sl15.title'), dataset: { deck: String(n), current: '0' } },
    h('div', { class: 'dk-top' }, h('h2', { class: 'h-sm dk-label' }, icon('layers'), ' ', t('sl15.title')), counter, presentBtn),
    stage, h('div', { class: 'dk-controls' }, prevBtn, dots, nextBtn), live);

  const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint(dir = 0) {
    els.forEach((e, i) => { e.hidden = i !== cur; e.classList.remove('turn-fwd', 'turn-back'); });
    if (dir && !reduce()) els[cur].classList.add(dir > 0 ? 'turn-fwd' : 'turn-back');
    [...dots.children].forEach((d, i) => { d.setAttribute('aria-current', i === cur ? 'step' : 'false'); });
    prevBtn.disabled = cur === 0; nextBtn.disabled = cur === n - 1;
    counter.textContent = t('sl15.of', { n: i18n.number(cur + 1), total: i18n.number(n) });
    root.dataset.current = String(cur);
  }
  function go(i) {
    const to = Math.max(0, Math.min(n - 1, i));
    if (to === cur) return;
    const dir = to > cur ? 1 : -1; cur = to; paint(dir);
    live.textContent = t('sl15.of', { n: i18n.number(cur + 1), total: i18n.number(n) });
  }
  function present() {
    const el = root;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (el.requestFullscreen) el.requestFullscreen().then(() => stage.focus()).catch(() => root.classList.toggle('is-full'));
    else root.classList.toggle('is-full');
  }
  document.addEventListener('fullscreenchange', () => root.classList.toggle('is-full', document.fullscreenElement === root));
  stage.addEventListener('keydown', e => {
    const rtl = document.documentElement.dir === 'rtl';
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === fwd || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
    else if (e.key === back || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
  });
  let x0 = null;
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stage.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) < 40) return;
    const rtl = document.documentElement.dir === 'rtl';
    go(cur + ((dx < 0) !== rtl ? 1 : -1));
  });
  paint();
  return root;
}
