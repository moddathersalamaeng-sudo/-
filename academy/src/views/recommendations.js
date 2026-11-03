/**
 * Recommendations and learning path (Phase 6, rebuilt on the Phase 7 learner model).
 *
 *  #/recommendations              recommendationsView — gaps, scored recommendations with "why", next best action
 *  #/learning-path?route=ID       learningPathView    — any visible path/route; ISO routes skip what you have demonstrated
 *
 * Evidence used (in this order): assessment results per competency (latest attempt wins), then self-declared levels.
 * Years of experience only adjust fit; they never count as competency evidence.
 * Only targets the viewer may see are recommended; path steps that are not yet published are shown as such.
 */
import { h } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, ProgressBar, Table, toast } from '../ui/components.js';
import { calculateGaps, generateRecommendations, buildLearningPath, nextBestAction, suppressDemonstrated } from '../domain/recommendations.mjs';
import { percentMap } from '../domain/learner-model.mjs';
import { ROLE_ROUTE } from '../domain/iso.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, pageHead, previewBanner, linkBtn, section, setHashQuery, targetHref, effortLabel } from '../ui/academy.js';

const PRIORITY_TONE = { Critical: 'bad', High: 'warn', Medium: 'info', Low: 'neutral', Achieved: 'ok' };
const STEP_TONE = { Completed: 'ok', Skipped: 'ok', Locked: 'neutral', Recommended: 'gold', Available: 'info' };
const key = s => String(s).toLowerCase().replace(/\s+/g, '_');

/** Build the full recommendation model for the current viewer. Exported for tests and other views. */
export async function buildRecommendationModel(ctx, routeId = null) {
  const { content, learner } = await loadAll(ctx);
  const [feedback, saved] = await Promise.all([ctx.repos.recommendationFeedback.list(), ctx.repos.recommendations.list()]);
  const profile = learner.profile;
  const role = profile ? content.roles.find(r => r.id === profile.target_role) || null : null;
  const assessmentByCompetency = percentMap(learner.evidence);
  const gaps = role ? calculateGaps({ role, competencies: content.competencies, selfLevels: learner.selfLevels, assessmentByCompetency }) : [];
  const eligible = content.catalog.filter(x => x.recommendation_type === 'competency_development' || content.visibleIds.has(x.target_id));
  const dismissed = new Set(feedback.filter(f => f.action === 'dismissed').map(f => f.recommendation_id));
  const recs = profile
    ? suppressDemonstrated(generateRecommendations(eligible, { profile, gaps, assessmentByCompetency, completedIds: learner.completed }), learner.mastered)
      .filter(r => !dismissed.has(r.id))
      .map(r => ({ ...r, user_state: saved.find(x => x.id === r.id)?.status || 'generated', href: targetHref({ type: r.recommendation_type, target_id: r.target_id }, content) }))
    : [];
  const pathChoices = content.paths;
  const defaultRoute = ROLE_ROUTE[profile?.target_role];
  const template = pathChoices.find(p => p.id === routeId) || pathChoices.find(p => p.id === defaultRoute) || pathChoices.find(p => (p.roles || []).includes(profile?.target_role)) || null;
  const path = template ? buildLearningPath(structuredClone(template), { completedIds: learner.completed, recommendations: recs, mastered: learner.mastered }) : null;
  if (path) for (const s of path.steps) {
    s.visible = s.type === 'competency_development' || content.visibleIds.has(s.target_id);
    s.href = s.visible ? targetHref({ type: s.type, target_id: s.target_id }, content) : null;
  }
  return { content, learner, profile, role, gaps, recs, path, pathChoices, next: nextBestAction({ path: path && { ...path, steps: path.steps.filter(s => s.visible) }, recommendations: recs }) };
}

/* ------------------------------------------------------------------ shared pieces */

export function GapTable(ctx, gaps, { limit = 10 } = {}) {
  const { t, i18n } = ctx;
  if (!gaps.length) return h('p', { class: 'note' }, t('p7.rec.noGaps'));
  return Table({ caption: t('phase6.gaps'), columns: [
    { key: 'c', label: t('pf.thCompetency') }, { key: 'cur', label: t('p7.comp.current'), num: true }, { key: 'req', label: t('p7.comp.target'), num: true },
    { key: 'gap', label: t('pf.thGap'), num: true }, { key: 'src', label: t('p7.comp.evidence') }, { key: 'p', label: t('p7.rec.priority') }],
  rows: gaps.slice(0, limit).map(g => ({
    c: h('span', null, h('span', { class: 'cid' }, g.competency_id), ' ', L(ctx, g.name)),
    cur: i18n.number(g.current), req: i18n.number(g.required), gap: i18n.number(g.gap),
    src: t('p7.comp.src.' + g.evidence_source),
    p: Badge({ label: t('p7.priority.' + key(g.priority)), tone: PRIORITY_TONE[g.priority] })
  })) });
}

function recCard(ctx, r, region) {
  const { t, i18n } = ctx;
  const setState = async status => {
    await ctx.repos.recommendations.save({ id: r.id, status, score: r.recommendation_score, reason_codes: r.reason_codes, target_id: r.target_id, type: r.recommendation_type, updated_at: new Date().toISOString() });
    toast(t('p7.rec.state.' + status));
    region.refresh();
  };
  const dismiss = async () => {
    await ctx.repos.recommendationFeedback.save({ id: 'fb-' + r.id, recommendation_id: r.id, action: 'dismissed', at: new Date().toISOString() });
    toast(t('p7.rec.dismissed')); region.refresh();
  };
  const why = h('details', null, h('summary', null, t('phase6.why')),
    h('p', null, L(ctx, r.explanation)),
    h('p', { class: 'note' }, t('p7.rec.reasons', { list: (r.reason_codes || []).map(c => t('p7.reason.' + c)).join(' · ') || t('p7.reason.CAREER_GOAL') })),
    h('ul', { class: 'plain contrib' }, Object.entries(r.score_detail.contributions).map(([k, v]) => h('li', null, h('span', null, t('p7.factor.' + k)), h('strong', null, '+' + i18n.number(v))))),
    r.score_detail.prerequisite.status !== 'Met' ? h('p', { class: 'note' }, t('p7.rec.prereq.' + key(r.score_detail.prerequisite.status))) : null);
  return h('article', { class: 'card rec', dataset: { rec: r.id, target: r.target_id } },
    h('div', { class: 'rec-top' },
      h('div', null, h('p', { class: 'eyebrow' }, t('p7.recType.' + r.recommendation_type)), h('h3', null, r.href ? h('a', { href: r.href }, L(ctx, r.title)) : L(ctx, r.title))),
      h('div', { class: 'score', role: 'img', 'aria-label': t('p7.rec.scoreAria', { n: i18n.number(r.recommendation_score) }) }, h('span', { 'aria-hidden': 'true' }, i18n.number(r.recommendation_score)))),
    h('div', { class: 'badges' }, Badge({ label: t('p7.priority.' + key(r.priority)), tone: PRIORITY_TONE[r.priority] }), r.estimated_effort ? Badge({ label: effortLabel(ctx, r.estimated_effort), tone: 'neutral' }) : null,
      r.user_state !== 'generated' ? Badge({ label: t('p7.rec.state.' + r.user_state), tone: 'info' }) : null),
    why,
    h('div', { class: 'btnrow' },
      r.href ? h('a', { class: 'btn btn-primary', href: r.href, onclick: () => setState('started') }, t('phase6.start')) : null,
      r.user_state !== 'saved' ? Button({ label: t('phase6.saveLater'), variant: 'secondary', onClick: () => setState('saved') }) : null,
      Button({ label: t('phase6.dismiss'), variant: 'quiet', onClick: dismiss, attrs: { 'data-action': 'dismiss' } })));
}

/* ------------------------------------------------------------------ recommendations */

export function recommendationsView(ctx) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.rec.eyebrow'), title: t('phase6.recTitle'), lede: t('phase6.recLede') });
  const region = dataRegion({ t, load: () => buildRecommendationModel(ctx), render: m => {
    if (!m.profile) return EmptyState({ title: t('phase6.improve'), body: t('phase6.improveBody'), action: linkBtn('#/profile', t('phase6.completeProfile'), 'primary') });
    const nba = m.next ? (() => {
      const href = m.next.type === 'path_step' ? m.path.steps.find(s => s.target_id === m.next.target_id)?.href : targetHref({ type: m.next.type, target_id: m.next.target_id }, m.content);
      return h('div', { class: 'nba' }, h('p', { class: 'eyebrow' }, t('phase6.nba')), h('h3', null, L(ctx, m.next.title)),
        h('p', { class: 'note' }, t('p7.reason.' + m.next.reason), m.next.effort ? ' · ' + effortLabel(ctx, m.next.effort) : ''),
        href ? linkBtn(href, t('phase6.start'), 'primary', { 'data-action': 'nba' }) : null);
    })() : h('p', { class: 'note' }, t('p7.rec.noNext'));
    const snapshot = h('section', { class: 'panel feature', 'aria-labelledby': 'snap-h' },
      h('h2', { id: 'snap-h' }, t('phase6.snapshot')),
      h('p', null, t('phase6.target'), ': ', h('strong', null, L(ctx, m.content.rolesAll.find(r => r.id === m.profile.target_role)?.name) || '—')),
      m.role ? h('p', null, t('phase6.criticalGaps'), ': ', h('strong', null, i18n.number(m.gaps.filter(g => ['Critical', 'High'].includes(g.priority)).length))) : h('p', { class: 'note' }, t('p7.rec.frameworkPending')),
      h('p', { class: 'note' }, t('p7.rec.evidenceRule')),
      nba);
    return h('div', null,
      previewBanner(ctx, m.role ? [m.role, ...m.content.competencies] : []),
      snapshot,
      m.role ? section('rec-gaps', t('phase6.gaps'), GapTable(ctx, m.gaps), linkBtn('#/profile/competencies', t('profile.competencies'))) : null,
      section('rec-list', t('phase6.forYou'), m.recs.length
        ? h('div', { class: 'cards' }, m.recs.slice(0, 12).map(r => recCard(ctx, r, region)))
        : EmptyState({ title: t('phase6.noRecs'), body: t('p7.rec.noRecsBody') })),
      h('div', { class: 'btnrow' }, linkBtn('#/learning-path', t('phase6.pathTitle'), 'primary'), linkBtn('#/academy/iso', t('nav.items.isoAcademy'))));
  } });
  return h('div', null, head, region);
}

/* ------------------------------------------------------------------ learning path */

export function learningPathView(ctx, match) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.rec.eyebrow'), title: t('phase6.pathTitle'), lede: t('p7.path.lede') });
  let routeId = match.query?.route || null;
  const region = dataRegion({ t, load: () => buildRecommendationModel(ctx, routeId), render: m => {
    if (!m.pathChoices.length) return EmptyState({ title: t('phase6.noPath'), body: t('p7.pendingBody'), iconName: 'lock', action: linkBtn('#/knowledge', t('knowledge.title')) });
    const picker = h('div', { class: 'field picker' }, h('label', { for: 'route-pick' }, t('p7.path.choose')),
      h('select', { class: 'select', id: 'route-pick', onchange: e => { routeId = e.target.value; setHashQuery('/learning-path', { route: routeId }); region.refresh().then(() => document.getElementById('route-pick')?.focus()); } },
        !m.path ? h('option', { value: '' }, t('pf.choose')) : null,
        m.pathChoices.map(p => h('option', { value: p.id, selected: m.path?.id === p.id }, L(ctx, p.title)))));
    if (!m.path) return h('div', null, picker, EmptyState({ title: t('phase6.noPath'), body: t('phase6.noPathBody'), action: linkBtn('#/profile', t('phase6.profile')) }));
    const p = m.path;
    const summary = h('section', { class: 'panel feature', 'aria-labelledby': 'lp-h', dataset: { path: p.id } },
      h('h2', { id: 'lp-h' }, L(ctx, p.title)), h('p', null, L(ctx, p.goal)),
      ProgressBar({ value: p.progress.done, max: p.progress.total, label: t('phase6.pathProgress'), valueText: t('p7.path.progress', { done: i18n.number(p.progress.done), total: i18n.number(p.progress.total), pct: i18n.number(p.progress.percent) }) }),
      ROLE_ROUTE[m.profile?.target_role] === p.id ? Badge({ label: t('p7.iso.yourRoute'), tone: 'gold' }) : null,
      h('p', { class: 'note' }, t('p7.path.skipRule')));
    const steps = h('ol', { class: 'timeline' }, p.steps.map(s => {
      const status = s.visible ? s.status : 'Pending';
      const extra = s.skip_reason === 'demonstrated' ? t('p7.path.skipDemonstrated', { list: (s.skip_if_mastered || []).join(', ') })
        : s.skip_reason === 'completed' ? t('p7.path.skipCompleted')
        : status === 'Locked' ? t('p7.path.locked')
        : !s.visible ? t('p7.pendingShort') : null;
      return h('li', { class: ['step', 'step-' + key(status)], dataset: { step: s.target_id, status: key(status) } },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h('div', { class: 'step-body' },
          h('p', { class: 'eyebrow' }, t('p7.path.stepN', { n: i18n.number(s.order) }), ' · ', t('p7.recType.' + s.type), s.effort ? ' · ' + effortLabel(ctx, s.effort) : '', ' · ', t(s.dependency === 'required' ? 'p7.path.required' : 'p7.path.recommended')),
          h('h3', null, s.href && status !== 'Locked' ? h('a', { href: s.href }, L(ctx, s.title)) : L(ctx, s.title)),
          extra ? h('p', { class: 'note' }, extra) : null),
        Badge({ label: t('p7.stepStatus.' + key(status)), tone: STEP_TONE[status] || 'neutral' }));
    }));
    return h('div', null, previewBanner(ctx, [p]), picker, summary, section('lp-steps', t('p7.path.steps'), steps));
  } });
  return h('div', null, head, region);
}
