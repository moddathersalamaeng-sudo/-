/**
 * Safe DOM builder. Content is always set through textContent / attributes —
 * never innerHTML — so data can never inject markup (Audit §3.2 reuse rule).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
const BOOL_ATTRS = new Set(['disabled', 'checked', 'hidden', 'required', 'readonly', 'selected', 'multiple', 'open']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (BOOL_ATTRS.has(k)) { if (v) el.setAttribute(k, ''); }
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Inline SVG icon from a fixed internal path table (no external markup). */
const ICONS = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6L6 18',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 3l10 18H2L12 3zm0 7v5m0 3v.5',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 8v6m0-9v.5',
  refresh: 'M20 11a8 8 0 10-2.3 6.3M20 4v7h-7',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M4 20h16',
  upload: 'M12 20V9m0 0l-4 4m4-4l4 4M4 4h16',
  compass: 'M12 3a9 9 0 100 18 9 9 0 000-18zm3.5 5.5l-2 5-5 2 2-5 5-2z',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zm0 14a2 2 0 012-2h13',
  chevron: 'M9 6l6 6-6 6',
  /* Phase 8 — learning and project icons (original line drawings, 24×24 grid). */
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10zm0 4a1 1 0 100 2 1 1 0 000-2z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3 2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 6.5M18 14c2 .8 3 2.9 3 6',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5',
  award: 'M12 3a6 6 0 100 12 6 6 0 000-12zM8.5 13.5L7 21l5-3 5 3-1.5-7.5',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z',
  briefcase: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  puzzle: 'M5 8h3a2 2 0 114 0h3v3a2 2 0 110 4v3h-3a2 2 0 10-4 0H5v-3a2 2 0 100-4z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  route: 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h4M18 9v6a4 4 0 01-4 4h-4',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  play: 'M12 3a9 9 0 100 18 9 9 0 000-18zm-2 6l5 3-5 3z',
  ladder: 'M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10',
  gauge: 'M4 18a8 8 0 1116 0M12 18l4-6M6.5 13.5l1 .6M12 9v1M17.5 13.5l-1 .6',
  question: 'M12 3a9 9 0 100 18 9 9 0 000-18zm-2.5 7a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4m0 3v.5',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4-4',
  steps: 'M3 20h6v-5h6v-5h6',
  doc: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  /* Phase 9 — quality, visuals and marketing icons (original line drawings, 24×24 grid). */
  cycle: 'M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6M18 3v4h-4M6 21v-4h4',
  fish: 'M3 12h14M17 12l4-3v6zM7 12L5 7M11 12L9 7M7 12l-2 5M11 12l-2 5M14 12l-1.5-4M14 12l-1.5 4',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  control: 'M3 6h18M3 18h18M3 12h2l2-3 2 5 2-4 2 3 2-2 2 1 2-1',
  funnel: 'M3 4h18l-7 8v6l-4 2v-8z',
  sigma: 'M18 5H6l6 7-6 7h12',
  cog: 'M12 9a3 3 0 100 6 3 3 0 000-6zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z',
  coins: 'M12 4c4 0 7 1.3 7 3s-3 3-7 3-7-1.3-7-3 3-3 7-3zM5 7v5c0 1.7 3 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3 3 7 3s7-1.3 7-3v-5',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 100 6 3 3 0 000-6z',
  magnify: 'M10 4a6 6 0 100 12 6 6 0 000-12zm10 16l-5.5-5.5M7.5 10h5M10 7.5v5',
  hardhat: 'M4 17h16M6 17v-3a6 6 0 0112 0v3M10 8V5h4v3M3 20h18',
  medal: 'M8 3l4 6 4-6M12 9a6 6 0 100 12 6 6 0 000-12zm0 3l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9a1 1 0 100-2 1 1 0 000 2z',
  pie: 'M12 3v9h9a9 9 0 11-9-9zm3-.5A9 9 0 0121.5 9H15z',
  scale: 'M12 3v18M7 21h10M4 7h16M6 7l-3 7h6zM18 7l-3 7h6z',
  handshake: 'M2 11l4-4 4 2 4-2 4 2 4 2-3 3M9 9l-3 3 3 3 2-2 2 2 2-2 2 2M2 11l4 4'
};
export const ICON_NAMES = () => Object.keys(ICONS);
export const iconPath = name => ICONS[name] || ICONS.info;
export function icon(name, label) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico ico-' + name);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); }
  else svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.info);
  svg.appendChild(p);
  return svg;
}

let uid = 0;
export const nextId = (prefix = 'cia') => `${prefix}-${++uid}`;
