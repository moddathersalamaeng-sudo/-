/**
 * Shared UI components (Phase 1). Components are language-agnostic: callers
 * pass already-translated strings. All markup is built with the safe DOM builder.
 */
import { h, icon, nextId, clear } from '../core/dom.js';

export const Button = ({ label, variant = 'primary', onClick, type = 'button', disabled, iconName, attrs = {} }) =>
  h('button', { class: `btn btn-${variant}`, type, disabled, onclick: onClick, ...attrs }, iconName ? icon(iconName) : null, label);

export const LinkButton = ({ label, href, variant = 'secondary', iconName, attrs = {} }) =>
  h('a', { class: `btn btn-${variant}`, href, ...attrs }, iconName ? icon(iconName) : null, label);

export const Link = ({ label, href, attrs = {} }) => h('a', { href, ...attrs }, label);

/** Badge / StatusLabel. tone: neutral | gold | ok | warn | bad | info */
export const Badge = ({ label, tone = 'neutral', title }) => h('span', { class: `badge badge-${tone}`, title }, label);

const GOV_TONE = { draft: 'neutral', needs_review: 'warn', in_review: 'info', approved: 'ok', published: 'ok', archived: 'neutral' };
const COURSE_TONE = { cia_internal: 'neutral', exam_prep: 'info', accreditation_pending: 'warn', externally_accredited: 'gold', official_partner: 'gold' };
const CERT_TONE = { attendance: 'neutral', completion: 'neutral', assessment_passed: 'info', platform_credential: 'info', professional_certification: 'warn', externally_accredited: 'gold' };
export const StatusLabel = ({ kind, value, label }) => {
  const tone = (kind === 'governance' ? GOV_TONE : kind === 'course' ? COURSE_TONE : CERT_TONE)[value] || 'neutral';
  return h('span', { class: `badge badge-${tone}`, dataset: { kind, value } }, label);
};

export const Card = ({ title, body, children = [], tag = 'article' }) =>
  h(tag, { class: 'card' }, title ? h('h3', null, title) : null, body ? h('p', null, body) : null, children);

/** Table: columns [{key,label,num?}] rows [{...}] — cell values may be strings or Nodes. */
export const Table = ({ columns, rows, caption }) =>
  h('div', { class: 'tbl-wrap', tabindex: '0', role: 'group', 'aria-label': caption },
    h('table', { class: 'tbl' },
      caption ? h('caption', { class: 'sr-only' }, caption) : null,
      h('thead', null, h('tr', null, columns.map(c => h('th', { scope: 'col' }, c.label)))),
      h('tbody', null, rows.map(r => h('tr', null, columns.map((c, i) =>
        i === 0 ? h('th', { scope: 'row' }, r[c.key]) : h('td', { class: c.num ? 'num' : null }, r[c.key])))))));

/* ---------- form fields with validation messaging ---------- */
function wrap({ id, label, hint, control, errId, hintId }) {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    hint ? h('span', { class: 'hint', id: hintId }, hint) : null,
    control,
    h('span', { class: 'err', id: errId, 'aria-live': 'polite' }));
}
function describe(hint, id) { return [hint ? id + '-hint' : null, id + '-err'].filter(Boolean).join(' '); }

export const TextField = ({ name, label, hint, type = 'text', required, value = '', autocomplete, rules = {} }) => {
  const id = nextId('f');
  const control = h('input', { class: 'input', id, name, type, required, value, autocomplete, 'aria-describedby': describe(hint, id), dataset: { rules: JSON.stringify({ required, type, ...rules }) } });
  return wrap({ id, label, hint, control, errId: id + '-err', hintId: id + '-hint' });
};
export const TextArea = ({ name, label, hint, required, rules = {} }) => {
  const id = nextId('f');
  const control = h('textarea', { class: 'textarea', id, name, required, 'aria-describedby': describe(hint, id), dataset: { rules: JSON.stringify({ required, ...rules }) } });
  return wrap({ id, label, hint, control, errId: id + '-err', hintId: id + '-hint' });
};
export const Select = ({ name, label, hint, required, options, placeholder, value = '' }) => {
  const id = nextId('f');
  const control = h('select', { class: 'select', id, name, required, 'aria-describedby': describe(hint, id), dataset: { rules: JSON.stringify({ required }) } },
    placeholder ? h('option', { value: '' }, placeholder) : null,
    options.map(o => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return wrap({ id, label, hint, control, errId: id + '-err', hintId: id + '-hint' });
};
export const RadioGroup = ({ name, legend, options, value, onChange, required }) => {
  const id = nextId('g');
  return h('fieldset', { class: 'fs', id, dataset: { rules: JSON.stringify({ required }), group: name } },
    h('legend', null, legend),
    options.map(o => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value: o.value, checked: o.value === value, onchange: onChange ? () => onChange(o.value) : null }), o.label)),
    h('span', { class: 'err', id: id + '-err', 'aria-live': 'polite' }));
};
export const Checkbox = ({ name, label, checked, required }) => {
  const id = nextId('f');
  return h('div', { class: 'field' },
    h('label', { class: 'choice', for: id }, h('input', { type: 'checkbox', id, name, checked, required, 'aria-describedby': id + '-err', dataset: { rules: JSON.stringify({ required }) } }), label),
    h('span', { class: 'err', id: id + '-err', 'aria-live': 'polite' }));
};

/** Pure validator shared by forms and unit tests. msgs: {required, email, minLength(n)} */
export function validateValue(value, rules, msgs) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (rules.required && (v === '' || v === false || v == null)) return msgs.required;
  if (v && rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return msgs.email;
  if (v && rules.minLength && String(v).length < rules.minLength) return msgs.minLength(rules.minLength);
  return '';
}

/** Validate every rule-bearing control in a form; sets aria-invalid + messages; returns first invalid element. */
export function validateForm(form, msgs) {
  let first = null;
  form.querySelectorAll('[data-rules]').forEach(el => {
    const rules = JSON.parse(el.dataset.rules || '{}');
    let value; let target = el;
    if (el.tagName === 'FIELDSET') { value = el.querySelector('input:checked')?.value ?? ''; target = el.querySelector('input'); }
    else if (el.type === 'checkbox') value = el.checked;
    else value = el.value;
    const msg = validateValue(value, rules, msgs);
    const errEl = el.tagName === 'FIELDSET' ? el.querySelector('.err') : document.getElementById(el.id + '-err');
    if (errEl) errEl.textContent = msg;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && !first) first = target;
  });
  return first;
}

export function ProgressBar({ value, max = 100, label, valueText }) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  return h('div', { class: 'pbar' },
    h('div', { class: 'pbar-track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value), 'aria-valuetext': valueText },
      h('div', { class: 'pbar-fill', style: { inlineSize: (pct * 100).toFixed(1) + '%' } })),
    h('div', { class: 'pbar-meta' }, h('span', null, label), h('span', { 'aria-hidden': 'true' }, valueText)));
}

export function ProgressRing({ ratio, label, valueText, size = 72 }) {
  const ns = 'http://www.w3.org/2000/svg'; const r = (size - 8) / 2; const c = 2 * Math.PI * r;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true');
  for (const [stroke, dash] of [['var(--surface-2)', null], ['var(--gold)', c * Math.max(0, Math.min(1, ratio))]]) {
    const ci = document.createElementNS(ns, 'circle');
    ci.setAttribute('cx', size / 2); ci.setAttribute('cy', size / 2); ci.setAttribute('r', r);
    ci.setAttribute('fill', 'none'); ci.setAttribute('stroke', stroke); ci.setAttribute('stroke-width', '8');
    if (dash !== null) { ci.setAttribute('stroke-dasharray', `${dash} ${c}`); ci.setAttribute('stroke-linecap', 'round'); }
    svg.appendChild(ci);
  }
  return h('div', { class: 'ring', role: 'img', 'aria-label': `${label}: ${valueText}` }, svg, h('span', { class: 'val', 'aria-hidden': 'true' }, valueText));
}

/** Accessible tabs (WAI-ARIA APG): arrow keys, Home/End, roving tabindex; RTL-aware arrows. */
export function Tabs({ label, tabs, initial = 0 }) {
  const base = nextId('tabs');
  const list = h('div', { role: 'tablist', 'aria-label': label });
  const panels = [];
  const buttons = tabs.map((t, i) => {
    const b = h('button', { role: 'tab', id: `${base}-t${i}`, 'aria-controls': `${base}-p${i}`, 'aria-selected': String(i === initial), tabindex: i === initial ? '0' : '-1', type: 'button' }, t.label);
    panels.push(h('div', { role: 'tabpanel', id: `${base}-p${i}`, 'aria-labelledby': `${base}-t${i}`, tabindex: '0', hidden: i !== initial }, t.content()));
    return b;
  });
  const select = (i, focus = true) => {
    buttons.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
    if (focus) buttons[i].focus();
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', e => {
      const rtl = document.documentElement.dir === 'rtl';
      const n = buttons.length; let k = null;
      if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) k = (i + 1) % n;
      if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) k = (i - 1 + n) % n;
      if (e.key === 'Home') k = 0; if (e.key === 'End') k = n - 1;
      if (k !== null) { e.preventDefault(); select(k); }
    });
    list.appendChild(b);
  });
  return h('div', { class: 'tabs' }, list, panels);
}

/** Modal dialog using native <dialog> (focus containment, Esc) and focus return. */
export function openDialog({ title, body, actions, closeLabel }) {
  const opener = document.activeElement;
  const titleId = nextId('dlg');
  const dlg = h('dialog', { class: 'dlg', 'aria-labelledby': titleId });
  const close = (result) => { dlg.close(result || ''); };
  dlg.addEventListener('close', () => { dlg.remove(); if (opener && opener.focus) opener.focus(); });
  dlg.append(h('div', { class: 'dlg-in' },
    h('h2', { id: titleId }, title),
    typeof body === 'string' ? h('p', null, body) : body,
    h('div', { class: 'btnrow' }, actions.map(a => Button({ label: a.label, variant: a.variant || 'secondary', onClick: () => { a.onClick?.(); close(a.value); } })))));
  dlg.setAttribute('aria-describedby', titleId);
  if (closeLabel) dlg.dataset.closeLabel = closeLabel;
  document.body.appendChild(dlg);
  dlg.showModal();
  return { dialog: dlg, close };
}

let toastRegion;
export function toast(message, ms = 2600) {
  if (!toastRegion || !toastRegion.isConnected) {
    toastRegion = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.appendChild(toastRegion);
  }
  clear(toastRegion);
  const el = h('div', { class: 'toast' }, message);
  toastRegion.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

export const EmptyState = ({ title, body, action, iconName = 'compass', level = 2 }) =>
  h('div', { class: 'state empty' }, icon(iconName), h('h' + level, { class: 'state-title' }, title), body ? h('p', null, body) : null, action || null);

export const ErrorState = ({ title, body, retryLabel, onRetry, level = 3 }) =>
  h('div', { class: 'state error', role: 'alert' }, icon('alert'), h('h' + level, { class: 'state-title' }, title), h('p', null, body),
    onRetry ? Button({ label: retryLabel, variant: 'secondary', iconName: 'refresh', onClick: onRetry }) : null);

export const LoadingState = ({ label }) => h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), label);

export const Skeleton = ({ label, lines = 3 }) => h('div', { class: 'skel', role: 'status', 'aria-label': label }, Array.from({ length: lines }, () => h('span')));

/**
 * Data region helper: shows Loading → content | Error(with retry).
 * `load` returns a Promise; `render` turns the data into Nodes.
 * `region.refresh()` re-runs load + render (returns a Promise) — used after a save, instead of reloading the page.
 */
export function dataRegion({ load, render, t, skeleton = false }) {
  const region = h('div', { class: 'region', 'aria-busy': 'true' });
  const run = async () => {
    clear(region); region.setAttribute('aria-busy', 'true');
    region.append(skeleton ? Skeleton({ label: t('states.loading') }) : LoadingState({ label: t('states.loading') }));
    try {
      const data = await load();
      clear(region); region.append(render(data));
    } catch (err) {
      console.warn('[cia] region load failed:', err?.message);
      clear(region);
      region.append(ErrorState({ title: t('states.errorTitle'), body: t('states.errorBody'), retryLabel: t('states.retry'), onRetry: run }));
    } finally { region.setAttribute('aria-busy', 'false'); }
  };
  region.refresh = run;
  run();
  return region;
}
