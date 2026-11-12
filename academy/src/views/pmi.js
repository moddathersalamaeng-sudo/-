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
import { BookmarkButton } from '../ui/bookmark.js';
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Table } from '../ui/components.js';
import { pmiStartingPoint, PM_ROLE_ROUTE, certFactState, domainHours, FACT_GROUPS, showsFacts, renewalUnits } from '../domain/pmi.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, notAvailable, previewBanner, linkBtn, section, facts, hours, isReviewer, govBadge, toolLink, setHashQuery } from '../ui/academy.js';
import { courseCard, sourceList } from './courses.js';
import { effortMinutes } from './iso.js';
import { academyBanner } from '../ui/art.js';
import { labsToolPanel } from './labs.js';
import { academyLanding, toolPanel, orderCourses } from '../ui/landing.js';

const STAGE_ICON = { entry: 'flag', practitioner: 'briefcase', specialist: 'target', senior: 'award', advanced: 'star', top: 'crown', professional: 'users' };
const AREA_ICON = { project: 'briefcase', agile: 'refresh', risk: 'shield', pmo: 'grid', programme: 'layers', portfolio: 'chart', analysis: 'search',
  management: 'crown', auditing: 'magnify', engineering: 'cog', improvement: 'sigma', construction: 'hardhat', foundations: 'book', inspection: 'ruler', recognition: 'star', award: 'medal', assessor: 'magnify' };
/** Professional bodies served by the certification explorer (Phase 9): base route, landing and the i18n namespace of their strings. */
export const BODIES = {
  PMI: { base: '/academy/pmi/certifications', landing: '/academy/pmi', ns: 'pmi', landingKey: 'nav.items.pmiAcademy' },
  ASQ: { base: '/academy/quality/certifications', landing: '/academy/quality', ns: 'q9', landingKey: 'nav.items.qualityAcademy' },
  /* Phase 10: EFQM recognition options. Their "exam" group is a list of label/value rows (how the assessment works) and their
     "domains" are names only (dimensions or criterion names), so cards, the comparison table and the page render those instead. */
  EFQM: { base: '/academy/excellence/recognition', landing: '/academy/excellence', ns: 'ex10', landingKey: 'nav.items.excellenceAcademy', family: 'excellence', rows: true }
};
const bodyOf = c => BODIES[c?.body] || BODIES.PMI;
const tk = (ctx, B, key, vars) => ctx.t(B.ns + '.' + key, vars);
export const certsOf = (content, body) => (content.certifications || []).filter(c => (c.body || 'PMI') === body);
const isPmCourse = c => ['pmi', 'pmo', 'p3o'].includes(c.ecosystem);
export const certHref = c => `#${bodyOf(c).base}/${c.slug}`;
/** The short code before a name (PMP®, CMQ/OE…), left out when the English name already contains it (EFQM options). */
const codeChip = c => (c.code && !String(c.name?.en || '').toLowerCase().includes(String(c.code).toLowerCase()) ? [h('span', { class: 'code' }, c.code), ' '] : null);

export function stat(iconName, value, label) {
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
      ? h('div', { class: 'btnrow' }, linkBtn(sp.href, t('p7.iso.startCta'), 'primary', { 'data-action': 'pm-start' }), learner.profile ? null : linkBtn('#/welcome', t('phase6.completeProfile')))
      : h('div', null, h('p', { class: 'banner banner-info', role: 'note' }, t('pmi.startPending')),
        h('div', { class: 'btnrow' }, linkBtn('#/knowledge/pmi', t('pmi.readFundamentals'), 'primary'), learner.profile ? null : linkBtn('#/welcome', t('phase6.completeProfile')))),
    h('p', { class: 'note' }, t('p7.iso.yearsNote')));
}

export function routeCard(ctx, p, content, learner, roleRoute = PM_ROLE_ROUTE) {
  const { t, i18n } = ctx;
  const mins = (p.steps || []).reduce((a, s) => a + effortMinutes(s.effort), 0);
  const mine = roleRoute[learner.profile?.target_role] === p.id;
  const certs = (p.certification_ids || []).map(id => content.certifications.find(c => c.id === id)).filter(Boolean);
  return h('article', { class: ['card', 'route-card', mine && 'card-current'], dataset: { route: p.id } },
    mine ? Badge({ label: t('p7.iso.yourRoute'), tone: 'gold' }) : null,
    h('h3', null, icon('route'), ' ', h('a', { href: `#/learning-path?route=${p.id}` }, L(ctx, p.title))),
    h('p', null, L(ctx, p.goal)),
    h('p', { class: 'meta' }, icon('steps'), ' ', t('p7.iso.routeMeta', { n: i18n.number((p.steps || []).length) }), mins ? [' · ', icon('clock'), ' ', hours(ctx, Math.round(mins / 6) / 10)] : null),
    certs.length ? h('p', { class: 'note' }, icon('award'), ' ', tk(ctx, bodyOf(certs[0]), 'routeCerts'), ' ', certs.map((c, i) => [i ? ' · ' : '', h('a', { href: certHref(c) }, c.code)])) : null);
}

/** Renewal in words for a card or table cell: units per cycle, or lifetime. */
function renewalShort(ctx, B, c) {
  const { i18n } = ctx;
  return c.renewal?.lifetime ? tk(ctx, B, 'lifetime') : tk(ctx, B, 'pdusShort', { n: i18n.number(renewalUnits(c.renewal)), y: i18n.number(c.renewal.years) });
}

export function certCard(ctx, c) {
  const { t, i18n } = ctx;
  const B = bodyOf(c);
  const st = certFactState(c);
  const rowVal = key => L(ctx, (c.exam?.rows || []).find(r => r.label.en === key)?.value);
  const quick = B.rows ? [st.exam === 'verified' && c.exam ? [icon('clock'), ' ', rowVal('Duration') || rowVal('Applications') || '—', ' · ', icon('star'), ' ', rowVal('Outcome') || rowVal('Ratings') || '—'] : [icon('external'), ' ', tk(ctx, B, 'checkPmi')]] : [
    st.exam === 'verified' && c.exam ? [icon('question'), ' ', tk(ctx, B, 'qShort', { n: i18n.number(c.exam.questions) }), ' · ', icon('clock'), ' ', t('p7.minutes', { n: i18n.number(c.exam.minutes) })] : [icon('external'), ' ', tk(ctx, B, 'checkPmi')],
    st.renewal === 'verified' && c.renewal ? [' · ', icon('refresh'), ' ', renewalShort(ctx, B, c)] : null];
  return h('article', { class: 'card cert-card', dataset: { cert: c.id, stage: c.stage, area: c.area, body: c.body || 'PMI' } },
    h('p', { class: 'eyebrow' }, icon(STAGE_ICON[c.stage] || 'award'), ' ', tk(ctx, B, 'stage.' + c.stage), ' · ', icon(AREA_ICON[c.area] || 'briefcase'), ' ', tk(ctx, B, 'area.' + c.area)),
    h('h3', null, h('a', { href: certHref(c) }, codeChip(c), L(ctx, c.name))),
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
    const guideCourses = courses.filter(c => c.guide);
    const guides = (content.guides || []).filter(g => g.kind === 'practice');
    const tools = content.tools.filter(m => m.system === 'pmo');
    const ready = content.byId(content.assessments, 'ASM-READY-PM-001');
    const practices = guides.reduce((a, g) => a + (g.counts?.items || 0), 0);
    const certs = certsOf(content, 'PMI');
    /* Phase 10A: the shared academy template (src/ui/landing.js). */
    return academyLanding(ctx, {
      key: 'pmi', prefix: 'pm', cls: 'pmi-hero', family: 'pmi', iconName: 'briefcase',
      eyebrow: t('pmi.eyebrow'), title: t('pmi.title'), lede: t('pmi.lede'), statsLabel: t('pmi.statsLabel'),
      stats: [stat('book', i18n.number(courses.length), t('pmi.statCourses')), stat('ladder', i18n.number(practices), t('pmi.statPractices')),
        stat('award', i18n.number(certs.length), t('pmi.statCerts')), stat('route', i18n.number(routes.length), t('pmi.statRoutes'))],
      primary: ready ? { href: `#/assessments/${ready.slug}`, label: t('pmi.takeReadiness'), action: 'take-readiness' } : { href: '#/knowledge/pmi', label: t('pmi.readFundamentals') },
      secondary: { href: '#/academy/pmi/certifications', label: t('pmi.exploreCerts') },
      preview: previewBanner(ctx, [...courses, ...routes, ...certs]),
      next: startingPoint(ctx, content, learner),
      routes: { items: routes, title: t('pmi.routes'), mineId: PM_ROLE_ROUTE[learner.profile?.target_role], card: p => routeCard(ctx, p, content, learner), pendingTitle: t('pmi.routesPending') },
      courses: { items: orderCourses(courses, learner), title: t('pmi.courses'), seeAll: '#/academy/courses?academy=pmi', card: c => courseCard(ctx, c, learner), pendingTitle: t('pmi.coursesPending') },
      certs: { title: t('pmi.certs'), body: certs.length ? h('div', null, h('div', { class: 'cards' }, certs.map(c => certCard(ctx, c))), h('p', null, linkBtn('#/academy/pmi/certifications', t('pmi.compareCerts'))))
        : EmptyState({ title: t('pmi.certsPending'), body: t('p7.pendingBody'), iconName: 'lock', level: 3 }) },
      tools: { title: t('x10a.landing.tools'), items: [
        /* Phase 11: practice labs of this academy (loads itself). */
        labsToolPanel(ctx, 'pmi'),
        toolPanel(t('p7.iso.useTitle'), 'grid', t('pmi.useBody'), tools.length ? h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m)))) : h('p', { class: 'note' }, t('p7.none'))),
        guides.length ? toolPanel(t('gd.practices'), 'ladder', t('pmi.guidesNote'), h('ul', { class: 'plain' }, guides.map(g => {
          const gc = guideCourses.find(c => c.guide === g.slug);
          return h('li', { dataset: { guide: g.slug } }, h('a', { href: `#/guides/${g.slug}` }, L(ctx, g.title)), gc ? [' · ', h('a', { class: 'note', href: `#/academy/courses/${gc.slug}` }, t('gd.course'))] : null);
        }))) : null] },
      about: [t('pmi.honesty'), t('pmi.certsNote')]
    });
  } });
  return h('div', { class: 'iso pmi' }, region);
}

/* ------------------------------------------------------------------ explorer */

export function certificationsView(ctx, match, body = 'PMI') {
  const { t, i18n } = ctx;
  const B = BODIES[body] || BODIES.PMI;
  const q = { stage: '', area: '', ...(match.query || {}) };
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content }) => {
    const all = certsOf(content, body);
    if (!all.length) return EmptyState({ title: tk(ctx, B, 'certsPending'), body: t('p7.pendingBody'), iconName: 'lock', action: linkBtn('#' + B.landing, t(B.landingKey)) });
    const stages = [...new Set(all.map(c => c.stage))], areas = [...new Set(all.map(c => c.area))];
    const list = h('div', { class: 'cards', id: 'cert-list' });
    const count = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const paint = () => {
      const xs = all.filter(c => (!q.stage || c.stage === q.stage) && (!q.area || c.area === q.area));
      count.textContent = tk(ctx, B, 'certCount', { n: i18n.number(xs.length) });
      list.replaceChildren(...(xs.length ? xs.map(c => certCard(ctx, c)) : [EmptyState({ title: t('p7.course.noMatch'), body: t('p7.course.noMatchBody') })]));
      setHashQuery(B.base, q);
    };
    const sel = (name, label, options, prefix) => h('div', { class: 'field' }, h('label', { for: 'pf-' + name }, label),
      h('select', { class: 'select', id: 'pf-' + name, onchange: e => { q[name] = e.target.value; paint(); } },
        h('option', { value: '' }, t('p7.course.any')), options.map(v => h('option', { value: v, selected: q[name] === v }, tk(ctx, B, prefix + v)))));
    const filters = h('form', { class: 'filters', role: 'search', 'aria-label': t('p7.course.filters'), onsubmit: e => e.preventDefault() },
      sel('stage', tk(ctx, B, 'filterStage'), stages, 'stage.'), sel('area', tk(ctx, B, 'filterArea'), areas, 'area.'));
    const cell = (c, g, fn) => certFactState(c)[g] === 'verified' ? fn() : h('a', { href: c.official_url, target: '_blank', rel: 'noopener', class: 'pending' }, tk(ctx, B, 'checkPmi'));
    const rowOf = (c, key) => L(ctx, (c.exam?.rows || []).find(r => r.label.en === key)?.value) || '—';
    const compare = B.rows ? Table({ caption: tk(ctx, B, 'compareCaption'), columns: [{ key: 'c', label: tk(ctx, B, 'col.cert') }, { key: 'd', label: tk(ctx, B, 'col.duration') },
      { key: 'o', label: tk(ctx, B, 'col.outcome') }, { key: 'r', label: tk(ctx, B, 'col.renewal') }, { key: 'f', label: tk(ctx, B, 'col.fee') }],
    rows: all.map(c => ({ c: h('a', { href: certHref(c) }, c.code),
      d: cell(c, 'exam', () => rowOf(c, 'Duration') !== '—' ? rowOf(c, 'Duration') : rowOf(c, 'Applications')),
      o: cell(c, 'exam', () => rowOf(c, 'Outcome') !== '—' ? rowOf(c, 'Outcome') : rowOf(c, 'Ratings')),
      r: cell(c, 'renewal', () => tk(ctx, B, 'renewalText', { n: i18n.number(c.renewal?.validity_years || 0) })),
      f: cell(c, 'fee', () => '—') })) }) : Table({ caption: tk(ctx, B, 'compareCaption'), columns: [{ key: 'c', label: tk(ctx, B, 'col.cert') }, { key: 'q', label: tk(ctx, B, 'col.questions'), num: true }, { key: 'm', label: tk(ctx, B, 'col.minutes'), num: true },
      { key: 'r', label: tk(ctx, B, 'col.renewal') }, { key: 'f', label: tk(ctx, B, 'col.fee') }],
    rows: all.map(c => ({ c: h('a', { href: certHref(c) }, c.code),
      q: cell(c, 'exam', () => i18n.number(c.exam.questions)), m: cell(c, 'exam', () => i18n.number(c.exam.minutes)),
      r: cell(c, 'renewal', () => renewalShort(ctx, B, c)),
      f: cell(c, 'fee', () => `${c.fee.currency} ${i18n.number(c.fee.member)} / ${i18n.number(c.fee.non_member)}`) })) });
    paint();
    return h('div', null, previewBanner(ctx, all), h('p', { class: 'banner banner-info', role: 'note' }, icon('info'), ' ', tk(ctx, B, 'explorerNote', { date: i18n.date(all[0].verified_date) })),
      filters, count, h('h2', { class: 'sr-only' }, tk(ctx, B, 'certs')), list,
      section('cert-compare', tk(ctx, B, 'compareTitle'), h('div', { class: 'table-wrap' }, compare), h('p', { class: 'note' }, tk(ctx, B, 'compareNote'))));
  } });
  return h('div', { class: 'pmi', dataset: { body } }, h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('award'), ' ', tk(ctx, B, 'eyebrow')), h('h1', null, tk(ctx, B, 'explorerTitle')), h('p', null, tk(ctx, B, 'explorerLede')),
    h('div', { class: 'btnrow' }, linkBtn('#' + B.landing, t(B.landingKey)))), region);
}

/* ------------------------------------------------------------------ one certification */

function factBlock(ctx, c, group, title, iconName, body) {
  const { i18n } = ctx;
  const B = bodyOf(c);
  const state = certFactState(c)[group];
  const ok = showsFacts(state);
  return h('section', { class: ['panel', 'fact', ok ? 'fact-ok' : 'fact-pending'], 'aria-labelledby': 'cf-' + group, dataset: { fact: group, state } },
    h('h2', { id: 'cf-' + group }, icon(iconName), ' ', title, ' ',
      state === 'verified' ? Badge({ label: tk(ctx, B, 'verifiedOn', { date: i18n.date(c.verified_date) }), tone: 'ok' })
        : state === 'secondary' ? Badge({ label: tk(ctx, B, 'secondary'), tone: 'info' }) : Badge({ label: tk(ctx, B, 'pending'), tone: 'warn' })),
    state === 'secondary' ? h('p', { class: 'note', dataset: { secondary: 'true' } }, icon('info'), ' ', tk(ctx, B, 'secondaryBody'), ' ', c.bok_version ? `(${c.bok_version})` : null) : null,
    ok ? body() : h('p', null, tk(ctx, B, 'pendingBody'), ' ', h('a', { href: c.official_url, target: '_blank', rel: 'noopener' }, tk(ctx, B, 'openPmi'), ' ', icon('external'))));
}

function domainBars(ctx, c) {
  const { i18n } = ctx;
  const B = bodyOf(c);
  const byQ = c.domain_unit === 'questions';
  const max = byQ ? Math.max(...c.domains.map(d => d.questions || 0), 1) : 100;
  return h('ul', { class: 'bars', 'aria-label': tk(ctx, B, 'domains') }, c.domains.map(d => {
    const val = byQ ? d.questions : d.weight;
    const label = byQ ? `${tk(ctx, B, 'questionsN', { n: i18n.number(d.questions) })} · ${i18n.number(d.weight)}%` : `${i18n.number(d.weight)}%`;
    return h('li', null,
      h('span', { class: 'bar-label' }, L(ctx, d.name)), h('span', { class: 'bar', role: 'img', 'aria-label': `${L(ctx, d.name)} ${label}` },
        h('span', { class: 'bar-fill', style: { inlineSize: Math.round(100 * val / max) + '%' } })), h('strong', { class: 'bar-val' }, byQ ? i18n.number(d.questions) : [i18n.number(d.weight), '%']));
  }));
}

function hoursPlanner(ctx, c) {
  const { i18n } = ctx;
  const B = bodyOf(c);
  const out = h('div', { class: 'planner-out', 'aria-live': 'polite' });
  const err = h('p', { class: 'field-error', id: 'hp-err', hidden: true });
  const paint = v => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 20 || n > 400) { err.hidden = false; err.textContent = tk(ctx, B, 'plannerInvalid'); input.setAttribute('aria-invalid', 'true'); return; }
    err.hidden = true; input.removeAttribute('aria-invalid');
    const plan = domainHours(c.domains, Math.round(n));
    out.replaceChildren(Table({ caption: tk(ctx, B, 'plannerCaption', { n: i18n.number(Math.round(n)) }), columns: [{ key: 'd', label: tk(ctx, B, 'col.domain') }, { key: 'w', label: tk(ctx, B, 'col.weight'), num: true }, { key: 'h', label: tk(ctx, B, 'col.hours'), num: true }],
      rows: [...plan.domains.map(d => ({ d: L(ctx, d.name), w: i18n.number(d.weight) + '%', h: i18n.number(d.hours) })), { d: tk(ctx, B, 'practiceReserve'), w: '—', h: i18n.number(plan.practice) }] }));
  };
  const input = h('input', { class: 'input', id: 'hp-total', type: 'number', min: '20', max: '400', step: '5', value: '120', inputmode: 'numeric', 'aria-describedby': 'hp-hint hp-err',
    oninput: e => paint(e.target.value) });
  paint(120);
  return h('div', { class: 'planner', dataset: { planner: c.id } },
    h('div', { class: 'field' }, h('label', { for: 'hp-total' }, tk(ctx, B, 'plannerLabel')), h('p', { class: 'hint', id: 'hp-hint' }, tk(ctx, B, 'plannerHint')), input, err), out);
}

export function studyPlan(ctx, c, content) {
  const B = bodyOf(c);
  const sp = c.study_plan;
  if (!sp) return null;
  return section('cert-plan', tk(ctx, B, 'studyPlan'), h('p', { class: 'note' }, tk(ctx, B, 'studyPlanNote', { weeks: ctx.i18n.number(sp.weeks), hours: ctx.i18n.number(sp.hours_per_week) })),
    h('ol', { class: 'timeline plan' }, sp.phases.map(p => h('li', { dataset: { weeks: p.weeks } },
      h('p', { class: 'eyebrow' }, icon('calendar'), ' ', tk(ctx, B, 'weeks', { w: p.weeks })),
      h('h3', null, L(ctx, p.title)), h('p', null, L(ctx, p.text)),
      p.courses?.length ? h('ul', { class: 'chips' }, p.courses.map(id => content.byId(content.courses, id)).filter(Boolean).map(cc => h('li', null, h('a', { href: `#/academy/courses/${cc.slug}` }, icon('book'), ' ', L(ctx, cc.title))))) : null))));
}

export function certificationView(ctx, match, body = 'PMI') {
  const { t } = ctx;
  const B = BODIES[body] || BODIES.PMI;
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    const c = certsOf(content, body).find(x => x.slug === match.params.slug);
    if (!c) return notAvailable(ctx, { title: tk(ctx, B, 'certNotFound'), body: t('p7.pendingBody'), action: linkBtn('#' + B.base, tk(ctx, B, 'explorerTitle')) });
    return certPage(ctx, c, content, learner);
  } });
  return h('div', { class: 'pmi', dataset: { body } }, region);
}

function certPage(ctx, c, content, learner) {
  const { t, i18n } = ctx;
  const B = bodyOf(c);
  const courses = (c.cia_courses || []).map(id => content.byId(content.courses, id)).filter(Boolean);
  const routes = (c.cia_routes || []).map(id => content.paths.find(p => p.id === id)).filter(Boolean);
  const tools = (c.toolkits || []).map(id => content.tools.find(m => m.id === id)).filter(Boolean);
  const next = (c.next || []).map(id => content.certifications.find(x => x.id === id)).filter(Boolean);
  const comps = (c.competencies || []).map(id => content.byId(content.competencies, id)).filter(Boolean);
  const center = c.id === 'CERT-CMQOE' ? linkBtn('#/academy/quality/cmqoe', t('q9.openCenter'), 'secondary', { 'data-action': 'open-center' }) : null;
  const hero = h('header', { class: ['iso-hero', 'pmi-hero', c.body === 'ASQ' && 'q-hero', c.body === 'EFQM' && 'ex-hero'] }, academyBanner(B.family || (c.body === 'ASQ' ? 'quality' : 'pmi'), 'award', c.id),
    h('p', { class: 'eyebrow' }, icon(STAGE_ICON[c.stage] || 'award'), ' ', tk(ctx, B, 'stage.' + c.stage), ' · ', tk(ctx, B, 'area.' + c.area), ' · ', c.body || 'PMI'),
    h('h1', null, codeChip(c), L(ctx, c.name)),
    h('p', null, L(ctx, c.summary)),
    h('p', { class: 'note' }, icon('users'), ' ', h('strong', null, tk(ctx, B, 'whoFor')), ' ', L(ctx, c.who)),
    h('div', { class: 'btnrow' }, h('a', { class: 'btn btn-primary', href: c.official_url, target: '_blank', rel: 'noopener' }, tk(ctx, B, 'openPmi'), ' ', icon('external')),
      center, routes[0] ? linkBtn(`#/learning-path?route=${routes[0].id}`, tk(ctx, B, 'followRoute')) : null, linkBtn('#' + B.base, tk(ctx, B, 'explorerTitle')),
      BookmarkButton(ctx, { type: 'certification', id: c.id, href: certHref(c), title: { ar: `${c.code || ''} ${c.name?.ar || ''}`.trim(), en: `${c.code || ''} ${c.name?.en || ''}`.trim() } })));
  const exam = () => B.rows ? h('div', null, facts((c.exam.rows || []).map(r => [L(ctx, r.label), L(ctx, r.value)])), c.exam.note ? h('p', { class: 'note' }, L(ctx, c.exam.note)) : null) : h('div', null, facts([[tk(ctx, B, 'col.questions'), i18n.number(c.exam.questions) + (c.exam.scored ? ' ' + tk(ctx, B, 'scored', { n: i18n.number(c.exam.scored) }) : '')],
    [tk(ctx, B, 'col.minutes'), t('p7.minutes', { n: i18n.number(c.exam.minutes) })]]), c.exam.note ? h('p', { class: 'note' }, L(ctx, c.exam.note)) : null,
  c.languages ? h('p', { class: 'note' }, icon('globe'), ' ', L(ctx, c.languages)) : null);
  const feeRows = () => [[tk(ctx, B, 'member'), `${c.fee.currency} ${i18n.number(c.fee.member)}`], [tk(ctx, B, 'nonMember'), `${c.fee.currency} ${i18n.number(c.fee.non_member)}`],
    c.fee.retake ? [tk(ctx, B, 'retake'), `${c.fee.currency} ${i18n.number(c.fee.retake)}`] : null].filter(Boolean);
  const renewal = () => B.rows ? h('p', null, tk(ctx, B, 'renewalText', { n: i18n.number(c.renewal.validity_years) }), ' ', h('span', { class: 'note' }, tk(ctx, B, 'noPdus'))) : h('p', null, c.renewal.lifetime ? tk(ctx, B, 'lifetimeText') : tk(ctx, B, 'renewalText', { n: i18n.number(renewalUnits(c.renewal)), y: i18n.number(c.renewal.years) }), ' ', h('span', { class: 'note' }, tk(ctx, B, 'noPdus')));
  return h('article', { class: 'cert', dataset: { cert: c.id, body: c.body || 'PMI' } },
    previewBanner(ctx, [c]), hero,
    h('p', { class: 'banner banner-warn', role: 'note', dataset: { claims: 'true' } }, icon('shield'), ' ', L(ctx, c.claims)),
    h('div', { class: 'facts-grid' },
      factBlock(ctx, c, 'eligibility', tk(ctx, B, 'eligibility'), 'clipboard', () => h('div', { class: 'cards cards-tight' }, c.eligibility.map(o => h('div', { class: 'card' },
        h('h3', null, L(ctx, o.label)), h('ul', { class: 'checks' }, o.items.map(x => h('li', null, icon('check'), ' ', L(ctx, x)))))))),
      factBlock(ctx, c, 'exam', tk(ctx, B, 'exam'), 'question', exam),
      factBlock(ctx, c, 'fee', tk(ctx, B, 'fee'), 'coins', () => h('div', null, facts(feeRows()), c.fee.note ? h('p', { class: 'note' }, L(ctx, c.fee.note)) : null)),
      factBlock(ctx, c, 'renewal', tk(ctx, B, 'renewal'), 'refresh', renewal)),
    factBlock(ctx, c, 'domains', tk(ctx, B, 'domains'), 'chart', () => h('div', null, c.domain_unit === 'names'
      ? h('ol', { class: 'name-list' }, c.domains.map(d => h('li', { dataset: d.group ? { group: d.group } : null }, L(ctx, d.name), d.group ? h('span', { class: 'note' }, ' · ', tk(ctx, B, 'group.' + d.group)) : null)))
      : domainBars(ctx, c), h('p', { class: 'note' }, tk(ctx, B, 'domainsNote')))),
    c.extra?.length ? section('cert-extra', tk(ctx, B, 'alsoKnow'), h('ul', null, c.extra.map(x => h('li', null, L(ctx, x))))) : null,
    section('cert-prep', tk(ctx, B, 'howToPrepare'), h('ol', { class: 'howto-steps big' }, c.prepare.map(p => h('li', null, h('h3', null, icon('bulb'), ' ', L(ctx, p.title)), h('p', null, L(ctx, p.text)))))),
    studyPlan(ctx, c, content),
    showsFacts(certFactState(c).domains) && c.domains.length && c.domain_unit !== 'names' ? section('cert-hours', tk(ctx, B, 'plannerTitle'), h('p', { class: 'note' }, tk(ctx, B, 'plannerNote')), hoursPlanner(ctx, c)) : null,
    routes.length ? section('cert-routes', tk(ctx, B, 'routes'), h('div', { class: 'cards' }, routes.map(p => routeCard(ctx, p, content, learner)))) : null,
    courses.length ? section('cert-courses', tk(ctx, B, 'ciaCourses'), h('p', { class: 'note' }, tk(ctx, B, 'ciaCoursesNote')), h('div', { class: 'cards' }, courses.map(cc => courseCard(ctx, cc, learner)))) : null,
    comps.length ? section('cert-comps', t('p7.course.competencies'), h('ul', { class: 'chips' }, comps.map(x => h('li', null, h('a', { href: '#/competencies' }, x.id, ' ', L(ctx, x.name)))))) : null,
    tools.length ? section('cert-tools', t('gd.useTool'), h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m))))) : null,
    next.length ? section('cert-next', tk(ctx, B, 'nextCerts'), h('div', { class: 'cards' }, next.map(x => certCard(ctx, x)))) : null,
    section('cert-src', t('p7.sources.title'), sourceList(ctx, c.source_ids, content), h('p', { class: 'note' }, tk(ctx, B, 'sourcesNote'))),
    isReviewer(ctx) ? h('p', { class: 'note' }, govBadge(ctx, c)) : null);
}
