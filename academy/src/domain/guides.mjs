/**
 * Requirement and method guides (integration with the hub toolkits).
 *
 * A guide is the owner's published toolkit explanation, mirrored into data/guides/<slug>.json by
 * tools/build_toolkit_courses.py: sections ("clauses") → items. Each item explains one requirement or
 * one method step in plain words: req (what it asks), ex (worked example), how (steps), ev (evidence),
 * tip, checks (auditor questions), gaps (common gaps), links (related items).
 *
 * Courses built from a guide carry lessons with `source: { guide, ref }` instead of copied text, so the
 * guide stays the single source of truth. Pure functions only (no DOM, no fetch).
 */

/** All items of a guide in reading order, each with its section. */
export function guideItems(guide) {
  return (guide?.clauses || []).flatMap(c => (c.items || []).map(i => ({ ...i, section: c })));
}

export function findItem(guide, ref) {
  return guideItems(guide).find(i => i.ref === ref) || null;
}

/** Previous and next item in reading order. */
export function itemNeighbours(guide, ref) {
  const all = guideItems(guide);
  const i = all.findIndex(x => x.ref === ref);
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null, index: i, total: all.length };
}

/** Case- and diacritic-insensitive search across an item's title, requirement and example (both languages). */
export function searchItems(guide, q = '') {
  const n = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[ً-ْـ]/g, '');
  const qq = n(q).trim();
  const all = guideItems(guide);
  if (!qq) return all;
  return all.filter(i => n([i.ref, i.title?.en, i.title?.ar, i.req?.en, i.req?.ar, i.ex?.en, i.ex?.ar].join(' ')).includes(qq));
}

/** Which tabs a guide can show (only those with data). */
export function guideTabs(guide) {
  const tabs = ['items'];
  if (guide?.kind === 'method' && guide.steps?.length) tabs.unshift('steps');
  for (const [k, ok] of [['changes', guide?.changes?.length], ['threads', guide?.threads?.length], ['terms', guide?.terms?.length], ['pairs', guide?.pairs?.length],
    ['scale', guide?.scale?.length], ['roles', guide?.roles?.length], ['related', guide?.related?.length || guide?.serves?.length], ['faq', guide?.faq?.length],
    ['templates', guide?.templates?.length], ['timeline', guide?.timeline?.length], ['official', guide?.official?.length]]) if (ok) tabs.push(k);
  return tabs;
}

/** Every course lesson that teaches a given guide item: generated lessons (`source`) and mapped lessons (lesson-guide-map). */
export function lessonsForItem(slug, ref, { courses = [], lessonMap = [] } = {}) {
  const mapped = new Map(lessonMap.map(m => [m.id, m.refs || []]));
  const out = [];
  for (const c of courses) for (const m of c.modules || []) for (const l of m.lessons || []) {
    const hit = (l.source && l.source.guide === slug && l.source.ref === ref) || (mapped.get(l.id) || []).some(r => r.guide === slug && r.ref === ref);
    if (hit) out.push({ course: c, lesson: l });
  }
  return out;
}

/** Guide refs a lesson draws on: its own source, plus any mapped refs. */
export function lessonGuideRefs(lesson, lessonMap = []) {
  const refs = [];
  if (lesson?.source?.guide && lesson.source.ref) refs.push({ guide: lesson.source.guide, ref: lesson.source.ref, primary: true });
  const m = lessonMap.find(x => x.id === lesson?.id);
  for (const r of m?.refs || []) if (!refs.some(x => x.guide === r.guide && x.ref === r.ref)) refs.push({ ...r, primary: false });
  return refs;
}

/** True when the item carries the fields a lesson needs. */
export function itemTeachable(item, kind) {
  const bi = v => v && typeof v.en === 'string' && v.en.trim() && typeof v.ar === 'string' && v.ar.trim();
  if (!item || !bi(item.title) || !bi(item.req) || !item.how?.length || !item.how.every(bi)) return false;
  if (kind === 'method') return (item.gaps?.length > 0 || item.tips?.length > 0) && [...(item.gaps || []), ...(item.tips || [])].every(bi);
  return item.ev?.length > 0 && item.ev.every(bi);
}

/** Validates a guide file; returns problems (empty = valid). */
export function validateGuide(guide) {
  const e = [];
  if (!guide?.id || !guide.slug || !['standard', 'method'].includes(guide.kind)) e.push('missing_identity');
  if (!guide?.title?.en || !guide?.title?.ar) e.push('missing_title');
  const items = guideItems(guide);
  if (!items.length) e.push('no_items');
  const refs = new Set();
  const placeholder = x => ['en', 'ar'].includes(x?.en) || ['en', 'ar'].includes(x?.ar);
  for (const i of items) {
    if (refs.has(i.ref)) e.push('duplicate_ref:' + i.ref);
    if ([...(i.how || []), ...(i.ev || []), ...(i.gaps || []), ...(i.tips || [])].some(placeholder)) e.push('placeholder_text:' + i.ref);
    refs.add(i.ref);
    if (!itemTeachable(i, guide.kind)) e.push('incomplete_item:' + i.ref);
  }
  for (const i of items) for (const l of [...(i.links?.out || []), ...(i.links?.in || [])]) if (!refs.has(l.ref)) e.push(`dangling_link:${i.ref}->${l.ref}`);
  return e;
}
