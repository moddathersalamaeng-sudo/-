/**
 * Where explanatory figures appear (Phase 9, D-32). Pure functions, no DOM.
 * data/seed/lesson-figures.json items: { id: "<lesson id>" | "course:<course id>" | "guide:<guide slug>", figures: [figure ids] }.
 * Only figures the viewer may see (already filtered by the governance gate) are returned, in the order listed.
 */
const pick = (ids, figures) => (ids || []).map(id => figures.find(f => f.id === id)).filter(Boolean);
const entry = (map, key) => (map || []).find(x => x.id === key)?.figures || [];

export function lessonFigures(lesson, course, figures = [], map = []) {
  if (!lesson) return [];
  const ids = [...entry(map, lesson.id)];
  /* A guide-built course: the guide's figures go to its first lesson. */
  const first = (course?.modules || [])[0]?.lessons?.[0];
  if (course?.guide && first && first.id === lesson.id) ids.push(...entry(map, 'guide:' + course.guide));
  return pick([...new Set(ids)], figures);
}

export function courseFigures(course, figures = [], map = []) {
  if (!course) return [];
  const ids = [...entry(map, 'course:' + course.id)];
  for (const m of course.modules || []) for (const l of m.lessons || []) ids.push(...entry(map, l.id));
  if (course.guide) ids.push(...entry(map, 'guide:' + course.guide));
  return pick([...new Set(ids)], figures);
}

/** Map entries that point to missing figures or lessons (empty = consistent). */
export function danglingFigureRefs(map = [], figures = [], courses = []) {
  const fid = new Set(figures.map(f => f.id));
  const lid = new Set(courses.flatMap(c => (c.modules || []).flatMap(m => (m.lessons || []).map(l => l.id))));
  const cid = new Set(courses.map(c => c.id));
  const gs = new Set(courses.map(c => c.guide).filter(Boolean));
  const out = [];
  for (const e of map) {
    const [kind, key] = e.id.includes(':') ? e.id.split(':') : ['lesson', e.id];
    if (kind === 'lesson' && !lid.has(key)) out.push('lesson:' + key);
    if (kind === 'course' && !cid.has(key)) out.push('course:' + key);
    if (kind === 'guide' && !gs.has(key)) out.push('guide:' + key);
    for (const f of e.figures || []) if (!fid.has(f)) out.push('figure:' + f);
  }
  return out;
}
