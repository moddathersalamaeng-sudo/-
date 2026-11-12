/**
 * Training-platform emblem (owner request, 12 Nov 2026): the main platform's logo in the centre, framed by a
 * half-circle band on top carrying the motto «علمًا نافعًا» — the mark of the Academy (منصة التدريب).
 * Inline SVG (no external markup); the logo image is the hub's own (src/ui/emblem-logo.js).
 */
import { PLATFORM_LOGO } from './emblem-logo.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of kids) n.append(c);
  return n;
};
let seq = 0;

/**
 * @param {{motto:string, size?:number, cls?:string, label?:string|null}} o  motto: i18n `app.motto` (the same Arabic words in both
 *   languages — part of the mark); label → role="img" with that name; null → decorative.
 */
export function academyEmblem({ motto, size = 52, cls = 'brand-mark', label = null } = {}) {
  const id = `emb${++seq}`;
  const svg = el('svg', { viewBox: '0 0 200 200', width: size, height: size, class: cls });
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  const defs = el('defs', {}, [
    el('clipPath', { id: id + 'c' }, [el('circle', { cx: 100, cy: 104, r: 70 })]),
    el('path', { id: id + 'p', d: 'M 21 104 A 79 79 0 0 1 179 104' }),
    el('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 1, y2: 1 }, [
      el('stop', { offset: '0', 'stop-color': '#E2C46B' }), el('stop', { offset: '1', 'stop-color': '#B88B3A' })])
  ]);
  /* half-circle band (top) */
  const band = el('path', { d: 'M 4 104 A 96 96 0 0 1 196 104 L 166 104 A 66 66 0 0 0 34 104 Z', fill: '#0B1E3D', stroke: `url(#${id}g)`, 'stroke-width': 3 });
  /* thin gold ring closing the lower half */
  const ring = el('path', { d: 'M 4 104 A 96 96 0 0 0 196 104', fill: 'none', stroke: `url(#${id}g)`, 'stroke-width': 3, 'stroke-linecap': 'round' });
  const dots = [[19, 112], [181, 112]].map(([x, y]) => el('circle', { cx: x, cy: y, r: 5, fill: `url(#${id}g)` }));
  const mottoText = el('text', { 'font-size': 24, 'font-weight': 700, fill: '#E2C46B', 'text-anchor': 'middle', 'font-family': '"CIA Arabic", "Segoe UI", Tahoma, sans-serif', direction: 'rtl' },
    [el('textPath', { href: `#${id}p`, startOffset: '50%' }, [motto])]);
  const disc = el('circle', { cx: 100, cy: 104, r: 71, fill: '#FFFFFF', stroke: `url(#${id}g)`, 'stroke-width': 2 });
  const logo = el('image', { href: PLATFORM_LOGO, x: 29, y: 33, width: 142, height: 142, 'clip-path': `url(#${id}c)`, preserveAspectRatio: 'xMidYMid slice' });
  svg.append(defs, ring, band, dots[0], dots[1], mottoText, disc, logo);
  return svg;
}
