/**
 * Excellence (EFQM-informed) Academy (Phase 10).
 *
 *  #/academy/excellence                        excellenceAcademyView     — starting point, routes, courses, EFQM Assessment Lab, recognition, KAQA facts, toolkits
 *  #/academy/excellence/recognition            (pmi.js certificationsView with body EFQM)
 *  #/academy/excellence/recognition/:slug      (pmi.js certificationView with body EFQM)
 *  #/academy/excellence/lab                    excellenceLabView         — evidence, strengths / AFIs, RADAR-style self-rating, analysis, prioritised plan, export
 *  #/academy/excellence/lab/summary            excellenceLabSummaryView  — printable summary of the learner's own Lab
 *
 * The Lab is a self-assessment AID: everything it shows is labelled "not an EFQM assessment", it gives no EFQM score, star, diamond
 * or recognition, and it stores only the learner's own cia:v1:* record (collection excellence_lab). Criterion names are EFQM's;
 * every guiding question and rating description is CIA's own wording.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Table, Button, openDialog, toast } from '../ui/components.js';
import { excellenceStartingPoint, EX_ROLE_ROUTE, newLab, addEvidence, addFinding, removeItem, setRating, setPlanField, criterionRating, unsupported,
  labSummary, planRows, exportLab, importLab, elementsFor, LAB_LABEL } from '../domain/excellence.mjs';
import { courseStatus } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, previewBanner, linkBtn, section, isReviewer, govBadge, toolLink } from '../ui/academy.js';
import { courseCard } from './courses.js';
import { certCard, certsOf, routeCard, stat } from './pmi.js';
import { academyBanner } from '../ui/art.js';
import { Figure } from '../ui/figures.js';
import { academyLanding, toolPanel, orderCourses } from '../ui/landing.js';

const isExCourse = c => c.ecosystem === 'efqm' && !c.guide;
const LAB_ID = 'LAB-EFQM';

async function loadLabDef(ctx) {
  const items = await ctx.repos.excellence.listVisible(ctx.session.roles).catch(() => []);
  return { def: items.find(x => x.id === LAB_ID) || null, kaqa: items.find(x => x.id === 'REG-KAQA') || null };
}
async function loadLabState(ctx) {
  const rec = await ctx.repos.excellenceLab.get('current').catch(() => null);
  return rec && rec.schema ? rec : newLab();
}

function hero(cls, iconName, ...kids) {
  return h('header', { class: ['iso-hero', 'ex-hero', cls], dataset: { family: 'excellence' } }, academyBanner('excellence', iconName, cls), ...kids);
}

function factorText(ctx, f, content) {
  const { t, i18n } = ctx;
  if (f.code === 'target_role') return t('ex10.factor.target_role', { value: L(ctx, content.rolesAll.find(r => r.id === f.value)?.name) || f.value });
  if (f.code === 'intent') return t('ex10.factor.intent', { value: t('ex10.intent.' + f.value) });
  return t('ex10.factor.' + f.code, { value: i18n.number(f.value ?? 0) });
}

function startingPoint(ctx, content, learner, labWithEvidence) {
  const { t } = ctx;
  const sp = excellenceStartingPoint({ profile: learner.profile, evidence: learner.evidence, completed: learner.completed, labCriteriaWithEvidence: labWithEvidence });
  const visible = sp.href.startsWith('#/learning-path') ? content.paths.some(p => p.id === sp.route_id)
    : sp.href.startsWith('#/academy/excellence/lab') ? true : content.visibleIds.has(sp.target_id);
  return h('section', { class: 'panel feature start', 'aria-labelledby': 'exsp-h', dataset: { start: sp.key, target: sp.target_id } },
    h('p', { class: 'eyebrow' }, icon('compass'), ' ', t('ex10.startEyebrow')),
    h('h2', { id: 'exsp-h' }, L(ctx, sp.title)),
    h('p', null, L(ctx, sp.reason)),
    sp.factors.length ? h('details', null, h('summary', null, t('p7.iso.whyThis')), h('ul', null, sp.factors.map(f => h('li', null, factorText(ctx, f, content))))) : null,
    visible
      ? h('div', { class: 'btnrow' }, linkBtn(sp.href, t('p7.iso.startCta'), 'primary', { 'data-action': 'ex-start' }), learner.profile ? null : linkBtn('#/welcome', t('phase6.completeProfile')))
      : h('div', null, h('p', { class: 'banner banner-info', role: 'note' }, t('ex10.startPending')),
        h('div', { class: 'btnrow' }, linkBtn('#/knowledge/efqm', t('ex10.readFundamentals'), 'primary'), learner.profile ? null : linkBtn('#/welcome', t('phase6.completeProfile')))),
    h('p', { class: 'note' }, t('p7.iso.yearsNote')));
}

/* ------------------------------------------------------------------ landing */

export function excellenceAcademyView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => ({ ...(await loadAll(ctx)), ...(await loadLabDef(ctx)), lab: await loadLabState(ctx) }), render: ({ content, learner, def, kaqa, lab }) => {
    const routes = content.paths.filter(p => p.kind === 'excellence_route');
    const courses = content.courses.filter(isExCourse);
    const certs = certsOf(content, 'EFQM');
    const tools = content.tools.filter(m => ['exc', 'kaqa', 'str', 'oec'].includes(m.id));
    const ready = content.byId(content.assessments, 'ASM-READY-EX-001');
    const figN = (content.figures || []).filter(f => f.id.startsWith('FIG-EX-')).length;
    const sum = def ? labSummary(lab, def) : null;
    const withEv = sum ? sum.withEvidence : 0;
    const labFig = (content.figures || []).find(f => f.id === 'FIG-EX-LABFLOW');
    const labPanel = def ? h('div', { class: 'panel feature lab-feature tool-panel', dataset: { lab: 'feature' } },
      h('div', null, h('p', { class: 'eyebrow' }, icon('clipboard'), ' ', t('ex10.labLabel')), h('h3', { id: 'exlab-h' }, t('ex10.labTitle')), h('p', null, t('ex10.labBody')),
        withEv ? h('p', { class: 'note' }, icon('check'), ' ', t('ex10.lab.progress', { done: i18n.number(withEv), n: i18n.number(def.criteria.length), s: i18n.number(sum.strengths), a: i18n.number(sum.afis) })) : null,
        h('div', { class: 'btnrow' }, linkBtn('#/academy/excellence/lab', t('ex10.labCta'), 'primary', { 'data-action': 'open-lab' }))),
      labFig ? Figure(ctx, labFig, { compact: true }) : null) : null;
    const kaqaBlock = kaqa ? h('div', { class: 'panel', dataset: { kaqa: 'true' } }, h('h3', { id: 'ex-kaqa' }, t('ex10.kaqaTitle')), h('ul', { class: 'checks' }, kaqa.facts.map(f => {
      const s = content.sources.find(x => x.id === f.source);
      return h('li', null, icon('check'), ' ', L(ctx, f.text), ' ', s?.official_url ? h('a', { href: s.official_url, target: '_blank', rel: 'noopener', class: 'note' }, '(', s.organization, ') ', icon('external')) : null);
    })), h('p', { class: 'note' }, icon('info'), ' ', t('ex10.kaqaChecked', { date: i18n.date(kaqa.checked) }), ' ', L(ctx, kaqa.note))) : null;
    /* Phase 10A: the shared academy template (src/ui/landing.js); the Lab sits under Tools & labs, KAQA under recognition. */
    return academyLanding(ctx, {
      key: 'excellence', prefix: 'ex', heroCls: ['ex-hero', 'ex-landing'], cls: 'ex-landing', family: 'excellence', iconName: 'star',
      eyebrow: t('ex10.eyebrow'), title: t('ex10.title'), lede: t('ex10.lede'), statsLabel: t('ex10.statsLabel'),
      stats: [stat('book', i18n.number(courses.length), t('ex10.statCourses')), stat('image', i18n.number(figN), t('ex10.statFigures')),
        stat('award', i18n.number(certs.length), t('ex10.statCerts')), stat('route', i18n.number(routes.length), t('ex10.statRoutes'))],
      primary: ready ? { href: `#/assessments/${ready.slug}`, label: t('ex10.takeReadiness'), action: 'take-readiness' } : { href: '#/knowledge/efqm', label: t('ex10.readFundamentals') },
      secondary: certs.length ? { href: '#/academy/excellence/recognition', label: t('ex10.exploreCerts') } : (def ? { href: '#/academy/excellence/lab', label: t('ex10.openLab') } : null),
      preview: previewBanner(ctx, [...courses, ...routes, ...certs, def].filter(Boolean)),
      next: startingPoint(ctx, content, learner, withEv),
      routes: { items: routes, title: t('ex10.routes'), mineId: EX_ROLE_ROUTE[learner.profile?.target_role], card: p => routeCard(ctx, p, content, learner, EX_ROLE_ROUTE), pendingTitle: t('ex10.routesPending') },
      courses: { items: orderCourses(courses, learner), title: t('ex10.courses'), seeAll: '#/academy/courses?academy=excellence', card: c => courseCard(ctx, c, learner), pendingTitle: t('ex10.coursesPending') },
      certs: { title: t('ex10.certs'), body: h('div', null,
        certs.length ? h('div', { class: 'cards' }, certs.map(c => certCard(ctx, c))) : EmptyState({ title: t('ex10.certsPending'), body: t('p7.pendingBody'), iconName: 'lock', level: 3 }),
        certs.length ? h('p', null, linkBtn('#/academy/excellence/recognition', t('ex10.compareCerts'))) : null, kaqaBlock) },
      tools: { title: t('x10a.landing.tools'), items: [labPanel,
        toolPanel(t('p7.iso.useTitle'), 'grid', t('ex10.useBody'), tools.length ? h('ul', { class: 'tools-mini' }, tools.map(m => h('li', null, toolLink(ctx, m)))) : h('p', { class: 'note' }, t('p7.none')))] },
      about: [t('ex10.honesty'), t('ex10.certsNote')]
    });
  } });
  return h('div', { class: 'iso excellence' }, region);
}

/* ------------------------------------------------------------------ the EFQM Assessment Lab */

const labelBanner = (ctx, def) => h('p', { class: 'banner banner-warn lab-label', role: 'note', dataset: { labLabel: 'true' } },
  icon('shield'), ' ', h('strong', null, L(ctx, def?.label || LAB_LABEL)), ' — ', L(ctx, def?.disclaimer));

export function excellenceLabView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => ({ ...(await loadLabDef(ctx)), lab: await loadLabState(ctx), content: await loadAll(ctx).then(x => x.content) }), render: ({ def, lab, content }) => {
    const head = hero('ex-lab', 'clipboard', h('p', { class: 'eyebrow' }, icon('clipboard'), ' ', t('ex10.lab.eyebrow')), h('h1', null, t('ex10.lab.title')), h('p', null, t('ex10.lab.lede')),
      h('div', { class: 'btnrow' }, linkBtn('#/academy/excellence', t('nav.items.excellenceAcademy'))));
    if (!def) return h('div', null, head, EmptyState({ title: t('ex10.lab.pending'), body: t('ex10.lab.pendingBody'), iconName: 'lock', action: linkBtn('#/academy/excellence', t('nav.items.excellenceAcademy')) }));
    const status = h('p', { class: 'note lab-status', role: 'status', 'aria-live': 'polite', dataset: { saved: 'idle' } });
    const progress = h('p', { class: 'lab-progress', dataset: { progress: 'true' } });
    const save = async () => {
      try { await ctx.repos.excellenceLab.save(lab); status.dataset.saved = 'ok'; status.textContent = t('ex10.lab.saved'); }
      catch (err) { console.warn('[cia] lab save failed', err); status.dataset.saved = 'error'; status.textContent = t('ex10.lab.saveFailed'); }
    };
    const crName = cr => `${t('ex10.lab.criterionNo', { n: i18n.number(cr.no) })} · ${L(ctx, cr.name)}`;
    const panels = new Map();
    const open = new Set();

    /* --- organisation */
    const orgField = (key, type = 'text') => {
      const id = 'lab-org-' + key;
      return h('div', { class: 'field' }, h('label', { for: id }, t('ex10.lab.org' + key[0].toUpperCase() + key.slice(1))),
        h('input', { class: 'input', id, type, value: lab.org[key] || '', maxlength: key === 'scope' ? 300 : 200,
          onchange: e => { lab.org[key] = String(e.target.value).slice(0, 300); save(); } }));
    };
    const orgSec = section('lab-org', t('ex10.lab.orgTitle'), h('p', { class: 'hint' }, t('ex10.lab.orgHint')),
      h('div', { class: 'grid-3' }, orgField('name'), orgField('scope'), orgField('date', 'date')));

    /* --- one criterion */
    const listOf = (cr, kind, rows, renderRow) => h('ul', { class: 'lab-list', dataset: { list: kind } }, rows.map(x => h('li', { dataset: { item: x.id } }, renderRow(x),
      h('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `${t('ex10.lab.evRemove')}: ${x.title || x.text.slice(0, 40)}`,
        onclick: () => { removeItem(lab, cr.id, kind, x.id); save(); refresh(cr.id); } }, icon('close'), ' ', t('ex10.lab.evRemove')))));

    function evidenceForm(cr) {
      const p = `ev-${cr.id}-`;
      const err = h('p', { class: 'field-error', id: p + 'err', hidden: true, role: 'alert' });
      const inp = (k, type = 'text', req = false) => h('div', { class: 'field' }, h('label', { for: p + k }, t('ex10.lab.ev' + k[0].toUpperCase() + k.slice(1)), req ? ' *' : ''),
        h('input', { class: 'input', id: p + k, name: k, type, maxlength: k === 'link' ? 500 : 200, 'aria-describedby': p + 'err', inputmode: k === 'link' ? 'url' : null }));
      const form = h('form', { class: 'lab-form', dataset: { form: 'evidence' }, novalidate: true, onsubmit: e => {
        e.preventDefault();
        const v = Object.fromEntries(['title', 'source', 'date', 'owner', 'link'].map(k => [k, form.elements[k].value.trim()]));
        const r = addEvidence(lab, cr.id, v);
        if (r.errors.length) {
          err.hidden = false; err.textContent = r.errors.map(x => t({ required: 'ex10.lab.evRequired', link: 'ex10.lab.evLinkInvalid', date: 'ex10.lab.evDateInvalid' }[x])).join(' ');
          const bad = r.errors.includes('required') ? (form.elements.title.value.trim() ? 'source' : 'title') : r.errors[0];
          form.elements[bad].setAttribute('aria-invalid', 'true'); form.elements[bad].focus(); return;
        }
        save(); refresh(cr.id, `#${p}title`);
      } }, h('div', { class: 'grid-3' }, inp('title', 'text', true), inp('source', 'text', true), inp('date', 'date'), inp('owner'), inp('link', 'url')), err,
      h('div', { class: 'btnrow' }, h('button', { type: 'submit', class: 'btn btn-secondary' }, icon('upload'), ' ', t('ex10.lab.evAdd'))));
      return form;
    }

    function findingForm(cr, kind) {
      const id = `fd-${cr.id}-${kind}`;
      const err = h('p', { class: 'field-error', id: id + '-err', hidden: true, role: 'alert' });
      const ta = h('textarea', { class: 'input', id, rows: 2, maxlength: 1000, 'aria-describedby': `${id}-hint ${id}-err` });
      return h('form', { class: 'lab-form', dataset: { form: kind }, novalidate: true, onsubmit: e => {
        e.preventDefault();
        const r = addFinding(lab, cr.id, kind, ta.value);
        if (r.errors.length) { err.hidden = false; err.textContent = t('ex10.lab.findingRequired'); ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
        save(); refresh(cr.id, '#' + id);
      } }, h('label', { for: id }, t(kind === 'afis' ? 'ex10.lab.afis' : 'ex10.lab.strengths')), h('p', { class: 'hint', id: id + '-hint' }, t(kind === 'afis' ? 'ex10.lab.afiHint' : 'ex10.lab.strengthHint')), ta, err,
      h('div', { class: 'btnrow' }, h('button', { type: 'submit', class: 'btn btn-secondary' }, icon('upload'), ' ', t('ex10.lab.findingAdd'))));
    }

    function ratingBlock(cr) {
      const els = (def.elements[cr.kind] || []);
      const r = lab.criteria[cr.id]?.ratings || {};
      const cRating = criterionRating(lab, def, cr);
      return h('div', { class: 'lab-rating', dataset: { rating: cr.id } },
        h('h4', null, icon('gauge'), ' ', t('ex10.lab.rating')), h('p', { class: 'note' }, t('ex10.lab.ratingNote')),
        els.map(el => h('fieldset', { class: 'rate-set', dataset: { element: el.id } },
          h('legend', null, h('strong', null, L(ctx, el.name)), ' — ', L(ctx, el.ask)),
          h('div', { class: 'rate-opts' }, def.scale.map((s, i) => {
            const rid = `rt-${cr.id}-${el.id}-${s.value}`;
            return h('label', { class: 'rate-opt', for: rid },
              h('input', { type: 'radio', id: rid, name: `rt-${cr.id}-${el.id}`, value: String(s.value), checked: r[el.id] === s.value,
                onchange: () => { setRating(lab, cr.id, el.id, s.value); save(); refresh(cr.id, '#' + rid); } }),
              h('span', { class: 'rate-v' }, i18n.number(s.value), '%'), h('span', { class: 'rate-l' }, L(ctx, s.label)), h('span', { class: 'rate-d' }, L(ctx, el.bands[i])));
          })))),
        h('p', { class: 'lab-crating', dataset: { crating: cRating === null ? 'none' : String(cRating) } }, cRating === null ? t('ex10.lab.criterionUnrated') : h('strong', null, t('ex10.lab.criterionRating', { v: i18n.number(cRating) }))),
        unsupported(lab, cr) ? h('p', { class: 'banner banner-warn', role: 'note', dataset: { unsupported: 'true' } }, icon('alert'), ' ', t('ex10.lab.unsupported')) : null);
    }

    function panel(cr) {
      const c = lab.criteria[cr.id] || { evidence: [], strengths: [], afis: [] };
      const cRating = criterionRating(lab, def, cr);
      const d = h('details', { class: 'lab-crit', id: 'lab-' + cr.id, dataset: { criterion: cr.id, group: cr.group }, open: open.has(cr.id) },
        h('summary', null, h('span', { class: 'crit-no' }, i18n.number(cr.no)), h('span', { class: 'crit-name' }, L(ctx, cr.name)),
          h('span', { class: 'crit-meta' }, Badge({ label: `${i18n.number(c.evidence.length)} ${t('ex10.lab.evidence')}`, tone: c.evidence.length ? 'ok' : 'neutral' }), ' ',
            Badge({ label: cRating === null ? t('ex10.lab.ratingUnset') : t('ex10.lab.ratingValue', { v: i18n.number(cRating) }), tone: cRating === null ? 'neutral' : 'info' }))),
        h('div', { class: 'crit-body' },
          h('p', { class: 'crit-prompt' }, icon('question'), ' ', L(ctx, cr.prompt)),
          h('h4', null, icon('doc'), ' ', t('ex10.lab.evidence')),
          c.evidence.length ? listOf(cr, 'evidence', c.evidence, e => h('div', { class: 'ev' }, h('strong', null, e.title), h('span', { class: 'note' }, ' · ', e.source, e.date ? ` · ${i18n.date(e.date)}` : '', e.owner ? ` · ${e.owner}` : ''),
            e.link ? [' ', h('a', { href: e.link, target: '_blank', rel: 'noopener noreferrer' }, icon('external'))] : null))
            : h('p', { class: 'note', dataset: { empty: 'evidence' } }, t('ex10.lab.evidenceEmpty')),
          evidenceForm(cr),
          h('div', { class: 'split' },
            h('div', null, h('h4', null, icon('star'), ' ', t('ex10.lab.strengths')), c.strengths.length ? listOf(cr, 'strengths', c.strengths, f => h('p', null, f.text)) : null, findingForm(cr, 'strengths')),
            h('div', null, h('h4', null, icon('target'), ' ', t('ex10.lab.afis')), c.afis.length ? listOf(cr, 'afis', c.afis, f => h('p', null, f.text)) : null, findingForm(cr, 'afis'))),
          ratingBlock(cr)));
      d.addEventListener('toggle', () => { if (d.open) open.add(cr.id); else open.delete(cr.id); });
      return d;
    }

    /* --- analysis */
    const analysisBox = h('div', { dataset: { analysis: 'true' } });
    function paintAnalysis() {
      const sum = labSummary(lab, def);
      progress.textContent = t('ex10.lab.progress', { done: i18n.number(sum.withEvidence), n: i18n.number(def.criteria.length), s: i18n.number(sum.strengths), a: i18n.number(sum.afis) });
      analysisBox.replaceChildren(
        h('ul', { class: 'dims' }, sum.dims.map(d => h('li', { dataset: { dim: d.id, rating: d.rating === null ? 'none' : String(d.rating) } },
          h('strong', null, L(ctx, d.name)), h('span', { class: 'bar', role: 'img', 'aria-label': `${L(ctx, d.name)} ${d.rating === null ? t('ex10.lab.ratingUnset') : d.rating + '%'}` },
            h('span', { class: 'bar-fill', style: { inlineSize: (d.rating || 0) + '%' } })),
          h('span', { class: 'note' }, d.rating === null ? t('ex10.lab.ratingUnset') : t('ex10.lab.dimensionRating', { v: i18n.number(d.rating) }))))),
        h('div', { class: 'table-wrap' }, Table({ caption: t('ex10.lab.analysisTitle') + ' — ' + L(ctx, def.label), columns: [{ key: 'c', label: t('ex10.lab.colCriterion') }, { key: 'e', label: t('ex10.lab.colEvidence'), num: true },
          { key: 's', label: t('ex10.lab.colStrengths'), num: true }, { key: 'a', label: t('ex10.lab.colAfis'), num: true }, { key: 'r', label: t('ex10.lab.colRating'), num: true }, { key: 'f', label: t('ex10.lab.colFlag') }],
        rows: sum.rows.map(r => ({ c: h('a', { href: '#/academy/excellence/lab', onclick: e => { e.preventDefault(); const p = panels.get(r.id); if (p) { p.open = true; open.add(r.id); p.scrollIntoView({ block: 'start' }); p.querySelector('summary')?.focus(); } } }, `${i18n.number(r.no)} · ${L(ctx, r.name)}`),
          e: i18n.number(r.evidence), s: i18n.number(r.strengths), a: i18n.number(r.afis), r: r.rating === null ? '—' : i18n.number(r.rating) + '%',
          f: r.flag === 'unsupported' ? Badge({ label: t('ex10.lab.flagUnsupported'), tone: 'warn' }) : r.flag === 'no_evidence' ? Badge({ label: t('ex10.lab.flagNoEvidence'), tone: 'neutral' }) : t('ex10.lab.flagOk') })) })));
    }

    /* --- plan */
    const planBox = h('div', { dataset: { plan: 'true' } });
    function paintPlan(focusSel) {
      const rows = planRows(lab, def);
      if (!rows.length) { planBox.replaceChildren(h('p', { class: 'note', dataset: { empty: 'plan' } }, t('ex10.lab.planEmpty'))); return; }
      const crOf = id => def.criteria.find(c => c.id === id);
      planBox.replaceChildren(h('ol', { class: 'plan-list' }, rows.map(r => {
        const p = `pl-${r.id}-`;
        const err = h('p', { class: 'field-error', id: p + 'err', hidden: true, role: 'alert' });
        const upd = (field, el) => {
          const res = setPlanField(lab, r.id, field, el.value);
          if (res.error) { err.hidden = false; err.textContent = t(res.error === 'score' ? 'ex10.lab.scoreInvalid' : 'ex10.lab.evDateInvalid'); el.setAttribute('aria-invalid', 'true'); return; }
          el.removeAttribute('aria-invalid'); save(); if (field === 'impact' || field === 'ease' || field === 'status') paintPlan('#' + el.id);
        };
        const num = field => h('div', { class: 'field field-sm' }, h('label', { for: p + field }, t('ex10.lab.' + field)),
          h('input', { class: 'input', id: p + field, type: 'number', min: '1', max: '5', step: '1', inputmode: 'numeric', value: r[field] ?? '', 'aria-describedby': p + 'err', onchange: e => upd(field, e.target) }));
        const txt = (field, type = 'text') => h('div', { class: 'field' }, h('label', { for: p + field }, t('ex10.lab.' + field)),
          h('input', { class: 'input', id: p + field, type, value: r[field] || '', maxlength: field === 'action' ? 500 : 120, onchange: e => upd(field, e.target) }));
        return h('li', { class: ['plan-item', 'zone-' + r.zone], dataset: { afi: r.id, zone: r.zone, priority: r.priority === null ? 'none' : String(r.priority) } },
          h('div', { class: 'plan-head' }, h('span', { class: 'prio' }, r.priority === null ? '—' : i18n.number(r.priority)),
            Badge({ label: t('ex10.lab.q.' + r.zone), tone: { quick: 'ok', major: 'gold', fill: 'info', reconsider: 'neutral', unscored: 'neutral' }[r.zone] }),
            h('span', { class: 'note' }, crName(crOf(r.criterion)))),
          h('p', { class: 'plan-text' }, r.text),
          h('div', { class: 'plan-fields' }, num('impact'), num('ease'), txt('action'), txt('owner'), txt('due', 'date'),
            h('div', { class: 'field field-sm' }, h('label', { for: p + 'status' }, t('ex10.lab.status')),
              h('select', { class: 'select', id: p + 'status', onchange: e => upd('status', e.target) }, ['open', 'doing', 'done'].map(s => h('option', { value: s, selected: r.status === s }, t('ex10.lab.st.' + s)))))), err);
      })));
      if (focusSel) planBox.querySelector(focusSel)?.focus();
    }

    function refresh(cid, focusSel) {
      const cr = def.criteria.find(c => c.id === cid);
      const old = panels.get(cid);
      open.add(cid);
      const fresh = panel(cr);
      panels.set(cid, fresh);
      old?.replaceWith(fresh);
      paintAnalysis(); paintPlan();
      if (focusSel) fresh.querySelector(focusSel)?.focus();
    }

    const groups = def.groups.map(g => h('div', { class: 'lab-group', dataset: { group: g.id } }, h('h3', null, L(ctx, g.name)),
      def.criteria.filter(c => c.group === g.id).map(cr => { const p = panel(cr); panels.set(cr.id, p); return p; })));
    paintAnalysis(); paintPlan();

    /* --- export / import / clear */
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'lab-import', tabindex: '-1', 'aria-hidden': 'true',
      onchange: async e => {
        const f = e.target.files?.[0]; if (!f) return;
        const res = importLab(await f.text(), def);
        e.target.value = '';
        if (res.error) { toast(t('ex10.lab.importBad')); status.textContent = t('ex10.lab.importBad'); return; }
        await ctx.repos.excellenceLab.save(res.lab); toast(t('ex10.lab.importOk')); render();
      } });
    const doExport = () => {
      const doc = exportLab(lab, def);
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `cia-efqm-lab-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    };
    const doReset = () => openDialog({ title: t('ex10.lab.reset'), body: t('ex10.lab.resetConfirm'), closeLabel: t('ex10.lab.resetNo'), actions: [
      { label: t('ex10.lab.resetNo'), variant: 'secondary', value: 'no' },
      { label: t('ex10.lab.resetYes'), variant: 'danger', value: 'yes', onClick: async () => { await ctx.repos.excellenceLab.remove('current').catch(() => {}); toast(t('ex10.lab.resetDone')); render(); } }] });
    const exportSec = section('lab-export', t('ex10.lab.exportTitle'), h('p', { class: 'note' }, t('ex10.lab.exportNote')),
      h('div', { class: 'btnrow' }, Button({ label: t('ex10.lab.exportJson'), variant: 'primary', iconName: 'download', onClick: doExport, attrs: { 'data-action': 'lab-export' } }),
        linkBtn('#/academy/excellence/lab/summary', t('ex10.lab.print'), 'secondary', { 'data-action': 'lab-summary' }),
        Button({ label: t('ex10.lab.import'), variant: 'secondary', iconName: 'upload', onClick: () => fileInput.click(), attrs: { 'data-action': 'lab-import' } }),
        Button({ label: t('ex10.lab.reset'), variant: 'quiet', iconName: 'close', onClick: doReset, attrs: { 'data-action': 'lab-reset' } })), fileInput);

    const flow = (content.figures || []).find(f => f.id === 'FIG-EX-LABFLOW');
    const courses = (def.courses || []).map(id => content.byId(content.courses, id)).filter(Boolean);
    return h('div', null, head, previewBanner(ctx, [def]), labelBanner(ctx, def),
      flow ? Figure(ctx, flow, { compact: true }) : null,
      orgSec, h('div', { class: 'lab-bar' }, progress, status),
      section('lab-criteria', t('ex10.lab.criteria'), h('p', { class: 'note' }, L(ctx, def.model)), groups),
      section('lab-analysis', t('ex10.lab.analysisTitle'), h('p', { class: 'note' }, t('ex10.lab.analysisNote')), analysisBox),
      section('lab-plan', t('ex10.lab.planTitle'), h('p', { class: 'note' }, t('ex10.lab.planNote')), planBox),
      exportSec,
      courses.length ? section('lab-courses', t('ex10.lab.courses'), h('ul', { class: 'chips' }, courses.map(c => h('li', null, h('a', { href: `#/academy/courses/${c.slug}` }, icon('book'), ' ', L(ctx, c.title)))))) : null,
      isReviewer(ctx) ? h('p', { class: 'note' }, govBadge(ctx, def)) : null);
  } });
  /* Re-render the whole region (after import or clear) by asking the router to render the same route again. */
  function render() { window.dispatchEvent(new HashChangeEvent('hashchange')); }
  return h('div', { class: 'iso excellence ex-lab-page' }, region);
}

/* ------------------------------------------------------------------ printable summary */

export function excellenceLabSummaryView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => ({ ...(await loadLabDef(ctx)), lab: await loadLabState(ctx) }), render: ({ def, lab }) => {
    if (!def) return EmptyState({ title: t('ex10.lab.pending'), body: t('ex10.lab.pendingBody'), iconName: 'lock', action: linkBtn('#/academy/excellence', t('nav.items.excellenceAcademy')) });
    const sum = labSummary(lab, def);
    const plan = planRows(lab, def);
    const top = plan.filter(r => r.priority !== null).slice(0, 10);
    const any = sum.withEvidence || sum.strengths || sum.afis;
    return h('article', { class: 'lab-summary', dataset: { summary: 'true' } },
      h('div', { class: 'btnrow no-print' }, linkBtn('#/academy/excellence/lab', t('ex10.lab.summaryBack')),
        Button({ label: t('ex10.lab.summaryPrintBtn'), variant: 'primary', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print' } })),
      h('h1', null, t('ex10.lab.summaryTitle')),
      labelBanner(ctx, def),
      h('p', null, t('ex10.lab.summaryFor', { org: lab.org.name || '—', scope: lab.org.scope || '—', date: lab.org.date ? i18n.date(lab.org.date) : '—' })),
      !any ? h('p', { class: 'note', dataset: { empty: 'summary' } }, t('ex10.lab.summaryEmpty')) : null,
      h('div', { class: 'table-wrap' }, Table({ caption: t('ex10.lab.analysisTitle'), columns: [{ key: 'd', label: t('ex10.lab.dimension') }, { key: 'r', label: t('ex10.lab.colRating'), num: true }],
        rows: sum.dims.map(d => ({ d: L(ctx, d.name), r: d.rating === null ? '—' : i18n.number(d.rating) + '%' })) })),
      def.criteria.map(cr => {
        const c = lab.criteria[cr.id] || { evidence: [], strengths: [], afis: [] };
        const r = sum.rows.find(x => x.id === cr.id);
        return h('section', { class: 'sum-crit', dataset: { criterion: cr.id } }, h('h2', null, `${i18n.number(cr.no)} · ${L(ctx, cr.name)}`, ' ', h('span', { class: 'note' }, r.rating === null ? t('ex10.lab.ratingUnset') : t('ex10.lab.ratingValue', { v: i18n.number(r.rating) }))),
          c.evidence.length ? h('div', null, h('h3', null, t('ex10.lab.evidence')), h('ul', null, c.evidence.map(e => h('li', null, e.title, ' — ', e.source, e.date ? ` (${i18n.date(e.date)})` : '', e.owner ? ` · ${e.owner}` : '')))) : null,
          c.strengths.length ? h('div', null, h('h3', null, t('ex10.lab.strengths')), h('ul', null, c.strengths.map(f => h('li', null, f.text)))) : null,
          c.afis.length ? h('div', null, h('h3', null, t('ex10.lab.afis')), h('ul', null, c.afis.map(f => h('li', null, f.text)))) : null);
      }),
      top.length ? h('section', null, h('h2', null, t('ex10.lab.summaryTopPlan')), h('div', { class: 'table-wrap' }, Table({ caption: t('ex10.lab.planTitle'),
        columns: [{ key: 'p', label: t('ex10.lab.priority'), num: true }, { key: 'z', label: t('ex10.lab.quadrant') }, { key: 'x', label: t('ex10.lab.afis') }, { key: 'a', label: t('ex10.lab.action') }, { key: 'o', label: t('ex10.lab.owner') }, { key: 'd', label: t('ex10.lab.due') }],
        rows: top.map(r => ({ p: i18n.number(r.priority), z: t('ex10.lab.q.' + r.zone), x: r.text, a: r.action || '—', o: r.owner || '—', d: r.due ? i18n.date(r.due) : '—' })) }))) : null,
      h('p', { class: 'note' }, t('ex10.lab.summaryPrinted', { date: i18n.date(new Date().toISOString().slice(0, 10)) }), ' ', L(ctx, def.label)));
  } });
  return h('div', { class: 'excellence ex-summary-page' }, region);
}
