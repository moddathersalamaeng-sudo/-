/**
 * Quality (ASQ-informed) Academy (Phase 9).
 *
 *  #/academy/quality                        qualityAcademyView — starting point, five routes, ASQ certifications, courses, method guides, CMQ/OE Center
 *  #/academy/quality/certifications         (pmi.js certificationsView with body ASQ)
 *  #/academy/quality/certifications/:slug   (pmi.js certificationView with body ASQ)
 *  #/academy/quality/cmqoe                  cmqoeCenterView — diagnostic, readiness, weak areas by BoK area, study hours, practice, progress, 12-week plan
 *
 * Facts come only from ASQ's official pages, each group verified (date), secondary (BoK counts from a dated provider summary) or
 * pending (go to ASQ). The Academy never claims to be an ASQ partner, never awards RUs and does not reproduce the BoK or exam questions.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Table, ProgressRing } from '../ui/components.js';
import { qualityStartingPoint, Q_ROLE_ROUTE, bokAreaResults, readinessIndex, weightedStudyHours, weakAreas, CMQOE_AREA_COURSES, CMQOE_DIAG, readinessBand } from '../domain/quality.mjs';
import { certFactState, showsFacts } from '../domain/pmi.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, previewBanner, linkBtn, section, isReviewer, govBadge, toolLink } from '../ui/academy.js';
import { courseCard } from './courses.js';
import { certCard, certsOf, routeCard, stat, studyPlan, certHref } from './pmi.js';
import { academyBanner } from '../ui/art.js';

const isQCourse = c => c.ecosystem === 'quality' && !c.guide;
const isQGuideCourse = c => c.guide && (c.category === 'quality' || c.ecosystem === 'quality' || c.id.startsWith('CRS-M-'));

function factorText(ctx, f, content) {
  const { t, i18n } = ctx;
  if (f.code === 'target_role') return t('q9.factor.target_role', { value: L(ctx, content.rolesAll.find(r => r.id === f.value)?.name) || f.value });
  if (f.code === 'intent') return t('q9.factor.intent', { value: t('q9.intent.' + f.value) });
  return t('q9.factor.' + f.code, { value: i18n.number(f.value ?? 0) });
}

function startingPoint(ctx, content, learner) {
  const { t } = ctx;
  const sp = qualityStartingPoint({ profile: learner.profile, evidence: learner.evidence, completed: learner.completed });
  const visible = sp.href.startsWith('#/learning-path') ? content.paths.some(p => p.id === sp.route_id) : content.visibleIds.has(sp.target_id);
  return h('section', { class: 'panel feature start', 'aria-labelledby': 'qsp-h', dataset: { start: sp.key, target: sp.target_id } },
    h('p', { class: 'eyebrow' }, icon('compass'), ' ', t('q9.startEyebrow')),
    h('h2', { id: 'qsp-h' }, L(ctx, sp.title)),
    h('p', null, L(ctx, sp.reason)),
    sp.factors.length ? h('details', null, h('summary', null, t('p7.iso.whyThis')), h('ul', null, sp.factors.map(f => h('li', null, factorText(ctx, f, content))))) : null,
    visible
      ? h('div', { class: 'btnrow' }, linkBtn(sp.href, t('p7.iso.startCta'), 'primary', { 'data-action': 'q-start' }), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))
      : h('div', null, h('p', { class: 'banner banner-info', role: 'note' }, t('q9.startPending')),
        h('div', { class: 'btnrow' }, linkBtn('#/guides', t('q9.readFundamentals'), 'primary'), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))),
    h('p', { class: 'note' }, t('p7.iso.yearsNote')));
}

/** The academy hero (same frame as the ISO and PMI heroes) with the Quality illustration behind the text. */
export function bannerHero(cls, family, iconName, ...kids) {
  return h('header', { class: ['iso-hero', 'q-hero', cls], dataset: { family } }, academyBanner(family, iconName, cls), ...kids);
}

/* ------------------------------------------------------------------ landing */

export function qualityAcademyView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const routes = content.paths.filter(p => p.kind === 'quality_route');
    const courses = content.courses.filter(isQCourse);
    const guideCourses = content.courses.filter(isQGuideCourse);
    const guides = (content.guides || []).filter(g => g.kind === 'method');
    const certs = certsOf(content, 'ASQ');
    const tools = content.tools.filter(m => m.system === 'aud' && m.id !== 'aud' && m.id !== 'oec');
    const ready = content.byId(content.assessments, 'ASM-READY-Q-001');
    const figN = (content.figures || []).filter(f => f.id.startsWith('FIG-Q-') || f.id.startsWith('FIG-M-')).length;
    const inProgress = courses.filter(c => courseStatus(c, learner.progress, learner.attempts).state === 'in_progress');
    const hero = bannerHero('q-landing', 'quality', 'award',
      h('p', { class: 'eyebrow' }, icon('award'), ' ', t('q9.eyebrow')), h('h1', null, t('q9.title')), h('p', null, t('q9.lede')),
      h('ul', { class: 'stats', 'aria-label': t('q9.statsLabel') },
        stat('book', i18n.number(courses.length), t('q9.statCourses')), stat('image', i18n.number(figN), t('q9.statFigures')),
        stat('award', i18n.number(certs.length), t('q9.statCerts')), stat('route', i18n.number(routes.length), t('q9.statRoutes'))),
      h('div', { class: 'btnrow' }, ready ? linkBtn(`#/assessments/${ready.slug}`, t('q9.takeReadiness'), 'primary') : linkBtn('#/guides', t('q9.readFundamentals'), 'primary'),
        linkBtn('#/academy/quality/certifications', t('q9.exploreCerts')), linkBtn('#/academy/quality/cmqoe', t('q9.openCenter'))));
    return h('div', null,
      hero,
      previewBanner(ctx, [...courses, ...routes, ...certs]),
      startingPoint(ctx, content, learner),
      inProgress.length ? section('q-cont', t('p7.iso.continue'), h('div', { class: 'cards' }, inProgress.map(c => courseCard(ctx, c, learner)))) : null,
      section('q-routes', t('q9.routes'), h('p', { class: 'note' }, t('q9.routesNote')),
        routes.length ? h('div', { class: 'cards' }, routes.map(p => routeCard(ctx, p, content, learner, Q_ROLE_ROUTE))) : EmptyState({ title: t('q9.routesPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      section('q-courses', t('q9.courses'), h('p', { class: 'note' }, t('q9.coursesNote')),
        courses.length ? h('div', { class: 'cards' }, courses.map(c => courseCard(ctx, c, learner))) : EmptyState({ title: t('q9.coursesPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      section('q-certs', t('q9.certs'), h('p', { class: 'note' }, t('q9.certsNote')),
        certs.length ? h('div', { class: 'cards' }, certs.map(c => certCard(ctx, c))) : EmptyState({ title: t('q9.certsPending'), body: t('p7.pendingBody'), iconName: 'lock' }),
        certs.length ? h('p', null, linkBtn('#/academy/quality/certifications', t('q9.compareCerts'))) : null),
      guides.length ? section('q-methods', t('q9.methods'), h('p', { class: 'note' }, t('q9.methodsNote')),
        h('div', { class: 'cards' }, guideCourses.filter(c => guides.some(g => g.slug === c.guide)).map(c => courseCard(ctx, c, learner)))) : null,
      section('q-learnuse', t('p7.iso.learnVsUse'), h('div', { class: 'split' },
        h('div', { class: 'panel' }, h('h3', null, icon('book'), ' ', t('p7.iso.learnTitle')), h('p', null, t('q9.learnBody')), linkBtn('#/academy/courses?q=', t('courses.title'))),
        h('div', { class: 'panel' }, h('h3', null, icon('grid'), ' ', t('p7.iso.useTitle')), h('p', null, t('q9.useBody')),
          tools.length ? h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m)))) : h('p', { class: 'note' }, t('p7.none'))))),
      h('p', { class: 'note' }, icon('info'), ' ', t('q9.honesty')));
  } });
  return h('div', { class: 'iso quality' }, region);
}

/* ------------------------------------------------------------------ CMQ/OE Center */

export function cmqoeCenterView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const cert = certsOf(content, 'ASQ').find(c => c.id === 'CERT-CMQOE');
    const diag = content.byId(content.assessments, CMQOE_DIAG);
    const route = content.paths.find(p => p.id === 'ROUTE-Q-CMQOE');
    const areas = cert && showsFacts(certFactState(cert).domains) ? cert.domains : [];
    const res = bokAreaResults(learner.attempts, diag, areas);
    const ri = readinessIndex(res.areas);
    const band = readinessBand(ri);
    const weak = weakAreas(res.areas);
    const totalQ = areas.reduce((a, d) => a + (d.questions || 0), 0) || 1;
    const courseLinks = ids => ids.map(id => content.byId(content.courses, id)).filter(Boolean)
      .map(cc => h('li', null, h('a', { href: `#/academy/courses/${cc.slug}` }, icon('book'), ' ', L(ctx, cc.title))));

    const hero = bannerHero('q-center', 'quality', 'crown',
      h('p', { class: 'eyebrow' }, icon('crown'), ' ', t('q9.center.eyebrow')), h('h1', null, t('q9.center.title')), h('p', null, t('q9.center.lede')),
      h('div', { class: 'btnrow' }, diag ? linkBtn(`#/assessments/${diag.slug}`, res.attempt ? t('q9.center.retakeDiag') : t('q9.center.takeDiag'), 'primary', { 'data-action': 'cmqoe-diag' }) : null,
        cert ? linkBtn(certHref(cert), t('q9.center.certLink')) : null, route ? linkBtn(`#/learning-path?route=${route.id}`, t('q9.center.routeLink')) : null));
    if (!cert) return h('div', null, hero, EmptyState({ title: t('q9.certsPending'), body: t('p7.pendingBody'), iconName: 'lock', action: linkBtn('#/academy/quality', t('nav.items.qualityAcademy')) }));

    const diagSec = section('cc-diag', t('q9.center.diagTitle'), h('p', null, t('q9.center.diagBody')),
      res.attempt ? h('p', { class: 'note', dataset: { attempt: 'true' } }, icon('calendar'), ' ', t('q9.center.lastAttempt', { date: i18n.date(String(res.attempt.submitted_at).slice(0, 10)), score: i18n.number(res.attempt.score ?? 0) }))
        : h('p', { class: 'note', dataset: { attempt: 'none' } }, t('q9.center.noAttempt')),
      diag ? null : h('p', { class: 'banner banner-info', role: 'note' }, t('p7.pendingShort')));

    const readySec = section('cc-ready', t('q9.center.readinessTitle'), h('div', { class: 'readiness' },
      ri === null ? h('div', { class: 'ring-empty', 'aria-hidden': 'true' }, icon('gauge')) : ProgressRing({ ratio: ri / 100, label: t('q9.center.readiness'), valueText: i18n.number(ri) + '%' }),
      h('div', null, h('p', { dataset: { readiness: ri === null ? 'none' : String(ri) } }, h('strong', null, t('q9.center.readiness'), ': '), ri === null ? t('q9.center.readinessNone') : [i18n.number(ri), '% — ', t('q9.center.readinessBand.' + band)]),
        h('p', { class: 'note' }, t('q9.center.readinessNote')),
        weak.length ? h('p', null, icon('alert'), ' ', t('q9.center.weakest', { list: weak.map(w => L(ctx, w.name)).join(' · ') })) : (res.attempt ? h('p', null, icon('check'), ' ', t('q9.center.noWeak')) : null))));

    const areaSec = section('cc-areas', t('q9.center.areasTitle'), h('p', { class: 'note' }, t('q9.center.areasNote')),
      certFactState(cert).domains === 'secondary' ? h('p', { class: 'note' }, icon('info'), ' ', t('q9.secondaryBody')) : null,
      h('ul', { class: 'bok-grid' }, res.areas.map(r => h('li', { dataset: { state: r.state === 'mid' ? 'none' : r.state, area: String(r.index) } },
        h('div', { class: 'bok-head' }, h('span', { class: 'bok-no' }, i18n.number(r.index + 1)), h('strong', null, L(ctx, r.name))),
        h('span', { class: 'bok-q' }, t('q9.center.areaQ', { n: i18n.number(r.questions), s: i18n.number(Math.round(100 * r.questions / totalQ)) })),
        h('div', null, Badge({ label: t('q9.center.areaState.' + r.state), tone: r.state === 'ok' ? 'ok' : r.state === 'weak' ? 'warn' : r.state === 'mid' ? 'info' : 'neutral' }),
          r.percent !== null ? [' ', t('q9.center.areaResult', { p: i18n.number(r.percent) })] : null),
        h('ul', { class: 'plain' }, courseLinks(CMQOE_AREA_COURSES[r.index] || []))))));

    const out = h('div', { class: 'planner-out', 'aria-live': 'polite' });
    const err = h('p', { class: 'field-error', id: 'cc-err', hidden: true });
    const input = h('input', { class: 'input', id: 'cc-total', type: 'number', min: '20', max: '400', step: '5', value: '100', inputmode: 'numeric', 'aria-describedby': 'cc-hint cc-err' });
    const paint = v => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 20 || n > 400) { err.hidden = false; err.textContent = t('q9.plannerInvalid'); input.setAttribute('aria-invalid', 'true'); return; }
      err.hidden = true; input.removeAttribute('aria-invalid');
      const plan = weightedStudyHours(res.areas, Math.round(n));
      out.replaceChildren(Table({ caption: t('q9.plannerCaption', { n: i18n.number(Math.round(n)) }), columns: [{ key: 'd', label: t('q9.col.domain') }, { key: 's', label: t('q9.col.weight') }, { key: 'h', label: t('q9.col.hours'), num: true }],
        rows: [...plan.areas.map(a => ({ d: L(ctx, a.name), s: t('q9.center.areaState.' + a.state), h: i18n.number(a.hours) })), { d: t('q9.practiceReserve'), s: '—', h: i18n.number(plan.practice) }] }));
    };
    input.addEventListener('input', e => paint(e.target.value));
    paint(100);
    const planSec = section('cc-plan', t('q9.center.planTitle'), h('p', { class: 'note' }, t('q9.center.planNote')),
      h('div', { class: 'planner', dataset: { planner: 'cmqoe' } }, h('div', { class: 'field' }, h('label', { for: 'cc-total' }, t('q9.plannerLabel')), h('p', { class: 'hint', id: 'cc-hint' }, t('q9.plannerHint')), input, err), out));

    const routeCourses = (route?.steps || []).filter(s => s.type === 'course').map(s => content.byId(content.courses, s.target_id)).filter(Boolean);
    const finals = routeCourses.map(c => content.byId(content.assessments, c.assessments?.final)).filter(Boolean);
    const practiceSec = section('cc-practice', t('q9.center.practiceTitle'), h('p', null, t('q9.center.practiceBody')),
      finals.length ? h('ul', { class: 'chips' }, finals.map(a => h('li', null, h('a', { href: `#/assessments/${a.slug}` }, icon('question'), ' ', L(ctx, a.title))))) : h('p', { class: 'note' }, t('p7.pendingShort')));
    const comps = (cert.competencies || []).map(id => content.byId(content.competencies, id)).filter(Boolean);
    const compSec = comps.length ? section('cc-comps', t('q9.center.competenciesTitle'), h('ul', { class: 'chips' }, comps.map(x => h('li', null,
      h('a', { href: '#/profile/competencies' }, x.id, ' ', L(ctx, x.name), Number.isFinite(learner.evidence?.[x.id]?.percent) ? ` · ${i18n.number(learner.evidence[x.id].percent)}%` : ''))))) : null;
    const progressSec = routeCourses.length ? section('cc-progress', t('q9.center.progressTitle'), h('p', { class: 'note' }, t('q9.center.progressNote')),
      h('div', { class: 'cards' }, routeCourses.map(c => courseCard(ctx, c, learner)))) : null;

    return h('div', null, hero, previewBanner(ctx, [cert, diag].filter(Boolean)),
      h('p', { class: 'banner banner-warn', role: 'note', dataset: { claims: 'true' } }, icon('shield'), ' ', L(ctx, cert.claims)),
      diagSec, readySec, areaSec, planSec, practiceSec, compSec, progressSec,
      cert.study_plan ? h('div', { dataset: { plan12: 'true' } }, studyPlan(ctx, cert, content)) : null,
      isReviewer(ctx) ? h('p', { class: 'note' }, govBadge(ctx, cert)) : null);
  } });
  return h('div', { class: 'iso quality cmqoe' }, region);
}
