/** Phase 7 chart components (inline SVG, no library — decision D-13): level meter and competency radar. */
import { h } from '../core/dom.js';
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v); kids.flat().forEach(k => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k)))); return el; };

/** Five-step level meter; 0 = not assessed (distinct style). */
export function LevelMeter({ level = 0, label }) {
  const lv = Math.max(0, Math.min(5, Math.round(level || 0)));
  return h('span', { class: ['meter', lv === 0 && 'meter-none'], role: 'img', 'aria-label': label },
    h('span', { class: 'bars', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= lv ? 'on' : null }))),
    h('span', { class: 'lvtxt', 'aria-hidden': 'true' }, label));
}

/**
 * Radar of target vs current level per axis (0–5). axes: [{label, target, current}].
 * Returns an SVG with title/desc; pair it with a data table for screen readers.
 */
export function Radar({ axes, title, targetLabel, currentLabel }) {
  const W = 520, H = 440, cx = 260, cy = 222, R = 150, n = Math.max(axes.length, 3);
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
  const g = s('g');
  for (let lv = 1; lv <= 5; lv++) g.append(s('polygon', { points: axes.map((_, i) => pt(i, lv).join(',')).join(' '), fill: 'none', stroke: 'var(--line)', 'stroke-width': lv === 5 ? 1.4 : 1 }));
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 5); g.append(s('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--line)' }));
    const [tx, ty] = pt(i, 5.9);
    g.append(s('text', { x: tx, y: ty + 4, 'text-anchor': Math.abs(tx - cx) < 8 ? 'middle' : (tx > cx ? 'start' : 'end'), 'font-size': 12, fill: 'var(--ink)' }, a.label));
  });
  g.append(s('polygon', { points: axes.map((a, i) => pt(i, a.current).join(',')).join(' '), fill: 'var(--info)', 'fill-opacity': .22, stroke: 'var(--info)', 'stroke-width': 1.5 }));
  g.append(s('polygon', { points: axes.map((a, i) => pt(i, a.target).join(',')).join(' '), fill: 'none', stroke: 'var(--gold)', 'stroke-width': 2.5 }));
  const desc = axes.map(a => `${a.label}: ${targetLabel} ${a.target}, ${currentLabel} ${a.current}`).join('; ');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'radar-svg' }, s('title', {}, title), s('desc', {}, desc), g);
  return h('figure', { class: 'radar' }, svg,
    h('figcaption', { class: 'legend' }, h('span', null, h('i', { class: 'sw sw-target', 'aria-hidden': 'true' }), targetLabel), h('span', null, h('i', { class: 'sw sw-current', 'aria-hidden': 'true' }), currentLabel)));
}
