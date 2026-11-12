/**
 * Knowledge Hub and Professional Library (Phase 3, rebuilt in Phase 7 for readability and next steps).
 *
 *  #/knowledge?q=                 knowledgeIndexView — published articles grouped by discipline, with search
 *  #/knowledge/:ecosystem         ecosystemView
 *  #/knowledge/:ecosystem/:slug   articleView        — article + "next step" panel built from typed relationships
 *  #/library  #/library/:id  #/my-library
 *
 * Ecosystem *names* are used as labels even while the ecosystem records are under review; articles themselves
 * are always filtered by the governance gate.
 */
import { BookmarkButton } from '../ui/bookmark.js';
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, Table, toast } from '../ui/components.js';
import { searchRecords, csvFor } from '../domain/knowledge.mjs';
import { loadContent } from '../data/learner-state.js';
import { L, srHeading, notAvailable, pageHead, linkBtn, section, platformHref, setHashQuery, toolLink } from '../ui/academy.js';
import { sourceList } from './courses.js';

const ecoName = (ctx, content, id) => L(ctx, content.ecosystems.find(e => e.id === id)?.name) || id;
const articleHref = a => `#/knowledge/${a.ecosystem}/${a.slug}`;
const articleCard = (ctx, a) => h('article', { class: 'card', dataset: { article: a.id } },
  h('p', { class: 'eyebrow' }, ctx.t('p7.kind.' + a.kind), ' · ', ctx.t('p7.minutesRead', { n: ctx.i18n.number(a.estimated_minutes || 0) })),
  h('h3', null, h('a', { href: articleHref(a) }, L(ctx, a.title))),
  a.content?.[0]?.text ? h('p', null, L(ctx, a.content[0].text)) : null);

export function knowledgeIndexView(ctx, match) {
  const { t, i18n } = ctx;
  const q = { q: match.query?.q || '' };
  const head = pageHead(ctx, { eyebrow: t('knowledge.eyebrow'), title: t('knowledge.title'), lede: t('knowledge.intro'), actions: [linkBtn('#/guides', t('gd.title')), linkBtn('#/library', t('library.title'))] });
  const region = dataRegion({ t, load: () => loadContent(ctx), render: content => {
    const arts = content.articles;
    if (!arts.length) return EmptyState({ title: t('states.emptyTitle'), body: t('states.emptyBody') });
    const results = h('div', { id: 'k-results' });
    const status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const ecos = [...new Set(arts.map(a => a.ecosystem))];
    const gs = content.guides || [];
    const guidesTeaser = gs.length ? section('k-guides', t('gd.title'), h('p', null, t('gd.summary', { n: i18n.number(gs.length), items: i18n.number(gs.reduce((a, g) => a + g.counts.items, 0)) })),
      h('div', { class: 'btnrow' }, linkBtn('#/guides', t('gd.openAll'), 'primary'))) : null;
    const browse = h('div', { class: 'cards' }, ecos.map(id => h('article', { class: 'card', dataset: { ecosystem: id } },
      h('h3', null, h('a', { href: `#/knowledge/${id}` }, ecoName(ctx, content, id))),
      h('p', { class: 'note' }, t('p7.knowledge.count', { n: i18n.number(arts.filter(a => a.ecosystem === id).length) })))));
    const paint = () => {
      if (match.path !== '/library') setHashQuery('/knowledge', q);
      if (!q.q.trim() || match.path === '/library') { status.textContent = ''; results.replaceChildren(section('k-browse', t('p7.knowledge.browse'), browse), match.path === '/library' ? null : guidesTeaser); return; }
      const hits = searchRecords(arts, q.q, i18n.locale);
      status.textContent = t('p7.knowledge.results', { n: i18n.number(hits.length) });
      results.replaceChildren(hits.length ? h('div', null, srHeading(t('p7.course.results')), h('div', { class: 'cards' }, hits.map(a => articleCard(ctx, a)))) : EmptyState({ title: t('p7.course.noMatch'), body: t('p7.knowledge.noMatchBody') }));
    };
    const search = h('form', { class: 'filters', role: 'search', onsubmit: e => e.preventDefault() },
      h('div', { class: 'field' }, h('label', { for: 'k-q' }, t('p7.knowledge.search')), h('input', { class: 'input', id: 'k-q', type: 'search', value: q.q, oninput: e => { q.q = e.target.value; paint(); } })));
    paint();
    /* Phase 10A: inside the Library the page-level search is the one search; this tab only browses. */
    return match.path === '/library' ? h('div', null, results) : h('div', null, search, status, results);
  } });
  return h('div', null, head, region);
}

export function ecosystemView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadContent(ctx), render: content => {
    const id = match.params.ecosystem;
    const rows = content.articles.filter(a => a.ecosystem === id);
    const tools = ctx.relationships.from('ecosystem', id).filter(r => r.toType === 'platform_module').map(r => content.tools.find(m => m.id === r.toId)).filter(Boolean);
    return h('div', null,
      pageHead(ctx, { eyebrow: t('knowledge.discipline'), title: ecoName(ctx, content, id), lede: t('knowledge.disciplineIntro'), actions: [id === 'iso' ? linkBtn('#/academy/iso', t('nav.items.isoAcademy'), 'primary') : null, linkBtn('#/knowledge', t('knowledge.title'))].filter(Boolean) }),
      rows.length ? h('div', null, srHeading(t('knowledge.title')), h('div', { class: 'cards' }, rows.map(a => articleCard(ctx, a)))) : EmptyState({ title: t('states.emptyTitle'), body: t('states.emptyBody'), action: linkBtn('#/knowledge', t('knowledge.title')) }),
      tools.length ? section('eco-tools', t('p7.course.tools'), h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m))))) : null);
  } });
  return h('div', null, region);
}

/** Next-step links for an article: typed relationships first, then the article's own `related` list. */
export function articleNextSteps(ctx, a, content) {
  const rels = ctx.relationships;
  const out = { courses: [], competencies: [], library: [], tools: [] };
  const add = (k, x) => { if (x && !out[k].some(y => y.id === x.id)) out[k].push(x); };
  for (const r of rels.from('article', a.id)) {
    if (r.toType === 'course') add('courses', content.byId(content.courses, r.toId));
    if (r.toType === 'competency') add('competencies', content.byId(content.competencies, r.toId));
    if (r.toType === 'library_resource') add('library', content.byId(content.library, r.toId));
    if (r.toType === 'platform_module') add('tools', content.tools.find(m => m.id === r.toId));
  }
  for (const r of rels.to('article', a.id)) if (r.fromType === 'course') add('courses', content.byId(content.courses, r.fromId));
  for (const r of a.related || []) {
    if (r.target_type === 'course') add('courses', content.byId(content.courses, r.target_id));
    if (r.target_type === 'competency') add('competencies', content.byId(content.competencies, r.target_id));
    if (r.target_type === 'library_item') add('library', content.byId(content.library, r.target_id));
  }
  for (const r of rels.from('ecosystem', a.ecosystem)) if (r.toType === 'platform_module' && out.tools.length < 4) add('tools', content.tools.find(m => m.id === r.toId));
  return out;
}

export function articleView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadContent(ctx), render: content => {
    const a = content.articles.find(x => x.ecosystem === match.params.ecosystem && x.slug === match.params.slug);
    if (!a) return notAvailable(ctx, { title: t('states.emptyTitle'), body: t('states.emptyBody'), action: linkBtn('#/knowledge', t('knowledge.title')) });
    const next = articleNextSteps(ctx, a, content);
    const nextPanel = h('aside', { class: 'panel feature next-step', 'aria-labelledby': 'ns-h' }, h('h2', { id: 'ns-h' }, t('knowledge.next')),
      next.courses.length ? h('div', null, h('h3', null, t('p7.knowledge.courses')), h('ul', { class: 'plain' }, next.courses.map(c => h('li', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)))))) : null,
      next.library.length ? h('div', null, h('h3', null, t('p7.knowledge.resources')), h('ul', { class: 'plain' }, next.library.map(x => h('li', null, h('a', { href: `#/library/${x.id}` }, L(ctx, x.title)))))) : null,
      next.tools.length ? h('div', null, h('h3', null, t('p7.course.tools')), h('ul', { class: 'plain' }, next.tools.map(m => h('li', null, h('a', { href: platformHref(ctx, m.href), 'aria-describedby': 'ext-note' }, L(ctx, m.name), ' ', icon('external')))))) : null,
      next.competencies.length ? h('div', null, h('h3', null, t('p7.course.competencies')), h('ul', { class: 'plain' }, next.competencies.map(c => h('li', null, L(ctx, c.name))))) : null,
      a.ecosystem === 'iso' ? linkBtn('#/academy/iso', t('nav.items.isoAcademy'), 'primary') : linkBtn(`#/knowledge/${a.ecosystem}`, ecoName(ctx, content, a.ecosystem)));
    return h('article', { class: 'article', dataset: { article: a.id } },
      pageHead(ctx, { eyebrow: `${ecoName(ctx, content, a.ecosystem)} · ${t('p7.minutesRead', { n: ctx.i18n.number(a.estimated_minutes || 0) })}`, title: L(ctx, a.title), actions: [BookmarkButton(ctx, { type: 'article', id: a.id, href: articleHref(a), title: a.title })] }),
      a.learning_objectives?.length ? h('section', { class: 'panel' }, h('h2', { class: 'h-sm' }, t('p7.lesson.objectives')), h('ul', null, a.learning_objectives.map(o => h('li', null, L(ctx, o))))) : null,
      h('div', { class: 'article-grid' },
        h('div', null, a.content.map(b => h('section', { class: 'lblock', dataset: { block: b.type } }, h('h2', null, L(ctx, b.title)),
          b.text ? h('p', null, L(ctx, b.text)) : h('ul', null, (b.items?.[ctx.i18n.locale] || b.items?.en || []).map(x => h('li', null, x))))),
          section('a-src', t('p7.sources.title'), sourceList(ctx, a.sources, content)),
          a.last_reviewed ? h('p', { class: 'note' }, t('p7.knowledge.reviewed', { date: ctx.i18n.date(a.last_reviewed), v: a.version })) : null),
        nextPanel));
  } });
  return h('div', null, region);
}

/* ------------------------------------------------------------------ library */

const libCard = (ctx, x) => h('article', { class: 'card', dataset: { library: x.id } },
  h('p', { class: 'eyebrow' }, ctx.t('p7.libKind.' + x.kind), ' · ', ctx.t('p7.tier.' + x.access_tier)),
  h('h3', null, h('a', { href: `#/library/${x.id}` }, L(ctx, x.title))),
  h('p', null, L(ctx, x.description)));

export function libraryView(ctx, match) {
  const { t, i18n } = ctx;
  const f = { kind: match.query?.kind || '' };
  const head = pageHead(ctx, { eyebrow: t('knowledge.eyebrow'), title: t('library.title'), lede: t('library.intro'), actions: [linkBtn('#/my-library', t('library.my'))] });
  const region = dataRegion({ t, load: () => loadContent(ctx), render: content => {
    const xs = content.library;
    if (!xs.length) return EmptyState({ title: t('states.emptyTitle'), body: t('states.emptyBody') });
    const kinds = [...new Set(xs.map(x => x.kind))];
    const list = h('div', { class: 'cards' });
    const status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const paint = () => { const ys = xs.filter(x => !f.kind || x.kind === f.kind); status.textContent = t('p7.knowledge.results', { n: i18n.number(ys.length) }); list.replaceChildren(...ys.map(x => libCard(ctx, x))); setHashQuery('/library', match.path === '/library' ? { tab: 'templates', ...f } : f); };
    const filters = h('div', { class: 'filters' }, h('div', { class: 'field' }, h('label', { for: 'lib-kind' }, t('p7.library.kind')),
      h('select', { class: 'select', id: 'lib-kind', onchange: e => { f.kind = e.target.value; paint(); } }, h('option', { value: '' }, t('p7.course.any')), kinds.map(k => h('option', { value: k, selected: f.kind === k }, t('p7.libKind.' + k))))));
    paint();
    return h('div', null, filters, status, srHeading(t('p7.course.results')), list);
  } });
  return h('div', null, head, region);
}

export function libraryItemView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: async () => ({ content: await loadContent(ctx), favs: await ctx.repos.libraryFavorites.list() }), render: ({ content, favs }) => {
    const x = content.library.find(z => z.id === match.params.id);
    if (!x) return notAvailable(ctx, { title: t('states.emptyTitle'), body: t('states.emptyBody'), action: linkBtn('#/library', t('library.title')) });
    const saved = favs.some(f => f.id === x.id);
    const toggleSave = async () => {
      if (saved) await ctx.repos.libraryFavorites.remove(x.id); else await ctx.repos.libraryFavorites.save({ id: x.id, savedAt: new Date().toISOString() });
      toast(saved ? t('p7.library.removed') : t('p7.library.saved')); region.refresh();
    };
    const download = () => {
      const blob = new Blob(['﻿' + csvFor(x)], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: x.id + '.csv' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const sd = x.structured_data;
    return h('article', { dataset: { library: x.id } },
      pageHead(ctx, { eyebrow: t('p7.libKind.' + x.kind), title: L(ctx, x.title), lede: L(ctx, x.description), actions: [
        Button({ label: saved ? t('p7.library.unsave') : t('library.save'), variant: saved ? 'secondary' : 'primary', onClick: toggleSave, attrs: { 'aria-pressed': String(saved), 'data-action': 'save-library' } }),
        sd ? Button({ label: t('library.csv'), variant: 'secondary', iconName: 'download', onClick: download }) : null,
        x.link ? h('a', { class: 'btn btn-secondary', href: platformHref(ctx, x.link), 'aria-describedby': 'ext-note' }, t(x.kind === 'simulation' ? 'gd.openGame' : 'library.openTool'), ' ', icon('external')) : null].filter(Boolean) }),
      sd ? Table({ caption: L(ctx, x.title), columns: sd.columns.map((c, i) => ({ key: 'c' + i, label: c })), rows: (sd.rows?.length ? sd.rows : [{}]).map(r => Object.fromEntries(sd.columns.map((c, i) => ['c' + i, r[c] ?? '—']))) }) : null,
      h('p', { class: 'note' }, t(x.governance?.content_source === 'owner' && x.kind !== 'template' ? 'gd.libOwner' : 'p7.library.original')));
  } });
  return h('div', null, region);
}

export function myLibraryView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('knowledge.eyebrow'), title: t('library.my') });
  const region = dataRegion({ t, load: async () => ({ content: await loadContent(ctx), favs: await ctx.repos.libraryFavorites.list() }), render: ({ content, favs }) => {
    const items = favs.map(f => content.library.find(x => x.id === f.id)).filter(Boolean);
    return items.length ? h('div', null, srHeading(t('library.my')), h('div', { class: 'cards' }, items.map(x => libCard(ctx, x))))
      : EmptyState({ title: t('library.empty'), body: t('library.emptyBody'), action: linkBtn('#/library', t('library.title'), 'primary') });
  } });
  return h('div', null, head, region);
}
