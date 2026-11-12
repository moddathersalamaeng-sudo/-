/**
 * Learner state loader (Phase 7).
 * One place that gathers the content a viewer may see and the learner's own records, and turns
 * them into the evidence model used by the recommendation engine, the ISO starting point and
 * course status. Views call these two functions instead of repeating repository plumbing.
 *
 * Toolkit links, guides and the lesson→guide map are non-critical: if they fail to load, they are empty and the rest still renders.
 * Governance: every list returned in `content` is already filtered by the governance gate
 * (`listVisible`) except `rolesAll`, `domains` and `ecosystems`, which are used only as *labels*
 * (a learner may name the role they are aiming for even before the framework is published).
 */
import { isVisible, validateGovernance } from './governance.js';
import { assessmentEvidence, masteredCompetencies, completedTargets } from '../domain/learner-model.mjs';

export async function loadContent(ctx) {
  const roles = ctx.session.roles;
  const r = ctx.repos;
  const [courses, assessments, questions, articles, standards, library, tools, ecosystems, competencies, rolesAll, domains, pathsRaw, catalog, sources, programs, guides, lessonMap, certifications, figures, lessonFigures] = await Promise.all([
    /* Phase 10A: lists use the light course index; full course records and questions are loaded on demand
       (loadFullCourse, loadQuestions) — see src/data/adapters/split-json.js. */
    (r.coursesIndex || r.courses).listVisible(roles), r.assessments.listVisible(roles), Promise.resolve([]), r.articles.listVisible(roles),
    r.isoStandards.listVisible(roles), r.library.listVisible(roles), r.platformModules.listVisible(roles).catch(() => []), r.ecosystems.listAll(),
    r.competencies.listVisible(roles), r.targetRoles.listAll(), r.domains.listAll(), r.learningPaths.list(), r.recCatalog.list(),
    r.sources.list(), r.programs.listVisible(roles),
    /* Guides and the lesson→guide map are enrichment: if they fail to load, courses still render. */
    r.guides ? r.guides.listVisible(roles).catch(() => []) : [], r.lessonGuideMap ? r.lessonGuideMap.list().catch(() => []) : [],
    /* Phase 8: the certification explorer is enrichment too. */
    r.certifications ? r.certifications.listVisible(roles).catch(() => []) : [],
    /* Phase 9: figures and their placement map are enrichment as well. */
    r.figures ? r.figures.listVisible(roles).catch(() => []) : [], r.lessonFigures ? r.lessonFigures.list().catch(() => []) : []
  ]);
  const paths = pathsRaw.filter(p => !p.governance || isVisible(p, roles));
  const visibleIds = new Set([...courses, ...assessments, ...articles, ...library].map(x => x.id));
  return {
    courses, assessments, questions, articles, standards, library, tools, ecosystems, competencies, domains, paths, catalog, sources, programs, guides, lessonMap, certifications, figures, lessonFigures,
    rolesAll, roles: rolesAll.filter(x => isVisible(x, roles)), visibleIds,
    byId: (list, id) => list.find(x => x.id === id) || null
  };
}

export async function loadLearner(ctx, content) {
  const r = ctx.repos;
  const [profile, selfRows, attempts, progress, bookmarks] = await Promise.all([
    r.profile.get('me'), r.selfLevels.list(), r.assessmentAttempts.list(), r.courseProgress.list(), r.bookmarks ? r.bookmarks.list().catch(() => []) : []
  ]);
  const selfLevels = Object.fromEntries(selfRows.filter(x => Number.isInteger(x.level) && x.level >= 1 && x.level <= 5).map(x => [x.id, x.level]));
  const evidence = assessmentEvidence(attempts);
  return {
    profile, selfLevels, attempts, progress, evidence, bookmarks,
    mastered: masteredCompetencies(evidence),
    completed: completedTargets({ courses: content?.courses || [], progress, attempts })
  };
}

export async function loadAll(ctx) {
  const content = await loadContent(ctx);
  const learner = await loadLearner(ctx, content);
  return { content, learner };
}

/** Guide files for the given slugs, limited to guides this viewer may see (`content.guides`). Failures give null. */
export async function loadGuides(ctx, content, slugs = []) {
  const visible = new Set((content.guides || []).map(g => g.slug));
  const want = [...new Set(slugs)].filter(s => visible.has(s));
  const pairs = await Promise.all(want.map(s => ctx.loadGuide(s).then(g => [s, g]).catch(() => [s, null])));
  return Object.fromEntries(pairs.filter(([, g]) => g));
}

/* ------------------------------------------------------------------ Phase 10A: on-demand full records */

const visibleFull = (ctx, rec) => rec && validateGovernance(rec).length === 0 && isVisible(rec, ctx.session.roles);

/** The full record of one course (from its academy shard), or null when it is missing or not visible to this viewer. */
export async function loadFullCourse(ctx, light) {
  if (!light) return null;
  if (light.split?.full !== false || !ctx.split) return light;
  const shard = await ctx.split.readShards('courses', [light.split.academy]);
  const full = shard.find(c => c.id === light.id);
  return visibleFull(ctx, full) ? full : null;
}

/** Content with the named courses swapped for their full records (course page and lesson player). */
export async function withFullCourses(ctx, content, ids = []) {
  const full = await Promise.all(content.courses.filter(c => ids.includes(c.id)).map(c => loadFullCourse(ctx, c)));
  const byId = new Map(full.filter(Boolean).map(c => [c.id, c]));
  return { ...content, courses: content.courses.map(c => byId.get(c.id) || c) };
}

/** Question records by id from the shards that hold them, filtered by the governance gate. Order follows `ids`. */
export async function loadQuestions(ctx, ids = []) {
  const want = [...new Set(ids.filter(Boolean))];
  if (!want.length) return [];
  let recs;
  if (ctx.split) recs = await ctx.split.readShards('questions', await ctx.split.questionShardsFor(want));
  else recs = await ctx.repos.questions.listAll();
  const byId = new Map(recs.filter(q => visibleFull(ctx, q)).map(q => [q.id, q]));
  return want.map(id => byId.get(id)).filter(Boolean);
}

/**
 * Phase 10A light loader for the home page and the shell-level widgets: the course index, guide index and the
 * learner's own records only — no assessments, questions, figures or certifications (first load ≤ 0.4 MB).
 */
export async function loadLight(ctx) {
  const roles = ctx.session.roles;
  const r = ctx.repos;
  const [courses, guides] = await Promise.all([(r.coursesIndex || r.courses).listVisible(roles), r.guides ? r.guides.listVisible(roles).catch(() => []) : []]);
  const content = { courses, guides, assessments: [], byId: (list, id) => list.find(x => x.id === id) || null };
  const learner = await loadLearner(ctx, content);
  return { content, learner };
}
