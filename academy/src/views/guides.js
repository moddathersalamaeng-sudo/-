/**
 * Requirement and method guides — the hub toolkits' explanations inside the Academy.
 *
 *  #/guides                         guidesIndexView — 9 standard guides + 14 method guides
 *  #/guides/:slug?tab=&q=           guideView       — one guide: requirements/steps, what changed, terms, FAQ, templates, official sources
 *  #/guides/:slug/:ref              guideItemView   — one requirement / method step: plain-words requirement, example, how, evidence,
 *                                                     tip, auditor questions, connected requirements, courses that teach it, the toolkit
 *
 * The guide text is the owner's own published explanation (mirrored from modules/*.html by tools/build_toolkit_courses.py);
 * it explains requirements in independent wording and never reproduces standard text. The same renderer
 * (guideItemBody) is used by the lesson player, so a course built from a guide and the guide never drift apart.
 */
import { BookmarkButton } from '../ui/bookmark.js';
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Table } from '../ui/components.js';
import { guideItems, findItem, itemNeighbours, searchItems, guideTabs, lessonsForItem, ladderRung } from '../domain/guides.mjs';
import { loadContent, loadGuides } from '../data/learner-state.js';
import { L, srHeading, notAvailable, pageHead, linkBtn, section, facts, setHashQuery, isReviewer, toolLink, mdLite, previewBanner } from '../ui/academy.js';
import { governanceFooter } from './courses.js';

const KIND_ICON = { standard: 'shield', method: 'steps', practice: 'ladder' };

/**
 * "How to read this page": the anatomy of an item, for each kind of guide, in the order a learner should read it.
 * kind: 'standard' | 'method' | 'practice' | 'all' (index page: one short paragraph per kind).
 */
export function howToRead(ctx, kind, { open = false } = {}) {
  const { t } = ctx;
  const kinds = kind === 'all' ? ['standard', 'practice', 'method'] : [kind];
  const steps = k => ({ standard: ['req', 'ex', 'how', 'ev', 'checks', 'links'], method: ['req', 'how', 'ev', 'gaps', 'tool'], practice: ['req', 'ladder', 'how', 'owner', 'links', 'tool'] })[k] || [];
  const ICON = { req: 'doc', ex: 'bulb', how: 'steps', ev: 'clipboard', checks: 'question', links: 'link', gaps: 'alert', tool: 'external', ladder: 'ladder', owner: 'users' };
  return h('details', { class: 'panel howto', open: open || null, dataset: { howto: kind } },
    h('summary', null, icon('compass'), ' ', t('gd.howto.title')),
    kinds.map(k => h('div', { class: 'howto-kind' },
      kind === 'all' ? h('h3', null, icon(KIND_ICON[k]), ' ', t('gd.howto.kind.' + k)) : null,
      h('p', null, t('gd.howto.intro.' + k)),
      h('ol', { class: 'howto-steps' }, steps(k).map(s => h('li', null, icon(ICON[s]), ' ', h('strong', null, t('gd.howto.step.' + k + '.' + s + '.t')), ' — ', t('gd.howto.step.' + k + '.' + s + '.d')))))),
    h('p', { class: 'note' }, t('gd.howto.rule')));
}

export const guideHref = (slug, ref, query) => `#/guides/${slug}` + (ref ? '/' + encodeURIComponent(ref) : '') + (query ? '?' + new URLSearchParams(query) : '');
const statusBadge = (ctx, s) => s === 'new' || s === 'upd' ? Badge({ label: ctx.t('gd.status.' + s), tone: s === 'new' ? 'gold' : 'info' }) : null;
const toolOf = (content, rec) => content.tools.find(m => m.id === rec.module) || null;
const courseFor = (content, slug) => content.courses.find(c => c.guide === slug) || null;
const snippet = (s, n = 170) => { const x = String(s || ''); return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x; };

/* ------------------------------------------------------------------ index */

function guideCard(ctx, g, content) {
  const { t, i18n } = ctx;
  const tool = toolOf(content, g);
  const course = courseFor(content, g.slug);
  const counts = g.kind === 'standard'
    ? t('gd.counts', { items: i18n.number(g.counts.items), checks: i18n.number(g.counts.checks) })
    : g.kind === 'practice' ? t('gd.countsPractice', { sections: i18n.number(g.counts.sections), items: i18n.number(g.counts.items) })
      : t('gd.countsMethod', { sections: i18n.number(g.counts.sections), items: i18n.number(g.counts.items) });
  return h('article', { class: 'card gcard', dataset: { guide: g.slug, kind: g.kind } },
    h('p', { class: 'eyebrow' }, icon(KIND_ICON[g.kind] || 'book'), ' ', g.kind === 'standard' ? 'ISO ' + g.code : g.code, ' · ', counts),
    h('h3', null, h('a', { href: guideHref(g.slug) }, L(ctx, g.title))),
    g.subtitle && L(ctx, g.subtitle) ? h('p', { class: 'note' }, L(ctx, g.subtitle)) : null,
    h('p', null, snippet(L(ctx, g.lede), 220)),
    h('div', { class: 'btnrow' }, linkBtn(guideHref(g.slug), t('gd.open'), 'primary'),
      course ? linkBtn(`#/academy/courses/${course.slug}`, t('gd.course')) : null,
      tool ? toolLink(ctx, tool, { asButton: true, label: t('gd.useTool') }) : null),
    isReviewer(ctx) && course ? h('p', { class: 'note' }, t('gd.courseState', { state: t('labels.governance.' + course.governance.content_status) })) : null);
}

export function guidesIndexView(ctx) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('gd.eyebrow'), title: t('gd.title'), lede: t('gd.lede'), actions: [linkBtn('#/academy/iso', t('nav.items.isoAcademy')), linkBtn('#/knowledge', t('knowledge.title'))] });
  const region = dataRegion({ t, load: () => loadContent(ctx), render: content => {
    const gs = content.guides;
    if (!gs.length) return EmptyState({ title: t('gd.emptyTitle'), body: t('gd.emptyBody'), iconName: 'lock' });
    const std = gs.filter(g => g.kind === 'standard'), met = gs.filter(g => g.kind === 'method'), prac = gs.filter(g => g.kind === 'practice');
    const total = gs.reduce((a, g) => a + g.counts.items, 0);
    return h('div', null,
      h('p', { class: 'banner banner-info', role: 'note' }, t('gd.summary', { n: i18n.number(gs.length), items: i18n.number(total) })),
      howToRead(ctx, 'all', { open: false }),
      std.length ? section('gd-std', t('gd.standards'), h('p', { class: 'note' }, t('gd.standardsNote')), h('div', { class: 'cards' }, std.map(g => guideCard(ctx, g, content)))) : null,
      prac.length ? section('gd-prac', t('gd.practices'), h('p', { class: 'note' }, t('gd.practicesNote')), h('div', { class: 'cards' }, prac.map(g => guideCard(ctx, g, content)))) : null,
      met.length ? section('gd-met', t('gd.methods'), h('p', { class: 'note' }, t('gd.methodsNote')), h('div', { class: 'cards' }, met.map(g => guideCard(ctx, g, content)))) : null,
      h('p', { class: 'note' }, t('gd.honesty')));
  } });
  return h('div', { class: 'guides' }, head, region);
}

/* ------------------------------------------------------------------ one guide */

async function loadGuidePage(ctx, slug) {
  const content = await loadContent(ctx);
  const rec = content.guides.find(g => g.slug === slug) || null;
  const files = rec ? await loadGuides(ctx, content, [slug]) : {};
  return { content, rec, guide: files[slug] || null };
}

function guideHeader(ctx, rec, guide, content) {
  const { t } = ctx;
  const tool = toolOf(content, rec);
  const course = courseFor(content, rec.slug);
  const head = pageHead(ctx, {
    eyebrow: t(rec.kind === 'standard' ? 'gd.kindStandard' : rec.kind === 'practice' ? 'gd.kindPractice' : 'gd.kindMethod') + (L(ctx, guide.subtitle) ? ' · ' + L(ctx, guide.subtitle) : ''),
    title: L(ctx, guide.title), lede: L(ctx, guide.lede),
    actions: [tool ? toolLink(ctx, tool, { asButton: true, label: t('gd.useTool') }) : null, course ? linkBtn(`#/academy/courses/${course.slug}`, t('gd.course'), 'primary') : null, linkBtn('#/library?tab=guides', t('gd.back')),
      BookmarkButton(ctx, { type: 'guide', id: rec.slug, href: `#/guides/${rec.slug}`, title: guide.title })].filter(Boolean)
  });
  head.append(h('p', { class: 'note' }, t('gd.by', { name: guide.author || '—' })));
  if (tool?.access === 'account') head.append(h('p', { class: 'note' }, icon('lock'), ' ', t('gd.accountNote')));
  return head;
}

function itemList(ctx, guide, items) {
  const bySection = new Map();
  for (const i of items) { if (!bySection.has(i.section.id)) bySection.set(i.section.id, { s: i.section, items: [] }); bySection.get(i.section.id).items.push(i); }
  return h('div', { class: 'gsections' }, [...bySection.values()].map(({ s, items: xs }, n) => h('section', { class: 'gsec', 'aria-labelledby': 'gs-' + n },
    h('h2', { id: 'gs-' + n }, guide.kind === 'standard' ? ctx.t('gd.clause', { n: s.id }) + ' · ' : '', L(ctx, s.title)),
    L(ctx, s.intro) ? h('p', { class: 'note' }, L(ctx, s.intro)) : null,
    h('ol', { class: 'gitems' }, xs.map(i => h('li', { dataset: { ref: i.ref } },
      h('a', { href: guideHref(guide.slug, i.ref) }, guide.kind === 'standard' ? h('span', { class: 'ref' }, i.ref) : null, L(ctx, i.title)),
      ' ', statusBadge(ctx, i.status), guide.kind === 'practice' && i.clause ? h('span', { class: 'clref', title: ctx.t('gd.item.clauseRef') }, i.clause) : null,
      h('span', { class: 'note block' }, snippet(L(ctx, i.req)))))))));
}

function itemsTab(ctx, guide, q) {
  const { t, i18n } = ctx;
  const out = h('div', { id: 'g-items' });
  const status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
  const paint = () => {
    const xs = searchItems(guide, q.q);
    status.textContent = q.q ? t('gd.searchCount', { n: i18n.number(xs.length) }) : '';
    out.replaceChildren(xs.length ? itemList(ctx, guide, xs) : EmptyState({ title: t('gd.noMatch'), body: t('gd.noMatchBody') }));
    setHashQuery('/guides/' + guide.slug, { tab: q.tab === 'items' ? '' : q.tab, q: q.q });
  };
  const form = h('form', { class: 'filters', role: 'search', onsubmit: e => e.preventDefault() },
    h('div', { class: 'field' }, h('label', { for: 'g-q' }, t('gd.search')), h('input', { class: 'input', id: 'g-q', type: 'search', value: q.q, oninput: e => { q.q = e.target.value; paint(); } })));
  paint();
  return h('div', null, form, status, out);
}

const refLink = (ctx, guide, ref) => findItem(guide, ref) ? h('a', { href: guideHref(guide.slug, ref) }, ref) : h('span', null, ref);
const refLinks = (ctx, guide, refs) => (refs || []).flatMap((r, i) => i ? [' · ', refLink(ctx, guide, r)] : [refLink(ctx, guide, r)]);

function tabContent(ctx, guide, tab, q) {
  const { t, i18n } = ctx;
  switch (tab) {
    case 'steps': return h('div', null, h('h2', null, t('gd.tab.steps')),
      guide.note ? h('p', { class: 'banner banner-info', role: 'note' }, L(ctx, guide.note)) : null,
      guide.who ? h('p', null, h('strong', null, t('gd.who')), ' ', L(ctx, guide.who)) : null,
      h('ol', { class: 'gsteps' }, guide.steps.map(s => h('li', null, h('h3', null, L(ctx, s.title)), h('p', null, L(ctx, s.text)), s.ref ? h('p', { class: 'note' }, t('gd.item.clause'), ': ', s.ref) : null))),
      linkBtn(guideHref(guide.slug, null, { tab: 'items' }), t('gd.stepsDetail'), 'primary'));
    case 'items': return h('div', null, h('h2', { class: 'sr-only' }, t(guide.kind === 'standard' ? 'gd.tab.items' : guide.kind === 'practice' ? 'gd.tab.itemsPractice' : 'gd.tab.itemsMethod')),
      guide.kind === 'practice' && guide.note ? h('p', { class: 'banner banner-info', role: 'note' }, L(ctx, guide.note)) : null, itemsTab(ctx, guide, q));
    case 'models': return h('div', null, h('h2', null, t('gd.tab.models')), h('p', { class: 'note' }, t('gd.modelsNote')), h('div', { class: 'cards' }, guide.models.map(m => h('article', { class: 'card' },
      h('h3', null, icon('grid'), ' ', L(ctx, m.name)), h('p', null, L(ctx, m.text)), m.when && L(ctx, m.when) ? h('p', { class: 'note' }, h('strong', null, t('gd.whenFits')), ' ', L(ctx, m.when)) : null))));
    case 'levers': return h('div', null, h('h2', null, t('gd.tab.levers')),
      guide.levers?.length ? section('g-lev', t('gd.levers'), h('div', { class: 'cards' }, guide.levers.map(x => h('article', { class: 'card lever' }, h('h3', null, icon('bulb'), ' ', L(ctx, x.title)), h('p', null, L(ctx, x.text)))))) : null,
      guide.pitfalls?.length ? section('g-pit', t('gd.pitfalls'), h('div', { class: 'cards' }, guide.pitfalls.map(x => h('article', { class: 'card pitfall' }, h('h3', null, icon('alert'), ' ', L(ctx, x.title)), h('p', null, L(ctx, x.text)))))) : null);
    case 'checklist': return h('div', null, h('h2', null, t('gd.tab.checklist')), h('p', { class: 'note' }, t('gd.checklistNote')), h('div', { class: 'cards' }, guide.checklist.map(c => h('article', { class: 'card' },
      h('h3', null, icon('clipboard'), ' ', L(ctx, c.group)), h('ul', { class: 'checks' }, c.items.map(x => h('li', null, icon('check'), ' ', L(ctx, x))))))));
    case 'references': return h('div', null, h('h2', null, t('gd.tab.references')), h('p', { class: 'note' }, t('gd.referencesNote')), Table({ caption: t('gd.tab.references'),
      columns: [{ key: 'c', label: t('gd.col.code') }, { key: 't', label: t('gd.col.title') }, { key: 's', label: t('gd.col.status') }, { key: 'n', label: t('gd.col.note') }],
      rows: guide.references.map(r => ({ c: h('strong', null, r.code), t: L(ctx, r.title), s: L(ctx, r.status), n: L(ctx, r.note) })) }));
    case 'changes': return h('div', null, h('h2', null, t('gd.tab.changes')), h('div', { class: 'cards' }, guide.changes.map(c => h('article', { class: 'card' },
      h('h3', null, L(ctx, c.title)), h('p', null, L(ctx, c.text)), c.refs?.length ? h('p', { class: 'note' }, t('gd.seeItems'), ' ', refLinks(ctx, guide, c.refs)) : null))));
    case 'threads': return h('div', null, h('h2', null, t('gd.tab.threads')), h('p', { class: 'note' }, t('gd.threadsNote')), h('div', { class: 'cards' }, guide.threads.map(th => h('article', { class: 'card' },
      h('h3', null, L(ctx, th.title)), h('p', null, L(ctx, th.text)), h('p', { class: 'chain' }, (th.chain || []).flatMap((r, i) => i ? [' → ', refLink(ctx, guide, r)] : [refLink(ctx, guide, r)]))))));
    case 'terms': return h('div', null, h('h2', null, t('gd.tab.terms')), Table({ caption: t('gd.tab.terms'),
      columns: [{ key: 'no', label: t('gd.col.no') }, { key: 'term', label: t('gd.col.term') }, { key: 'def', label: t('gd.col.def') }],
      rows: guide.terms.map(x => ({ no: x.no, term: h('span', null, h('strong', null, i18n.locale === 'ar' ? x.ar : x.en), h('span', { class: 'note block', lang: i18n.locale === 'ar' ? 'en' : 'ar' }, i18n.locale === 'ar' ? x.en : x.ar)), def: L(ctx, x.def) })) }));
    case 'pairs': return h('div', null, h('h2', null, t('gd.tab.pairs')), h('p', { class: 'note' }, t('gd.pairsNote')), h('div', { class: 'cards' }, guide.pairs.map(p => h('article', { class: 'card' },
      h('h3', null, L(ctx, p.title)), facts(p.items.map(x => [L(ctx, x.term), L(ctx, x.meaning)]))))));
    case 'scale': if (guide.kind === 'practice') return h('div', null, h('h2', null, t('gd.tab.scale')), h('p', { class: 'note' }, t('gd.scaleNotePractice')),
      h('ol', { class: 'scale-list', start: String(guide.scale[0]?.level ?? 0) }, guide.scale.map(x => h('li', { dataset: { level: String(x.level) } }, h('span', { class: 'lvl' }, i18n.number(x.level)), ' ', L(ctx, x.meaning)))));
      return h('div', null, h('h2', null, t('gd.tab.scale')), h('p', { class: 'note' }, t('gd.scaleNote')), Table({ caption: t('gd.tab.scale'),
      columns: [{ key: 'l', label: t('gd.col.level'), num: true }, { key: 'm', label: t('gd.col.meaning') }, { key: 'k', label: t('gd.col.look') }, { key: 'e', label: t('gd.col.evidence') }],
      rows: guide.scale.map(x => ({ l: i18n.number(x.level), m: L(ctx, x.meaning), k: L(ctx, x.look), e: L(ctx, x.evidence) })) }));
    case 'roles': return h('div', null, h('h2', null, t('gd.tab.roles')), facts(guide.roles.map(r => [L(ctx, r.name), L(ctx, r.text)])));
    case 'related': return h('div', null, h('h2', null, t('gd.tab.related')),
      guide.serves?.length ? section('g-serves', t('gd.serves'), h('ul', { class: 'plain' }, guide.serves.map(r => h('li', null, h('strong', null, r.code || L(ctx, r.name)), ' — ', L(ctx, r.name), h('span', { class: 'note block' }, L(ctx, r.text)))))) : null,
      guide.related?.length ? section('g-rel', t('gd.relatedMethods'), h('ul', { class: 'plain' }, guide.related.map(r => h('li', null, h('strong', null, r.code), ' — ', L(ctx, r.name), h('span', { class: 'note block' }, L(ctx, r.text)))))) : null);
    case 'faq': return h('div', null, h('h2', null, t('gd.tab.faq')), h('div', { class: 'faq' }, guide.faq.map(f => h('details', { class: 'card', dataset: { faq: f.id || '' } },
      h('summary', null, L(ctx, f.q)), h('div', { class: 'md' }, mdLite(L(ctx, f.a)))))));
    case 'templates': return h('div', null, h('h2', null, t('gd.tab.templates')), h('p', { class: 'note' }, t(guide.kind === 'practice' ? 'gd.tplNotePractice' : 'gd.tplNote')), h('div', { class: 'cards' }, guide.templates.map(x => h('article', { class: 'card' },
      h('p', { class: 'eyebrow' }, icon('doc'), ' ', guide.kind === 'practice' ? [x.no, x.ref && x.ref !== x.no ? ' · ' + x.ref : ''] : t('gd.clause', { n: x.ref || '—' })), h('h3', null, L(ctx, x.title)), h('p', null, L(ctx, x.purpose)),
      x.fields?.length ? h('details', { class: 'tplfields' }, h('summary', null, t('gd.tplExample', { n: i18n.number(x.fields.length) })),
        facts(x.fields.map(f => [L(ctx, f.label), L(ctx, f.example)]))) : null,
      x.tips?.length ? h('ul', null, x.tips.map(tp => h('li', null, L(ctx, tp)))) : null, x.ref && findItem(guide, x.ref) ? h('p', null, h('a', { href: guideHref(guide.slug, x.ref) }, t('gd.openItem', { ref: x.ref }))) : null))));
    case 'timeline': return h('div', null, h('h2', null, t('gd.tab.timeline')), h('p', { class: 'note' }, t('gd.timelineNote')), h('ol', { class: 'timeline' }, guide.timeline.map(x => h('li', null, h('strong', null, L(ctx, x.date)), ' — ', L(ctx, x.text)))));
    case 'official': return h('div', null, h('h2', null, t('gd.tab.official')), h('p', { class: 'note' }, t('gd.officialNote')),
      h('ul', { class: 'plain sources' }, guide.official.map(s => h('li', null, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, L(ctx, s.name), ' ', icon('external')), h('span', { class: 'note block' }, L(ctx, s.note))))));
    default: return EmptyState({ title: t('gd.noMatch'), body: '' });
  }
}

export function guideView(ctx, match) {
  const { t } = ctx;
  const slug = match.params.slug;
  const region = dataRegion({ t, load: () => loadGuidePage(ctx, slug), render: ({ content, rec, guide }) => {
    if (!rec || !guide) return notAvailable(ctx, { title: t('gd.notFound'), body: t('gd.notFoundBody'), action: linkBtn('#/guides', t('gd.back')) });
    const tabs = guideTabs(guide);
    const q = { tab: tabs.includes(match.query?.tab) ? match.query.tab : tabs[0], q: match.query?.q || '' };
    const label = k => k === 'items' && guide.kind !== 'standard' ? t(guide.kind === 'practice' ? 'gd.tab.itemsPractice' : 'gd.tab.itemsMethod') : t('gd.tab.' + k);
    const nav = h('nav', { class: 'gtabs', 'aria-label': t('gd.tabsLabel') }, h('ul', null, tabs.map(k => h('li', null,
      h('a', { href: guideHref(slug, null, k === tabs[0] ? null : { tab: k }), 'aria-current': k === q.tab ? 'page' : null, dataset: { tab: k } }, label(k))))));
    return h('article', { class: 'guide', dataset: { guide: slug, kind: guide.kind } },
      previewBanner(ctx, [rec]),
      guideHeader(ctx, rec, guide, content),
      nav,
      q.tab === 'items' || q.tab === 'steps' ? howToRead(ctx, guide.kind) : null,
      h('div', { class: 'gpanel', dataset: { panel: q.tab } }, tabContent(ctx, guide, q.tab, q)),
      h('p', { class: 'note' }, t('gd.sourceNote', { version: rec.version })),
      isReviewer(ctx) ? governanceFooter(ctx, rec) : null);
  } });
  return h('div', { class: 'guides' }, region);
}

/* ------------------------------------------------------------------ one item (also used by the lesson player) */

/**
 * The teaching body of one guide item. `level` is the heading level for its sections (2 under a page h1).
 * Returns an array of section nodes.
 */
const BLOCK_ICON = { req: 'doc', reqMethod: 'doc', reqPractice: 'doc', ex: 'bulb', how: 'steps', actions: 'steps', ev: 'clipboard', ladder: 'ladder', gaps: 'alert', tips: 'star',
  checks: 'question', links: 'link', deps: 'link', cross: 'puzzle', questions: 'gauge', topics: 'grid', roadmap: 'route' };

/** Practice guides (ISO 21500, P3O, P3M3, PMO Excellence): the statement, the evidence ladder, actions, maturity questions and links. */
function practiceBody(ctx, guide, item, { level, compact, guides }) {
  const { t, i18n } = ctx;
  const H = 'h' + level;
  const blk = (key, cls, ...kids) => h('section', { class: ['lblock', 'gblock', cls], dataset: { block: key } }, h(H, null, icon(BLOCK_ICON[key] || 'info'), ' ', t('gd.item.' + key)), ...kids);
  const isMaturity = Boolean(item.questions?.length);
  const titleOf = slug => L(ctx, (guides || []).find(g => g.slug === slug)?.title) || slug;
  const deps = [...(item.links?.in || []).map(l => ({ ...l, dir: 'in' })), ...(item.links?.out || []).map(l => ({ ...l, dir: 'out' }))];
  return [
    blk('reqPractice', 'lblock-concept', h('p', null, L(ctx, item.req)),
      item.clause ? h('p', { class: 'note' }, icon('link'), ' ', t('gd.item.clauseRef'), ': ', h('span', { class: 'clref' }, item.clause)) : null,
      item.topics && L(ctx, item.topics) ? h('p', { class: 'note' }, h('strong', null, t('gd.item.topics')), ' ', L(ctx, item.topics)) : null),
    item.ev?.length && item.ladder ? blk('ladder', 'lblock-evidence', h('p', { class: 'note' }, t('gd.item.ladderNote')),
      h('ol', { class: 'ladder' }, item.ev.map((x, i) => h('li', { dataset: { rung: String(i + 1) } },
        h('span', { class: 'rung' }, t('gd.rung.' + ladderRung(i, item.ev.length))), ' ', L(ctx, x))))) : null,
    isMaturity ? blk('questions', 'lblock-checks', h('p', { class: 'note' }, t('gd.item.questionsNote')),
      item.questions.map((q, n) => h('details', { class: 'mq', open: n === 0 || null },
        h('summary', null, h('span', { class: 'lvl' }, i18n.number(n + 1)), ' ', L(ctx, q.q)),
        h('ol', { class: 'levels' }, q.levels.map(l => h('li', { dataset: { level: String(l.level) } }, h('span', { class: 'rung' }, t('gd.levelN', { n: i18n.number(l.level) })), ' ', L(ctx, l.text))))))) : null,
    item.how?.length ? blk(isMaturity ? 'roadmap' : 'actions', 'lblock-scenario', h('ol', null, item.how.map(x => h('li', null, L(ctx, x))))) : null,
    isMaturity && item.ev?.length ? blk('ev', 'lblock-evidence', h('ul', null, item.ev.map(x => h('li', null, L(ctx, x))))) : null,
    item.owner || item.kpi ? h('div', { class: 'panel ownerkpi' }, facts([item.owner ? [h('span', null, icon('users'), ' ', t('gd.item.owner')), L(ctx, item.owner)] : null,
      item.kpi ? [h('span', null, icon('chart'), ' ', t('gd.item.kpi')), L(ctx, item.kpi)] : null])) : null,
    !compact && item.cross?.length ? blk('cross', 'lblock-links', h('p', { class: 'note' }, t('gd.item.crossNote')),
      h('ul', { class: 'chips' }, item.cross.map(x => h('li', null, h('a', { href: guideHref(x.guide, x.ref) }, titleOf(x.guide), ' · ', x.ref))))) : null,
    !compact && deps.length ? blk('deps', 'lblock-links', h('ul', { class: 'plain' }, deps.map(l => {
      const target = findItem(guide, l.ref);
      return h('li', null, h('span', { class: 'note' }, t(l.dir === 'in' ? 'gd.item.dependsOn' : 'gd.item.enables'), ' '),
        target ? h('a', { href: guideHref(guide.slug, l.ref) }, L(ctx, target.title)) : l.ref);
    }))) : null
  ].filter(Boolean);
}

export function guideItemBody(ctx, guide, item, { level = 2, compact = false, guides = null } = {}) {
  const { t } = ctx;
  if (guide.kind === 'practice') return practiceBody(ctx, guide, item, { level, compact, guides });
  const H = 'h' + level;
  const blk = (key, cls, ...kids) => h('section', { class: ['lblock', 'gblock', cls], dataset: { block: key } }, h(H, null, icon(BLOCK_ICON[key] || 'info'), ' ', t('gd.item.' + key)), ...kids);
  const list = (xs, tag = 'ul') => h(tag, null, xs.map(x => h('li', null, L(ctx, x))));
  const isMethod = guide.kind === 'method';
  const links = [...(item.links?.out || []).map(l => ({ ...l, dir: 'out' })), ...(item.links?.in || []).map(l => ({ ...l, dir: 'in' }))];
  return [
    blk(isMethod ? 'reqMethod' : 'req', 'lblock-concept', h('p', null, L(ctx, item.req)),
      isMethod && item.clause ? h('p', { class: 'note' }, t('gd.item.clause'), ': ', item.clause) : null),
    item.ex && L(ctx, item.ex) ? blk('ex', 'lblock-worked_example', h('p', null, L(ctx, item.ex))) : null,
    item.how?.length ? blk('how', 'lblock-scenario', list(item.how, 'ol')) : null,
    item.ev?.length ? blk('ev', 'lblock-evidence', list(item.ev)) : null,
    item.gaps?.length ? blk('gaps', 'lblock-common_mistake', list(item.gaps)) : null,
    item.tips?.length ? blk('tips', 'lblock-tips', list(item.tips)) : null,
    item.owner || item.kpi ? h('div', { class: 'panel' }, facts([item.owner ? [t('gd.item.owner'), L(ctx, item.owner)] : null, item.kpi ? [t('gd.item.kpi'), L(ctx, item.kpi)] : null])) : null,
    item.tip && L(ctx, item.tip) ? h('aside', { class: 'banner banner-info gtip', role: 'note' }, h('strong', null, t('gd.item.tip')), ' ', L(ctx, item.tip)) : null,
    item.checks?.length ? blk('checks', 'lblock-checks', list(item.checks)) : null,
    !compact && links.length ? blk('links', 'lblock-links', h('ul', { class: 'plain' }, links.map(l => {
      const target = findItem(guide, l.ref);
      return h('li', null, h('span', { class: 'note' }, t(l.dir === 'out' ? 'gd.item.leadsTo' : 'gd.item.comesFrom'), ' '),
        target ? h('a', { href: guideHref(guide.slug, l.ref) }, l.ref, ' ', L(ctx, target.title)) : l.ref,
        L(ctx, l.why) ? h('span', { class: 'note block' }, L(ctx, l.why)) : null);
    }))) : null
  ].filter(Boolean);
}

/** "Apply it" exercise for a lesson built from a guide item; notes are private and saved with course progress. */
export function guideApply(ctx, guide, item) {
  const { t } = ctx;
  if (guide.kind === 'practice') return {
    prompt: t(item.questions?.length ? 'gd.apply.maturity' : 'gd.apply.practice', { title: L(ctx, item.title) }),
    model: [h('p', null, t(item.questions?.length ? 'gd.apply.modelMaturity' : 'gd.apply.modelPractice')),
      h('ul', null, (item.ladder ? item.ev : item.how).map(x => h('li', null, L(ctx, x))))]
  };
  const isMethod = guide.kind === 'method';
  return {
    prompt: t(isMethod ? 'gd.apply.method' : 'gd.apply.std', { title: L(ctx, item.title) }),
    model: [h('p', null, t(isMethod ? (item.gaps?.length ? 'gd.apply.modelMethod' : 'gd.apply.modelTips') : 'gd.apply.modelStd')),
      h('ul', null, (isMethod ? (item.gaps?.length ? item.gaps : item.tips || []) : item.ev || []).map(x => h('li', null, L(ctx, x))))]
  };
}

/** Collapsible "From the requirement guides" panel for a lesson that draws on guide items (lesson-guide-map). */
export function guideRefsPanel(ctx, refs, guides) {
  const { t } = ctx;
  const rows = refs.map(r => ({ ...r, guide: guides[r.guide], item: guides[r.guide] && findItem(guides[r.guide], r.ref) })).filter(r => r.item);
  if (!rows.length) return null;
  return h('section', { class: 'panel gfrom', 'aria-labelledby': 'gf-h', dataset: { guideRefs: String(rows.length) } },
    h('h2', { id: 'gf-h' }, t('gd.fromGuide')), h('p', { class: 'note' }, t('gd.fromGuideNote')),
    rows.map(r => h('details', { class: 'gref', dataset: { ref: r.ref, guide: r.guide.slug } },
      h('summary', null, h('span', { class: 'note' }, L(ctx, r.guide.title), ' · '), r.guide.kind === 'standard' ? h('strong', null, r.ref, ' ') : null, L(ctx, r.item.title)),
      h('p', null, L(ctx, r.item.req)),
      r.item.ev?.length ? h('p', null, h('strong', null, t('gd.item.ev')), ' ', r.item.ev.map(x => L(ctx, x)).join(' · ')) : null,
      r.item.gaps?.length ? h('p', null, h('strong', null, t('gd.item.gaps')), ' ', r.item.gaps.map(x => L(ctx, x)).join(' · ')) : null,
      !r.item.gaps?.length && r.item.tips?.length ? h('p', null, h('strong', null, t('gd.item.tips')), ' ', r.item.tips.map(x => L(ctx, x)).join(' · ')) : null,
      h('p', null, h('a', { href: guideHref(r.guide.slug, r.ref) }, t('gd.openInGuide')))
    )));
}

export function guideItemView(ctx, match) {
  const { t, i18n } = ctx;
  const { slug, ref } = match.params;
  const region = dataRegion({ t, load: () => loadGuidePage(ctx, slug), render: ({ content, rec, guide }) => {
    const item = guide && findItem(guide, ref);
    if (!rec || !guide || !item) return notAvailable(ctx, { title: t('gd.itemNotFound'), body: t('gd.notFoundBody'), action: linkBtn(rec ? guideHref(slug) : '#/guides', rec ? L(ctx, rec.title) : t('gd.back')) });
    const nb = itemNeighbours(guide, ref);
    const tool = toolOf(content, rec);
    const lessons = lessonsForItem(slug, ref, { courses: content.courses, lessonMap: content.lessonMap });
    const lessonLink = ({ course, lesson }) => {
      const key = lesson.id.startsWith(course.id + '-') ? lesson.id.slice(course.id.length + 1) : lesson.id;
      return h('li', null, h('a', { href: `#/academy/courses/${course.slug}/${encodeURIComponent(key)}` }, L(ctx, lesson.title)), h('span', { class: 'note block' }, L(ctx, course.title)));
    };
    return h('article', { class: 'guide-item lesson', dataset: { guide: slug, ref } },
      h('nav', { class: 'lesson-nav', 'aria-label': t('gd.crumbs') },
        h('a', { href: '#/library?tab=guides' }, t('gd.title')), ' › ', h('a', { href: guideHref(slug) }, L(ctx, guide.title)), ' › ', h('span', null, L(ctx, item.section.title))),
      h('header', { class: 'phead' },
        h('p', { class: 'eyebrow' }, icon(KIND_ICON[guide.kind] || 'book'), ' ', guide.kind === 'standard' ? t('gd.clause', { n: item.ref }) + ' · ' : guide.kind === 'practice' ? L(ctx, item.section.short || item.section.title) + ' · ' : '',
          t('gd.position', { n: i18n.number(nb.index + 1), total: i18n.number(nb.total) }), ' ', statusBadge(ctx, item.status)),
        h('h1', null, guide.kind === 'standard' ? item.ref + ' ' : '', L(ctx, item.title)),
        h('div', { class: 'btnrow' }, BookmarkButton(ctx, { type: 'guide_item', id: `${slug}#${ref}`, href: guideHref(slug, ref), title: { ar: (guide.kind === 'standard' ? item.ref + ' ' : '') + (item.title?.ar || ''), en: (guide.kind === 'standard' ? item.ref + ' ' : '') + (item.title?.en || '') } }))),
      howToRead(ctx, guide.kind),
      guideItemBody(ctx, guide, item, { guides: content.guides }),
      section('gi-learn', t('gd.learnIt'), lessons.length ? h('ul', { class: 'plain' }, lessons.slice(0, 8).map(lessonLink)) : h('p', { class: 'note' }, t('gd.noLessons'))),
      tool ? section('gi-tool', t('gd.useTool'), h('p', null, t('gd.useToolBody')), h('ul', { class: 'tools-mini' }, h('li', null, toolLink(ctx, tool)))) : null,
      h('footer', { class: 'lesson-foot' }, h('div', { class: 'btnrow pager' },
        nb.prev ? linkBtn(guideHref(slug, nb.prev.ref), t('gd.prev'), 'secondary', { rel: 'prev', 'data-action': 'prev-item' }) : null,
        linkBtn(guideHref(slug), t('gd.allItems'), 'quiet'),
        nb.next ? linkBtn(guideHref(slug, nb.next.ref), t('gd.next'), 'primary', { rel: 'next', 'data-action': 'next-item' }) : null)),
      h('p', { class: 'note' }, t('gd.sourceNote', { version: rec.version })));
  } });
  return h('div', { class: 'guides' }, region);
}

export { guideItems };
