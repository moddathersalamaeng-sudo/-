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
import { isVisible } from './governance.js';
import { assessmentEvidence, masteredCompetencies, completedTargets } from '../domain/learner-model.mjs';

export async function loadContent(ctx) {
  const roles = ctx.session.roles;
  const r = ctx.repos;
  const [courses, assessments, questions, articles, standards, library, tools, ecosystems, competencies, rolesAll, domains, pathsRaw, catalog, sources, programs, guides, lessonMap] = await Promise.all([
    r.courses.listVisible(roles), r.assessments.listVisible(roles), r.questions.listVisible(roles), r.articles.listVisible(roles),
    r.isoStandards.listVisible(roles), r.library.listVisible(roles), r.platformModules.listVisible(roles).catch(() => []), r.ecosystems.listAll(),
    r.competencies.listVisible(roles), r.targetRoles.listAll(), r.domains.listAll(), r.learningPaths.list(), r.recCatalog.list(),
    r.sources.list(), r.programs.listVisible(roles),
    /* Guides and the lesson→guide map are enrichment: if they fail to load, courses still render. */
    r.guides ? r.guides.listVisible(roles).catch(() => []) : [], r.lessonGuideMap ? r.lessonGuideMap.list().catch(() => []) : []
  ]);
  const paths = pathsRaw.filter(p => !p.governance || isVisible(p, roles));
  const visibleIds = new Set([...courses, ...assessments, ...articles, ...library].map(x => x.id));
  return {
    courses, assessments, questions, articles, standards, library, tools, ecosystems, competencies, domains, paths, catalog, sources, programs, guides, lessonMap,
    rolesAll, roles: rolesAll.filter(x => isVisible(x, roles)), visibleIds,
    byId: (list, id) => list.find(x => x.id === id) || null
  };
}

export async function loadLearner(ctx, content) {
  const r = ctx.repos;
  const [profile, selfRows, attempts, progress] = await Promise.all([
    r.profile.get('me'), r.selfLevels.list(), r.assessmentAttempts.list(), r.courseProgress.list()
  ]);
  const selfLevels = Object.fromEntries(selfRows.filter(x => Number.isInteger(x.level) && x.level >= 1 && x.level <= 5).map(x => [x.id, x.level]));
  const evidence = assessmentEvidence(attempts);
  return {
    profile, selfLevels, attempts, progress, evidence,
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
