/**
 * Phase 7 shared view helpers: localisation of data fields, page heads, governance badges,
 * reviewer-preview banners, link buttons and simple definition lists. Safe DOM only.
 */
import { h, icon } from '../core/dom.js';
import { StatusLabel, Badge, EmptyState } from './components.js';

export const L = (ctx, v) => (typeof v === 'string' ? v : (v?.[ctx.i18n.locale] || v?.en || v?.ar || ''));
export const isReviewer = ctx => ctx.session.roles.includes('reviewer') || ctx.session.roles.includes('admin');
export const linkBtn = (href, label, variant = 'secondary', attrs = {}) => h('a', { class: `btn btn-${variant}`, href, ...attrs }, label);
export const external = (ctx, href, label, variant = 'secondary') => h('a', { class: `btn btn-${variant}`, href, target: '_blank', rel: 'noopener', 'aria-describedby': 'ext-note' }, label);

/** Resolve a hub-relative link (`../#m=iso9001`) against the configured platform base. */
export const platformHref = (ctx, href) => String(href || '').replace(/^\.\.\//, ctx.config.platformBase);

export function pageHead(ctx, { eyebrow, title, lede, actions }) {
  return h('header', { class: 'phead' },
    eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
    h('h1', null, title),
    lede ? h('p', null, lede) : null,
    actions?.length ? h('div', { class: 'btnrow' }, actions) : null);
}

export const govBadge = (ctx, rec) => rec?.governance
  ? StatusLabel({ kind: 'governance', value: rec.governance.content_status, label: ctx.t('labels.governance.' + rec.governance.content_status) })
  : null;

/** Banner shown to reviewers/admins when the page contains content learners cannot see yet. */
export function previewBanner(ctx, records = []) {
  if (!isReviewer(ctx)) return null;
  const drafts = records.filter(r => r?.governance && r.governance.content_status !== 'published');
  if (!drafts.length) return null;
  return h('div', { class: 'banner banner-warn', role: 'note', dataset: { preview: 'true' } },
    h('strong', null, ctx.t('p7.previewTitle')), ' ', ctx.t('p7.previewBody', { n: ctx.i18n.number(drafts.length) }));
}

export const section = (id, title, ...kids) => h('section', { class: 'section', 'aria-labelledby': id }, h('h2', { id }, title), ...kids);

export const facts = rows => h('dl', { class: 'facts' }, rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v))));

/** Visually hidden h2 that keeps the heading outline valid (h1 → h2 → h3) above card lists. */
export const srHeading = text => h('h2', { class: 'sr-only' }, text);

export const chips = (items = []) => h('ul', { class: 'chips' }, items.filter(Boolean).map(x => h('li', null, x)));

export const levelBadge = (ctx, level) => Badge({ label: ctx.t('p7.level', { n: ctx.i18n.digitize(level) }), tone: 'neutral' });

export const hours = (ctx, n) => ctx.t('p7.hours', { n: ctx.i18n.number(n) });
export const minutes = (ctx, n) => ctx.t('p7.minutes', { n: ctx.i18n.number(n) });

/** Localise an effort string from the data ("20 min", "6.5 h") — unknown formats are shown as written. */
export function effortLabel(ctx, s) {
  const m = String(s || '').match(/([\d.]+)\s*(h|min)/i);
  if (!m) return s || '';
  return m[2].toLowerCase() === 'h' ? hours(ctx, parseFloat(m[1])) : minutes(ctx, parseFloat(m[1]));
}

/** Update the query string inside the hash without triggering a re-render. */
export function setHashQuery(path, query) {
  const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  try { history.replaceState(null, '', '#' + path + (q ? '?' + q : '')); } catch { /* sandboxed */ }
}

/** Where a learning target lives in the Academy. */
export function targetHref({ type, target_id }, { courses = [], assessments = [], articles = [] } = {}) {
  if (type === 'course') { const c = courses.find(x => x.id === target_id); return c ? `#/academy/courses/${c.slug}` : null; }
  if (type === 'knowledge') { const a = articles.find(x => x.id === target_id); return a ? `#/knowledge/${a.ecosystem}/${a.slug}` : null; }
  const a = assessments.find(x => x.id === target_id); return a ? `#/assessments/${a.slug}` : null;
}

/** A page whose record is missing or not yet published for this viewer: keeps one h1 per page. */
export function notAvailable(ctx, { title, body, action }) {
  return h('div', { dataset: { unavailable: 'true' } },
    h('header', { class: 'phead' }, h('h1', null, title)),
    EmptyState({ title: ctx.t('p7.pendingHeading'), body, iconName: 'lock', action, level: 2 }));
}

/**
 * A hub toolkit link with its access rule. Toolkits marked `access: "account"` open only after the free sign-in on
 * the hub (cloud-config gate); the badge says so before the learner leaves the Academy.
 */
export function toolLink(ctx, m, { asButton = false, label } = {}) {
  const needsAccount = m.access === 'account';
  const badge = needsAccount ? h('span', { class: 'acc', title: ctx.t('gd.account') }, ctx.t('gd.accountShort')) : null;
  return h('a', { class: asButton ? 'btn btn-secondary' : 'tlink', href: platformHref(ctx, m.href), 'aria-describedby': 'ext-note', dataset: { module: m.id, access: m.access || 'open' },
    'aria-label': (label || L(ctx, m.name)) + (needsAccount ? ' — ' + ctx.t('gd.account') : '') },
  asButton ? [label || L(ctx, m.name), ' ', badge] : [h('span', { class: 'n' }, L(ctx, m.name), badge ? ' ' : null, badge), m.note ? h('span', { class: 'd' }, L(ctx, m.note)) : null],
  ' ', icon('external'));
}

/**
 * Minimal, safe rendering of the toolkits' FAQ text: paragraphs (blank line), "- " and "1. " lists, and **bold**.
 * Everything is text nodes; no HTML from data is ever parsed.
 */
export function mdLite(text) {
  const inline = s => String(s).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p => p.startsWith('**') && p.endsWith('**') ? h('strong', null, p.slice(2, -2)) : p);
  return String(text || '').split(/\n{2,}/).map(block => {
    const lines = block.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length && lines.every(x => /^[-•]\s+/.test(x))) return h('ul', null, lines.map(x => h('li', null, inline(x.replace(/^[-•]\s+/, '')))));
    if (lines.length && lines.every(x => /^\d+[.)]\s+/.test(x))) return h('ol', null, lines.map(x => h('li', null, inline(x.replace(/^\d+[.)]\s+/, '')))));
    return h('p', null, lines.flatMap((x, i) => i ? [h('br'), ...inline(x)] : inline(x)));
  });
}
