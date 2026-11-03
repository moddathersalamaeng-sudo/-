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
  chevron: 'M9 6l6 6-6 6'
};
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
