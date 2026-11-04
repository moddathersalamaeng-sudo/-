/**
 * ISO Academy (Phase 7).
 *
 *  #/academy/iso          isoAcademyView   — personalised starting point, six routes, standards, fundamentals, tools
 *  #/academy/iso/:slug    isoStandardView  — one standard family: edition facts with sources, "Learn" vs "Use the tool"
 *
 * The starting point is deterministic and explained (src/domain/iso.mjs → isoStartingPoint). When the step it picks is
 * not yet published, learners are told so honestly and offered the published fundamentals instead of a dead link.
 * The Academy never reproduces standard text; it links to the official pages.
 */
import { h, icon } from '../core/dom.js';
import { academyBanner } from '../ui/art.js';
import { dataRegion, EmptyState, Badge } from '../ui/components.js';
import { isoStartingPoint, standardBundle, ROLE_ROUTE } from '../domain/iso.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, notAvailable, pageHead, previewBanner, linkBtn, section, facts, hours, platformHref, isReviewer, govBadge, toolLink } from '../ui/academy.js';
import { courseCard, sourceList } from './courses.js';

/** "9 h" / "20 min" / "6.5 h" → minutes. */
export function effortMinutes(s) {
  const m = String(s || '').match(/([\d.]+)\s*(h|min)/i);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'h' ? 60 : 1));
}

function factorText(ctx, f, content) {
  const { t, i18n } = ctx;
  if (f.code === 'target_role') return t('p7.iso.factor.target_role', { value: L(ctx, content.rolesAll.find(r => r.id === f.value)?.name) || f.value });
  if (f.code === 'focus_standard') return t('p7.iso.factor.focus_standard', { value: L(ctx, content.standards.find(s => s.id === f.value)?.name) || f.value });
  return t('p7.iso.factor.' + f.code, { value: i18n.number(f.value ?? 0) });
}

function startTargetVisible(sp, content) {
  if (sp.key === 'standard') return content.standards.some(s => sp.href.endsWith('/' + s.slug));
  if (sp.key === 'advance') return content.paths.some(p => p.id === sp.route_id);
  return content.visibleIds.has(sp.target_id);
}

function startingPointCard(ctx, content, learner) {
  const { t } = ctx;
  const sp = isoStartingPoint({ profile: learner.profile, evidence: learner.evidence, completed: learner.completed, standards: content.standards });
  const visible = startTargetVisible(sp, content);
  return h('section', { class: 'panel feature start', 'aria-labelledby': 'sp-h', dataset: { start: sp.key, target: sp.target_id } },
    h('p', { class: 'eyebrow' }, t('p7.iso.startEyebrow')),
    h('h2', { id: 'sp-h' }, L(ctx, sp.title)),
    h('p', null, L(ctx, sp.reason)),
    sp.factors.length ? h('details', null, h('summary', null, t('p7.iso.whyThis')), h('ul', null, sp.factors.map(f => h('li', null, factorText(ctx, f, content))))) : null,
    visible
      ? h('div', { class: 'btnrow' }, linkBtn(sp.href, t('p7.iso.startCta'), 'primary', { 'data-action': 'start-point' }), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))
      : h('div', null, h('p', { class: 'banner banner-info', role: 'note' }, t('p7.iso.startPending')),
        h('div', { class: 'btnrow' }, linkBtn('#/knowledge/iso', t('p7.iso.readFundamentals'), 'primary'), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))),
    h('p', { class: 'note' }, t('p7.iso.yearsNote')));
}

function routeCard(ctx, p, content, learner) {
  const { t, i18n } = ctx;
  const mins = (p.steps || []).reduce((a, s) => a + effortMinutes(s.effort), 0);
  const mine = ROLE_ROUTE[learner.profile?.target_role] === p.id;
  const roleNames = (p.roles || []).map(id => L(ctx, content.rolesAll.find(r => r.id === id)?.name)).filter(Boolean);
  return h('article', { class: ['card', mine && 'card-current'], dataset: { route: p.id } },
    mine ? Badge({ label: t('p7.iso.yourRoute'), tone: 'gold' }) : null,
    h('h3', null, h('a', { href: `#/learning-path?route=${p.id}` }, L(ctx, p.title))),
    h('p', null, L(ctx, p.goal)),
    h('p', { class: 'note' }, t('p7.iso.routeMeta', { n: i18n.number((p.steps || []).length) }), mins ? ' · ' + hours(ctx, Math.round(mins / 6) / 10) : ''),
    roleNames.length ? h('p', { class: 'note' }, t('p7.iso.forRoles', { roles: roleNames.join(' · ') })) : null);
}

function standardCard(ctx, s) {
  const { t, i18n } = ctx;
  return h('article', { class: 'card', dataset: { standard: s.id } },
    h('p', { class: 'eyebrow' }, L(ctx, s.theme)),
    h('h3', null, h('a', { href: `#/academy/iso/${s.slug}` }, L(ctx, s.name))),
    h('p', null, L(ctx, s.purpose)),
    s.edition ? h('p', { class: 'note' }, L(ctx, s.edition.status), s.edition.verified_date ? ' ' + t('p7.iso.verified', { date: i18n.date(s.edition.verified_date) }) : '') : null,
    isReviewer(ctx) ? govBadge(ctx, s) : null);
}

function toolList(ctx, tools) {
  return h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m))));
}

/** Guide cards for the ISO landing: the toolkits' clause-by-clause explanations, and the courses built from them. */
function isoGuides(ctx, content) {
  const { t, i18n } = ctx;
  const gs = (content.guides || []).filter(g => g.kind === 'standard');
  if (!gs.length) return null;
  return section('iso-guides', t('gd.isoGuides'), h('p', { class: 'note' }, t('gd.isoGuidesNote')),
    h('ul', { class: 'cards cards-tight' }, gs.map(g => h('li', { class: 'card', dataset: { guide: g.slug } },
      h('a', { href: `#/guides/${g.slug}` }, L(ctx, g.title)),
      h('span', { class: 'note block' }, t('gd.counts', { items: i18n.number(g.counts.items), checks: i18n.number(g.counts.checks) }))))),
    h('p', null, h('a', { href: '#/guides' }, t('gd.allGuides'))));
}

/** Quality Mission (the owner's audit-day game), when published in the library. */
function isoGame(ctx, content) {
  const { t } = ctx;
  const sims = content.library.filter(x => x.kind === 'simulation');
  if (!sims.length) return null;
  return section('iso-game', t('gd.gameTitle'), h('p', null, t('gd.gameBody')),
    h('ul', { class: 'tools-mini' }, sims.map(x => h('li', null, h('a', { class: 'tlink', href: platformHref(ctx, x.link), 'aria-describedby': 'ext-note', dataset: { library: x.id } },
      h('span', { class: 'n' }, L(ctx, x.title)), h('span', { class: 'd' }, L(ctx, x.description)), icon('external'))))));
}

export function isoAcademyView(ctx) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const ready = content.byId(content.assessments, 'ASM-READY-ISO-001');
    const hero = h('header', { class: 'iso-hero' }, academyBanner('iso', 'shield'),
      h('p', { class: 'eyebrow' }, t('p7.iso.eyebrow')), h('h1', null, t('p7.iso.title')), h('p', null, t('p7.iso.lede')),
      h('div', { class: 'btnrow' }, linkBtn('#/knowledge/iso', t('p7.iso.readFundamentals'), 'primary'), ready ? linkBtn(`#/assessments/${ready.slug}`, t('p7.iso.takeReadiness')) : null));
    const routes = content.paths.filter(p => p.kind === 'iso_route');
    const isoArticles = content.articles.filter(a => a.ecosystem === 'iso');
    const isoTools = content.tools.filter(m => m.system === 'iso');
    const isoCourses = content.courses.filter(c => c.ecosystem === 'iso' || c.category === 'iso');
    const inProgress = isoCourses.filter(c => courseStatus(c, learner.progress, learner.attempts).state === 'in_progress');
    return h('div', null,
      hero,
      previewBanner(ctx, [...content.standards, ...isoCourses, ...routes]),
      startingPointCard(ctx, content, learner),
      inProgress.length ? section('iso-cont', t('p7.iso.continue'), h('div', { class: 'cards' }, inProgress.map(c => courseCard(ctx, c, learner)))) : null,
      section('iso-routes', t('p7.iso.routes'), h('p', { class: 'note' }, t('p7.iso.routesNote')),
        routes.length ? h('div', { class: 'cards' }, routes.map(p => routeCard(ctx, p, content, learner))) : EmptyState({ title: t('p7.iso.routesPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      section('iso-std', t('p7.iso.standards'),
        content.standards.length ? h('div', { class: 'cards' }, content.standards.map(s => standardCard(ctx, s))) : EmptyState({ title: t('p7.iso.standardsPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      isoGuides(ctx, content),
      isoGame(ctx, content),
      section('iso-found', t('p7.iso.fundamentals'), h('p', { class: 'note' }, t('p7.iso.fundamentalsNote')),
        isoArticles.length ? h('ul', { class: 'cards cards-tight' }, isoArticles.map(a => h('li', { class: 'card' }, h('a', { href: `#/knowledge/${a.ecosystem}/${a.slug}` }, L(ctx, a.title)), h('span', { class: 'note block' }, t('p7.minutesRead', { n: ctx.i18n.number(a.estimated_minutes || 0) }))))) : EmptyState({ title: t('states.emptyTitle'), body: t('states.emptyBody') })),
      section('iso-learnuse', t('p7.iso.learnVsUse'), h('div', { class: 'split' },
        h('div', { class: 'panel' }, h('h3', null, t('p7.iso.learnTitle')), h('p', null, t('p7.iso.learnBody')), linkBtn('#/academy/courses', t('courses.title'))),
        h('div', { class: 'panel' }, h('h3', null, t('p7.iso.useTitle')), h('p', null, t('p7.iso.useBody')), toolList(ctx, isoTools)))),
      h('p', { class: 'note' }, t('p7.iso.honesty')));
  } });
  return h('div', { class: 'iso' }, region);
}

export function isoStandardView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const s = content.standards.find(x => x.slug === match.params.slug);
    if (!s) return notAvailable(ctx, { title: t('p7.iso.standardNotFound'), body: t('p7.pendingBody'), action: linkBtn('#/academy/iso', t('nav.items.isoAcademy')) });
    return standardPage(ctx, s, content, learner);
  } });
  return h('div', { class: 'iso' }, region);
}

function standardPage(ctx, s, content, learner) {
  const { t, i18n } = ctx;
  const b = standardBundle(s, { courses: content.courses, assessments: content.assessments, articles: content.articles, tools: content.tools, paths: content.paths.filter(p => p.kind === 'iso_route') });
  const related = (s.related_toolkits || []).map(id => content.tools.find(m => m.id === id)).filter(Boolean);
  const tools = [b.tool, ...related].filter(Boolean);
  const roleCourse = id => content.byId(content.courses, id);
  const keyCourses = [['p7.iso.foundationCourse', s.foundation_course_id], ['p7.iso.implementerCourse', s.implementer_course_id], ['p7.iso.auditorCourse', s.auditor_course_id]]
    .map(([k, id]) => [k, roleCourse(id)]).filter(([, c]) => c);
  const others = b.courses.filter(c => !keyCourses.some(([, k]) => k.id === c.id));
  const guide = (content.guides || []).find(g => g.standard_id === s.id);
  const guideCourse = guide ? content.courses.find(c => c.guide === guide.slug) : null;

  const hero = h('header', { class: 'iso-hero' }, academyBanner('iso', 'book', s.id || 'std'),
    h('p', { class: 'eyebrow' }, L(ctx, s.theme)), h('h1', null, L(ctx, s.name)), h('p', null, L(ctx, s.purpose)),
    h('div', { class: 'btnrow' },
      keyCourses[0] ? linkBtn(`#/academy/courses/${keyCourses[0][1].slug}`, t('p7.iso.learnCta'), 'primary') : null,
      guide ? linkBtn(`#/guides/${guide.slug}`, t('gd.readGuide')) : null,
      b.diagnostic ? linkBtn(`#/assessments/${b.diagnostic.slug}`, t('p7.iso.diagnosticCta')) : null,
      b.tool ? toolLink(ctx, b.tool, { asButton: true, label: t('p7.iso.useCta') }) : null));

  const edition = s.edition ? h('section', { class: 'panel feature', 'aria-labelledby': 'ed-h' },
    h('h2', { id: 'ed-h' }, t('p7.iso.edition')),
    facts([[t('p7.iso.editionLabel'), s.edition.label], [t('p7.iso.editionStatus'), L(ctx, s.edition.status)], s.edition.transition ? [t('p7.iso.transition'), L(ctx, s.edition.transition)] : null,
      [t('p7.iso.verifiedOn'), s.edition.verified_date ? i18n.date(s.edition.verified_date) : '—']]),
    h('h3', null, t('p7.sources.title')), sourceList(ctx, s.edition.source_ids || s.source_ids, content),
    s.official_url ? h('p', null, h('a', { href: s.official_url, target: '_blank', rel: 'noopener' }, t('p7.iso.official'), ' ', icon('external'))) : null,
    h('p', { class: 'note' }, t('p7.iso.editionNote'))) : null;

  return h('article', { class: 'standard', dataset: { standard: s.id } },
    hero, previewBanner(ctx, [s, ...b.courses]), edition,
    s.themes?.length ? section('st-themes', t('p7.iso.themes'), h('ul', { class: 'chips' }, s.themes.map(x => h('li', null, L(ctx, x))))) : null,
    s.audience?.length ? section('st-aud', t('p7.course.audience'), h('ul', null, s.audience.map(x => h('li', null, L(ctx, x))))) : null,
    section('st-learn-use', t('p7.iso.learnVsUse'), h('div', { class: 'split' },
      h('div', { class: 'panel' }, h('h3', null, t('p7.iso.learnTitle')),
        keyCourses.length ? h('ul', { class: 'plain' }, keyCourses.map(([k, c]) => h('li', null, h('span', { class: 'note block' }, t(k)), h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)), ' ', h('span', { class: 'note' }, hours(ctx, c.training_hours))))) : h('p', { class: 'note' }, t('p7.pendingShort')),
        others.length ? h('details', null, h('summary', null, t('p7.iso.alsoCovers')), h('ul', { class: 'plain' }, others.map(c => h('li', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)))))) : null,
        b.diagnostic ? h('p', null, h('a', { href: `#/assessments/${b.diagnostic.slug}` }, L(ctx, b.diagnostic.title))) : null),
      h('div', { class: 'panel' }, h('h3', null, t('p7.iso.useTitle')), h('p', null, t('p7.iso.useBodyStd')), tools.length ? toolList(ctx, tools) : h('p', { class: 'note' }, t('p7.none'))))),
    guide ? section('st-guide', t('gd.stdGuide'), h('p', null, t('gd.stdGuideBody', { items: ctx.i18n.number(guide.counts.items), checks: ctx.i18n.number(guide.counts.checks) })),
      h('div', { class: 'btnrow' }, linkBtn(`#/guides/${guide.slug}`, L(ctx, guide.title), 'primary'), guideCourse ? linkBtn(`#/academy/courses/${guideCourse.slug}`, L(ctx, guideCourse.title)) : null)) : null,
    section('st-practice', t('p7.iso.inPractice'), h('div', { class: 'cards' },
      [['p7.iso.example', s.example], ['p7.iso.mistake', s.mistake], ['p7.iso.evidence', s.evidence]].filter(([, v]) => v).map(([k, v]) => h('article', { class: 'card' }, h('h3', null, t(k)), h('p', null, L(ctx, v)))))),
    b.articles.length ? section('st-know', t('p7.course.knowledge'), h('ul', { class: 'plain' }, b.articles.map(a => h('li', null, h('a', { href: `#/knowledge/${a.ecosystem}/${a.slug}` }, L(ctx, a.title)))))) : null,
    b.routes.length ? section('st-routes', t('p7.iso.routes'), h('div', { class: 'cards' }, b.routes.map(p => routeCard(ctx, p, content, learner)))) : null,
    h('p', { class: 'note' }, t('p7.sources.noCopy')));
}
