/**
 * Phase 12B — guided-experience UI pieces (lessons from the Sumud Navigator study).
 *   counterStrip   three or four big numbers that make a tool concrete before starting (L-B5, L-A1)
 *   flipCard       term on the front, one sentence on the back; a real button with aria-pressed (L-B4)
 *   clamp          folds a long paragraph to three lines with "Read more" — content is never shortened (L-B6)
 *   stepRail       the stage rail of a guided flow (L-A1, L-B1)
 *   competencyBars one bar per competency with band and text value — readable without colour (L-A3)
 *   numberedCards  01, 02 … outcome cards (L-B3)
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { shouldClamp } from '../domain/guided.mjs';

export function counterStrip(ctx, items = [], { label } = {}) {
  return h('ul', { class: 'gx-counters', 'aria-label': label || null },
    items.filter(Boolean).map(([value, text, iconName]) => h('li', null,
      iconName ? h('span', { class: 'gx-cicon', 'aria-hidden': 'true' }, icon(iconName)) : null,
      h('strong', { class: 'gx-cval' }, typeof value === 'number' ? ctx.i18n.number(value) : value),
      h('span', { class: 'gx-ctext' }, text))));
}

export function flipCard(ctx, { term, detail, kicker = null, id = null }) {
  const front = h('span', { class: 'gx-flip-front' }, kicker ? h('span', { class: 'gx-flip-kicker' }, kicker) : null,
    h('span', { class: 'gx-flip-term' }, term), h('span', { class: 'gx-flip-hint', 'aria-hidden': 'true' }, icon('cycle'), ' ', ctx.t('g12b.flip.hint')));
  const back = h('span', { class: 'gx-flip-back' }, h('span', { class: 'gx-flip-term-sm', 'aria-hidden': 'true' }, term), h('span', { class: 'gx-flip-detail' }, detail));
  const btn = h('button', { type: 'button', class: 'gx-flip', 'aria-pressed': 'false', dataset: { flip: id || '' },
    onclick: () => { const on = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', String(on)); } },
    h('span', { class: 'sr-only' }, ctx.t('g12b.flip.sr', { term: typeof term === 'string' ? term : '' })), front, back);
  return btn;
}

/** Fold a paragraph longer than `words` words (default 60). Returns the paragraph itself when it is short. */
export function clamp(ctx, text, { tag = 'p', cls = '', words = 60 } = {}) {
  const p = h(tag, { class: (cls + ' gx-clamp').trim() }, text);
  if (!shouldClamp(text, words)) { p.classList.remove('gx-clamp'); return p; }
  p.classList.add('is-clamped');
  const id = 'gxc-' + Math.random().toString(36).slice(2, 8);
  p.id = id;
  const btn = h('button', { type: 'button', class: 'linkish gx-more', 'aria-expanded': 'false', 'aria-controls': id, dataset: { action: 'read-more' },
    onclick: () => { const open = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(open)); p.classList.toggle('is-clamped', !open); btn.textContent = open ? ctx.t('g12b.readLess') : ctx.t('g12b.readMore'); } },
    ctx.t('g12b.readMore'));
  return h('div', { class: 'gx-clampwrap' }, p, btn);
}

/**
 * Stage rail. stages: [{ label, state: 'done'|'current'|'todo' }]. onGo(i) is called for done / visited stages.
 * The rail is an ordered list of buttons; the current stage carries aria-current="step".
 */
export function stepRail(ctx, stages, { onGo, label, reviewLabel = null, reviewState = 'todo', onReview = null } = {}) {
  const li = (text, n, state, go) => h('li', { class: 'gx-step is-' + state },
    h('button', { type: 'button', class: 'gx-stepbtn', disabled: state === 'todo' && !go, 'aria-current': state === 'current' ? 'step' : null, onclick: go },
      h('span', { class: 'gx-stepno', 'aria-hidden': 'true' }, state === 'done' ? icon('check') : n),
      h('span', { class: 'gx-steplabel' }, text),
      h('span', { class: 'sr-only' }, ' — ' + ctx.t('g12b.step.' + state))));
  return h('nav', { class: 'gx-rail', 'aria-label': label },
    h('ol', null,
      stages.map((s, i) => li(s.label, ctx.i18n.number(i + 1), s.state, s.state !== 'todo' || s.visited ? () => onGo(i) : null)),
      reviewLabel ? li(reviewLabel, '✓', reviewState, reviewState !== 'todo' ? onReview : null) : null));
}

export function competencyBars(ctx, rows = [], { nameOf = id => id, caption } = {}) {
  return h('figure', { class: 'gx-bars' },
    caption ? h('figcaption', null, caption) : null,
    h('ul', null, rows.map(r => h('li', { class: 'gx-bar is-' + r.band, dataset: { competency: r.id, band: r.band } },
      h('span', { class: 'gx-barname' }, h('span', { class: 'cid' }, r.id), ' ', nameOf(r.id)),
      h('span', { class: 'gx-bartrack', 'aria-hidden': 'true' }, h('span', { class: 'gx-barfill', style: { inlineSize: Math.max(2, Math.min(100, r.percent)) + '%' } }),
        h('span', { class: 'gx-barmark', style: { insetInlineStart: '70%' } })),
      h('span', { class: 'gx-barval' }, ctx.i18n.number(r.percent) + '%', ' · ', ctx.t('p7.asm.band.' + r.band),
        r.unknown ? h('span', { class: 'note' }, ' · ', ctx.t('g12b.res.unknownN', { n: ctx.i18n.number(r.unknown) })) : null)))));
}

export function numberedCards(ctx, items = [], { cls = '' } = {}) {
  return h('ol', { class: ('gx-numcards ' + cls).trim() }, items.map((text, i) => h('li', null,
    h('span', { class: 'gx-num', 'aria-hidden': 'true' }, ctx.i18n.digitize ? ctx.i18n.digitize(String(i + 1).padStart(2, '0')) : String(i + 1).padStart(2, '0')),
    h('span', { class: 'gx-numtext' }, text))));
}

/** Big score ring for a result (reuses the visual language of ProgressRing at a larger size). */
export function scoreRing(ctx, { percent, label, tone = 'ok', size = 132 }) {
  const ns = 'http://www.w3.org/2000/svg'; const r = (size - 14) / 2; const c = 2 * Math.PI * r;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('aria-hidden', 'true');
  for (const [cls, dash] of [['gx-ring-bg', null], ['gx-ring-fg', c * Math.max(0, Math.min(1, (percent || 0) / 100))]]) {
    const ci = document.createElementNS(ns, 'circle');
    ci.setAttribute('cx', size / 2); ci.setAttribute('cy', size / 2); ci.setAttribute('r', r); ci.setAttribute('class', cls);
    ci.setAttribute('fill', 'none'); ci.setAttribute('stroke-width', '12');
    if (dash !== null) { ci.setAttribute('stroke-dasharray', `${dash} ${c}`); ci.setAttribute('stroke-linecap', 'round'); ci.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`); }
    svg.appendChild(ci);
  }
  return h('div', { class: 'gx-ring tone-' + tone, role: 'img', 'aria-label': label },
    svg, h('span', { class: 'gx-ringval', 'aria-hidden': 'true' }, ctx.i18n.number(percent ?? 0) + '%'));
}
