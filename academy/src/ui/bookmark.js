/**
 * Phase 10A — bookmarks across courses, lessons, guides, guide items, certifications, templates and articles.
 * Stored in the learner's own `cia:v1:*` collection `bookmarks` (id = "<type>:<id>"); the older Professional Library
 * favourites (`library_favorites`) keep working and are listed alongside.
 */
import { h, icon } from '../core/dom.js';
import { toast } from './components.js';
import { makeBookmark, bookmarkId } from '../domain/academies.mjs';

export function BookmarkButton(ctx, { type, id, href, title, compact = false }) {
  const { t } = ctx;
  const bid = bookmarkId(type, id);
  const btn = h('button', { class: compact ? 'iconbtn bm-btn' : 'btn btn-secondary bm-btn', type: 'button', 'aria-pressed': 'false', dataset: { action: 'bookmark', bookmark: bid } });
  let on = false;
  const paint = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-on', on);
    const label = t(on ? 'x10a.bm.saved' : 'x10a.bm.save');
    btn.replaceChildren(icon('bookmark'), h('span', { class: compact ? 'lbl' : null }, label));
    if (compact) btn.setAttribute('aria-label', label);
  };
  paint();
  ctx.repos.bookmarks.get(bid).then(x => { on = Boolean(x); paint(); }).catch(() => {});
  btn.addEventListener('click', async () => {
    try {
      if (on) await ctx.repos.bookmarks.remove(bid);
      else await ctx.repos.bookmarks.save(makeBookmark({ type, id, href, title }));
      on = !on; paint();
      toast(t(on ? 'x10a.bm.added' : 'x10a.bm.removed'));
    } catch (err) { console.warn('[cia] bookmark failed:', err?.message); toast(t('states.errorTitle')); }
  });
  return btn;
}

/** A view rendered inside a tab: its own page head (h1) is dropped — the hosting page has the h1. */
export function embed(node) {
  const head = node.querySelector(':scope > .phead, :scope > header.phead');
  if (head) head.remove();
  return node;
}
