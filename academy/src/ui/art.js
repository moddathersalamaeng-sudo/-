/**
 * Course and academy cover art (Phase 9, D-31). Original, deterministic SVG built from the record's own metadata
 * (family, topic, id) — no external images, no copied artwork, nothing to download, works offline and in both themes.
 * Covers are decorative (aria-hidden): the title and facts beside them carry the meaning.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { iconPath } from '../core/dom.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 400, H = 225;

/** Colour families: navy base + one hue per academy; gold stays the signature accent. */
export const FAMILIES = {
  iso: { a: '#0B1E3D', b: '#1C3F73', hue: '#C6A15B', label: 'ISO' },
  pmi: { a: '#0B1E3D', b: '#0F4C5C', hue: '#7FD1C7', label: 'PM' },
  pmo: { a: '#0B1E3D', b: '#3A2C63', hue: '#C9B6F2', label: 'PMO' },
  quality: { a: '#0B1E3D', b: '#0F5132', hue: '#8BD3A8', label: 'Q' },
  method: { a: '#0B1E3D', b: '#5C3B12', hue: '#F2C879', label: 'M' },
  excellence: { a: '#0B1E3D', b: '#5A1E3A', hue: '#F2A7C3', label: 'X' },
  guide: { a: '#0B1E3D', b: '#23395F', hue: '#C6A15B', label: 'G' }
};

/** Topic → (motif, icon). Matched on id, slug, guide and category, most specific first. */
const TOPICS = [
  /* Phase 10 excellence courses (cover_topic "ex-…"), matched first so their covers differ from each other. */
  [/\bex-radar\b/, 'loop', 'cycle'], [/\bex-evidence\b/, 'lines', 'magnify'], [/\bex-facilitation\b/, 'nodes', 'users'], [/\bex-roadmap\b/, 'gantt', 'flag'],
  [/\bex-award\b/, 'steps', 'medal'], [/\bex-sustain\b/, 'waves', 'refresh'], [/\bex-foundations\b/, 'steps', 'star'],
  [/spc|control-chart/, 'control', 'control'], [/coq|cost-of-quality/, 'iceberg', 'coins'], [/supplier/, 'chain', 'truck'],
  [/lss|green-belt|dmaic|sigma/, 'hexes', 'sigma'], [/cmqoe|leadership-strategy|q-lead/, 'steps', 'crown'], [/q-audit|quality-audit/, 'rings', 'magnify'],
  [/capa|nonconformity|-nc\b|rca|five-whys|fishbone|why5/, 'loop', 'fish'], [/tools|pareto|qt-/, 'bars', 'chart'], [/qms|quality-practice|quality/, 'loop', 'cycle'],
  [/audit/, 'rings', 'magnify'], [/risk|fmea/, 'matrix', 'shield'], [/27001|security/, 'rings', 'lock'], [/45001|ohs|safety/, 'steps', 'hardhat'],
  [/14001|environment/, 'waves', 'globe'], [/9001/, 'loop', 'award'], [/ims|integrated/, 'rings', 'layers'], [/read-iso|read/, 'lines', 'book'],
  [/iso/, 'rings', 'shield'], [/pmp|capm/, 'gantt', 'target'], [/agile|scrum|kanban/, 'loop', 'refresh'], [/stake/, 'nodes', 'users'],
  [/scope|schedule|ssc/, 'gantt', 'calendar'], [/portfolio|pfm/, 'bars', 'pie'], [/p3o|p3m3/, 'grid', 'grid'], [/pmo/, 'grid', 'briefcase'],
  [/project|pm-/, 'gantt', 'briefcase'], [/swot|pestle/, 'grid', 'compass'], [/lessons/, 'lines', 'bulb'], [/a3|pdca/, 'loop', 'cycle'],
  [/efqm|excellence/, 'steps', 'star']
];

export function familyOf(c = {}) {
  if (c.family) return c.family;
  if (c.ecosystem === 'efqm' || c.category === 'efqm') return 'excellence';
  if (c.guide && (c.category === 'quality' || c.ecosystem === 'quality' || ['risk', 'performance'].includes(c.ecosystem))) return 'method';
  if (c.guide) return c.ecosystem === 'iso' || c.category === 'iso' ? 'guide' : (['pmi', 'pmo', 'p3o'].includes(c.ecosystem) ? 'pmo' : 'guide');
  if (c.ecosystem === 'quality' || c.category === 'quality' || c.professional_body_reference === 'ASQ') return 'quality';
  if (c.ecosystem === 'pmo' || c.ecosystem === 'p3o') return 'pmo';
  if (c.ecosystem === 'pmi' || c.category === 'project_management') return 'pmi';
  return 'iso';
}

export function topicOf(c = {}) {
  const key = [c.cover_topic, c.id, c.slug, c.guide, c.category].filter(Boolean).join(' ').toLowerCase();
  for (const [re, motif, ico] of TOPICS) if (re.test(key)) return { motif, icon: ico };
  return { motif: 'lines', icon: 'book' };
}

/** Small deterministic PRNG seeded by a string (FNV-1a → mulberry32). */
export function seeded(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function el(name, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k) e.appendChild(k);
  return e;
}

/** Motif drawn in the hue of the family, on the "art" half of the cover. */
function motif(kind, hue, rnd) {
  const g = el('g', { fill: 'none', stroke: hue, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 });
  const add = (n, a) => g.appendChild(el(n, a));
  const r = (a, b) => a + rnd() * (b - a);
  switch (kind) {
    case 'bars': { const n = 6; for (let i = 0; i < n; i++) { const hh = 110 - i * 15 + r(-6, 6); add('rect', { x: 220 + i * 26, y: 190 - hh, width: 18, height: hh, rx: 3, fill: hue, 'fill-opacity': 0.18 }); }
      add('path', { d: 'M229 95 C 270 60, 320 45, 371 40', 'stroke-dasharray': '4 5' }); break; }
    case 'control': { add('path', { d: 'M210 70H390M210 170H390', 'stroke-dasharray': '6 6' }); add('path', { d: 'M210 120H390', opacity: 0.6 });
      let d = 'M210 120'; for (let x = 225; x <= 390; x += 15) d += ` L${x} ${120 + r(-38, 38)}`; add('path', { d, 'stroke-width': 2.5 });
      for (let x = 225; x <= 390; x += 15) add('circle', { cx: x, cy: 0, r: 0 }); break; }
    case 'iceberg': { add('path', { d: 'M205 110H395', opacity: 0.8 }); add('path', { d: 'M265 110 L300 55 L330 75 L345 110', fill: hue, 'fill-opacity': 0.25 });
      add('path', { d: 'M240 110 L230 160 L280 205 L350 200 L385 150 L360 110', fill: hue, 'fill-opacity': 0.1, 'stroke-dasharray': '5 5' }); break; }
    case 'chain': { for (let i = 0; i < 4; i++) { const cx = 230 + i * 48, cy = 115 + (i % 2 ? 22 : -22); add('circle', { cx, cy, r: 16, fill: hue, 'fill-opacity': 0.15 }); if (i) add('path', { d: `M${cx - 32} ${cy + (i % 2 ? -44 : 44) / 2 * 0} L${cx - 16} ${cy}` }); }
      add('path', { d: 'M246 93 L262 137 M294 137 L310 93 M342 93 L358 137' }); break; }
    case 'hexes': { const hex = (cx, cy, s) => `M${cx} ${cy - s} L${cx + s * .87} ${cy - s / 2} L${cx + s * .87} ${cy + s / 2} L${cx} ${cy + s} L${cx - s * .87} ${cy + s / 2} L${cx - s * .87} ${cy - s / 2}Z`;
      [[250, 80], [300, 80], [350, 80], [275, 125], [325, 125]].forEach(([x, y], i) => add('path', { d: hex(x, y + 10, 24), fill: hue, 'fill-opacity': 0.08 + i * 0.04 })); break; }
    case 'steps': { add('path', { d: 'M215 195 H260 V160 H300 V125 H340 V90 H385 V55', 'stroke-width': 3 }); add('path', { d: 'M372 40 L385 55 L398 40', opacity: 0.8 }); break; }
    case 'rings': { for (let i = 0; i < 4; i++) add('circle', { cx: 305, cy: 112, r: 22 + i * 22, opacity: 1 - i * 0.2 }); add('path', { d: 'M305 30 V195 M220 112 H390', 'stroke-dasharray': '3 7' }); break; }
    case 'loop': { add('path', { d: 'M305 50 a62 62 0 1 1 -0.1 0', 'stroke-width': 3 }); add('path', { d: 'M298 42 L308 50 L298 58' });
      [[305, 50], [367, 112], [305, 174], [243, 112]].forEach(([x, y]) => add('circle', { cx: x, cy: y, r: 9, fill: hue, 'fill-opacity': 0.35 })); break; }
    case 'matrix': { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) add('rect', { x: 235 + i * 28, y: 45 + j * 28, width: 24, height: 24, rx: 3, fill: hue, 'fill-opacity': 0.04 + ((i + (4 - j)) / 8) * 0.35, stroke: 'none' }); break; }
    case 'gantt': { for (let i = 0; i < 6; i++) { const x = 215 + r(0, 80) + i * 12, w = r(50, 110); add('rect', { x, y: 45 + i * 25, width: Math.min(w, 395 - x), height: 13, rx: 6, fill: hue, 'fill-opacity': 0.2 + (i % 3) * 0.1 }); }
      add('path', { d: 'M330 35V200', 'stroke-dasharray': '4 5' }); break; }
    case 'nodes': { const pts = Array.from({ length: 7 }, () => [r(225, 385), r(45, 185)]); pts.forEach((p, i) => { if (i) add('path', { d: `M${pts[0][0]} ${pts[0][1]} L${p[0]} ${p[1]}`, opacity: 0.5 }); add('circle', { cx: p[0], cy: p[1], r: i ? 8 : 14, fill: hue, 'fill-opacity': 0.3 }); }); break; }
    case 'grid': { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add('rect', { x: 245 + i * 44, y: 50 + j * 44, width: 36, height: 36, rx: 6, fill: (i + j) % 2 ? hue : 'none', 'fill-opacity': 0.18 }); break; }
    case 'waves': { for (let i = 0; i < 5; i++) add('path', { d: `M210 ${70 + i * 28} q 22 -16 45 0 t 45 0 t 45 0 t 45 0`, opacity: 1 - i * 0.15 }); break; }
    default: { for (let i = 0; i < 7; i++) add('path', { d: `M${220 + i * 8} ${50 + i * 20} H${390 - i * 10}`, opacity: 0.9 - i * 0.1 }); }
  }
  return g;
}

/**
 * Cover for a course (or any record with ecosystem/category/id). Options: { family, topic, code, compact }.
 * Returns an <svg> with role=presentation; the visible code chip is drawn in Latin digits on purpose (a course code).
 */
export function courseCover(c = {}, opts = {}) {
  const fam = FAMILIES[opts.family || familyOf(c)] || FAMILIES.iso;
  const top = { ...topicOf(c), ...(opts.topic || {}) };
  const rnd = seeded(String(c.id || c.slug || 'cia'));
  const gid = 'cv' + Math.floor(rnd() * 1e9).toString(36);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cover-art', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid slice', dataset: null });
  svg.dataset.motif = top.motif;
  const defs = el('defs', {},
    el('linearGradient', { id: gid + 'g', x1: 0, y1: 0, x2: 1, y2: 1 }, el('stop', { offset: '0%', 'stop-color': fam.a }), el('stop', { offset: '100%', 'stop-color': fam.b })),
    el('radialGradient', { id: gid + 'r', cx: '0.25', cy: '0.4', r: '0.6' }, el('stop', { offset: '0%', 'stop-color': fam.hue, 'stop-opacity': 0.35 }), el('stop', { offset: '100%', 'stop-color': fam.hue, 'stop-opacity': 0 })),
    el('pattern', { id: gid + 'p', width: 16, height: 16, patternUnits: 'userSpaceOnUse' }, el('circle', { cx: 2, cy: 2, r: 1, fill: '#FFFFFF', 'fill-opacity': 0.09 })));
  svg.appendChild(defs);
  svg.appendChild(el('rect', { width: W, height: H, fill: `url(#${gid}g)` }));
  svg.appendChild(el('rect', { width: W, height: H, fill: `url(#${gid}p)` }));
  svg.appendChild(el('rect', { width: W, height: H, fill: `url(#${gid}r)` }));
  svg.appendChild(motif(top.motif, fam.hue, rnd));
  /* Gold signature: a thin arc and rule, the house accent. */
  svg.appendChild(el('path', { d: `M0 ${H - 26} Q ${W * 0.45} ${H - 70 - rnd() * 30} ${W} ${H - 18}`, fill: 'none', stroke: '#C6A15B', 'stroke-width': 1.5, opacity: 0.7 }));
  /* Icon medallion. */
  const m = el('g', { transform: 'translate(40 58)' },
    el('circle', { cx: 48, cy: 48, r: 50, fill: '#FFFFFF', 'fill-opacity': 0.07, stroke: '#C6A15B', 'stroke-opacity': 0.7, 'stroke-width': 1.5 }),
    el('circle', { cx: 48, cy: 48, r: 38, fill: fam.hue, 'fill-opacity': 0.14 }),
    el('g', { transform: 'translate(22 22) scale(2.15)' }, el('path', { d: iconPath(top.icon), fill: 'none', stroke: '#F7F5F0', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
  svg.appendChild(m);
  if (!opts.compact && (opts.code || c.code || c.id)) {
    const code = String(opts.code || c.code || c.id).replace(/^CRS-/, '');
    const t = el('text', { x: 24, y: 32, fill: '#F7F5F0', 'fill-opacity': 0.85, 'font-size': 13, 'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace', 'letter-spacing': 1, direction: 'ltr' });
    t.textContent = code;
    svg.appendChild(t);
  }
  return svg;
}

/** Wide banner for academy landings and the home page (same language as covers, wider canvas). */
export function academyBanner(family, iconName, seed = family) {
  const fam = FAMILIES[family] || FAMILIES.iso;
  const rnd = seeded(seed);
  const gid = 'bn' + Math.floor(rnd() * 1e9).toString(36);
  const svg = el('svg', { viewBox: '0 0 1200 300', class: 'banner-art', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid slice' });
  svg.appendChild(el('defs', {},
    el('linearGradient', { id: gid + 'g', x1: 0, y1: 0, x2: 1, y2: 0.6 }, el('stop', { offset: '0%', 'stop-color': fam.a }), el('stop', { offset: '100%', 'stop-color': fam.b })),
    el('pattern', { id: gid + 'p', width: 22, height: 22, patternUnits: 'userSpaceOnUse' }, el('circle', { cx: 2, cy: 2, r: 1.2, fill: '#FFFFFF', 'fill-opacity': 0.08 }))));
  svg.appendChild(el('rect', { width: 1200, height: 300, fill: `url(#${gid}g)` }));
  svg.appendChild(el('rect', { width: 1200, height: 300, fill: `url(#${gid}p)` }));
  for (let i = 0; i < 6; i++) svg.appendChild(el('circle', { cx: 980, cy: 150, r: 40 + i * 38, fill: 'none', stroke: i % 2 ? fam.hue : '#C6A15B', 'stroke-opacity': 0.5 - i * 0.07, 'stroke-width': 1.5 }));
  const g = el('g', { transform: 'translate(926 96) scale(4.5)' }, el('path', { d: iconPath(iconName), fill: 'none', stroke: '#F7F5F0', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }));
  svg.appendChild(g);
  svg.appendChild(el('path', { d: 'M0 292 Q 560 250 1200 286', fill: 'none', stroke: '#C6A15B', 'stroke-width': 2, opacity: 0.55 }));
  return svg;
}
