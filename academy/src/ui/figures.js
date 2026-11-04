/**
 * Explanatory figures (Phase 9, D-32). A figure is data (data/seed/figures.json): a template name, bilingual labels and
 * numbers. This module turns it into an accessible inline SVG — original drawings, no external images. Every figure has a
 * caption and a "how to read it" text, and its text alternative (aria-label + <desc>) is built from its labels, so the
 * meaning is never only in the picture. Horizontal templates mirror for right-to-left reading.
 * Colours come from CSS classes (theme tokens), so figures work in light and dark themes.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon, iconPath } from '../core/dom.js';

const NS = 'http://www.w3.org/2000/svg';
export const W = 640, H = 360;
export const TEMPLATES = ['cycle', 'flow', 'matrix', 'ladder', 'nested', 'pareto', 'histogram', 'control', 'scatter', 'scurve', 'fishbone', 'iceberg',
  'tree', 'kanban', 'table', 'triad', 'hub', 'funnel', 'tiles', 'spectrum', 'bars'];

function el(name, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) e.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k) e.appendChild(k);
  return e;
}

/** Split a label into lines of at most `max` characters (word boundaries). */
export function wrap(s = '', max = 16) {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/** Text block centred on (x, y), wrapped, with the given class. */
function label(x, y, s, { max = 16, size = 13, cls = 'f-ink', anchor = 'middle', weight = null, lh = 1.25 } = {}) {
  const lines = wrap(s, max);
  const t = el('text', { x, y: y - ((lines.length - 1) * size * lh) / 2, 'text-anchor': anchor, 'font-size': size, class: cls, 'dominant-baseline': 'middle', 'font-weight': weight });
  lines.forEach((ln, i) => { const sp = el('tspan', { x, dy: i ? size * lh : 0 }); sp.textContent = ln; t.appendChild(sp); });
  return t;
}
const box = (x, y, w, hh, cls = 'f-box', rx = 10) => el('rect', { x, y, width: w, height: hh, rx, class: cls });
const line = (x1, y1, x2, y2, cls = 'f-line', extra = {}) => el('line', { x1, y1, x2, y2, class: cls, ...extra });
const arrowHead = (id) => el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, el('path', { d: 'M0 0L10 5L0 10z', class: 'f-arrowhead' }));
const arrow = (x1, y1, x2, y2, mid, cls = 'f-arrow') => el('line', { x1, y1, x2, y2, class: cls, 'marker-end': `url(#${mid})` });
const iconAt = (name, x, y, s = 1, cls = 'f-icon') => el('g', { transform: `translate(${x - 12 * s} ${y - 12 * s}) scale(${s})` }, el('path', { d: iconPath(name), class: cls }));

/** Helpers bound to one render: language, mirroring, label lookup. */
function kit(spec, lang) {
  const rtl = lang === 'ar';
  const T = v => (v && typeof v === 'object' ? (v[lang] || v.en || '') : (v ?? ''));
  const mx = x => (rtl && spec.mirror !== false ? W - x : x);
  return { rtl, T, mx };
}

/* ------------------------------------------------------------------ templates */

const R = {};

R.cycle = (s, k, mid) => {
  const steps = s.steps || [];
  const n = steps.length || 4, cx = W / 2, cy = H / 2 + 4, rad = Math.min(130, 60 + n * 14), bw = n > 5 ? 120 : 136, bh = 58;
  const g = [];
  g.push(el('circle', { cx, cy, r: rad, class: 'f-ring' }));
  steps.forEach((st, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n * (k.rtl ? -1 : 1);
    const a2 = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n * (k.rtl ? -1 : 1);
    const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
    const ax = cx + rad * Math.cos(a2), ay = cy + rad * Math.sin(a2);
    const tang = a2 + (Math.PI / 2) * (k.rtl ? -1 : 1);
    g.push(el('path', { d: `M${ax - 7 * Math.cos(tang)} ${ay - 7 * Math.sin(tang)} L${ax + 7 * Math.cos(tang)} ${ay + 7 * Math.sin(tang)}`, class: 'f-arrow', 'marker-end': `url(#${mid})` }));
    g.push(box(x - bw / 2, y - bh / 2, bw, bh, i === s.highlight ? 'f-hi' : 'f-box'));
    g.push(label(x, y - (st.d ? 9 : 0), k.T(st.t), { max: 15, size: 14, weight: 700, cls: i === s.highlight ? 'f-hi-t' : 'f-ink' }));
    if (st.d) g.push(label(x, y + 13, k.T(st.d), { max: 22, size: 10.5, cls: i === s.highlight ? 'f-hi-t' : 'f-soft' }));
  });
  if (s.center) { g.push(el('circle', { cx, cy, r: 46, class: 'f-acc-soft' })); g.push(label(cx, cy, k.T(s.center), { max: 12, size: 13, weight: 700 })); }
  return g;
};

R.flow = (s, k, mid) => {
  const steps = s.steps || [], n = steps.length || 1, g = [];
  if (s.dir === 'v') {
    const bw = 380, gap = 12, bh = Math.min(56, (H - 30 - gap * (n - 1)) / n), x = (W - bw) / 2;
    steps.forEach((st, i) => {
      const y = 15 + i * (bh + gap), hi = (s.highlight ?? -1) === i;
      g.push(box(x + (s.indent ? i * 14 : 0), y, bw - (s.indent ? i * 28 : 0), bh, hi ? 'f-hi' : 'f-box', 8));
      if (st.tag) { g.push(el('circle', { cx: k.mx(x + 26), cy: y + bh / 2, r: 15, class: hi ? 'f-acc' : 'f-acc-soft' })); g.push(label(k.mx(x + 26), y + bh / 2, k.T(st.tag), { size: 12, weight: 700, max: 4 })); }
      g.push(label(W / 2 + (st.tag ? (k.rtl ? -14 : 14) : 0), y + bh / 2, k.T(st.t), { max: 46, size: 13.5, cls: hi ? 'f-hi-t' : 'f-ink', weight: 600 }));
      if (i < n - 1) g.push(arrow(W / 2, y + bh, W / 2, y + bh + gap, mid));
    });
    return g;
  }
  const gap = s.gates ? 30 : 22, bw = Math.min(150, (W - 30 - gap * (n - 1)) / n), total = n * bw + (n - 1) * gap, x0 = (W - total) / 2, y = s.sub ? 110 : 140, bh = 84;
  steps.forEach((st, i) => {
    const xl = x0 + i * (bw + gap), x = k.mx(xl + bw / 2), hi = (s.highlight ?? -1) === i;
    g.push(box(x - bw / 2, y, bw, bh, hi ? 'f-hi' : 'f-box'));
    if (st.tag) g.push(label(x, y + 18, k.T(st.tag), { size: 11, cls: hi ? 'f-hi-t' : 'f-gold', weight: 700, max: 20 }));
    g.push(label(x, y + bh / 2 + (st.tag ? 8 : 0), k.T(st.t), { max: Math.max(9, Math.floor(bw / 8.5)), size: 13, weight: 600, cls: hi ? 'f-hi-t' : 'f-ink' }));
    if (st.d) g.push(label(x, y + bh + 34, k.T(st.d), { max: Math.max(10, Math.floor(bw / 6.8)), size: 10.5, cls: 'f-soft' }));
    if (i < n - 1) {
      const xa = k.mx(xl + bw + 2), xb = k.mx(xl + bw + gap - 2);
      if (s.gates) { const gx = k.mx(xl + bw + gap / 2); g.push(el('path', { d: `M${gx} ${y + bh / 2 - 13} l11 13 -11 13 -11 -13z`, class: 'f-acc' })); }
      else g.push(arrow(xa, y + bh / 2, xb, y + bh / 2, mid));
    }
  });
  if (s.sub) g.push(label(W / 2, 60, k.T(s.sub), { max: 80, size: 13, cls: 'f-soft' }));
  if (s.loop) { const ly = y + bh + (steps.some(x => x.d) ? 70 : 30); g.push(el('path', { d: `M${k.mx(x0 + total - bw / 2)} ${ly} C ${k.mx(x0 + total - bw / 2)} ${ly + 40}, ${k.mx(x0 + bw / 2)} ${ly + 40}, ${k.mx(x0 + bw / 2)} ${ly + 4}`, class: 'f-arrow f-dash', fill: 'none', 'marker-end': `url(#${mid})` })); }
  return g;
};

R.matrix = (s, k) => {
  const rows = s.rows || 2, cols = s.cols || 2, x0 = 110, y0 = 30, w = W - x0 - 30, hh = H - y0 - 60, cw = w / cols, ch = hh / rows, g = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cc = k.rtl ? cols - 1 - c : c, x = x0 + cc * cw - (k.rtl ? 80 : 0), y = y0 + r * ch;
    const cell = (s.cells?.[r] || [])[c];
    const heat = s.heat ? ((c + (rows - 1 - r)) / (rows + cols - 2)) : null;
    g.push(box(x + 3, y + 3, cw - 6, ch - 6, heat === null ? ((s.highlight || []).some(([a, b]) => a === r && b === c) ? 'f-hi' : 'f-box') : heat > 0.66 ? 'f-heat3' : heat > 0.4 ? 'f-heat2' : 'f-heat1', 8));
    if (cell) g.push(label(x + cw / 2, y + ch / 2, k.T(cell), { max: Math.floor(cw / 7.5), size: rows > 3 ? 11 : 13.5, weight: 600, cls: (s.highlight || []).some(([a, b]) => a === r && b === c) ? 'f-hi-t' : 'f-ink' }));
  }
  const ax = k.rtl ? W - 30 : x0 - 14, gx = k.rtl ? x0 - 80 : x0;
  g.push(arrow(ax, y0 + hh, ax, y0, 'mk'));
  g.push(label(k.rtl ? W - 12 : 40, y0 + hh / 2, k.T(s.yLabel), { max: 10, size: 12, cls: 'f-soft', weight: 700 }));
  g.push(arrow(k.rtl ? gx + w : gx, y0 + hh + 14, k.rtl ? gx : gx + w, y0 + hh + 14, 'mk'));
  g.push(label(gx + w / 2, y0 + hh + 36, k.T(s.xLabel), { max: 60, size: 12, cls: 'f-soft', weight: 700 }));
  return g;
};

R.ladder = (s, k) => {
  const lv = s.levels || [], n = lv.length, g = [], top = 20, bh = (H - 40) / n;
  lv.slice().reverse().forEach((st, i) => {
    const idx = n - 1 - i, y = top + i * bh;
    const wv = s.pyramid ? 200 + (idx / Math.max(1, n - 1)) * 360 * (s.inverted ? 1 : -1) + (s.inverted ? 0 : 360) : 420;
    const w = Math.max(160, Math.min(600, s.pyramid ? (s.inverted ? 560 - (n - 1 - idx) * (360 / n) : 220 + (n - 1 - idx) * (340 / n)) : wv));
    const x = (W - w) / 2, hi = (s.highlight ?? -1) === idx;
    g.push(box(x, y + 3, w, bh - 6, hi ? 'f-hi' : idx % 2 ? 'f-box' : 'f-box2', 6));
    g.push(label(k.mx(x + 22), y + bh / 2, String(idx + 1), { size: 13, cls: hi ? 'f-hi-t' : 'f-gold', weight: 700 }));
    g.push(label(W / 2, y + bh / 2 - (st.d ? 7 : 0), k.T(st.t), { max: Math.floor(w / 8), size: 13.5, weight: 700, cls: hi ? 'f-hi-t' : 'f-ink' }));
    if (st.d) g.push(label(W / 2, y + bh / 2 + 11, k.T(st.d), { max: Math.floor(w / 6.4), size: 10.5, cls: hi ? 'f-hi-t' : 'f-soft' }));
  });
  if (s.arrowLabel) { g.push(arrow(k.mx(24), H - 20, k.mx(24), 24, 'mk')); }
  return g;
};

R.nested = (s, k) => {
  const rings = s.rings || [], n = rings.length, g = [], cx = W / 2, cy = H / 2 + 10;
  const R2 = i => [300 - i * (230 / Math.max(1, n)), 165 - i * (130 / Math.max(1, n))];
  rings.forEach((st, i) => { const [rx, ry] = R2(i); g.push(el('ellipse', { cx, cy, rx, ry, class: i === n - 1 ? 'f-hi' : i % 2 ? 'f-box2' : 'f-box' })); });
  rings.forEach((st, i) => {
    const last = i === n - 1, ly = last ? cy : cy - (R2(i)[1] + R2(i + 1)[1]) / 2;
    g.push(label(cx, ly, k.T(st.t), { max: last ? 22 : 44, size: last ? 14 : 12.5, weight: 700, cls: last ? 'f-hi-t' : 'f-ink' }));
  });
  return g;
};

/** Bar-type charts share the axis frame. */
function frame(k, g, { yLabel, xLabel } = {}) {
  const x0 = 70, x1 = W - 60, y0 = 24, y1 = H - 60;
  g.push(line(k.mx(x0), y1, k.mx(x1), y1, 'f-axis'), line(k.mx(x0), y0, k.mx(x0), y1, 'f-axis'));
  if (yLabel) g.push(label(k.mx(24), (y0 + y1) / 2, k.T(yLabel), { max: 8, size: 11, cls: 'f-soft' }));
  if (xLabel) g.push(label(W / 2, H - 12, k.T(xLabel), { max: 70, size: 11.5, cls: 'f-soft' }));
  return { x0, x1, y0, y1 };
}

R.pareto = (s, k) => {
  const g = [], f = frame(k, g, s), bars = [...(s.bars || [])].sort((a, b) => b.v - a.v), tot = bars.reduce((a, b) => a + b.v, 0) || 1;
  const bw = (f.x1 - f.x0) / bars.length, max = bars[0]?.v || 1;
  let cum = 0; const pts = [];
  bars.forEach((b, i) => {
    const hh = ((f.y1 - f.y0 - 10) * b.v) / max, xl = f.x0 + i * bw + 6, x = k.mx(xl + (bw - 12) / 2);
    cum += b.v; const cy = f.y1 - ((f.y1 - f.y0) * cum) / tot;
    g.push(el('rect', { x: x - (bw - 12) / 2, y: f.y1 - hh, width: bw - 12, height: hh, rx: 3, class: cum / tot <= 0.8 + 1e-9 || i === 0 ? 'f-bar-hi' : 'f-bar' }));
    g.push(label(x, f.y1 + 16, k.T(b.t), { max: Math.floor(bw / 6.5), size: 10, cls: 'f-soft' }));
    pts.push([x, cy]);
  });
  g.push(el('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'f-cum' }));
  pts.forEach(([x, y]) => g.push(el('circle', { cx: x, cy: y, r: 3.5, class: 'f-cum-dot' })));
  const y80 = f.y1 - (f.y1 - f.y0) * 0.8;
  g.push(line(k.mx(f.x0), y80, k.mx(f.x1), y80, 'f-ref'));
  g.push(label(k.mx(f.x1 + 28), y80, '80%', { size: 11, cls: 'f-gold', weight: 700 }));
  return g;
};

R.bars = (s, k) => {
  const g = [], f = frame(k, g, s), bars = s.bars || [], bw = (f.x1 - f.x0) / Math.max(1, bars.length), max = Math.max(...bars.map(b => b.v), 1);
  bars.forEach((b, i) => {
    const hh = ((f.y1 - f.y0 - 16) * b.v) / max, x = k.mx(f.x0 + i * bw + bw / 2);
    g.push(el('rect', { x: x - bw * 0.32, y: f.y1 - hh, width: bw * 0.64, height: hh, rx: 4, class: i === s.highlight ? 'f-bar-hi' : 'f-bar' }));
    g.push(label(x, f.y1 - hh - 10, b.vLabel ? k.T(b.vLabel) : String(b.v), { size: 11, cls: 'f-ink', weight: 700 }));
    g.push(label(x, f.y1 + 18, k.T(b.t), { max: Math.floor(bw / 6.3), size: 10.5, cls: 'f-soft' }));
  });
  return g;
};

R.histogram = (s, k) => {
  const g = [], f = frame(k, g, s), bins = s.bins || [], bw = (f.x1 - f.x0) / bins.length, max = Math.max(...bins, 1);
  bins.forEach((v, i) => { const hh = ((f.y1 - f.y0 - 30) * v) / max, x = k.mx(f.x0 + i * bw + bw / 2); g.push(el('rect', { x: x - bw / 2 + 1, y: f.y1 - hh, width: bw - 2, height: hh, class: 'f-bar' })); });
  const at = p => k.mx(f.x0 + p * (f.x1 - f.x0));
  for (const [key, cls] of [['lsl', 'f-limit'], ['usl', 'f-limit'], ['target', 'f-ref']]) {
    if (s[key] === undefined) continue;
    const x = at(s[key]); g.push(line(x, f.y0, x, f.y1, cls));
    g.push(label(x, f.y0 - 8, k.T(s.labels?.[key]) || key.toUpperCase(), { size: 11, cls: cls === 'f-limit' ? 'f-red' : 'f-gold', weight: 700 }));
  }
  if (s.curve) { let d = ''; for (let i = 0; i <= 60; i++) { const p = i / 60, z = (p - s.curve.mean) / s.curve.sd, y = f.y1 - (f.y1 - f.y0 - 30) * Math.exp(-z * z / 2); d += (i ? ' L' : 'M') + at(p) + ' ' + y; } g.push(el('path', { d, class: 'f-cum', fill: 'none' })); }
  return g;
};

R.control = (s, k) => {
  const g = [], f = frame(k, g, s), pts = s.points || [], n = pts.length, lo = s.min ?? Math.min(...pts, s.lcl) - 1, hi = s.max ?? Math.max(...pts, s.ucl) + 1;
  const Y = v => f.y1 - ((v - lo) / (hi - lo)) * (f.y1 - f.y0), X = i => k.mx(f.x0 + 16 + (i * (f.x1 - f.x0 - 32)) / Math.max(1, n - 1));
  for (const [key, cls, lab] of [['ucl', 'f-limit', 'UCL'], ['cl', 'f-ref', 'CL'], ['lcl', 'f-limit', 'LCL']]) {
    if (s[key] === undefined) continue;
    g.push(line(k.mx(f.x0), Y(s[key]), k.mx(f.x1), Y(s[key]), cls));
    g.push(label(k.mx(f.x1 + 26), Y(s[key]), lab, { size: 11, cls: cls === 'f-limit' ? 'f-red' : 'f-gold', weight: 700 }));
  }
  g.push(el('polyline', { points: pts.map((v, i) => `${X(i)},${Y(v)}`).join(' '), class: 'f-series' }));
  const flags = new Set(s.flags || []);
  pts.forEach((v, i) => g.push(el('circle', { cx: X(i), cy: Y(v), r: flags.has(i) ? 6 : 3.5, class: flags.has(i) ? 'f-flag' : 'f-dot' })));
  if (s.note) g.push(label(W / 2, H - 12, k.T(s.note), { max: 90, size: 11.5, cls: 'f-soft' }));
  return g;
};

R.scatter = (s, k) => {
  const g = [], f = frame(k, g, s), pts = s.points || [];
  pts.forEach(([a, b]) => g.push(el('circle', { cx: k.mx(f.x0 + a * (f.x1 - f.x0)), cy: f.y1 - b * (f.y1 - f.y0), r: 4.5, class: 'f-dot' })));
  if (s.trend) g.push(line(k.mx(f.x0 + 0.05 * (f.x1 - f.x0)), f.y1 - s.trend[0] * (f.y1 - f.y0), k.mx(f.x0 + 0.95 * (f.x1 - f.x0)), f.y1 - s.trend[1] * (f.y1 - f.y0), 'f-ref'));
  return g;
};

R.scurve = (s, k) => {
  const g = [], f = frame(k, g, s), series = s.series || [], n = Math.max(...series.map(x => x.values.length), 2), max = Math.max(...series.flatMap(x => x.values), 1);
  const X = i => k.mx(f.x0 + (i * (f.x1 - f.x0)) / (n - 1)), Y = v => f.y1 - (v / max) * (f.y1 - f.y0 - 12);
  series.forEach((ser, j) => {
    g.push(el('polyline', { points: ser.values.map((v, i) => `${X(i)},${Y(v)}`).join(' '), class: 'f-s' + j }));
    const last = ser.values.length - 1;
    g.push(label(X(last) + (k.rtl ? -34 : 34), Y(ser.values[last]), k.T(ser.t), { size: 11.5, cls: 'f-s' + j + '-t', weight: 700, max: 10 }));
  });
  if (s.now !== undefined) { g.push(line(X(s.now), f.y0, X(s.now), f.y1, 'f-ref')); g.push(label(X(s.now), f.y0 - 8, k.T(s.nowLabel), { size: 11, cls: 'f-gold', weight: 700, max: 20 })); }
  return g;
};

R.fishbone = (s, k) => {
  const g = [], bones = s.bones || [], spineY = H / 2, xs = k.mx(40), xe = k.mx(470), head = k.mx(490);
  g.push(line(xs, spineY, xe, spineY, 'f-spine'));
  g.push(el('path', { d: `M${xe} ${spineY - 34} L${head + (k.rtl ? -0 : 0)} ${spineY - 34} L${head} ${spineY + 34} L${xe} ${spineY + 34}z`, class: 'f-hi' }));
  g.push(box(Math.min(head, k.mx(620)), spineY - 40, 130, 80, 'f-hi', 10));
  g.push(label(k.mx(555), spineY, k.T(s.effect), { max: 14, size: 13.5, weight: 700, cls: 'f-hi-t' }));
  const half = Math.ceil(bones.length / 2);
  bones.forEach((b, i) => {
    const top = i < half, j = top ? i : i - half, cnt = top ? half : bones.length - half;
    const bx = 90 + (j + 0.5) * (360 / cnt), by = top ? 52 : H - 52;
    g.push(line(k.mx(bx), by, k.mx(bx + 60), spineY, 'f-bone'));
    g.push(box(k.mx(bx) - 58, by - (top ? 34 : -6), 116, 28, 'f-box2', 6));
    g.push(label(k.mx(bx), by - (top ? 20 : -20), k.T(b.t), { size: 12.5, weight: 700, max: 16 }));
    (b.causes || []).slice(0, 2).forEach((c, ci) => {
      const t = 0.35 + ci * 0.33, cx = bx + 60 * t, cy = by + (spineY - by) * t;
      g.push(line(k.mx(cx), cy, k.mx(cx - 40), cy, 'f-twig'));
      g.push(label(k.mx(cx - 44), cy, k.T(c), { size: 10, cls: 'f-soft', anchor: k.rtl ? 'start' : 'end', max: 20 }));
    });
  });
  return g;
};

R.iceberg = (s, k) => {
  const g = [], wl = 120;
  g.push(el('rect', { x: 0, y: wl, width: W, height: H - wl, class: 'f-water' }));
  g.push(el('path', { d: `M250 ${wl} L300 40 L340 70 L390 ${wl}z`, class: 'f-ice' }));
  g.push(el('path', { d: `M250 ${wl} L225 210 L265 320 L395 328 L430 225 L390 ${wl}z`, class: 'f-ice-under' }));
  g.push(line(0, wl, W, wl, 'f-ref'));
  (s.above || []).forEach((t, i) => g.push(label(k.mx(530), 40 + i * 24, k.T(t), { size: 12.5, weight: 700, max: 24 })));
  (s.below || []).forEach((t, i) => g.push(label(k.mx(i % 2 ? 540 : 110), 165 + Math.floor(i / 2) * 50, k.T(t), { size: 12, cls: 'f-ink', max: 18 })));
  if (s.aboveLabel) g.push(label(k.mx(110), 60, k.T(s.aboveLabel), { size: 13, cls: 'f-gold', weight: 700, max: 18 }));
  if (s.belowLabel) g.push(label(W / 2 + 10, 280, k.T(s.belowLabel), { size: 13, cls: 'f-ink', weight: 700, max: 22 }));
  return g;
};

R.tree = (s, k) => {
  const g = [], kids = s.children || [], n = kids.length, rw = 200, rx = (W - rw) / 2;
  g.push(box(rx, 16, rw, 48, 'f-hi')); g.push(label(W / 2, 40, k.T(s.root), { max: 26, size: 14, weight: 700, cls: 'f-hi-t' }));
  const cw = Math.min(150, (W - 20) / n - 10);
  kids.forEach((c, i) => {
    const x = k.mx(10 + (i + 0.5) * ((W - 20) / n));
    g.push(el('path', { d: `M${W / 2} 64 V88 H${x} V108`, class: 'f-line', fill: 'none' }));
    g.push(box(x - cw / 2, 108, cw, 50, 'f-box')); g.push(label(x, 133, k.T(c.t), { max: Math.floor(cw / 7.6), size: 12.5, weight: 700 }));
    (c.children || []).forEach((cc, j) => {
      const y = 182 + j * 40;
      g.push(line(x, 158, x, y + 15, 'f-line'));
      g.push(box(x - cw / 2 + 10, y, cw - 20, 30, 'f-box2', 6)); g.push(label(x, y + 15, k.T(cc), { max: Math.floor((cw - 20) / 6.6), size: 10.5, cls: 'f-ink' }));
    });
  });
  return g;
};

R.kanban = (s, k) => {
  const g = [], cols = s.cols || [], n = cols.length, cw = (W - 30) / n;
  cols.forEach((c, i) => {
    const x = k.rtl ? W - 15 - (i + 1) * cw : 15 + i * cw;
    g.push(box(x + 4, 14, cw - 8, H - 28, 'f-box2', 8));
    g.push(label(x + cw / 2, 36, k.T(c.t), { size: 13, weight: 700, max: 14 }));
    if (c.wip) g.push(label(x + cw / 2, 56, k.T(c.wip), { size: 10.5, cls: 'f-gold', weight: 700, max: 18 }));
    for (let j = 0; j < (c.cards || 0); j++) g.push(box(x + 14, 72 + j * 46, cw - 28, 36, j === 0 && c.hot ? 'f-hi' : 'f-box', 6));
  });
  return g;
};

R.table = (s, k) => {
  const g = [], cols = s.cols || [], rows = s.rows || [], first = 190, cw = (W - first - 20) / Math.max(1, cols.length), rh = Math.min(44, (H - 60) / Math.max(1, rows.length));
  const cx = i => k.rtl ? W - first - 10 - (i + 0.5) * cw : first + 10 + (i + 0.5) * cw;
  cols.forEach((c, i) => { g.push(box(cx(i) - cw / 2 + 2, 10, cw - 4, 40, 'f-hi', 6)); g.push(label(cx(i), 30, k.T(c), { size: 12, weight: 700, cls: 'f-hi-t', max: Math.floor(cw / 7) })); });
  rows.forEach((r, j) => {
    const y = 58 + j * rh;
    g.push(box(k.rtl ? W - first : 10, y, first - 10, rh - 4, 'f-box2', 6)); g.push(label(k.rtl ? W - first / 2 - 5 : first / 2 + 5, y + rh / 2 - 2, k.T(r.t), { size: 12, weight: 700, max: 24 }));
    (r.cells || []).forEach((v, i) => { g.push(box(cx(i) - cw / 2 + 2, y, cw - 4, rh - 4, v ? 'f-box' : 'f-empty', 6)); if (v) g.push(label(cx(i), y + rh / 2 - 2, k.T(v), { size: 13, weight: 700, cls: 'f-gold', max: 10 })); });
  });
  return g;
};

R.triad = (s, k) => {
  const g = [], c = s.corners || [], pts = [[W / 2, 40], [k.mx(130), H - 50], [k.mx(W - 130), H - 50]];
  g.push(el('polygon', { points: pts.map(p => p.join(',')).join(' '), class: 'f-acc-soft' }));
  pts.forEach((p, i) => { g.push(el('circle', { cx: p[0], cy: p[1], r: 44, class: 'f-hi' })); g.push(label(p[0], p[1], k.T(c[i]?.t ?? c[i]), { max: 12, size: 13, weight: 700, cls: 'f-hi-t' })); });
  if (s.center) g.push(label(W / 2, H / 2 + 30, k.T(s.center), { max: 18, size: 13.5, weight: 700 }));
  return g;
};

R.hub = (s, k) => {
  const g = [], sp = s.spokes || [], n = sp.length, cx = W / 2, cy = H / 2, rad = 128;
  sp.forEach((t, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n * (k.rtl ? -1 : 1), x = cx + rad * 1.65 * Math.cos(a), y = cy + rad * 0.95 * Math.sin(a);
    g.push(line(cx, cy, x, y, s.dashed ? 'f-line f-dash' : 'f-line'));
    g.push(box(x - 70, y - 22, 140, 44, 'f-box')); g.push(label(x, y, k.T(t.t ?? t), { max: 18, size: 12, weight: 600 }));
  });
  g.push(el('circle', { cx, cy, r: 56, class: 'f-hi' })); g.push(label(cx, cy, k.T(s.center), { max: 12, size: 13.5, weight: 700, cls: 'f-hi-t' }));
  return g;
};

R.funnel = (s, k) => {
  const g = [], st = s.stages || [], n = st.length, bh = (H - 30) / n;
  st.forEach((t, i) => {
    const w1 = 600 - i * (420 / n), w2 = 600 - (i + 1) * (420 / n), y = 15 + i * bh;
    g.push(el('path', { d: `M${(W - w1) / 2} ${y} H${(W + w1) / 2} L${(W + w2) / 2} ${y + bh - 4} H${(W - w2) / 2}z`, class: i === n - 1 ? 'f-hi' : i % 2 ? 'f-box2' : 'f-box' }));
    g.push(label(W / 2, y + bh / 2 - 2, k.T(t.t ?? t), { max: Math.floor(w2 / 7.5), size: 13, weight: 700, cls: i === n - 1 ? 'f-hi-t' : 'f-ink' }));
  });
  return g;
};

R.tiles = (s, k) => {
  const g = [], items = s.items || [], n = items.length, cols = n > 8 ? 5 : n > 4 ? 4 : n, rows = Math.ceil(n / cols), cw = (W - 20) / cols, ch = (H - 20) / rows;
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = k.rtl ? W - 10 - (c + 1) * cw : 10 + c * cw, y = 10 + r * ch, hi = (s.highlight ?? -1) === i;
    g.push(box(x + 5, y + 5, cw - 10, ch - 10, hi ? 'f-hi' : 'f-box', 10));
    g.push(iconAt(it.icon || 'check', x + cw / 2, y + ch / 2 - 22, 1.6, hi ? 'f-icon-hi' : 'f-icon'));
    g.push(label(x + cw / 2, y + ch / 2 + 22, k.T(it.t), { max: Math.floor(cw / 7.4), size: 12.5, weight: 700, cls: hi ? 'f-hi-t' : 'f-ink' }));
  });
  return g;
};

R.spectrum = (s, k, mid) => {
  const g = [], marks = s.marks || [], y = H / 2;
  g.push(el('rect', { x: 40, y: y - 10, width: W - 80, height: 20, rx: 10, class: 'f-grad' }));
  g.push(label(k.mx(60), y - 40, k.T(s.from), { size: 12.5, cls: 'f-soft', weight: 700, max: 18, anchor: 'middle' }));
  g.push(label(k.mx(W - 60), y - 40, k.T(s.to), { size: 12.5, cls: 'f-soft', weight: 700, max: 18 }));
  marks.forEach((m, i) => {
    const x = k.mx(70 + (i * (W - 140)) / Math.max(1, marks.length - 1));
    g.push(el('circle', { cx: x, cy: y, r: 14, class: 'f-acc' }));
    g.push(box(x - 70, y + 30, 140, 70, 'f-box', 8));
    g.push(label(x, y + 52, k.T(m.t), { size: 13, weight: 700, max: 16 }));
    if (m.d) g.push(label(x, y + 78, k.T(m.d), { size: 10.5, cls: 'f-soft', max: 22 }));
  });
  return g;
};

/* ------------------------------------------------------------------ public API */

/** Plain-text summary of a figure's labels (used as its text alternative and by tests). */
export function figureText(spec, lang = 'en') {
  const T = v => (v && typeof v === 'object' && !Array.isArray(v) ? (v[lang] || v.en || '') : '');
  const out = [];
  const walk = v => {
    if (!v || typeof v !== 'object') return;
    if (('en' in v) || ('ar' in v)) { const s = T(v); if (s) out.push(s); return; }
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x);
  };
  walk({ ...spec, caption: null, read: null, governance: null, id: null });
  return [...new Set(out)].join(' · ');
}

/** Problems with a figure record (empty = valid). */
export function validateFigure(f) {
  const e = [];
  if (!f?.id) e.push('missing_id');
  if (!TEMPLATES.includes(f?.template)) e.push('unknown_template:' + f?.template);
  if (!f?.caption?.en || !f?.caption?.ar) e.push('missing_caption');
  if (!f?.read?.en || !f?.read?.ar) e.push('missing_read');
  if (!figureText(f, 'en') || !figureText(f, 'ar')) e.push('no_labels');
  if (figureText(f, 'en') && figureText(f, 'ar') && figureText(f, 'en').split(' · ').length !== figureText(f, 'ar').split(' · ').length) e.push('label_parity');
  return e;
}

/** The SVG drawing of one figure (no caption). */
export function figureSvg(spec, lang = 'en') {
  const k = kit(spec, lang);
  const mid = 'fa' + Math.random().toString(36).slice(2, 8);
  const alt = (k.T(spec.caption) ? k.T(spec.caption) + '. ' : '') + figureText(spec, lang);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig-svg', role: 'img', 'aria-label': alt, direction: k.rtl ? 'rtl' : 'ltr', dataset: null });
  svg.dataset.template = spec.template;
  const desc = el('desc'); desc.textContent = alt; svg.appendChild(desc);
  svg.appendChild(el('defs', {}, arrowHead(mid), arrowHead('mk')));
  const draw = R[spec.template];
  const g = el('g', {}, draw ? draw(spec, k, mid) : []);
  /* Templates that use the shared marker id 'mk' get the local one, so several figures on a page never collide. */
  g.querySelectorAll('[marker-end="url(#mk)"]').forEach(n => n.setAttribute('marker-end', `url(#${mid})`));
  svg.querySelector('marker:last-child')?.remove();
  svg.appendChild(g);
  return svg;
}

/**
 * A figure with caption, "how to read it" and an optional source note, ready to place in a lesson or course page.
 * ctx: { t, i18n } ; spec: figure record.
 */
export function Figure(ctx, spec, { compact = false, number = null } = {}) {
  const lang = ctx.i18n?.locale || 'en';
  const T = v => (v && typeof v === 'object' ? (v[lang] || v.en || '') : (v ?? ''));
  return h('figure', { class: ['fig', compact && 'fig-compact'], dataset: { figure: spec.id, template: spec.template } },
    h('div', { class: 'fig-canvas' }, figureSvg(spec, lang)),
    h('figcaption', null,
      h('p', { class: 'fig-cap' }, icon('image'), ' ', number ? h('span', { class: 'fig-no' }, ctx.t('p9.fig.number', { n: ctx.i18n.number(number) }), ' ') : null, T(spec.caption)),
      compact || !spec.read ? null : h('details', { class: 'fig-read' }, h('summary', null, icon('eye'), ' ', ctx.t('p9.fig.howToRead')), h('p', null, T(spec.read)))));
}
