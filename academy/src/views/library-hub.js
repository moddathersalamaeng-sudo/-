/**
 * Library (Phase 10A, plan §3.1) — #/library?tab=articles|guides|templates&q=
 * One place for what used to be three: the Knowledge Hub articles, the requirement & method guides, and the
 * Professional Library templates — with one search across all of them (the build-time index, src/domain/search.mjs).
 * Old addresses (#/knowledge, #/guides) redirect here; article, guide and template pages keep their own addresses.
 */
import { h, icon } from '../core/dom.js';
import { Tabs, EmptyState, LoadingState } from '../ui/components.js';
import { L, setHashQuery, pageHead } from '../ui/academy.js';
import { embed } from '../ui/bookmark.js';
import { searchIndex, groupResults } from '../domain/search.mjs';
import { knowledgeIndexView, libraryView } from './knowledge.js';
import { guidesIndexView } from './guides.js';
import { smartTemplatesBlock } from './templates.js';

export const LIBRARY_TABS = ['articles', 'guides', 'templates'];
export const LIBRARY_TYPES = ['article', 'guide', 'guide_item', 'template', 'standard'];

/** A grouped result list (also used by the global search page). */
export function resultList(ctx, results) {
  const { t, i18n } = ctx;
  return h('div', { class: 'sresults' }, groupResults(results).map(([type, xs]) => h('section', { class: 'section', 'aria-labelledby': 'sr-' + type, dataset: { rtype: type } },
    h('h2', { id: 'sr-' + type, class: 'h-sm' }, t('x10a.search.types.' + type), ' ', h('span', { class: 'note' }, '(', i18n.number(xs.length), ')')),
    h('ul', { class: 'plain sr-list' }, xs.map(r => h('li', { dataset: { result: r.t, id: r.id } },
      h('a', { href: r.h }, L(ctx, r.ti)), r.su ? h('span', { class: 'note block' }, L(ctx, r.su)) : null))))));
}

export function searchBox(ctx, { id, label, value, onInput, placeholder }) {
  return h('form', { class: 'filters libsearch', role: 'search', 'aria-label': label, onsubmit: e => e.preventDefault() },
    h('div', { class: 'field' }, h('label', { for: id }, icon('search'), ' ', label),
      h('input', { class: 'input', id, type: 'search', value: value || '', placeholder, autocomplete: 'off', oninput: e => onInput(e.target.value) })));
}

export function libraryHubView(ctx, match) {
  const { t, i18n } = ctx;
  const query = match.query || {};
  const tab0 = LIBRARY_TABS.includes(query.tab) ? query.tab : query.kind ? 'templates' : 'articles';
  const state = { tab: tab0, q: query.q || '' };
  const head = pageHead(ctx, { eyebrow: t('knowledge.eyebrow'), title: t('nav.items.library'), lede: t('x10a.lib.lede') });
  const sub = { ...match, path: '/library' };
  const tabs = Tabs({ label: t('nav.items.library'), initial: LIBRARY_TABS.indexOf(tab0), lazy: true,
    tabs: [
      { key: 'articles', label: t('x10a.lib.tabs.articles'), content: () => embed(knowledgeIndexView(ctx, sub)) },
      { key: 'guides', label: t('x10a.lib.tabs.guides'), content: () => embed(guidesIndexView(ctx, sub)) },
      /* Phase 11: the six smart guided templates first, then the Professional Library templates. */
      { key: 'templates', label: t('x10a.lib.tabs.templates'), content: () => h('div', null, smartTemplatesBlock(ctx), embed(libraryView(ctx, { ...sub, query: { kind: query.kind || '' } }))) }
    ],
    onSelect: i => { state.tab = LIBRARY_TABS[i]; setHashQuery('/library', { tab: state.tab, q: state.q }); } });
  const status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'lib-results', hidden: true });
  let timer = null, seq = 0;
  const run = async () => {
    const my = ++seq;
    setHashQuery('/library', { tab: state.tab, q: state.q });
    if (!state.q.trim()) { results.hidden = true; tabs.hidden = false; status.textContent = ''; return; }
    results.hidden = false; tabs.hidden = true;
    results.replaceChildren(LoadingState({ label: t('states.loading') }));
    try {
      const idx = await ctx.loadSearchIndex();
      if (my !== seq) return;
      const hits = searchIndex(idx, state.q, { types: LIBRARY_TYPES, limit: 60 });
      status.textContent = t('x10a.search.count', { n: i18n.number(hits.length) });
      results.replaceChildren(hits.length ? resultList(ctx, hits) : EmptyState({ title: t('p7.course.noMatch'), body: t('x10a.search.noneBody'), level: 2 }),
        h('p', null, h('a', { href: '#/search?q=' + encodeURIComponent(state.q) }, t('x10a.lib.searchAll'), ' ', icon('chevron'))));
    } catch { results.replaceChildren(EmptyState({ title: t('states.errorTitle'), body: t('states.errorBody'), level: 2 })); }
  };
  const box = searchBox(ctx, { id: 'lib-q', label: t('x10a.lib.search'), value: state.q, placeholder: t('x10a.lib.searchPh'), onInput: v => { state.q = v; clearTimeout(timer); timer = setTimeout(run, 180); } });
  if (state.q) setTimeout(run, 0);
  return h('div', { class: 'libhub' }, head, box, status, results, tabs);
}
