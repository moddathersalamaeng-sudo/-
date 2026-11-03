/**
 * PMI / PMO / P3O Academy (Phase 8).
 *
 *  #/academy/pmi                        pmiAcademyView     — starting point, five routes, certifications, practice guides, courses, toolkits
 *  #/academy/pmi/certifications         certificationsView — explorer of PMI certifications (stage and area filters in the URL) + comparison table
 *  #/academy/pmi/certifications/:slug   certificationView  — one certification: verified facts with dates and sources, how to prepare,
 *                                                            study plan (PMP®), domain-hours planner, routes, courses and toolkits
 *
 * Facts come only from PMI's official pages, each group marked verified (date) or pending (go to PMI). The Academy never claims to be
 * a PMI Authorized Training Partner and never awards PDUs; it does not reproduce PMBOK® Guide text or PMI exam questions.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Table } from '../ui/components.js';
import { pmiStartingPoint, PM_ROLE_ROUTE, certFactState, domainHours, FACT_GROUPS } from '../domain/pmi.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, notAvailable, previewBanner, linkBtn, section, facts, hours, isReviewer, govBadge, toolLink, setHashQuery } from '../ui/academy.js';
import { courseCard, sourceList } from './courses.js';
import { effortMinutes } from './iso.js';

const STAGE_ICON = { entry: 'flag', practitioner: 'briefcase', specialist: 'target', senior: 'award' };
const AREA_ICON = { project: 'briefcase', agile: 'refresh', risk: 'shield', pmo: 'grid', programme: 'layers', portfolio: 'chart', analysis: 'search' };
const isPmCourse = c => ['pmi', 'pmo', 'p3o'].includes(c.ecosystem);
const certHref = c => `#/academy/pmi/certifications/${c.slug}`;

function stat(iconName, value, label) {
  return h('li', { class: 'stat' }, icon(iconName), h('strong', null, value), h('span', null, label));
}

function factorText(ctx, f, content) {
  const { t, i18n } = ctx;
  if (f.code === 'target_role') return t('pmi.factor.target_role', { value: L(ctx, content.rolesAll.find(r => r.id === f.value)?.name) || f.value });
  if (f.code === 'intent') return t('pmi.factor.intent', { value: t('pmi.intent.' + f.value) });
  return t('pmi.factor.' + f.code, { value: i18n.number(f.value ?? 0) });
}

function startingPoint(ctx, content, learner) {
  const { t } = ctx;
  const sp = pmiStartingPoint({ profile: learner.profile, evidence: learner.evidence, completed: learner.completed });
  const visible = sp.key === 'pmp' ? content.paths.some(p => p.id === sp.route_id) : content.visibleIds.has(sp.target_id);
  return h('section', { class: 'panel feature start', 'aria-labelledby': 'pmsp-h', dataset: { start: sp.key, target: sp.target_id } },
    h('p', { class: 'eyebrow' }, icon('compass'), ' ', t('pmi.startEyebrow')),
    h('h2', { id: 'pmsp-h' }, L(ctx, sp.title)),
    h('p', null, L(ctx, sp.reason)),
    sp.factors.length ? h('details', null, h('summary', null, t('p7.iso.whyThis')), h('ul', null, sp.factors.map(f => h('li', null, factorText(ctx, f, content))))) : null,
    visible
      ? h('div', { class: 'btnrow' }, linkBtn(sp.href, t('p7.iso.startCta'), 'primary', { 'data-action': 'pm-start' }), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))
      : h('div', null, h('p', { class: 'banner banner-info', role: 'note' }, t('pmi.startPending')),
        h('div', { class: 'btnrow' }, linkBtn('#/knowledge/pmi', t('pmi.readFundamentals'), 'primary'), learner.profile ? null : linkBtn('#/profile', t('phase6.completeProfile')))),
    h('p', { class: 'note' }, t('p7.iso.yearsNote')));
}

function routeCard(ctx, p, content, learner) {
  const { t, i18n } = ctx;
  const mins = (p.steps || []).reduce((a, s) => a + effortMinutes(s.effort), 0);
  const mine = PM_ROLE_ROUTE[learner.profile?.target_role] === p.id;
  const certs = (p.certification_ids || []).map(id => content.certifications.find(c => c.id === id)).filter(Boolean);
  return h('article', { class: ['card', 'route-card', mine && 'card-current'], dataset: { route: p.id } },
    mine ? Badge({ label: t('p7.iso.yourRoute'), tone: 'gold' }) : null,
    h('h3', null, icon('route'), ' ', h('a', { href: `#/learning-path?route=${p.id}` }, L(ctx, p.title))),
    h('p', null, L(ctx, p.goal)),
    h('p', { class: 'meta' }, icon('steps'), ' ', t('p7.iso.routeMeta', { n: i18n.number((p.steps || []).length) }), mins ? [' · ', icon('clock'), ' ', hours(ctx, Math.round(mins / 6) / 10)] : null),
    certs.length ? h('p', { class: 'note' }, icon('award'), ' ', t('pmi.routeCerts'), ' ', certs.map((c, i) => [i ? ' · ' : '', h('a', { href: certHref(c) }, c.code)])) : null);
}

export function certCard(ctx, c) {
  const { t, i18n } = ctx;
  const st = certFactState(c);
  const quick = [
    st.exam === 'verified' && c.exam ? [icon('question'), ' ', t('pmi.qShort', { n: i18n.number(c.exam.questions) }), ' · ', icon('clock'), ' ', t('p7.minutes', { n: i18n.number(c.exam.minutes) })] : [icon('external'), ' ', t('pmi.checkPmi')],
    st.renewal === 'verified' && c.renewal ? [' · ', icon('refresh'), ' ', t('pmi.pdusShort', { n: i18n.number(c.renewal.pdus), y: i18n.number(c.renewal.years) })] : null];
  return h('article', { class: 'card cert-card', dataset: { cert: c.id, stage: c.stage, area: c.area } },
    h('p', { class: 'eyebrow' }, icon(STAGE_ICON[c.stage] || 'award'), ' ', t('pmi.stage.' + c.stage), ' · ', icon(AREA_ICON[c.area] || 'briefcase'), ' ', t('pmi.area.' + c.area)),
    h('h3', null, h('a', { href: certHref(c) }, h('span', { class: 'code' }, c.code), ' ', L(ctx, c.name))),
    h('p', null, L(ctx, c.summary)),
    h('p', { class: 'meta' }, quick),
    isReviewer(ctx) ? govBadge(ctx, c) : null);
}

/* ------------------------------------------------------------------ landing */

export function pmiAcademyView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const routes = content.paths.filter(p => p.kind === 'pm_route');
    const courses = content.courses.filter(isPmCourse);
    const handCourses = courses.filter(c => !c.guide);
    const guideCourses = courses.filter(c => c.guide);
    const guides = (content.guides || []).filter(g => g.kind === 'practice');
    const tools = content.tools.filter(m => m.system === 'pmo');
    const ready = content.byId(content.assessments, 'ASM-READY-PM-001');
    const inProgress = courses.filter(c => courseStatus(c, learner.progress, learner.attempts).state === 'in_progress');
    const practices = guides.reduce((a, g) => a + (g.counts?.items || 0), 0);
    const hero = h('header', { class: 'iso-hero pmi-hero' },
      h('p', { class: 'eyebrow' }, icon('briefcase'), ' ', t('pmi.eyebrow')), h('h1', null, t('pmi.title')), h('p', null, t('pmi.lede')),
      h('ul', { class: 'stats', 'aria-label': t('pmi.statsLabel') },
        stat('book', i18n.number(courses.length), t('pmi.statCourses')), stat('ladder', i18n.number(practices), t('pmi.statPractices')),
        stat('award', i18n.number(content.certifications.length), t('pmi.statCerts')), stat('route', i18n.number(routes.length), t('pmi.statRoutes'))),
      h('div', { class: 'btnrow' }, ready ? linkBtn(`#/assessments/${ready.slug}`, t('pmi.takeReadiness'), 'primary') : linkBtn('#/knowledge/pmi', t('pmi.readFundamentals'), 'primary'),
        linkBtn('#/academy/pmi/certifications', t('pmi.exploreCerts')), linkBtn('#/guides', t('gd.allGuides'))));
    return h('div', null,
      hero,
      previewBanner(ctx, [...courses, ...routes, ...content.certifications]),
      startingPoint(ctx, content, learner),
      inProgress.length ? section('pm-cont', t('p7.iso.continue'), h('div', { class: 'cards' }, inProgress.map(c => courseCard(ctx, c, learner)))) : null,
      section('pm-routes', t('pmi.routes'), h('p', { class: 'note' }, t('pmi.routesNote')),
        routes.length ? h('div', { class: 'cards' }, routes.map(p => routeCard(ctx, p, content, learner))) : EmptyState({ title: t('pmi.routesPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      section('pm-certs', t('pmi.certs'), h('p', { class: 'note' }, t('pmi.certsNote')),
        content.certifications.length ? h('div', { class: 'cards' }, content.certifications.map(c => certCard(ctx, c))) : EmptyState({ title: t('pmi.certsPending'), body: t('p7.pendingBody'), iconName: 'lock' }),
        content.certifications.length ? h('p', null, linkBtn('#/academy/pmi/certifications', t('pmi.compareCerts'))) : null),
      section('pm-courses', t('pmi.courses'), h('p', { class: 'note' }, t('pmi.coursesNote')),
        handCourses.length ? h('div', { class: 'cards' }, handCourses.map(c => courseCard(ctx, c, learner))) : EmptyState({ title: t('pmi.coursesPending'), body: t('p7.pendingBody'), iconName: 'lock' })),
      guides.length ? section('pm-guides', t('gd.practices'), h('p', { class: 'note' }, t('pmi.guidesNote')),
        h('ul', { class: 'cards cards-tight' }, guides.map(g => {
          const gc = guideCourses.find(c => c.guide === g.slug);
          return h('li', { class: 'card', dataset: { guide: g.slug } }, h('a', { href: `#/guides/${g.slug}` }, icon('ladder'), ' ', L(ctx, g.title)),
            h('span', { class: 'note block' }, t('gd.countsPractice', { sections: i18n.number(g.counts.sections), items: i18n.number(g.counts.items) })),
            gc ? h('a', { class: 'note block', href: `#/academy/courses/${gc.slug}` }, t('gd.course')) : null);
        }))) : null,
      section('pm-learnuse', t('p7.iso.learnVsUse'), h('div', { class: 'split' },
        h('div', { class: 'panel' }, h('h3', null, icon('book'), ' ', t('p7.iso.learnTitle')), h('p', null, t('pmi.learnBody')), linkBtn('#/academy/courses?q=', t('courses.title'))),
        h('div', { class: 'panel' }, h('h3', null, icon('grid'), ' ', t('p7.iso.useTitle')), h('p', null, t('pmi.useBody')),
          tools.length ? h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m)))) : h('p', { class: 'note' }, t('p7.none'))))),
      h('p', { class: 'note' }, icon('info'), ' ', t('pmi.honesty')));
  } });
  return h('div', { class: 'iso pmi' }, region);
}

/* ------------------------------------------------------------------ explorer */

export function certificationsView(ctx, match) {
  const { t, i18n } = ctx;
  const q = { stage: '', area: '', ...(match.query || {}) };
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content }) => {
    const all = content.certifications;
    if (!all.length) return EmptyState({ title: t('pmi.certsPending'), body: t('p7.pendingBody'), iconName: 'lock', action: linkBtn('#/academy/pmi', t('nav.items.pmiAcademy')) });
    const stages = [...new Set(all.map(c => c.stage))], areas = [...new Set(all.map(c => c.area))];
    const list = h('div', { class: 'cards', id: 'cert-list' });
    const count = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const paint = () => {
      const xs = all.filter(c => (!q.stage || c.stage === q.stage) && (!q.area || c.area === q.area));
      count.textContent = t('pmi.certCount', { n: i18n.number(xs.length) });
      list.replaceChildren(...(xs.length ? xs.map(c => certCard(ctx, c)) : [EmptyState({ title: t('p7.course.noMatch'), body: t('p7.course.noMatchBody') })]));
      setHashQuery('/academy/pmi/certifications', q);
    };
    const sel = (name, label, options, prefix) => h('div', { class: 'field' }, h('label', { for: 'pf-' + name }, label),
      h('select', { class: 'select', id: 'pf-' + name, onchange: e => { q[name] = e.target.value; paint(); } },
        h('option', { value: '' }, t('p7.course.any')), options.map(v => h('option', { value: v, selected: q[name] === v }, t(prefix + v)))));
    const filters = h('form', { class: 'filters', role: 'search', 'aria-label': t('p7.course.filters'), onsubmit: e => e.preventDefault() },
      sel('stage', t('pmi.filterStage'), stages, 'pmi.stage.'), sel('area', t('pmi.filterArea'), areas, 'pmi.area.'));
    const cell = (c, g, fn) => certFactState(c)[g] === 'verified' ? fn() : h('a', { href: c.official_url, target: '_blank', rel: 'noopener', class: 'pending' }, t('pmi.checkPmi'));
    const compare = Table({ caption: t('pmi.compareCaption'), columns: [{ key: 'c', label: t('pmi.col.cert') }, { key: 'q', label: t('pmi.col.questions'), num: true }, { key: 'm', label: t('pmi.col.minutes'), num: true },
      { key: 'r', label: t('pmi.col.renewal') }, { key: 'f', label: t('pmi.col.fee') }],
    rows: all.map(c => ({ c: h('a', { href: certHref(c) }, c.code),
      q: cell(c, 'exam', () => i18n.number(c.exam.questions)), m: cell(c, 'exam', () => i18n.number(c.exam.minutes)),
      r: cell(c, 'renewal', () => t('pmi.pdusShort', { n: i18n.number(c.renewal.pdus), y: i18n.number(c.renewal.years) })),
      f: cell(c, 'fee', () => `${c.fee.currency} ${i18n.number(c.fee.member)} / ${i18n.number(c.fee.non_member)}`) })) });
    paint();
    return h('div', null, previewBanner(ctx, all), h('p', { class: 'banner banner-info', role: 'note' }, icon('info'), ' ', t('pmi.explorerNote', { date: i18n.date(all[0].verified_date) })),
      filters, count, h('h2', { class: 'sr-only' }, t('pmi.certs')), list,
      section('cert-compare', t('pmi.compareTitle'), h('div', { class: 'table-wrap' }, compare), h('p', { class: 'note' }, t('pmi.compareNote'))));
  } });
  return h('div', { class: 'pmi' }, h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('award'), ' ', t('pmi.eyebrow')), h('h1', null, t('pmi.explorerTitle')), h('p', null, t('pmi.explorerLede')),
    h('div', { class: 'btnrow' }, linkBtn('#/academy/pmi', t('nav.items.pmiAcademy')))), region);
}

/* ------------------------------------------------------------------ one certification */

function factBlock(ctx, c, group, title, iconName, body) {
  const { t, i18n } = ctx;
  const ok = certFactState(c)[group] === 'verified';
  return h('section', { class: ['panel', 'fact', ok ? 'fact-ok' : 'fact-pending'], 'aria-labelledby': 'cf-' + group, dataset: { fact: group, state: ok ? 'verified' : 'pending' } },
    h('h2', { id: 'cf-' + group }, icon(iconName), ' ', title, ' ',
      ok ? Badge({ label: t('pmi.verifiedOn', { date: i18n.date(c.verified_date) }), tone: 'ok' }) : Badge({ label: t('pmi.pending'), tone: 'warn' })),
    ok ? body() : h('p', null, t('pmi.pendingBody'), ' ', h('a', { href: c.official_url, target: '_blank', rel: 'noopener' }, t('pmi.openPmi'), ' ', icon('external'))));
}

function domainBars(ctx, c, content) {
  const { i18n, t } = ctx;
  return h('ul', { class: 'bars', 'aria-label': t('pmi.domains') }, c.domains.map(d => h('li', null,
    h('span', { class: 'bar-label' }, L(ctx, d.name)), h('span', { class: 'bar', role: 'img', 'aria-label': `${L(ctx, d.name)} ${i18n.number(d.weight)}%` },
      h('span', { class: 'bar-fill', style: { inlineSize: d.weight + '%' } })), h('strong', { class: 'bar-val' }, i18n.number(d.weight), '%'))));
}

function hoursPlanner(ctx, c) {
  const { t, i18n } = ctx;
  const out = h('div', { class: 'planner-out', 'aria-live': 'polite' });
  const err = h('p', { class: 'field-error', id: 'hp-err', hidden: true });
  const paint = v => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 20 || n > 400) { err.hidden = false; err.textContent = t('pmi.plannerInvalid'); input.setAttribute('aria-invalid', 'true'); return; }
    err.hidden = true; input.removeAttribute('aria-invalid');
    const plan = domainHours(c.domains, Math.round(n));
    out.replaceChildren(Table({ caption: t('pmi.plannerCaption', { n: i18n.number(Math.round(n)) }), columns: [{ key: 'd', label: t('pmi.col.domain') }, { key: 'w', label: t('pmi.col.weight'), num: true }, { key: 'h', label: t('pmi.col.hours'), num: true }],
      rows: [...plan.domains.map(d => ({ d: L(ctx, d.name), w: i18n.number(d.weight) + '%', h: i18n.number(d.hours) })), { d: t('pmi.practiceReserve'), w: '—', h: i18n.number(plan.practice) }] }));
  };
  const input = h('input', { class: 'input', id: 'hp-total', type: 'number', min: '20', max: '400', step: '5', value: '120', inputmode: 'numeric', 'aria-describedby': 'hp-hint hp-err',
    oninput: e => paint(e.target.value) });
  paint(120);
  return h('div', { class: 'planner', dataset: { planner: c.id } },
    h('div', { class: 'field' }, h('label', { for: 'hp-total' }, t('pmi.plannerLabel')), h('p', { class: 'hint', id: 'hp-hint' }, t('pmi.plannerHint')), input, err), out);
}

function studyPlan(ctx, c, content) {
  const { t } = ctx;
  const sp = c.study_plan;
  if (!sp) return null;
  return section('cert-plan', t('pmi.studyPlan'), h('p', { class: 'note' }, t('pmi.studyPlanNote', { weeks: ctx.i18n.number(sp.weeks), hours: ctx.i18n.number(sp.hours_per_week) })),
    h('ol', { class: 'timeline plan' }, sp.phases.map(p => h('li', { dataset: { weeks: p.weeks } },
      h('p', { class: 'eyebrow' }, icon('calendar'), ' ', t('pmi.weeks', { w: p.weeks })),
      h('h3', null, L(ctx, p.title)), h('p', null, L(ctx, p.text)),
      p.courses?.length ? h('ul', { class: 'chips' }, p.courses.map(id => content.byId(content.courses, id)).filter(Boolean).map(cc => h('li', null, h('a', { href: `#/academy/courses/${cc.slug}` }, icon('book'), ' ', L(ctx, cc.title))))) : null))));
}

export function certificationView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const c = content.certifications.find(x => x.slug === match.params.slug);
    if (!c) return notAvailable(ctx, { title: t('pmi.certNotFound'), body: t('p7.pendingBody'), action: linkBtn('#/academy/pmi/certifications', t('pmi.explorerTitle')) });
    return certPage(ctx, c, content, learner);
  } });
  return h('div', { class: 'pmi' }, region);
}

function certPage(ctx, c, content, learner) {
  const { t, i18n } = ctx;
  const courses = (c.cia_courses || []).map(id => content.byId(content.courses, id)).filter(Boolean);
  const routes = (c.cia_routes || []).map(id => content.paths.find(p => p.id === id)).filter(Boolean);
  const tools = (c.toolkits || []).map(id => content.tools.find(m => m.id === id)).filter(Boolean);
  const next = (c.next || []).map(id => content.certifications.find(x => x.id === id)).filter(Boolean);
  const comps = (c.competencies || []).map(id => content.byId(content.competencies, id)).filter(Boolean);
  const hero = h('header', { class: 'iso-hero pmi-hero' },
    h('p', { class: 'eyebrow' }, icon(STAGE_ICON[c.stage] || 'award'), ' ', t('pmi.stage.' + c.stage), ' · ', t('pmi.area.' + c.area), ' · PMI'),
    h('h1', null, h('span', { class: 'code' }, c.code), ' ', L(ctx, c.name)),
    h('p', null, L(ctx, c.summary)),
    h('p', { class: 'note' }, icon('users'), ' ', h('strong', null, t('pmi.whoFor')), ' ', L(ctx, c.who)),
    h('div', { class: 'btnrow' }, h('a', { class: 'btn btn-primary', href: c.official_url, target: '_blank', rel: 'noopener' }, t('pmi.openPmi'), ' ', icon('external')),
      routes[0] ? linkBtn(`#/learning-path?route=${routes[0].id}`, t('pmi.followRoute')) : null, linkBtn('#/academy/pmi/certifications', t('pmi.explorerTitle'))));
  const exam = () => h('div', null, facts([[t('pmi.col.questions'), i18n.number(c.exam.questions) + (c.exam.scored ? ' ' + t('pmi.scored', { n: i18n.number(c.exam.scored) }) : '')],
    [t('pmi.col.minutes'), t('p7.minutes', { n: i18n.number(c.exam.minutes) })]]), c.exam.note ? h('p', { class: 'note' }, L(ctx, c.exam.note)) : null,
  c.languages ? h('p', { class: 'note' }, icon('globe'), ' ', L(ctx, c.languages)) : null);
  return h('article', { class: 'cert', dataset: { cert: c.id } },
    previewBanner(ctx, [c]), hero,
    h('p', { class: 'banner banner-warn', role: 'note', dataset: { claims: 'true' } }, icon('shield'), ' ', L(ctx, c.claims)),
    h('div', { class: 'facts-grid' },
      factBlock(ctx, c, 'eligibility', t('pmi.eligibility'), 'clipboard', () => h('div', { class: 'cards cards-tight' }, c.eligibility.map(o => h('div', { class: 'card' },
        h('h3', null, L(ctx, o.label)), h('ul', { class: 'checks' }, o.items.map(x => h('li', null, icon('check'), ' ', L(ctx, x)))))))),
      factBlock(ctx, c, 'exam', t('pmi.exam'), 'question', exam),
      factBlock(ctx, c, 'fee', t('pmi.fee'), 'briefcase', () => h('div', null, facts([[t('pmi.member'), `${c.fee.currency} ${i18n.number(c.fee.member)}`], [t('pmi.nonMember'), `${c.fee.currency} ${i18n.number(c.fee.non_member)}`]]),
        c.fee.note ? h('p', { class: 'note' }, L(ctx, c.fee.note)) : null)),
      factBlock(ctx, c, 'renewal', t('pmi.renewal'), 'refresh', () => h('p', null, t('pmi.renewalText', { n: i18n.number(c.renewal.pdus), y: i18n.number(c.renewal.years) }), ' ', h('span', { class: 'note' }, t('pmi.noPdus'))))),
    factBlock(ctx, c, 'domains', t('pmi.domains'), 'chart', () => h('div', null, domainBars(ctx, c, content), h('p', { class: 'note' }, t('pmi.domainsNote')))),
    c.extra?.length ? section('cert-extra', t('pmi.alsoKnow'), h('ul', null, c.extra.map(x => h('li', null, L(ctx, x))))) : null,
    section('cert-prep', t('pmi.howToPrepare'), h('ol', { class: 'howto-steps big' }, c.prepare.map(p => h('li', null, h('h3', null, icon('bulb'), ' ', L(ctx, p.title)), h('p', null, L(ctx, p.text)))))),
    studyPlan(ctx, c, content),
    certFactState(c).domains === 'verified' && c.domains.length ? section('cert-hours', t('pmi.plannerTitle'), h('p', { class: 'note' }, t('pmi.plannerNote')), hoursPlanner(ctx, c)) : null,
    routes.length ? section('cert-routes', t('pmi.routes'), h('div', { class: 'cards' }, routes.map(p => routeCard(ctx, p, content, learner)))) : null,
    courses.length ? section('cert-courses', t('pmi.ciaCourses'), h('p', { class: 'note' }, t('pmi.ciaCoursesNote')), h('div', { class: 'cards' }, courses.map(cc => courseCard(ctx, cc, learner)))) : null,
    comps.length ? section('cert-comps', t('p7.course.competencies'), h('ul', { class: 'chips' }, comps.map(x => h('li', null, h('a', { href: '#/competencies' }, x.id, ' ', L(ctx, x.name)))))) : null,
    tools.length ? section('cert-tools', t('gd.useTool'), h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m))))) : null,
    next.length ? section('cert-next', t('pmi.nextCerts'), h('div', { class: 'cards' }, next.map(x => certCard(ctx, x)))) : null,
    section('cert-src', t('p7.sources.title'), sourceList(ctx, c.source_ids, content), h('p', { class: 'note' }, t('pmi.sourcesNote'))),
    isReviewer(ctx) ? h('p', { class: 'note' }, govBadge(ctx, c)) : null);
}
