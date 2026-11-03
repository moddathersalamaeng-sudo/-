/**
 * Course engine views (Phase 4, rebuilt in Phase 7).
 *
 *  #/academy/courses                     courseCatalogView  — filters (?q=&level=&standard=&route=&delivery=) kept in the URL
 *  #/academy/courses/:slug               courseDetailView   — everything a course promises, from its record
 *  #/academy/courses/:slug/:lesson       lessonView         — lesson player: 5 blocks (or the guide item a lesson is built from), exercise,
 *                                                              knowledge check, "from the requirement guides" panel, complete
 *  #/academy/programs                    programsView
 *
 * Progress records (`course_progress`, id = course id): { completed_lessons[], exercise_notes{}, updated_at }.
 * Reading progress is never presented as a professional certification.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, StatusLabel, ProgressBar, toast, Table } from '../ui/components.js';
import { searchCourses, prerequisiteState, flatLessons, LESSON_BLOCKS } from '../domain/courses.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { optionFeedback, UNKNOWN } from '../domain/assessments.mjs';
import { loadAll, loadGuides } from '../data/learner-state.js';
import { L, srHeading, notAvailable, pageHead, govBadge, previewBanner, linkBtn, section, facts, chips, hours, minutes, setHashQuery, platformHref, targetHref, isReviewer, toolLink } from '../ui/academy.js';
import { lessonGuideRefs, findItem } from '../domain/guides.mjs';
import { guideItemBody, guideApply, guideRefsPanel, guideHref } from './guides.js';
import { LevelMeter } from '../ui/charts.js';
import { studyWeeks } from '../domain/pmi.mjs';

const STATUS_KEY = { 'CIA INTERNAL COURSE': 'cia_internal', 'EXAM PREPARATION COURSE': 'exam_prep', 'EXTERNAL ACCREDITATION PENDING': 'accreditation_pending', 'EXTERNALLY ACCREDITED': 'externally_accredited', 'OFFICIAL PARTNER COURSE': 'official_partner' };
export const courseStatusLabel = (ctx, c) => {
  const key = STATUS_KEY[c.status_label] || 'cia_internal';
  return StatusLabel({ kind: 'course', value: key, label: ctx.t('labels.courseStatus.' + key) });
};
const stateBadge = (ctx, st) => Badge({ label: ctx.t('p7.course.state.' + st.state), tone: st.state === 'completed' ? 'ok' : st.state === 'in_progress' ? 'info' : 'neutral' });
const lessonKey = (course, lesson) => lesson.id.startsWith(course.id + '-') ? lesson.id.slice(course.id.length + 1) : lesson.id;
const lessonHref = (course, lesson) => `#/academy/courses/${course.slug}/${encodeURIComponent(lessonKey(course, lesson))}`;
const langName = (ctx, l) => ctx.t('pf.lng' + l[0].toUpperCase() + l.slice(1));
/** A course-page section whose heading carries an icon (Phase 8). */
const isec = (id, iconName, title, ...kids) => h('section', { class: 'section', 'aria-labelledby': id }, h('h2', { id }, icon(iconName), ' ', title), ...kids);

/** "At a glance": the course in eight facts with icons. */
function glance(ctx, c, lessons) {
  const { t, i18n } = ctx;
  const n = (k, v) => h('li', null, icon(k), h('strong', null, v[0]), h('span', null, v[1]));
  const asm = ['quiz', 'final', 'practical'].filter(k => c.assessments?.[k]).length;
  return h('ul', { class: 'glance', 'aria-label': t('p8.course.glance') },
    n('gauge', [t('p7.level', { n: i18n.digitize(c.level) }), t('p8.course.levelName.' + Math.min(5, Math.max(1, c.level || 1)))]),
    n('clock', [hours(ctx, c.training_hours), c.duration_days ? t('p7.days', { n: i18n.number(c.duration_days) }) : '']),
    n('layers', [i18n.number((c.modules || []).length), t('p8.course.modules')]),
    n('book', [i18n.number(lessons.length), t('p8.course.lessons')]),
    n('question', [i18n.number(asm), t('p8.course.assessmentsN')]),
    c.practical_task ? n('clipboard', [t('p8.course.practicalYes'), t('p7.course.humanReview')]) : null,
    n('globe', [(c.languages || []).map(l => langName(ctx, l)).join(' · '), t('p7.course.languages')]),
    n('award', [t('labels.certificateType.' + c.certificate_type), t('p7.course.notClaimed')]));
}

/** "How to study this course": the method, and a personal weekly plan at the learner's weekly hours (profile). */
function studyPanel(ctx, c, learner) {
  const { t, i18n } = ctx;
  const weekly = Number(learner.profile?.weekly_hours) || 4;
  const weeks = studyWeeks(c, weekly);
  const steps = ['prep', 'read', 'apply', 'check', 'tool', 'final'];
  const ICON = { prep: 'target', read: 'book', apply: 'bulb', check: 'question', tool: 'grid', final: 'award' };
  return isec('c-study', 'route', t('p8.course.studyTitle'),
    h('ol', { class: 'howto-steps' }, steps.map(k => h('li', null, icon(ICON[k]), ' ', h('strong', null, t('p8.course.study.' + k + '.t')), ' — ', t('p8.course.study.' + k + '.d' + (c.guide && k === 'read' ? 'Guide' : ''))))),
    h('details', { class: 'panel weekplan', dataset: { weeks: String(weeks.length) } },
      h('summary', null, icon('calendar'), ' ', t('p8.course.weekPlan', { weeks: i18n.number(weeks.length), hours: i18n.number(weekly) })),
      h('p', { class: 'note' }, learner.profile?.weekly_hours ? t('p8.course.weekPlanFromProfile') : t('p8.course.weekPlanDefault'), ' ', h('a', { href: '#/profile' }, t('p8.course.changeHours'))),
      h('ol', { class: 'weeks' }, weeks.map(w => h('li', null, h('strong', null, t('p8.course.week', { n: i18n.number(w.week) })), ' · ', minutes(ctx, w.minutes), ' — ',
        w.items.map((x, j) => [j ? ' · ' : '', x.id === 'final' ? t('p8.course.finalAndPractical') : L(ctx, x.title)]))))));
}

/** Certifications this course supports (from the explorer) and the guides it draws on. */
function linkedPanel(ctx, c, content) {
  const { t } = ctx;
  const certs = (content.certifications || []).filter(x => x.id === c.related_certification || (x.cia_courses || []).includes(c.id));
  const guides = (c.related_guides || []).map(slug => (content.guides || []).find(g => g.slug === slug)).filter(Boolean);
  if (!certs.length && !guides.length) return null;
  return isec('c-links', 'link', t('p8.course.linked'),
    certs.length ? h('div', null, h('h3', null, icon('award'), ' ', t('p8.course.certs')), h('p', { class: 'note' }, t(c.status_label === 'EXAM PREPARATION COURSE' ? 'p8.course.certsNotePrep' : 'p8.course.certsNote')),
      h('ul', { class: 'chips' }, certs.map(x => h('li', null, h('a', { href: `#/academy/pmi/certifications/${x.slug}` }, x.code, ' ', L(ctx, x.name)))))) : null,
    guides.length ? h('div', null, h('h3', null, icon('ladder'), ' ', t('p8.course.guides')), h('p', { class: 'note' }, t('p8.course.guidesNote')),
      h('ul', { class: 'chips' }, guides.map(g => h('li', null, h('a', { href: guideHref(g.slug) }, L(ctx, g.title)))))) : null);
}

/* ------------------------------------------------------------------ catalog */

export function courseCard(ctx, c, learner) {
  const { t, i18n } = ctx;
  const st = courseStatus(c, learner.progress, learner.attempts);
  return h('article', { class: 'card ccard', dataset: { course: c.id } },
    h('p', { class: 'eyebrow' }, t('p7.level', { n: i18n.digitize(c.level) }), ' · ', hours(ctx, c.training_hours), c.duration_days ? ' · ' + t('p7.days', { n: i18n.number(c.duration_days) }) : null),
    h('h3', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title))),
    h('p', null, L(ctx, c.overview)),
    h('div', { class: 'badges' }, courseStatusLabel(ctx, c), stateBadge(ctx, st), isReviewer(ctx) ? govBadge(ctx, c) : null),
    st.percent ? ProgressBar({ value: st.done, max: st.total, label: t('courses.progress'), valueText: t('p7.course.lessonsDone', { done: i18n.number(st.done), total: i18n.number(st.total) }) }) : null);
}

export function courseCatalogView(ctx, match) {
  const { t } = ctx;
  const q = { q: '', level: '', standard: '', route: '', delivery: '', ...(match.query || {}) };
  const head = pageHead(ctx, { eyebrow: t('courses.eyebrow'), title: t('courses.title'), lede: t('courses.intro'), actions: [linkBtn('#/academy/programs', t('programs.title')), linkBtn('#/academy/iso', t('nav.items.isoAcademy'))] });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    if (!content.courses.length) return EmptyState({ title: t('courses.empty'), body: t('p7.course.pendingBody'), iconName: 'lock', action: linkBtn('#/knowledge', t('knowledge.title')) });
    const standards = [...new Set(content.courses.flatMap(c => c.standard_ids || []))].map(id => content.standards.find(s => s.id === id) || { id, name: id });
    const routes = content.paths.filter(p => p.kind === 'iso_route' || p.kind === 'pm_route');
    const levels = [...new Set(content.courses.map(c => c.level))].sort();
    const deliveries = [...new Set(content.courses.flatMap(c => c.delivery_modes || []))];
    const list = h('div', { class: 'cards', id: 'course-list' });
    const count = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const paint = () => {
      const xs = searchCourses(content.courses, q.q, { level: q.level, delivery: q.delivery })
        .filter(c => !q.standard || (c.standard_ids || []).includes(q.standard))
        .filter(c => !q.route || (c.route_ids || []).includes(q.route));
      count.textContent = t('p7.course.count', { n: ctx.i18n.number(xs.length) });
      list.replaceChildren(...(xs.length ? xs.map(c => courseCard(ctx, c, learner)) : [EmptyState({ title: t('p7.course.noMatch'), body: t('p7.course.noMatchBody') })]));
      setHashQuery('/academy/courses', q);
    };
    const sel = (name, label, options) => h('div', { class: 'field' }, h('label', { for: 'cf-' + name }, label),
      h('select', { class: 'select', id: 'cf-' + name, name, onchange: e => { q[name] = e.target.value; paint(); } },
        h('option', { value: '' }, t('p7.course.any')), options.map(o => h('option', { value: o.value, selected: String(q[name]) === String(o.value) }, o.label))));
    const filters = h('form', { class: 'filters', role: 'search', 'aria-label': t('p7.course.filters'), onsubmit: e => e.preventDefault() },
      h('div', { class: 'field' }, h('label', { for: 'cf-q' }, t('p7.course.search')),
        h('input', { class: 'input', id: 'cf-q', type: 'search', name: 'q', value: q.q, oninput: e => { q.q = e.target.value; paint(); } })),
      sel('level', t('p7.course.level'), levels.map(v => ({ value: v, label: t('p7.level', { n: ctx.i18n.digitize(v) }) }))),
      sel('standard', t('p7.course.standard'), standards.map(s => ({ value: s.id, label: L(ctx, s.name) }))),
      routes.length ? sel('route', t('p7.course.route'), routes.map(r => ({ value: r.id, label: L(ctx, r.title) }))) : null,
      sel('delivery', t('p7.course.delivery'), deliveries.map(v => ({ value: v, label: t('p7.delivery.' + v) }))),
      Button({ label: t('p7.course.clear'), variant: 'quiet', onClick: () => { Object.assign(q, { q: '', level: '', standard: '', route: '', delivery: '' }); filters.reset(); filters.querySelectorAll('select').forEach(s => { s.value = ''; }); paint(); } }));
    paint();
    return h('div', null, previewBanner(ctx, content.courses), filters, count, srHeading(t('p7.course.results')), list);
  } });
  return h('div', null, head, region);
}

/* ------------------------------------------------------------------ course detail */

function prereqList(ctx, course, content, completed) {
  const { t } = ctx;
  const st = prerequisiteState(course, completed);
  const items = (course.prerequisites || []);
  if (!items.length) return h('p', null, t('p7.course.noPrereq'));
  const missing = new Set(st.missing.map(x => x.course_id));
  return h('ul', { class: 'plain' }, items.map(p => {
    const id = p.course_id || p.target_id;
    const type = p.course_id ? 'course' : p.type === 'knowledge' ? 'knowledge' : p.type;
    const target = type === 'course' ? content.byId(content.courses, id) : type === 'knowledge' ? content.byId(content.articles, id) : content.byId(content.assessments, id);
    const href = target ? targetHref({ type, target_id: id }, content) : null;
    const done = completed.includes(id);
    return h('li', { dataset: { prereq: id } },
      Badge({ label: done ? t('p7.course.prereqDone') : p.required === false ? t('p7.course.prereqAdvised') : t('p7.course.prereqRequired'), tone: done ? 'ok' : missing.has(id) ? 'warn' : 'neutral' }), ' ',
      href ? h('a', { href }, L(ctx, target.title)) : h('span', null, id, ' ', h('span', { class: 'note' }, t('p7.pendingShort'))),
      p.reason ? h('span', { class: 'note' }, ' — ', L(ctx, p.reason)) : null);
  }));
}

function dayPlan(ctx, course) {
  const { t, i18n } = ctx;
  if (!course.daily_schedule?.length) return h('p', { class: 'note' }, t('p7.course.noDayPlan'));
  return h('div', { class: 'days' }, course.daily_schedule.map(d => h('section', { class: 'card day', dataset: { day: String(d.day) } },
    h('h3', null, t('p7.course.day', { n: i18n.number(d.day) }), ' · ', minutes(ctx, d.minutes)),
    d.focus_titles?.length ? h('p', { class: 'note' }, d.focus_titles.map(x => L(ctx, x)).join(' · ')) : null,
    h('ol', { class: 'sessions' }, d.sessions.map(s => h('li', null,
      Badge({ label: t('p7.session.' + s.kind), tone: s.kind === 'lesson' ? 'info' : s.kind === 'assessment' ? 'gold' : 'neutral' }), ' ',
      h('span', null, L(ctx, s.title)), ' ', h('span', { class: 'note' }, minutes(ctx, s.minutes))))))));
}

function assessmentRows(ctx, course, content, learner) {
  const { t, i18n } = ctx;
  const rows = ['quiz', 'final', 'practical'].map(k => {
    const id = course.assessments?.[k] || (k === 'final' ? course.final_assessment : null);
    if (!id) return null;
    const a = content.byId(content.assessments, id);
    const last = learner.attempts.filter(x => x.assessment_id === id).sort((x, y) => String(y.submitted_at).localeCompare(String(x.submitted_at)))[0];
    return {
      kind: t('p7.asmKind.' + (k === 'quiz' ? 'knowledge_quiz' : k)),
      title: a ? h('a', { href: `#/assessments/${a.slug}` }, L(ctx, a.title)) : h('span', { class: 'note' }, t('p7.pendingShort')),
      pass: a ? i18n.number(a.scoring.passing_score) + '%' : '—',
      last: last ? (last.pending_review ? t('assessments.pendingReview') : t('p7.asm.lastScore', { pct: i18n.number(last.score), status: last.passed ? t('assessments.passed') : t('assessments.notPassed') })) : t('p7.asm.notTaken')
    };
  }).filter(Boolean);
  if (!rows.length) return h('p', { class: 'note' }, t('p7.course.noAssessments'));
  return Table({ caption: t('p7.course.assessments'), columns: [{ key: 'kind', label: t('p7.course.assessmentKind') }, { key: 'title', label: t('assessments.assessment') }, { key: 'pass', label: t('p7.asm.passMark'), num: true }, { key: 'last', label: t('p7.asm.latest') }], rows });
}

export function rubricTable(ctx, rubric, caption) {
  const { t, i18n } = ctx;
  return Table({ caption, columns: [{ key: 'c', label: t('p7.rubric.criterion') }, { key: 'w', label: t('p7.rubric.weight'), num: true }, { key: 'm', label: t('p7.rubric.meets') }, { key: 'p', label: t('p7.rubric.partial') }, { key: 'n', label: t('p7.rubric.notYet') }],
    rows: rubric.map(r => ({ c: L(ctx, r.criterion), w: r.weight != null ? i18n.number(r.weight) + '%' : '—', m: L(ctx, r.levels?.meets), p: L(ctx, r.levels?.partial), n: L(ctx, r.levels?.not_yet) })) });
}

export function sourceList(ctx, ids, content) {
  const { t, i18n } = ctx;
  const srcs = (ids || []).map(id => content.sources.find(s => s.id === id || s.source_id === id)).filter(Boolean);
  if (!srcs.length) return h('p', { class: 'note' }, t('p7.sources.none'));
  return h('ul', { class: 'plain sources' }, srcs.map(s => h('li', { dataset: { source: s.id } },
    s.official_url ? h('a', { href: s.official_url, target: '_blank', rel: 'noopener' }, s.title, ' ', icon('external')) : h('span', null, s.title),
    h('span', { class: 'note' }, ' — ', s.organization, s.verified_date ? ' · ' + t('p7.sources.checked', { date: i18n.date(s.verified_date) }) : null),
    s.verification_note ? h('span', { class: 'note block' }, s.verification_note) : null)));
}

export function courseDetailView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadWithGuides(ctx, match.params.slug), render: ({ content, learner, guides }) => {
    const c = content.courses.find(x => x.slug === match.params.slug);
    if (!c) return notAvailable(ctx, { title: t('p7.course.notFound'), body: t('p7.course.pendingBody'), action: linkBtn('#/academy/courses', t('courses.title')) });
    return courseDetail(ctx, c, content, learner, region, guides);
  } });
  return h('div', null, region);
}

/** Guide refs used by a course (or by one of its lessons), and the guide files they live in. */
function courseGuideRefs(c, lessonMap, lessonId) {
  const ls = flatLessons(c).filter(l => !lessonId || l.id === lessonId);
  const refs = ls.flatMap(l => lessonGuideRefs(l, lessonMap));
  return [...new Map(refs.map(r => [r.guide + '#' + r.ref, r])).values()];
}
async function loadWithGuides(ctx, slug, lessonParam) {
  const { content, learner } = await loadAll(ctx);
  const c = content.courses.find(x => x.slug === slug);
  if (!c) return { content, learner, guides: {} };
  const lesson = lessonParam ? flatLessons(c).find(l => lessonKey(c, l) === lessonParam || l.id === lessonParam) : null;
  const slugs = c.guide && !lessonParam ? [] : courseGuideRefs(c, content.lessonMap, lesson?.id).map(r => r.guide);
  return { content, learner, guides: await loadGuides(ctx, content, slugs) };
}

function guideCoverage(ctx, c, content, guides) {
  const { t } = ctx;
  if (c.guide) {
    const g = content.guides.find(x => x.slug === c.guide);
    return g ? section('c-guide', t('gd.courseGuide'), h('p', null, t('gd.courseGuideBody')), linkBtn(guideHref(c.guide), L(ctx, g.title), 'secondary')) : null;
  }
  const refs = courseGuideRefs(c, content.lessonMap).map(r => ({ ...r, g: guides[r.guide] })).filter(r => r.g && findItem(r.g, r.ref));
  if (!refs.length) return null;
  const byGuide = new Map();
  for (const r of refs) { if (!byGuide.has(r.guide)) byGuide.set(r.guide, []); byGuide.get(r.guide).push(r); }
  return section('c-cover', t('gd.coverage'), h('p', { class: 'note' }, t('gd.coverageNote')),
    [...byGuide.values()].map(rs => h('div', { class: 'gcover' }, h('h3', null, L(ctx, rs[0].g.title)),
      h('ul', { class: 'chips' }, rs.map(r => h('li', null, h('a', { href: guideHref(r.guide, r.ref), title: L(ctx, findItem(r.g, r.ref).title) }, r.g.kind === 'standard' ? r.ref + ' ' : '', L(ctx, findItem(r.g, r.ref).title))))))));
}

function courseDetail(ctx, c, content, learner, region, guides = {}) {
  const { t, i18n } = ctx;
  const st = courseStatus(c, learner.progress, learner.attempts);
  const lessons = flatLessons(c);
  const saved = learner.progress.find(p => p.id === c.id);
  const nextLesson = lessons.find(l => !saved?.completed_lessons?.includes(l.id)) || lessons[0];
  const prereq = prerequisiteState(c, learner.completed);
  const final = content.byId(content.assessments, c.assessments?.final || c.final_assessment);
  const nextCourse = content.byId(content.courses, c.recommended_next_course);
  const articles = (c.related_knowledge_pages || []).map(id => content.byId(content.articles, id)).filter(Boolean);
  const tools = (c.tools || []).map(id => content.tools.find(m => m.id === id)).filter(Boolean);
  const templates = (c.templates || []).map(id => content.byId(content.library, id)).filter(Boolean);
  const sims = ctx.relationships.from('course', c.id).filter(r => r.toType === 'library_resource').map(r => content.byId(content.library, r.toId)).filter(x => x && x.kind === 'simulation');

  const actions = [
    nextLesson ? linkBtn(lessonHref(c, nextLesson), st.done ? t('p7.course.continue') : t('p7.course.start'), 'primary', { 'data-action': 'start-course' }) : null,
    final ? linkBtn(`#/assessments/${final.slug}`, t('p7.course.takeFinal')) : null,
    c.guide && content.guides.some(g => g.slug === c.guide) ? linkBtn(guideHref(c.guide), t('gd.readGuide')) : null
  ].filter(Boolean);

  const head = pageHead(ctx, { eyebrow: t('courses.eyebrow'), title: L(ctx, c.title), lede: L(ctx, c.overview), actions });
  head.prepend(h('div', { class: 'badges' }, courseStatusLabel(ctx, c), stateBadge(ctx, st), isReviewer(ctx) ? govBadge(ctx, c) : null));

  const progressPanel = h('section', { class: 'panel feature', 'aria-labelledby': 'cp-h' },
    h('h2', { id: 'cp-h' }, t('courses.progress')),
    lessons.length ? ProgressBar({ value: st.done, max: st.total, label: t('courses.progress'), valueText: t('p7.course.lessonsDone', { done: i18n.number(st.done), total: i18n.number(st.total) }) }) : null,
    h('p', null, st.state === 'completed' ? t('p7.course.completedNote') : st.lessonsDone && !st.finalPassed ? t('p7.course.finalPending') : t('p7.course.completionRule')),
    h('p', { class: 'note' }, t('p7.readingNotCert')),
    !prereq.eligible ? h('p', { class: 'banner banner-warn', role: 'note' }, t('p7.course.prereqMissing')) : null);

  const summary = facts([
    [t('p7.course.level'), LevelMeter({ level: c.level, label: t('p7.level', { n: i18n.digitize(c.level) }) })],
    [t('p7.course.duration'), (c.duration_days ? t('p7.days', { n: i18n.number(c.duration_days) }) + ' · ' : '') + hours(ctx, c.training_hours)],
    [t('p7.course.delivery'), (c.delivery_modes || []).map(m => t('p7.delivery.' + m)).join(' · ')],
    [t('p7.course.languages'), (c.languages || []).map(l => langName(ctx, l)).join(' · ')],
    [t('p7.course.certificate'), t('labels.certificateType.' + c.certificate_type)],
    [t('p7.course.accreditation'), t('p7.course.notClaimed')],
    [t('p7.course.cpd'), t('p7.course.notClaimed')],
    reviewFact(ctx, c)
  ]);

  const curriculum = h('ol', { class: 'modules' }, (c.modules || []).map(m => h('li', { class: 'card module', dataset: { module: m.id } },
    h('h3', null, L(ctx, m.title)), m.summary ? h('p', { class: 'note' }, L(ctx, m.summary)) : null,
    h('ol', { class: 'lessons' }, (m.lessons || []).map(l => {
      const done = saved?.completed_lessons?.includes(l.id);
      return h('li', { class: done ? 'done' : null },
        done ? icon('check', t('p7.lesson.completed')) : h('span', { class: 'ico-spacer', 'aria-hidden': 'true' }),
        h('a', { href: lessonHref(c, l) }, L(ctx, l.title)), ' ', h('span', { class: 'note' }, minutes(ctx, l.estimated_minutes || 0)));
    })))));

  const comps = (c.competency_mappings || []).map(m => {
    const comp = content.byId(content.competencies, m.competency);
    return h('li', null, h('span', { class: 'cid' }, m.competency), ' ', comp ? L(ctx, comp.name) : '', ' ',
      LevelMeter({ level: m.target_level, label: t('p7.course.targetLevel', { n: i18n.digitize(m.target_level) }) }));
  });

  return h('article', { class: 'course', dataset: { course: c.id } },
    previewBanner(ctx, [c]),
    head,
    glance(ctx, c, lessons),
    h('div', { class: 'split' }, progressPanel, h('section', { class: 'panel', 'aria-label': t('p7.course.summary') }, summary)),
    c.why_it_matters ? isec('c-why', 'bulb', t('p7.course.why'), h('p', null, L(ctx, c.why_it_matters)), c.professional_relevance ? h('p', { class: 'note' }, L(ctx, c.professional_relevance)) : null) : null,
    isec('c-aud', 'users', t('p7.course.audience'), chips((c.target_audience || []).map(a => L(ctx, a)))),
    isec('c-pre', 'flag', t('p7.course.prerequisites'), prereqList(ctx, c, content, learner.completed)),
    isec('c-out', 'target', t('p7.course.outcomes'), h('ol', null, (c.learning_outcomes || []).map(o => h('li', null, L(ctx, o))))),
    comps.length ? isec('c-comp', 'gauge', t('p7.course.competencies'), h('ul', { class: 'plain comps' }, comps)) : null,
    studyPanel(ctx, c, learner),
    linkedPanel(ctx, c, content),
    isec('c-cur', 'layers', t('p7.course.curriculum'), curriculum),
    isec('c-day', 'calendar', t('p7.course.dayPlan'), h('p', { class: 'note' }, t('p7.course.dayPlanNote')), dayPlan(ctx, c)),
    isec('c-asm', 'question', t('p7.course.assessments'), c.assessment_methodology ? h('p', null, L(ctx, c.assessment_methodology)) : null, assessmentRows(ctx, c, content, learner),
      c.passing_criteria ? h('p', { class: 'note' }, L(ctx, c.passing_criteria)) : null),
    c.practical_task ? isec('c-pt', 'clipboard', t('p7.course.practical'),
      h('p', null, L(ctx, c.practical_task.brief)),
      facts([[t('p7.course.deliverable'), L(ctx, c.practical_task.deliverable)], [t('p7.course.time'), minutes(ctx, c.practical_task.minutes)], [t('p7.course.reviewedBy'), t('p7.course.humanReview')]]),
      c.practical_task.rubric?.length ? rubricTable(ctx, c.practical_task.rubric, t('p7.course.rubric')) : null) : null,
    isec('c-res', 'book', t('p7.course.resources'),
      h('div', { class: 'split' },
        h('div', null, h('h3', null, t('p7.course.knowledge')), articles.length ? h('ul', { class: 'plain' }, articles.map(a => h('li', null, h('a', { href: `#/knowledge/${a.ecosystem}/${a.slug}` }, L(ctx, a.title))))) : h('p', { class: 'note' }, t('p7.none'))),
        h('div', null, h('h3', null, t('p7.course.tools')), tools.length ? h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m)))) : h('p', { class: 'note' }, t('p7.none')),
          sims.length ? h('ul', { class: 'plain' }, sims.map(x => h('li', null, h('a', { href: `#/library/${x.id}` }, L(ctx, x.title))))) : null,
          templates.length ? h('ul', { class: 'plain' }, templates.map(x => h('li', null, h('a', { href: `#/library/${x.id}` }, L(ctx, x.title))))) : null))),
    guideCoverage(ctx, c, content, guides),
    isec('c-src', 'doc', t('p7.sources.title'), sourceList(ctx, c.source_references, content), h('p', { class: 'note' }, t('p7.sources.noCopy'))),
    nextCourse ? isec('c-next', 'chevron', t('p7.course.next'), courseCard(ctx, nextCourse, learner)) : null,
    isec('c-team', 'users', t('gd.requestTitle'), h('p', null, t('gd.requestBody')),
      h('a', { class: 'btn btn-secondary', href: platformHref(ctx, '../#request'), 'aria-describedby': 'ext-note', 'data-action': 'request-course' }, t('gd.requestCta'), ' ', icon('external'))),
    isReviewer(ctx) ? governanceFooter(ctx, c) : null);
}

/** How this record came to be published, in plain words, for every viewer (learners included). */
export function reviewFact(ctx, rec) {
  const g = rec?.governance;
  if (!g || g.content_status !== 'published') return null;
  const basis = g.approval_basis === 'owner_approval_after_ai_prereview' ? 'owner' : g.approval_basis === 'expert_review' ? 'expert' : null;
  if (!basis) return null;
  return [ctx.t('p7.gov.reviewLabel'), ctx.t('p7.gov.reviewBasis.' + basis, { name: g.reviewer || '—', date: g.review_date ? ctx.i18n.date(g.review_date) : '—' })];
}

export function governanceFooter(ctx, rec) {
  const { t } = ctx; const g = rec.governance || {};
  return h('aside', { class: 'panel gov', 'aria-label': t('p7.gov.title') }, h('h2', null, t('p7.gov.title')),
    facts([[t('p7.gov.status'), t('labels.governance.' + g.content_status)], [t('p7.gov.source'), t('p7.gov.src.' + g.content_source)], [t('p7.gov.version'), g.version || '—'],
      [t('p7.gov.reviewer'), g.reviewer || t('p7.gov.noReviewer')], [t('p7.gov.date'), g.review_date || '—'],
      g.drafted_by ? [t('p7.gov.draftedBy'), t('p7.gov.src.' + g.drafted_by)] : null, [t('p7.gov.note'), g.change_note || '—']]),
    linkBtn('#/review', t('p7.review.open')));
}

/* ------------------------------------------------------------------ lesson player */

export function lessonView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadWithGuides(ctx, match.params.slug, match.params.lesson), render: ({ content, learner, guides }) => {
    const c = content.courses.find(x => x.slug === match.params.slug);
    const lessons = c ? flatLessons(c) : [];
    const i = lessons.findIndex(l => lessonKey(c, l) === match.params.lesson || l.id === match.params.lesson);
    if (!c || i < 0) return notAvailable(ctx, { title: t('p7.lesson.notFound'), body: t('p7.course.pendingBody'), action: linkBtn(c ? `#/academy/courses/${c.slug}` : '#/academy/courses', t('p7.lesson.backToCourse')) });
    return lessonPlayer(ctx, c, lessons, i, content, learner, guides);
  } });
  return h('div', null, region);
}

function lessonPlayer(ctx, c, lessons, i, content, learner, guides = {}) {
  const { t, i18n } = ctx;
  const l = lessons[i];
  const prev = lessons[i - 1], next = lessons[i + 1];
  let saved = learner.progress.find(p => p.id === c.id) || { id: c.id, completed_lessons: [], exercise_notes: {} };
  saved = { completed_lessons: [], exercise_notes: {}, ...saved };
  const persist = async () => { saved.updated_at = new Date().toISOString(); await ctx.repos.courseProgress.save(saved); };

  // --- complete toggle (no page reload; aria-pressed reflects state)
  const progressText = h('p', { class: 'note', 'aria-live': 'polite' });
  const toggle = h('button', { class: 'btn btn-secondary', type: 'button', dataset: { action: 'toggle-complete' } });
  const paintToggle = () => {
    const done = saved.completed_lessons.includes(l.id);
    toggle.setAttribute('aria-pressed', String(done));
    toggle.replaceChildren(...(done ? [icon('check'), t('p7.lesson.completed')] : [t('p7.lesson.markComplete')]));
    const n = lessons.filter(x => saved.completed_lessons.includes(x.id)).length;
    progressText.textContent = t('p7.course.lessonsDone', { done: i18n.number(n), total: i18n.number(lessons.length) });
  };
  toggle.addEventListener('click', async () => {
    const set = new Set(saved.completed_lessons);
    set.has(l.id) ? set.delete(l.id) : set.add(l.id);
    saved.completed_lessons = [...set];
    await persist(); paintToggle();
    toast(set.has(l.id) ? t('p7.lesson.markedDone') : t('p7.lesson.markedUndone'));
  });
  paintToggle();

  // --- a lesson built from a guide item renders that item (single source of truth); otherwise its own blocks in canonical order
  const srcGuide = l.source ? guides[l.source.guide] : null;
  const srcItem = srcGuide ? findItem(srcGuide, l.source.ref) : null;
  const blocks = [...(l.content_blocks || [])].sort((a, b) => (LESSON_BLOCKS.indexOf(a.type) + 1 || 99) - (LESSON_BLOCKS.indexOf(b.type) + 1 || 99));
  const blockEls = l.source
    ? (srcItem ? guideItemBody(ctx, srcGuide, srcItem, { compact: true }) : [h('p', { class: 'banner banner-warn', role: 'note' }, t('gd.sourceMissing'))])
    : blocks.map(b => h('section', { class: ['lblock', 'lblock-' + b.type], dataset: { block: b.type } },
      h('h2', null, t('p7.block.' + (LESSON_BLOCKS.includes(b.type) ? b.type : 'other'))), h('p', null, L(ctx, b.text))));
  const apply = srcItem ? guideApply(ctx, srcGuide, srcItem) : null;
  const exPrompt = apply ? apply.prompt : L(ctx, l.exercise?.prompt);
  const exModel = apply ? apply.model : h('p', null, L(ctx, l.exercise?.model_answer));
  const guidePanel = guideRefsPanel(ctx, lessonGuideRefs(l, content.lessonMap).filter(r => !r.primary), guides);

  // --- exercise with private notes + model answer reveal
  let exercise = null;
  if (exPrompt) {
    const notes = h('textarea', { class: 'textarea', id: 'ex-notes', rows: '4', 'aria-describedby': 'ex-notes-hint' }, saved.exercise_notes?.[l.id] || '');
    let timer = null;
    notes.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(async () => { saved.exercise_notes = { ...saved.exercise_notes, [l.id]: notes.value }; await persist(); }, 500); });
    const answer = h('div', { class: 'model-answer', id: 'ex-answer', hidden: true }, h('h3', null, t(apply ? 'gd.apply.checkTitle' : 'p7.lesson.modelAnswer')), exModel);
    const reveal = h('button', { class: 'btn btn-secondary', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'ex-answer', dataset: { action: 'reveal-answer' } }, t('p7.lesson.showAnswer'));
    reveal.addEventListener('click', () => {
      const open = answer.hidden; answer.hidden = !open;
      reveal.setAttribute('aria-expanded', String(open));
      reveal.textContent = open ? t('p7.lesson.hideAnswer') : t('p7.lesson.showAnswer');
    });
    exercise = h('section', { class: 'panel exercise', 'aria-labelledby': 'ex-h' }, h('h2', { id: 'ex-h' }, t(apply ? 'gd.apply.title' : 'p7.lesson.exercise')),
      h('p', null, exPrompt),
      h('div', { class: 'field' }, h('label', { for: 'ex-notes' }, t('p7.lesson.yourAnswer')), h('span', { class: 'hint', id: 'ex-notes-hint' }, t('p7.lesson.notesHint')), notes),
      reveal, answer);
  }

  // --- knowledge check (practice only: not stored as assessment evidence)
  const q = content.byId(content.questions, l.check_question_id);
  const check = q ? knowledgeCheck(ctx, q) : (l.check_question_id ? h('p', { class: 'note' }, t('p7.pendingShort')) : null);

  const resources = (l.resources || []).map(id => content.byId(content.articles, id) || content.byId(content.library, id)).filter(Boolean);

  return h('article', { class: 'lesson', dataset: { lesson: l.id } },
    previewBanner(ctx, [c]),
    h('nav', { class: 'lesson-nav', 'aria-label': t('p7.lesson.nav') },
      h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)), ' › ', h('span', null, L(ctx, l.module.title))),
    h('header', { class: 'phead' },
      h('p', { class: 'eyebrow' }, t('p7.lesson.position', { n: i18n.number(i + 1), total: i18n.number(lessons.length) }), ' · ', minutes(ctx, l.estimated_minutes || 0)),
      h('h1', null, L(ctx, l.title)),
      l.objectives?.length ? h('div', null, h('h2', { class: 'h-sm' }, t('p7.lesson.objectives')), h('ul', null, l.objectives.map(o => h('li', null, L(ctx, o))))) : null),
    blockEls,
    srcGuide && srcItem ? h('p', { class: 'note' }, t('gd.lessonSource'), ' ', h('a', { href: guideHref(srcGuide.slug, srcItem.ref) }, L(ctx, srcGuide.title))) : null,
    guidePanel,
    exercise,
    check ? h('section', { class: 'panel check', 'aria-labelledby': 'kc-h' }, h('h2', { id: 'kc-h' }, t('p7.lesson.check')), h('p', { class: 'note' }, t('p7.lesson.checkNote')), check) : null,
    resources.length ? section('l-res', t('p7.lesson.resources'), h('ul', { class: 'plain' }, resources.map(x => h('li', null,
      h('a', { href: x.slug && x.ecosystem ? `#/knowledge/${x.ecosystem}/${x.slug}` : `#/library/${x.id}` }, L(ctx, x.title)))))) : null,
    h('footer', { class: 'lesson-foot' },
      h('div', { class: 'btnrow' }, toggle, progressText),
      h('div', { class: 'btnrow pager' },
        prev ? linkBtn(lessonHref(c, prev), t('p7.lesson.prev'), 'secondary', { rel: 'prev', 'data-action': 'prev-lesson' }) : null,
        next ? linkBtn(lessonHref(c, next), t('p7.lesson.next'), 'primary', { rel: 'next', 'data-action': 'next-lesson' })
          : linkBtn(`#/academy/courses/${c.slug}`, t('p7.lesson.finish'), 'primary', { 'data-action': 'finish-course' }))));
}

/** One question with immediate, explained feedback. Used by the lesson player. */
export function knowledgeCheck(ctx, q) {
  const { t } = ctx;
  const name = 'kc-' + q.id;
  let answer = null;
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const opts = (q.options || []).map(o => h('label', { class: 'choice' },
    h('input', { type: 'radio', name, value: String(o.id), onchange: () => { answer = o.id; } }), h('span', null, L(ctx, o.text))));
  const unknown = h('label', { class: 'choice choice-unknown' }, h('input', { type: 'radio', name, value: UNKNOWN, onchange: () => { answer = UNKNOWN; } }), h('span', null, t('p7.asm.unknown')));
  const submit = Button({ label: t('p7.lesson.checkAnswer'), variant: 'secondary', attrs: { 'data-action': 'check-answer' }, onClick: () => {
    if (answer == null) { fb.replaceChildren(h('p', { class: 'errsum' }, t('p7.lesson.chooseFirst'))); return; }
    const f = optionFeedback(q, answer);
    const ok = answer === q.correct_answer;
    fb.replaceChildren(...[
      h('p', { class: ok ? 'oksum' : answer === UNKNOWN ? 'banner banner-info' : 'errsum' }, answer === UNKNOWN ? t('p7.asm.unknownFeedback') : ok ? t('p7.asm.correct') : t('p7.asm.incorrect')),
      f?.chosen && !ok ? h('p', null, h('strong', null, t('p7.asm.yourChoice')), ' ', L(ctx, f.chosen.why)) : null,
      f?.correct ? h('p', null, h('strong', null, t('p7.asm.correctAnswer')), ' ', L(ctx, f.correct.text), ' — ', L(ctx, f.correct.why)) : null,
      q.explanation ? h('p', { class: 'note' }, L(ctx, q.explanation)) : null].filter(Boolean));
  } });
  return h('div', { class: 'kc', dataset: { question: q.id } },
    h('fieldset', { class: 'fs' }, h('legend', null, L(ctx, q.prompt)), opts, q.options?.length ? unknown : null),
    submit, fb);
}

/* ------------------------------------------------------------------ programs */

export function programsView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('courses.eyebrow'), title: t('programs.title'), lede: t('p7.programs.lede') });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content }) => {
    if (!content.programs.length) return EmptyState({ title: t('programs.empty'), body: t('programs.emptyBody'), iconName: 'lock' });
    return h('div', null, previewBanner(ctx, content.programs), srHeading(t('programs.title')), h('div', { class: 'cards' }, content.programs.map(p => h('article', { class: 'card' },
      h('h3', null, L(ctx, p.title)), h('p', null, L(ctx, p.description)),
      h('p', { class: 'note' }, t('labels.certificateType.' + p.certificate_type)),
      h('ol', null, (p.stages || []).map(s => {
        const c = content.byId(content.courses, s.course_id);
        return h('li', null, c ? h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)) : s.course_id, ' ', s.mandatory ? Badge({ label: t('p7.programs.mandatory'), tone: 'neutral' }) : null);
    }))))));
  } });
  return h('div', null, head, region);
}
