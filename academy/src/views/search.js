/**
 * Global search (Phase 10A, plan §4) — #/search?q=&type=
 * Courses, lessons, guides and guide items (clause by clause), certifications, ISO standards, articles and templates,
 * from the build-time index (data/search-index.json, published records only). Arabic is normalised on both sides
 * (أ/إ/آ → ا, ة → ه, ى → ي, diacritics and tatweel removed), so "الجوده" finds "الجودة" and "بند 7.2" finds clause 7.2.
 */
import { h } from '../core/dom.js';
import { EmptyState, LoadingState } from '../ui/components.js';
import { setHashQuery, pageHead } from '../ui/academy.js';
import { searchIndex, SEARCH_TYPES } from '../domain/search.mjs';
import { resultList, searchBox } from './library-hub.js';

export function searchView(ctx, match) {
  const { t, i18n } = ctx;
  const state = { q: match.query?.q || '', type: SEARCH_TYPES.includes(match.query?.type) ? match.query.type : '' };
  const head = pageHead(ctx, { eyebrow: t('app.name'), title: t('x10a.search.title'), lede: t('x10a.search.lede') });
  const status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
  const out = h('div', { class: 'search-out' });
  const typeSel = h('select', { class: 'select', id: 'gs-type', onchange: e => { state.type = e.target.value; run(); } },
    h('option', { value: '' }, t('x10a.search.allTypes')), SEARCH_TYPES.map(ty => h('option', { value: ty, selected: state.type === ty }, t('x10a.search.types.' + ty))));
  let timer = null, seq = 0;
  async function run() {
    const my = ++seq;
    setHashQuery('/search', state);
    if (!state.q.trim()) { status.textContent = ''; out.replaceChildren(h('p', { class: 'note' }, t('x10a.search.examples'))); return; }
    out.replaceChildren(LoadingState({ label: t('states.loading') }));
    try {
      const idx = await ctx.loadSearchIndex();
      if (my !== seq) return;
      const hits = searchIndex(idx, state.q, { types: state.type ? [state.type] : null, limit: 80 });
      status.textContent = t('x10a.search.count', { n: i18n.number(hits.length) });
      out.replaceChildren(hits.length ? resultList(ctx, hits) : EmptyState({ title: t('p7.course.noMatch'), body: t('x10a.search.noneBody'), level: 2 }));
    } catch {
      out.replaceChildren(EmptyState({ title: t('states.errorTitle'), body: t('states.errorBody'), level: 2 }));
    }
  }
  const box = searchBox(ctx, { id: 'gs-q', label: t('x10a.search.label'), value: state.q, placeholder: t('x10a.search.placeholder'), onInput: v => { state.q = v; clearTimeout(timer); timer = setTimeout(run, 180); } });
  box.append(h('div', { class: 'field' }, h('label', { for: 'gs-type' }, t('x10a.search.type')), typeSel));
  setTimeout(() => { run(); document.getElementById('gs-q')?.focus(); }, 0);
  return h('div', { class: 'searchpage' }, head, box, status, out);
}
