/**
 * Company workspace (Phase 12A, spec §22A / ADD-13) — #/company?tab=overview|setup|people|matrix|tna|plan|assignments and the
 * printable annual training plan #/company/plan. Opened from the account menu by the company_admin (or admin) role.
 *
 * Honest prototype: there is no server yet. The administrator's workspace is their own record on this device
 * (cia:v1:<user>:company_*); employees appear only when the administrator imports a share file the employee chose to make,
 * and they leave when it is deleted. The matrix and the training-needs analysis are planning aids — never a performance
 * appraisal or a hiring decision. Real accounts, live consent management and live data arrive with Phase 14.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Tabs, dataRegion, Button, Table, toast, openDialog, ProgressRing } from '../ui/components.js';
import { L, linkBtn, pageHead, setHashQuery } from '../ui/academy.js';
import { Figure } from '../ui/figures.js';
import { academyBanner } from '../ui/art.js';
import { isVisible } from '../data/governance.js';
import * as C from '../domain/company.mjs';
import { download, newId, localToday, dueBadge, TYPE_ICON, put } from './company-share.js';

export const COMPANY_TABS = ['overview', 'setup', 'people', 'matrix', 'tna', 'plan', 'assignments'];
const PRIORITY_TONE = { Critical: 'bad', High: 'warn', Medium: 'info', Low: 'neutral', Achieved: 'ok' };
const SRC_GLYPH = { verified: 'V', assessment: 'A', self: 'S', none: '–' };
const SRC_ICON = { verified: 'check', assessment: 'gauge', self: 'user', none: 'question' };
const published = x => x?.governance?.content_status === 'published';
const safe = p => p.catch(() => []);

/* ------------------------------------------------------------------ data */

export async function loadCompany(ctx) {
  const r = ctx.repos; const roles = ctx.session.roles;
  const [profile, departments, customRoles, placements, shares, assignments, planPrefs, competencies, ciaRoles, domains, courses, labs, assessments, paths, figures, lessonFigures] = await Promise.all([
    r.companyProfile.get('me').catch(() => null), safe(r.companyDepartments.list()), safe(r.companyRoles.list()), safe(r.companyPeople.list()), safe(r.companyShares.list()), safe(r.companyAssignments.list()),
    r.companyPlan.get('me').catch(() => null), r.competencies.listVisible(roles), r.targetRoles.listVisible(roles), r.domains.listAll(),
    /* Plans and assignments point only at published content — a draft a reviewer can preview is never suggested to a company. */
    (r.coursesIndex || r.courses).listVisible(roles).then(x => x.filter(published)), safe(r.labsIndex.listVisible(roles)).then(x => x.filter(published)),
    safe(r.assessments.listVisible(roles)).then(x => x.filter(published)), safe(r.learningPaths.list()).then(x => x.filter(p => !p.superseded_by && (!p.governance || (isVisible(p, roles) && published(p))))),
    safe(r.figures.listVisible(roles)), safe(r.lessonFigures.list())]);
  const today = localToday();
  const allRoles = C.allRoles(ciaRoles.filter(published), customRoles);
  const people = C.peopleFrom(shares, placements, today);
  const minHolders = profile?.min_holders || C.DEFAULT_MIN_HOLDERS;
  const tna = C.buildTna({ people, roles: allRoles, departments, competencies, minHolders });
  const year = profile?.plan_year || (Number(today.slice(5, 7)) >= 10 ? Number(today.slice(0, 4)) + 1 : Number(today.slice(0, 4)));
  const plan = C.annualPlan({ tna, competencies, departments, courses, labs, year, overrides: planPrefs?.overrides || {} });
  const asg = assignments.map(a => ({ a, st: C.assignmentStatus(a, people, today) }));
  const figsFor = key => (lessonFigures.find(x => x.id === key)?.figures || []).map(id => figures.find(f => f.id === id)).filter(Boolean);
  return { profile, departments, customRoles, placements, shares, assignments, planPrefs, competencies, domains, ciaRoles: ciaRoles.filter(published), roles: allRoles, courses, labs, assessments, routes: paths,
    people, today, minHolders, tna, plan, year, asg, figsFor, catalog: { course: courses, lab: labs, assessment: assessments, route: paths } };
}

/** Labels for the pure exporters (plan, matrix, tracker) in the current language. */
const labelsOf = ctx => (k, p) => ctx.t('co12a.' + k, p);
const num = (ctx, n) => ctx.i18n.number(n);
const fmtDate = (ctx, s) => (s ? ctx.i18n.date(String(s).slice(0, 10)) : '—');
const prioBadge = (ctx, p) => h('span', { class: `badge badge-${PRIORITY_TONE[p] || 'neutral'}`, dataset: { priority: p } }, ctx.t('co12a.priority.' + p));
const compName = (ctx, d, id) => L(ctx, d.competencies.find(c => c.id === id)?.name) || id;
const kpi = (ctx, { key, value, label, iconName, tone = null, hint = null }) => h('li', { class: ['co-kpi', tone && 'is-' + tone], dataset: { kpi: key, value: String(value ?? '') } },
  icon(iconName), h('strong', null, value == null ? '—' : typeof value === 'number' ? num(ctx, value) : value), h('span', null, label), hint ? h('span', { class: 'note' }, hint) : null);
const fileInput = (id, hintId, multiple = false) => h('input', { type: 'file', id, accept: 'application/json,.json', class: 'input', multiple, 'aria-describedby': hintId });
const field = (id, label, control, { hint = null, err = null, req = false } = {}) => h('div', { class: 'field' }, h('label', { for: id }, label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
  hint ? h('span', { class: 'hint note', id: id + '-hint' }, hint) : null, control, err);
const closeDlg = e => e.currentTarget.closest('dialog')?.close();
const errSpan = id => h('span', { class: 'err', id: id + '-err', 'aria-live': 'polite' });

/* ------------------------------------------------------------------ page */

export function companyView(ctx, match) {
  const { t } = ctx;
  const q = match.query || {};
  const initial = Math.max(0, COMPANY_TABS.indexOf(q.tab));
  const state = { q }; /* the assignment form is pre-filled once from the address (matrix cell / need → Assign) */
  const region = dataRegion({ t, load: () => loadCompany(ctx), render: d => {
    const reload = async (tab, focusSel) => { if (tab) region.tab = tab; await region.refresh(); if (focusSel) setTimeout(() => document.querySelector(focusSel)?.focus(), 0); };
    const env = { region, reload, get q() { return state.q; }, set q(v) { state.q = v; } };
    const tabs = {
      overview: () => overviewTab(ctx, d, env), setup: () => setupTab(ctx, d, env), people: () => peopleTab(ctx, d, env), matrix: () => matrixTab(ctx, d, env),
      tna: () => tnaTab(ctx, d, env), plan: () => planTab(ctx, d, env), assignments: () => assignmentsTab(ctx, d, env)
    };
    return h('div', { class: 'company', dataset: { company: 'root', people: String(d.people.length), setup: String(!!d.profile) } },
      hero(ctx, d),
      Tabs({ label: t('co12a.title'), initial: Math.max(0, COMPANY_TABS.indexOf(region.tab)), lazy: true, tabs: COMPANY_TABS.map(k => ({ key: 'co-' + k, label: t('co12a.tabs.' + k), content: tabs[k] })),
        onSelect: i => { region.tab = COMPANY_TABS[i]; setHashQuery('/company', { tab: COMPANY_TABS[i] }); } }));
  } });
  region.tab = COMPANY_TABS[initial];
  return h('div', { class: 'company-page' }, pageHead(ctx, { eyebrow: t('co12a.eyebrow'), title: t('co12a.title'), lede: t('co12a.lede') }), region);
}

function hero(ctx, d) {
  const { t } = ctx;
  const co = d.tna.company;
  const overdue = d.asg.filter(x => !x.a.cancelled).reduce((a, x) => a + x.st.overdue, 0);
  const openAsg = d.asg.filter(x => !x.a.cancelled && x.st.due_state !== 'completed').length;
  const stale = d.people.filter(p => p.stale).length;
  return h('section', { class: 'co-hero', 'aria-labelledby': 'co-hero-h' },
    h('div', { class: 'co-hero-art' }, academyBanner('guide', 'users', 'company')),
    h('div', { class: 'co-hero-text' },
      h('h2', { id: 'co-hero-h' }, icon('briefcase'), ' ', d.profile?.name || t('co12a.hero.noName'), d.profile?.sample ? [' ', h('span', { class: 'badge badge-warn', dataset: { sample: 'company' } }, t('co12a.sample.badge'))] : null),
      d.profile?.sector ? h('p', { class: 'note' }, d.profile.sector) : null,
      h('p', { class: 'banner banner-info co-label', role: 'note', dataset: { companyLabel: 'true' } }, L(ctx, C.COMPANY_LABEL)),
      h('ul', { class: 'co-kpis', 'aria-label': t('co12a.hero.kpis') },
        kpi(ctx, { key: 'people', value: co.people, label: t('co12a.kpi.people'), iconName: 'users' }),
        kpi(ctx, { key: 'readiness', value: co.readiness == null ? null : num(ctx, co.readiness) + '%', label: t('co12a.kpi.readiness'), iconName: 'gauge', tone: co.readiness == null ? null : co.readiness >= 80 ? 'ok' : co.readiness >= 50 ? 'warn' : 'bad' }),
        kpi(ctx, { key: 'critical', value: co.critical_cells, label: t('co12a.kpi.critical'), iconName: 'alert', tone: co.critical_cells ? 'bad' : 'ok' }),
        kpi(ctx, { key: 'spof', value: co.spof, label: t('co12a.kpi.spof'), iconName: 'shield', tone: co.spof ? 'warn' : 'ok' }),
        kpi(ctx, { key: 'assignments', value: openAsg, label: t('co12a.kpi.assignments'), iconName: 'clipboard', hint: overdue ? t('co12a.kpi.overdue', { n: num(ctx, overdue) }) : null, tone: overdue ? 'bad' : null }),
        kpi(ctx, { key: 'stale', value: stale, label: t('co12a.kpi.stale'), iconName: 'clock', tone: stale ? 'warn' : null }))));
}

/* ------------------------------------------------------------------ overview: guided steps, never a dead end */

function overviewTab(ctx, d, env) {
  const { t } = ctx;
  const placed = d.people.filter(p => p.department_id && p.role_id).length;
  const steps = [
    { key: 'profile', done: !!d.profile, tab: 'setup' },
    { key: 'departments', done: d.departments.length > 0, tab: 'setup' },
    { key: 'shares', done: d.people.length > 0, tab: 'people' },
    { key: 'place', done: d.people.length > 0 && placed === d.people.length, tab: 'people', detail: d.people.length ? t('co12a.steps.placeDetail', { a: num(ctx, placed), n: num(ctx, d.people.length) }) : null },
    { key: 'matrix', done: d.tna.company.with_role > 0, tab: 'matrix' },
    { key: 'plan', done: d.tna.company.with_role > 0 && d.plan.totals.lines > 0, tab: 'plan' },
    { key: 'assign', done: d.assignments.some(a => !a.cancelled), tab: 'assignments' }
  ];
  const next = steps.find(s => !s.done);
  const doneN = steps.filter(s => s.done).length;
  const go = tab => () => env.reload(tab, `[role=tab][data-tab="co-${tab}"]`);
  const figs = d.figsFor('company:main');
  return h('div', { class: 'co-overview' },
    !d.profile && !d.people.length ? h('section', { class: 'panel feature co-start', 'aria-labelledby': 'co-start-h', dataset: { empty: 'company' } },
      h('h2', { id: 'co-start-h' }, icon('compass'), ' ', t('co12a.start.title')), h('p', null, t('co12a.start.body')),
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.start.setup'), variant: 'primary', onClick: go('setup'), attrs: { 'data-action': 'start-setup' } }),
        Button({ label: t('co12a.sample.load'), variant: 'secondary', iconName: 'spark', onClick: () => loadSample(ctx, d, env), attrs: { 'data-action': 'load-sample' } })),
      h('p', { class: 'note' }, t('co12a.sample.note'))) : null,
    h('section', { class: 'section', 'aria-labelledby': 'co-steps-h', dataset: { steps: `${doneN}/${steps.length}` } },
      h('h2', { id: 'co-steps-h' }, icon('steps'), ' ', t('co12a.steps.title', { a: num(ctx, doneN), n: num(ctx, steps.length) })),
      h('ol', { class: 'co-steps' }, steps.map(s => h('li', { class: [s.done && 'is-done', s === next && 'is-next'], dataset: { step: s.key, done: String(s.done) } },
        h('span', { class: 'co-step-mark', 'aria-hidden': 'true' }, s.done ? icon('check') : null),
        h('div', null, h('strong', null, t('co12a.steps.' + s.key)), ' ', h('span', { class: 'badge badge-' + (s.done ? 'ok' : s === next ? 'gold' : 'neutral') }, t(s.done ? 'co12a.steps.done' : s === next ? 'co12a.steps.next' : 'co12a.steps.later')),
          h('p', { class: 'note' }, s.detail || t('co12a.steps.' + s.key + 'D')),
          Button({ label: t('co12a.steps.open', { tab: t('co12a.tabs.' + s.tab) }), variant: s === next ? 'primary' : 'quiet', onClick: go(s.tab), attrs: { 'data-action': 'step-' + s.key } }))))),
      next ? null : h('p', { class: 'oksum', role: 'status' }, t('co12a.steps.allDone'))),
    h('section', { class: 'section', 'aria-labelledby': 'co-how-h' }, h('h2', { id: 'co-how-h' }, icon('info'), ' ', t('co12a.how.title')),
      h('div', { class: 'co-how' }, ['consent', 'files', 'honest', 'aid'].map(k => h('div', { class: 'card' }, h('h3', null, icon({ consent: 'handshake', files: 'doc', honest: 'scale', aid: 'compass' }[k]), ' ', t('co12a.how.' + k)), h('p', null, t('co12a.how.' + k + 'D'))))),
      figs.map(f => Figure(ctx, f)),
      h('p', { class: 'banner banner-warn', role: 'note', dataset: { prototype: 'true' } }, h('strong', null, t('co12a.how.protoTitle')), ' ', t('co12a.how.protoBody'))));
}

async function loadSample(ctx, d, env) {
  const { t } = ctx; const r = ctx.repos;
  const s = C.sampleCompany({ ciaRoles: d.ciaRoles, competencies: d.competencies, today: d.today });
  if (!d.profile) await r.companyProfile.save(s.profile);
  for (const dep of s.departments) if (!d.departments.some(x => x.id === dep.id)) await r.companyDepartments.save(dep);
  const have = d.shares.map(x => x.id); let added = 0;
  for (const f of s.files) {
    const out = C.readShare(JSON.stringify(f), { competencyIds: d.competencies.map(c => c.id), existingIds: have, today: d.today });
    if (out.ok) { await r.companyShares.save({ ...out.share, imported_at: new Date().toISOString() }); have.push(out.share.id); added++; }
  }
  for (const p of s.placements) await r.companyPeople.save(p);
  toast(t('co12a.sample.loaded', { n: num(ctx, added) }));
  env.reload('matrix', '[role=tab][data-tab="co-matrix"]');
}

async function removeSample(ctx, d, env) {
  const r = ctx.repos;
  for (const s of d.shares.filter(x => x.sample)) { await r.companyShares.remove(s.id); await r.companyPeople.remove(s.employee_key); }
  for (const dep of d.departments.filter(x => x.sample)) await r.companyDepartments.remove(dep.id);
  const keys = new Set(d.shares.filter(x => x.sample).map(x => x.employee_key));
  for (const a of d.assignments) if (a.assignees.every(k => keys.has(k))) await r.companyAssignments.remove(a.id);
  if (d.profile?.sample) await r.companyProfile.remove('me');
  toast(ctx.t('co12a.sample.removed'));
  env.reload('overview');
}

/* ------------------------------------------------------------------ set-up: company, departments, roles, backup */

function setupTab(ctx, d, env) {
  const { t } = ctx; const r = ctx.repos;
  const p = d.profile || {};
  /* ---- company profile */
  const nameIn = h('input', { class: 'input', id: 'co-name', type: 'text', maxlength: 120, value: p.name || '', autocomplete: 'organization', required: true, 'aria-describedby': 'co-name-err' });
  const sectorIn = h('input', { class: 'input', id: 'co-sector', type: 'text', maxlength: 80, value: p.sector || '', autocomplete: 'off' });
  const adminIn = h('input', { class: 'input', id: 'co-admin', type: 'text', maxlength: 80, value: p.admin_name || '', autocomplete: 'name', 'aria-describedby': 'co-admin-hint' });
  const holdersIn = h('select', { class: 'select input-short', id: 'co-holders', 'aria-describedby': 'co-holders-hint' }, [1, 2, 3, 4, 5].map(n => h('option', { value: String(n), selected: (p.min_holders || C.DEFAULT_MIN_HOLDERS) === n }, num(ctx, n))));
  const yearIn = h('input', { class: 'input input-short', id: 'co-year', type: 'number', min: '2024', max: '2100', inputmode: 'numeric', value: String(p.plan_year || d.year), 'aria-describedby': 'co-year-err' });
  const nameErr = errSpan('co-name'); const yearErr = errSpan('co-year');
  const saveProfile = async () => {
    const v = C.validateCompany({ name: nameIn.value, sector: sectorIn.value, admin_name: adminIn.value, min_holders: Number(holdersIn.value), plan_year: yearIn.value === '' ? null : Number(yearIn.value) });
    nameErr.textContent = v.errors.name ? t('co12a.err.name_' + v.errors.name) : ''; nameIn.setAttribute('aria-invalid', v.errors.name ? 'true' : 'false');
    yearErr.textContent = v.errors.plan_year ? t('co12a.err.year') : ''; yearIn.setAttribute('aria-invalid', v.errors.plan_year ? 'true' : 'false');
    if (!v.value) { (v.errors.name ? nameIn : yearIn).focus(); return; }
    await r.companyProfile.save({ ...v.value, updated_at: new Date().toISOString() });
    toast(t('co12a.setup.saved')); env.reload('setup', '#co-dep-name');
  };
  const profileSec = h('form', { class: 'panel feature', novalidate: true, 'aria-labelledby': 'co-prof-h', dataset: { form: 'company' }, onsubmit: e => { e.preventDefault(); saveProfile(); } },
    h('h2', { id: 'co-prof-h' }, icon('briefcase'), ' ', t('co12a.setup.profile')),
    h('div', { class: 'formgrid' }, field('co-name', t('co12a.setup.name'), nameIn, { err: nameErr, req: true }), field('co-sector', t('co12a.setup.sector'), sectorIn),
      field('co-admin', t('co12a.setup.admin'), adminIn, { hint: t('co12a.setup.adminHint') }), field('co-holders', t('co12a.setup.holders'), holdersIn, { hint: t('co12a.setup.holdersHint') }),
      field('co-year', t('co12a.setup.year'), yearIn, { err: yearErr })),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'save-company' } }, t('co12a.setup.save'))));

  /* ---- departments */
  const depName = h('input', { class: 'input', id: 'co-dep-name', type: 'text', maxlength: 80, autocomplete: 'off', 'aria-describedby': 'co-dep-name-err' });
  const depErr = errSpan('co-dep-name');
  const roleBoxes = () => h('fieldset', { class: 'fs co-rolepick' }, h('legend', null, t('co12a.setup.depRoles')), h('span', { class: 'hint note' }, t('co12a.setup.depRolesHint')),
    h('div', { class: 'co-checks' }, d.roles.map(ro => h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'dep-role', value: ro.id }), L(ctx, ro.name), ro.custom ? [' ', h('span', { class: 'badge badge-gold' }, t('co12a.setup.customBadge'))] : null))));
  const depRoles = roleBoxes();
  let editing = null;
  const depSubmit = h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'save-department' } }, t('co12a.setup.depAdd'));
  const saveDep = async () => {
    const v = C.validateDepartment({ id: editing, name: depName.value, roles: [...depRoles.querySelectorAll('input:checked')].map(i => i.value) }, { roleIds: d.roles.map(x => x.id), existing: d.departments });
    depErr.textContent = v.errors.name ? t('co12a.err.name_' + v.errors.name) : ''; depName.setAttribute('aria-invalid', v.errors.name ? 'true' : 'false');
    if (!v.value) { depName.focus(); return; }
    await r.companyDepartments.save({ ...v.value, id: editing || newId('DEP') });
    toast(t('co12a.setup.depSaved')); env.reload('setup', '#co-dep-name');
  };
  const editDep = dep => { editing = dep.id; depName.value = dep.name; depRoles.querySelectorAll('input').forEach(i => { i.checked = dep.roles.includes(i.value); }); depSubmit.textContent = t('co12a.setup.depUpdate'); depName.focus(); };
  const delDep = dep => openDialog({ title: t('co12a.setup.depDelTitle'), body: t('co12a.setup.depDelBody', { name: dep.name }), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('co12a.delete'), variant: 'danger', onClick: async () => { await r.companyDepartments.remove(dep.id); for (const pl of d.placements.filter(x => x.department_id === dep.id)) await r.companyPeople.save({ ...pl, department_id: null }); toast(t('co12a.setup.depDeleted')); env.reload('setup'); } }] });
  const depSec = h('section', { class: 'section', 'aria-labelledby': 'co-dep-h', dataset: { departments: String(d.departments.length) } }, h('h2', { id: 'co-dep-h' }, icon('layers'), ' ', t('co12a.setup.departments', { n: num(ctx, d.departments.length) })),
    h('p', null, t('co12a.setup.depIntro')),
    d.departments.length ? h('ul', { class: 'co-deps plain' }, d.departments.map(dep => h('li', { class: 'card', dataset: { department: dep.id } },
      h('h3', null, dep.name, dep.sample ? [' ', h('span', { class: 'badge badge-warn' }, t('co12a.sample.badge'))] : null),
      h('p', { class: 'note' }, t('co12a.setup.depPeople', { n: num(ctx, d.people.filter(x => x.department_id === dep.id).length) })),
      dep.roles.length ? h('ul', { class: 'chips' }, dep.roles.map(id => h('li', null, L(ctx, d.roles.find(x => x.id === id)?.name) || id))) : h('p', { class: 'note' }, t('co12a.setup.depNoRoles')),
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.edit'), variant: 'quiet', onClick: () => editDep(dep), attrs: { 'data-action': 'edit-department', 'aria-label': t('co12a.editNamed', { name: dep.name }) } }),
        Button({ label: t('co12a.delete'), variant: 'quiet', onClick: () => delDep(dep), attrs: { 'data-action': 'delete-department', 'aria-label': t('co12a.deleteNamed', { name: dep.name }) } }))))) : h('p', { class: 'note', dataset: { empty: 'departments' } }, t('co12a.setup.depEmpty')),
    h('form', { class: 'panel', novalidate: true, dataset: { form: 'department' }, onsubmit: e => { e.preventDefault(); saveDep(); } }, h('h3', null, t('co12a.setup.depForm')),
      field('co-dep-name', t('co12a.setup.depName'), depName, { err: depErr, req: true }), depRoles, h('div', { class: 'btnrow' }, depSubmit)));

  /* ---- company-defined roles (built from the framework) */
  const roleName = h('input', { class: 'input', id: 'co-role-name', type: 'text', maxlength: 80, autocomplete: 'off', 'aria-describedby': 'co-role-name-err' });
  const roleErr = errSpan('co-role-name'); const targetsErr = h('span', { class: 'err', id: 'co-role-t-err', 'aria-live': 'polite' });
  const baseSel = h('select', { class: 'select', id: 'co-role-base', 'aria-describedby': 'co-role-base-hint' }, h('option', { value: '' }, t('co12a.setup.roleBlank')), d.ciaRoles.map(ro => h('option', { value: ro.id }, L(ctx, ro.name))));
  const levelSel = {};
  const grid = h('div', { class: 'co-rolegrid' }, d.domains.map(dom => {
    const cs = d.competencies.filter(c => c.domain === dom.id); if (!cs.length) return null;
    return h('fieldset', { class: 'fs' }, h('legend', null, L(ctx, dom.name)), cs.map(c => {
      const sel = h('select', { class: 'select input-short', id: 'co-rl-' + c.id, 'aria-label': t('co12a.setup.roleLevelFor', { name: L(ctx, c.name) }) }, [0, 1, 2, 3, 4, 5].map(n => h('option', { value: String(n) }, n ? t('p7.level', { n: ctx.i18n.digitize(n) }) : t('co12a.setup.roleNotNeeded'))));
      levelSel[c.id] = sel;
      return h('div', { class: 'co-rl' }, h('label', { for: 'co-rl-' + c.id }, h('span', { class: 'cid' }, c.id), ' ', L(ctx, c.name)), sel);
    }));
  }));
  let editRole = null;
  baseSel.addEventListener('change', () => { const b = d.ciaRoles.find(x => x.id === baseSel.value); for (const [cid, sel] of Object.entries(levelSel)) sel.value = String(b?.targets?.[cid] || 0); });
  const roleSubmit = h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'save-role' } }, t('co12a.setup.roleAdd'));
  const roleDetails = h('details', { class: 'co-roleform panel', dataset: { form: 'role' } }, h('summary', null, icon('puzzle'), ' ', t('co12a.setup.roleForm')));
  const saveRole = async () => {
    const v = C.validateCustomRole({ id: editRole, name: roleName.value, based_on: baseSel.value, targets: Object.fromEntries(Object.entries(levelSel).map(([k, s]) => [k, Number(s.value)])) }, { competencyIds: d.competencies.map(c => c.id), existing: d.roles });
    roleErr.textContent = v.errors.name ? t('co12a.err.name_' + v.errors.name) : ''; roleName.setAttribute('aria-invalid', v.errors.name ? 'true' : 'false');
    targetsErr.textContent = v.errors.targets ? t('co12a.err.targets') : '';
    if (!v.value) { roleName.focus(); return; }
    await r.companyRoles.save({ ...v.value, id: editRole || newId('CROLE'), updated_at: new Date().toISOString() });
    toast(t('co12a.setup.roleSaved')); env.reload('setup', '#co-dep-name');
  };
  roleDetails.append(h('form', { novalidate: true, onsubmit: e => { e.preventDefault(); saveRole(); } }, h('p', { class: 'note' }, t('co12a.setup.roleIntro')),
    h('div', { class: 'formgrid' }, field('co-role-name', t('co12a.setup.roleName'), roleName, { err: roleErr, req: true }), field('co-role-base', t('co12a.setup.roleBase'), baseSel, { hint: t('co12a.setup.roleBaseHint') })),
    grid, targetsErr, h('div', { class: 'btnrow' }, roleSubmit)));
  const editCustom = ro => { editRole = ro.id; roleDetails.open = true; roleName.value = L(ctx, ro.name); baseSel.value = ro.based_on || ''; for (const [cid, sel] of Object.entries(levelSel)) sel.value = String(ro.targets?.[cid] || 0); roleSubmit.textContent = t('co12a.setup.roleUpdate'); roleName.focus(); };
  const delRole = ro => openDialog({ title: t('co12a.setup.roleDelTitle'), body: t('co12a.setup.roleDelBody', { name: L(ctx, ro.name) }), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('co12a.delete'), variant: 'danger', onClick: async () => { await r.companyRoles.remove(ro.id);
      for (const dep of d.departments.filter(x => x.roles.includes(ro.id))) await r.companyDepartments.save({ ...dep, roles: dep.roles.filter(x => x !== ro.id) });
      for (const pl of d.placements.filter(x => x.role_id === ro.id)) await r.companyPeople.save({ ...pl, role_id: null });
      toast(t('co12a.setup.roleDeleted')); env.reload('setup'); } }] });
  const roleSec = h('section', { class: 'section', 'aria-labelledby': 'co-role-h', dataset: { customRoles: String(d.customRoles.length) } }, h('h2', { id: 'co-role-h' }, icon('target'), ' ', t('co12a.setup.roles')),
    h('p', null, t('co12a.setup.rolesIntro', { n: num(ctx, d.ciaRoles.length) })),
    h('ul', { class: 'chips' }, d.ciaRoles.map(ro => h('li', null, L(ctx, ro.name)))),
    d.customRoles.length ? h('ul', { class: 'co-deps plain' }, d.customRoles.map(ro => h('li', { class: 'card', dataset: { role: ro.id } }, h('h3', null, L(ctx, ro.name), ' ', h('span', { class: 'badge badge-gold' }, t('co12a.setup.customBadge'))),
      h('p', { class: 'note' }, t('co12a.setup.roleLine', { n: num(ctx, Object.values(ro.targets).filter(v => v > 0).length), base: ro.based_on ? L(ctx, d.ciaRoles.find(x => x.id === ro.based_on)?.name) || '—' : '—' })),
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.edit'), variant: 'quiet', onClick: () => editCustom(ro), attrs: { 'data-action': 'edit-role', 'aria-label': t('co12a.editNamed', { name: L(ctx, ro.name) }) } }),
        Button({ label: t('co12a.delete'), variant: 'quiet', onClick: () => delRole(ro), attrs: { 'data-action': 'delete-role', 'aria-label': t('co12a.deleteNamed', { name: L(ctx, ro.name) }) } }))))) : null,
    roleDetails);

  /* ---- backup, sample, clear */
  const result = h('div', { 'aria-live': 'polite', dataset: { companyImport: '' } });
  const file = fileInput('co-backup-file', 'co-backup-file-hint');
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    const out = C.importCompany(await f.text(), { profile: d.profile, departments: d.departments, roles: d.customRoles, placements: d.placements, shares: d.shares, assignments: d.assignments, plan: d.planPrefs });
    if (!out.ok) { result.dataset.companyImport = 'error'; put(result, h('p', { class: 'errsum', role: 'alert' }, t('co12a.setup.bad.' + out.err))); file.value = ''; return; }
    if (out.profile) await r.companyProfile.save(out.profile);
    for (const x of out.add.departments) await r.companyDepartments.save(x);
    for (const x of out.add.roles) await r.companyRoles.save(x);
    for (const x of out.add.placements) await r.companyPeople.save(x);
    for (const x of out.add.shares) await r.companyShares.save(x);
    for (const x of out.add.assignments) await r.companyAssignments.save(x);
    if (out.plan) await r.companyPlan.save(out.plan);
    const n = Object.values(out.add).reduce((a, x) => a + x.length, 0);
    toast(t('co12a.setup.restored', { n: num(ctx, n) }));
    await env.reload('setup');
    const box = document.querySelector('[data-company-import]');
    if (box) { box.dataset.companyImport = 'ok'; box.dataset.added = String(n); put(box, h('p', { class: 'oksum', role: 'status' }, t('co12a.setup.restoreResult', { n: num(ctx, n), dup: num(ctx, out.skipped.duplicate) }))); }
  });
  const backup = () => { download(`cia-company-${localToday()}.json`, JSON.stringify(C.exportCompany({ profile: d.profile, departments: d.departments, roles: d.customRoles, placements: d.placements, shares: d.shares, assignments: d.assignments, plan: d.planPrefs }), null, 2), 'application/json'); toast(t('co12a.setup.backupDone')); };
  const clearAll = () => openDialog({ title: t('co12a.setup.clearTitle'), body: t('co12a.setup.clearBody'), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('co12a.setup.clearConfirm'), variant: 'danger', onClick: async () => { for (const k of ['companyProfile', 'companyDepartments', 'companyRoles', 'companyPeople', 'companyShares', 'companyAssignments', 'companyPlan']) for (const x of await r[k].list()) await r[k].remove(x.id); toast(t('co12a.setup.cleared')); env.reload('overview'); } }] });
  const hasSample = d.shares.some(x => x.sample) || d.departments.some(x => x.sample) || d.profile?.sample;
  const dataSec = h('section', { class: 'section', 'aria-labelledby': 'co-data-h' }, h('h2', { id: 'co-data-h' }, icon('shield'), ' ', t('co12a.setup.data')), h('p', null, t('co12a.setup.dataBody')),
    h('div', { class: 'btnrow' }, Button({ label: t('co12a.setup.backup'), variant: 'secondary', iconName: 'download', onClick: backup, attrs: { 'data-action': 'company-backup' } }),
      hasSample ? Button({ label: t('co12a.sample.remove'), variant: 'secondary', onClick: () => removeSample(ctx, d, env), attrs: { 'data-action': 'remove-sample' } }) : Button({ label: t('co12a.sample.load'), variant: 'secondary', iconName: 'spark', onClick: () => loadSample(ctx, d, env), attrs: { 'data-action': 'load-sample' } }),
      Button({ label: t('co12a.setup.clear'), variant: 'quiet', onClick: clearAll, attrs: { 'data-action': 'clear-company' } })),
    h('div', { class: 'panel' }, field('co-backup-file', t('co12a.setup.restore'), file, { hint: t('co12a.setup.restoreHint') }), result));
  return h('div', { class: 'co-setup' }, profileSec, depSec, roleSec, dataSec);
}

/* ------------------------------------------------------------------ people: consented shares only */

function peopleTab(ctx, d, env) {
  const { t, i18n } = ctx; const r = ctx.repos;
  const result = h('div', { 'aria-live': 'polite', dataset: { shareImport: '' } });
  const file = fileInput('co-share-file', 'co-share-file-hint', true);
  file.addEventListener('change', async () => {
    const files = [...(file.files || [])]; if (!files.length) return;
    const have = d.shares.map(x => x.id); const ok = []; const bad = []; const notes = { stripped: 0, downgraded: 0, unknown: 0 };
    for (const f of files.slice(0, 50)) {
      const out = f.size > C.MAX_FILE_BYTES ? { ok: false, err: 'size' } : C.readShare(await f.text(), { competencyIds: d.competencies.map(c => c.id), existingIds: have, today: localToday() });
      if (!out.ok) { bad.push({ name: f.name, err: out.err }); continue; }
      await r.companyShares.save({ ...out.share, imported_at: new Date().toISOString() }); have.push(out.share.id); ok.push(out.share);
      notes.stripped += out.notes.stripped.length; notes.downgraded += out.notes.downgraded; notes.unknown += out.notes.unknown + out.notes.dropped;
    }
    if (ok.length) toast(t('co12a.people.imported', { n: num(ctx, ok.length) }));
    await env.reload('people');
    const box = document.querySelector('[data-share-import]');
    if (box) { box.dataset.shareImport = bad.length && !ok.length ? 'error' : 'ok'; box.dataset.added = String(ok.length); box.dataset.rejected = String(bad.length); box.dataset.downgraded = String(notes.downgraded); box.dataset.stripped = String(notes.stripped);
      put(box, ok.length ? h('p', { class: 'oksum', role: 'status' }, t('co12a.people.importResult', { n: num(ctx, ok.length), names: i18n.list(ok.map(s => s.name)) })) : null,
        notes.downgraded || notes.stripped || notes.unknown ? h('p', { class: 'note' }, t('co12a.people.importNotes', { d: num(ctx, notes.downgraded), s: num(ctx, notes.stripped), u: num(ctx, notes.unknown) })) : null,
        bad.length ? h('div', { class: 'errsum', role: 'alert' }, h('p', null, t('co12a.people.rejected', { n: num(ctx, bad.length) })), h('ul', null, bad.map(b => h('li', { dataset: { rejected: b.err } }, h('bdi', null, b.name), ' — ', t('co12a.people.bad.' + b.err))))) : null); }
  });
  const place = async (p, patch, focusSel) => { await r.companyPeople.save({ id: p.key, department_id: p.department_id, role_id: p.role_id, ...patch }); toast(t('co12a.people.placed')); env.reload('people', focusSel); };
  const viewShare = p => {
    const s = p.share;
    openDialog({ title: t('co12a.people.shareOf', { name: p.name }), body: h('div', { class: 'co-sharedlg', dataset: { shareDialog: s.id } },
      h('p', null, t('co12a.people.sharedOn', { d: fmtDate(ctx, s.shared_at) }), ' · ', t('co12a.people.consentBy', { name: s.consent.name })),
      h('p', { class: 'note' }, L(ctx, C.CONSENT_TEXT)),
      h('h3', null, t('co12a.people.partsShared')), h('ul', { class: 'chips' }, s.includes.map(x => h('li', null, t('co12a.share.part.' + x)))),
      h('p', { class: 'note' }, t('co12a.people.partsNot'), ' ', i18n.list(C.SHARE_PARTS.filter(x => !s.includes.includes(x)).map(x => t('co12a.share.part.' + x))) || '—'),
      s.data.competencies ? h('p', null, t('co12a.people.levelsLine', { n: num(ctx, s.data.competencies.length), v: num(ctx, s.data.competencies.filter(x => x.source === 'verified').length), a: num(ctx, s.data.competencies.filter(x => x.source === 'assessment').length), s: num(ctx, s.data.competencies.filter(x => x.source === 'self').length) })) : null,
      s.data.cpd ? h('p', null, t('co12a.people.cpdLine', { h: num(ctx, s.data.cpd.total), n: num(ctx, s.data.cpd.count) }), ' ', h('span', { class: 'note' }, t('co12a.people.cpdHonest'))) : null,
      s.data.credentials?.length ? [h('h3', null, t('co12a.people.credentials', { n: num(ctx, s.data.credentials.length) })), h('ul', null, s.data.credentials.map(c => h('li', null, c.name, c.issuer ? ' — ' + c.issuer : '', ' · ', t(c.kind === 'cia_completion' ? 'co12a.share.pv.ciaCompletion' : 'pp12.cred.state.' + c.state)))), h('p', { class: 'note' }, t('co12a.people.credHonest'))] : null,
      s.data.roadmap ? h('p', null, t('co12a.people.roadmapLine', { role: L(ctx, s.data.roadmap.target_role_name), g: num(ctx, s.data.roadmap.gaps), h: num(ctx, s.data.roadmap.total_hours) })) : null,
      h('p', { class: 'note' }, t('co12a.share.logRef'), ' ', h('bdi', { dir: 'ltr' }, s.id))), actions: [{ label: t('co12a.close'), variant: 'primary' }] });
  };
  const delPerson = p => openDialog({ title: t('co12a.people.delTitle', { name: p.name }), body: t('co12a.people.delBody', { n: num(ctx, p.history) }), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('co12a.people.delConfirm'), variant: 'danger', onClick: async () => { for (const s of d.shares.filter(x => x.employee_key === p.key)) await r.companyShares.remove(s.id); await r.companyPeople.remove(p.key); toast(t('co12a.people.deleted')); env.reload('people'); } }] });
  const sel = (id, value, options, label, onChange) => { const s = h('select', { class: 'select', id, 'aria-label': label }, h('option', { value: '' }, t('co12a.people.choose')), options.map(([v, lab]) => h('option', { value: v, selected: v === value }, lab))); s.addEventListener('change', () => onChange(s.value || null)); return s; };
  const cards = d.people.map(p => {
    const dep = d.departments.find(x => x.id === p.department_id);
    const first = dep?.roles?.length ? d.roles.filter(x => dep.roles.includes(x.id)) : [];
    const roleOpts = [...first, ...d.roles.filter(x => !first.includes(x))].map(x => [x.id, L(ctx, x.name) + (first.includes(x) ? ' ★' : '')]);
    return h('li', { class: ['card', 'co-person', p.stale && 'is-stale'], dataset: { person: p.key, placed: String(!!(p.department_id && p.role_id)), stale: String(p.stale) } },
      h('div', { class: 'co-person-head' }, h('h3', null, p.name), p.sample ? h('span', { class: 'badge badge-warn' }, t('co12a.sample.badge')) : null,
        h('span', { class: `badge badge-${p.stale ? 'warn' : 'ok'}` }, icon('clock'), ' ', t(p.stale ? 'co12a.people.stale' : 'co12a.people.fresh', { n: num(ctx, p.age_days) }))),
      h('p', { class: 'note' }, [p.job_title, p.employee_no].filter(Boolean).join(' · ') || '—', ' · ', t('co12a.people.sharedOn', { d: fmtDate(ctx, p.share.shared_at) }), p.history > 1 ? ' · ' + t('co12a.people.history', { n: num(ctx, p.history) }) : ''),
      h('ul', { class: 'chips' }, p.share.includes.map(x => h('li', null, t('co12a.share.part.' + x)))),
      p.has_levels ? null : h('p', { class: 'banner banner-warn', role: 'note' }, t('co12a.people.noLevels')),
      h('div', { class: 'formgrid co-place' },
        h('div', { class: 'field' }, h('label', { for: 'pd-' + p.key }, t('co12a.people.department')), sel('pd-' + p.key, p.department_id, d.departments.map(x => [x.id, x.name]), t('co12a.people.departmentOf', { name: p.name }), v => place(p, { department_id: v }, `#pr-${CSS.escape(p.key)}`))),
        h('div', { class: 'field' }, h('label', { for: 'pr-' + p.key }, t('co12a.people.role')), sel('pr-' + p.key, p.role_id, roleOpts, t('co12a.people.roleOf', { name: p.name }), v => place(p, { role_id: v }, `#pr-${CSS.escape(p.key)}`)))),
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.people.view'), variant: 'quiet', onClick: () => viewShare(p), attrs: { 'data-action': 'view-share', 'aria-label': t('co12a.people.viewNamed', { name: p.name }) } }),
        Button({ label: t('co12a.people.del'), variant: 'quiet', onClick: () => delPerson(p), attrs: { 'data-action': 'delete-share', 'aria-label': t('co12a.people.delNamed', { name: p.name }) } })));
  });
  const figs = d.figsFor('company:share');
  return h('div', { class: 'co-people' },
    h('section', { class: 'section', 'aria-labelledby': 'co-imp-h' }, h('h2', { id: 'co-imp-h' }, icon('upload'), ' ', t('co12a.people.importTitle')), h('p', null, t('co12a.people.importBody')),
      h('div', { class: 'panel feature' }, field('co-share-file', t('co12a.people.importLabel'), file, { hint: t('co12a.people.importHint') }), result),
      h('details', { class: 'co-ask' }, h('summary', null, icon('question'), ' ', t('co12a.people.askTitle')), h('ol', null, ['1', '2', '3', '4'].map(k => h('li', null, t('co12a.people.ask' + k)))), h('p', { class: 'note' }, t('co12a.people.askNote')), figs.map(f => Figure(ctx, f, { compact: true })))),
    h('section', { class: 'section', 'aria-labelledby': 'co-ppl-h', dataset: { peopleCount: String(d.people.length) } }, h('h2', { id: 'co-ppl-h' }, icon('users'), ' ', t('co12a.people.title', { n: num(ctx, d.people.length) })),
      d.people.length ? [d.departments.length ? null : h('p', { class: 'banner banner-info', role: 'note' }, t('co12a.people.needDepartments'), ' ', h('a', { href: '#/company?tab=setup' }, t('co12a.tabs.setup'))),
        h('ul', { class: 'co-people-list plain' }, cards)]
        : h('div', { class: 'panel', dataset: { empty: 'people' } }, h('p', null, t('co12a.people.empty')), h('div', { class: 'btnrow' }, Button({ label: t('co12a.sample.load'), variant: 'secondary', iconName: 'spark', onClick: () => loadSample(ctx, d, env), attrs: { 'data-action': 'load-sample' } }))),
      h('p', { class: 'note' }, t('co12a.people.withdrawNote'))));
}

/* ------------------------------------------------------------------ competency matrix (table first, colour second) */

function matrixTab(ctx, d, env) {
  const { t } = ctx;
  if (!d.people.length) return emptyNeed(ctx, env, 'people', 'co12a.mx.empty');
  const st = { department_id: '', role_id: '', domain: '', view: 'level' };
  const out = h('div', { class: 'co-mx-out' });
  const pick = (id, label, options, key) => { const s = h('select', { class: 'select', id }, h('option', { value: '' }, t('co12a.mx.all')), options.map(([v, lab]) => h('option', { value: v }, lab))); s.addEventListener('change', () => { st[key] = s.value; paint(); }); return field(id, label, s); };
  const viewSel = h('select', { class: 'select', id: 'mx-view' }, ['level', 'gap'].map(v => h('option', { value: v }, t('co12a.mx.view.' + v)))); viewSel.addEventListener('change', () => { st.view = viewSel.value; paint(); });
  const cellDialog = (row, c, cell) => {
    const s = C.suggestFor(c.id, { courses: d.courses, labs: d.labs });
    openDialog({ title: `${row.person.name} — ${c.id} ${L(ctx, c.name)}`, body: h('div', { class: 'co-celldlg', dataset: { cellDialog: `${row.person.key}:${c.id}` } },
      h('dl', { class: 'facts' }, [[t('co12a.mx.required'), t('p7.level', { n: ctx.i18n.digitize(cell.required) })], [t('co12a.mx.shared'), cell.source === 'none' ? t('co12a.mx.nothingShared') : t('p7.level', { n: ctx.i18n.digitize(cell.level) })],
        [t('co12a.mx.source'), t('co12a.srcLong.' + cell.source)], cell.percent != null ? [t('co12a.mx.score'), num(ctx, cell.percent) + '%'] : null,
        cell.verification ? [t('co12a.mx.reviewer'), `${cell.verification.reviewer} · ${fmtDate(ctx, cell.verification.date)} · ${t('pp12.method.' + cell.verification.method)}`] : null,
        [t('co12a.mx.gap'), cell.gap ? t('co12a.mx.gapN', { n: num(ctx, cell.gap) }) : t('co12a.mx.met')], cell.gap ? [t('co12a.mx.priority'), prioBadge(ctx, cell.priority)] : null].filter(Boolean).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
      cell.gap ? h('div', null, h('h3', null, t('co12a.mx.suggest')), s.course || s.lab ? h('ul', null, s.course ? h('li', null, icon('book'), ' ', h('a', { href: s.course.href, onclick: closeDlg }, L(ctx, s.course.title)), ' · ', t('p7.hours', { n: num(ctx, s.course.hours) })) : null,
        s.lab ? h('li', null, icon('flask'), ' ', h('a', { href: s.lab.href, onclick: closeDlg }, L(ctx, s.lab.title)), ' · ', t('p7.hours', { n: num(ctx, s.lab.hours) })) : null) : h('p', { class: 'note' }, t('co12a.plan.noCourse')),
      s.course ? h('p', null, h('a', { class: 'btn btn-secondary', href: `#/company?tab=assignments&type=course&target=${encodeURIComponent(s.course.id)}&person=${encodeURIComponent(row.person.key)}`, dataset: { action: 'assign-from-cell' }, onclick: closeDlg }, t('co12a.mx.assign'))) : null) : null,
      h('p', { class: 'note' }, t('co12a.mx.cellHonest'))), actions: [{ label: t('co12a.close'), variant: 'primary' }] });
  };
  function paint() {
    const m = C.buildMatrix({ people: d.people, roles: d.roles, departments: d.departments, competencies: d.competencies, filter: st });
    const spof = d.tna.spof.filter(s => (!st.department_id || s.department_id === st.department_id) && (!st.domain || d.competencies.find(c => c.id === s.competency_id)?.domain === st.domain));
    const spofCols = new Set(spof.map(s => s.competency_id));
    const withRole = m.rows.filter(r => r.role);
    const table = m.columns.length ? h('div', { class: 'tbl-wrap co-mx-wrap', tabindex: '0', role: 'group', 'aria-label': t('co12a.mx.caption') },
      h('table', { class: 'tbl co-mx', dataset: { matrix: 'true', rows: String(withRole.length), cols: String(m.columns.length), view: st.view } },
        h('caption', { class: 'sr-only' }, t('co12a.mx.caption')),
        h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'co-mx-name' }, t('co12a.mx.col.person')), h('th', { scope: 'col' }, t('co12a.mx.col.readiness')),
          m.columns.map(c => h('th', { scope: 'col', class: ['co-mx-ch', spofCols.has(c.id) && 'is-spof'], title: L(ctx, c.name), dataset: { col: c.id } }, h('abbr', { title: L(ctx, c.name) }, c.id), spofCols.has(c.id) ? h('span', { class: 'co-spof-mark', title: t('co12a.mx.spofCol') }, icon('shield', t('co12a.mx.spofCol'))) : null)))),
        h('tbody', null, withRole.map(r => h('tr', { dataset: { row: r.person.key } },
          h('th', { scope: 'row', class: 'co-mx-name' }, h('span', { class: 'co-mx-person' }, r.person.name), h('span', { class: 'note' }, L(ctx, r.role.name), r.department ? ' · ' + r.department.name : ''), r.person.stale ? h('span', { class: 'badge badge-warn' }, t('co12a.people.staleShort')) : null),
          h('td', { class: 'num', dataset: { readiness: String(r.summary.readiness ?? '') } }, r.summary.readiness == null ? '—' : num(ctx, r.summary.readiness) + '%', h('br'), h('span', { class: 'note' }, t('co12a.mx.rowLine', { g: num(ctx, r.summary.gaps), c: num(ctx, r.summary.critical) }))),
          m.columns.map(c => {
            const x = r.cells[c.id];
            if (!x) return h('td', { class: 'co-cell is-na', dataset: { cell: `${r.person.key}:${c.id}`, state: 'na' } }, h('span', { 'aria-hidden': 'true' }, '·'), h('span', { class: 'sr-only' }, t('co12a.mx.notRequired')));
            const state = x.source === 'none' ? 'none' : x.gap === 0 ? 'met' : x.critical ? 'critical' : 'gap';
            const label = t('co12a.mx.cellLabel', { person: r.person.name, comp: `${c.id} ${L(ctx, c.name)}`, level: x.level, req: x.required, src: t('co12a.src.' + x.source), gap: x.gap });
            return h('td', { class: `co-cell is-${state}`, dataset: { cell: `${r.person.key}:${c.id}`, state, level: String(x.level), required: String(x.required), gap: String(x.gap), source: x.source } },
              h('button', { type: 'button', class: 'co-cellbtn', 'aria-label': label, title: label, onclick: () => cellDialog(r, c, x) },
                h('span', { class: 'co-cell-main' }, st.view === 'gap' ? (x.gap ? '−' + ctx.i18n.digitize(x.gap) : '✓') : `${ctx.i18n.digitize(x.level)}/${ctx.i18n.digitize(x.required)}`),
                h('span', { class: 'co-cell-src', 'aria-hidden': 'true' }, SRC_GLYPH[x.source], x.critical ? ' !' : '')));
          })))),
        h('tfoot', null, h('tr', { dataset: { coverage: 'true' } }, h('th', { scope: 'row', class: 'co-mx-name' }, t('co12a.mx.coverage')), h('td', null, ''),
          m.columns.map(c => h('td', { class: 'num', dataset: { cover: c.id, met: String(m.coverage[c.id].met), required: String(m.coverage[c.id].required) } }, `${ctx.i18n.digitize(m.coverage[c.id].met)}/${ctx.i18n.digitize(m.coverage[c.id].required)}`))))))
      : h('p', { class: 'note', dataset: { empty: 'matrix' } }, t(withRole.length ? 'co12a.mx.noColumns' : 'co12a.mx.noRoles'));
    const noRole = m.rows.filter(r => !r.role);
    put(out, 
      noRole.length ? h('p', { class: 'banner banner-warn', role: 'note', dataset: { withoutRole: String(noRole.length) } }, t('co12a.mx.withoutRole', { n: num(ctx, noRole.length), names: ctx.i18n.list(noRole.map(r => r.person.name)) }), ' ', h('a', { href: '#/company?tab=people' }, t('co12a.tabs.people'))) : null,
      table,
      h('section', { class: 'section co-spof', 'aria-labelledby': 'mx-spof-h', dataset: { spof: String(spof.length) } }, h('h3', { id: 'mx-spof-h' }, icon('shield'), ' ', t('co12a.mx.spofTitle', { n: num(ctx, spof.length) })),
        h('p', { class: 'note' }, t('co12a.mx.spofRule', { n: num(ctx, d.minHolders) })),
        spof.length ? h('ul', { class: 'chips' }, d.departments.filter(dep => spof.some(x => x.department_id === dep.id)).map(dep => h('li', { dataset: { spofDepartment: dep.id } }, dep.name, ': ', h('strong', null, num(ctx, spof.filter(x => x.department_id === dep.id).length))))) : null,
        spof.length ? spofTable(spof.slice(0, 10)) : h('p', { class: 'oksum', role: 'status' }, t('co12a.mx.spofNone')),
        spof.length > 10 ? h('details', { class: 'co-more' }, h('summary', null, t('co12a.mx.spofMore', { n: num(ctx, spof.length - 10) })), spofTable(spof.slice(10, 120))) : null));
  }
  function spofTable(list) {
    return h('div', { class: 'tablewrap' }, Table({ caption: t('co12a.mx.spofTitle', { n: num(ctx, list.length) }), columns: [{ key: 'd', label: t('co12a.mx.col.department') }, { key: 'c', label: t('pf.thCompetency') }, { key: 'l', label: t('co12a.mx.required'), num: true }, { key: 'n', label: t('co12a.mx.holders'), num: true }, { key: 'w', label: t('co12a.mx.who') }, { key: 'k', label: t('co12a.mx.risk') }],
          rows: list.map(s => ({ d: h('span', { dataset: { spofRow: `${s.department_id}:${s.competency_id}`, count: String(s.count), level: String(s.required_level) } }, s.department), c: `${s.competency_id} ${compName(ctx, d, s.competency_id)}`, l: ctx.i18n.digitize(s.required_level), n: num(ctx, s.count), w: s.holder_names.join(' · ') || '—',
            k: h('span', { class: `badge badge-${s.kind === 'none' ? 'bad' : 'warn'}` }, icon(s.kind === 'none' ? 'alert' : 'shield'), ' ', t('co12a.mx.kind.' + s.kind)) })) }));
  }
  paint();
  const exportCsv = () => { const m = C.buildMatrix({ people: d.people, roles: d.roles, departments: d.departments, competencies: d.competencies, filter: st }); download(`cia-competency-matrix-${localToday()}.csv`, C.matrixCsv({ ...m, rows: m.rows.filter(r => r.role) }, { labels: labelsOf(ctx), lang: ctx.i18n.locale }), 'text/csv;charset=utf-8'); toast(t('co12a.exported')); };
  const figs = d.figsFor('company:matrix');
  return h('div', { class: 'co-matrix' },
    h('section', { class: 'section', 'aria-labelledby': 'mx-h' }, h('h2', { id: 'mx-h' }, icon('grid'), ' ', t('co12a.mx.title')), h('p', null, t('co12a.mx.lede')),
      h('div', { class: 'formgrid co-filters' }, pick('mx-dep', t('co12a.mx.col.department'), d.departments.map(x => [x.id, x.name]), 'department_id'), pick('mx-role', t('co12a.mx.col.role'), d.roles.map(x => [x.id, L(ctx, x.name)]), 'role_id'),
        pick('mx-dom', t('pf.thDomain'), d.domains.filter(dm => d.competencies.some(c => c.domain === dm.id)).map(x => [x.id, L(ctx, x.name)]), 'domain'), field('mx-view', t('co12a.mx.viewLabel'), viewSel)),
      h('ul', { class: 'co-legend', 'aria-label': t('co12a.mx.legend') },
        ['met', 'gap', 'critical', 'none', 'na'].map(k => h('li', null, h('span', { class: `co-swatch is-${k}`, 'aria-hidden': 'true' }, { met: '3/3', gap: '2/3', critical: '1/3 !', none: '0/3', na: '·' }[k]), ' ', t('co12a.mx.legendItem.' + k))),
        C.LEVEL_SOURCES.map(s => h('li', null, h('span', { class: 'co-glyph', 'aria-hidden': 'true' }, SRC_GLYPH[s]), ' ', icon(SRC_ICON[s]), ' ', t('co12a.src.' + s)))),
      out,
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.mx.csv'), variant: 'secondary', iconName: 'download', onClick: exportCsv, attrs: { 'data-action': 'matrix-csv' } })),
      h('p', { class: 'note' }, t('co12a.mx.honest')), figs.map(f => Figure(ctx, f))));
}

function emptyNeed(ctx, env, tab, key) {
  const { t } = ctx;
  return h('div', { class: 'panel', dataset: { empty: 'needs-' + tab } }, h('p', null, t(key)), h('div', { class: 'btnrow' },
    Button({ label: t('co12a.steps.open', { tab: t('co12a.tabs.' + tab) }), variant: 'primary', onClick: () => env.reload(tab, `[role=tab][data-tab="co-${tab}"]`), attrs: { 'data-action': 'go-' + tab } })));
}

/* ------------------------------------------------------------------ training needs analysis */

function needsTable(ctx, d, needs, { caption, limit = 12 } = {}) {
  const { t } = ctx;
  const max = Math.max(1, ...needs.map(n => n.total_gap));
  return h('div', { class: 'tablewrap' }, Table({ caption, columns: [{ key: 'c', label: t('pf.thCompetency') }, { key: 'p', label: t('co12a.tna.col.people'), num: true }, { key: 'm', label: t('co12a.tna.col.meanGap'), num: true }, { key: 'g', label: t('co12a.tna.col.totalGap') }, { key: 'pr', label: t('co12a.tna.col.priority') }, { key: 's', label: t('co12a.tna.col.suggest') }],
    rows: needs.slice(0, limit).map(n => { const s = C.suggestFor(n.competency_id, { courses: d.courses, labs: d.labs });
      return { c: h('span', { dataset: { need: n.competency_id, people: String(n.people_affected), total: String(n.total_gap), mean: String(n.mean_gap) } }, h('span', { class: 'cid' }, n.competency_id), ' ', compName(ctx, d, n.competency_id)),
        p: h('span', { title: n.people.map(x => x.name).join(' · ') }, num(ctx, n.people_affected)), m: num(ctx, n.mean_gap),
        g: h('span', { class: 'co-bar', role: 'img', 'aria-label': t('co12a.tna.barLabel', { n: num(ctx, n.total_gap) }) }, h('i', { style: { inlineSize: Math.max(6, Math.round(n.total_gap / max * 100)) + '%' } }), h('b', null, num(ctx, n.total_gap))),
        pr: prioBadge(ctx, n.priority),
        s: s.course || s.lab ? h('span', null, s.course ? h('a', { href: s.course.href }, L(ctx, s.course.title)) : null, s.course && s.lab ? h('br') : null, s.lab ? h('a', { class: 'note', href: s.lab.href }, icon('flask'), ' ', L(ctx, s.lab.title)) : null) : h('span', { class: 'note' }, t('co12a.plan.noCourse')) }; }) }));
}

function tnaTab(ctx, d, env) {
  const { t } = ctx;
  if (!d.people.length) return emptyNeed(ctx, env, 'people', 'co12a.tna.empty');
  const co = d.tna.company;
  if (!co.with_role) return emptyNeed(ctx, env, 'people', 'co12a.tna.noRoles');
  const ring = (v, label) => (v == null ? h('p', { class: 'note' }, '—') : ProgressRing({ ratio: v / 100, label, valueText: num(ctx, v) + '%', size: 84 }));
  const company = h('section', { class: 'section', 'aria-labelledby': 'tna-co-h', dataset: { tna: 'company', people: String(co.people), required: String(co.required_cells), met: String(co.met_cells), totalGap: String(co.total_gap), meanGap: String(co.mean_gap), readiness: String(co.readiness) } },
    h('h2', { id: 'tna-co-h' }, icon('chart'), ' ', t('co12a.tna.company')),
    h('p', { class: 'co-formula' }, h('strong', null, t('co12a.tna.formula'))), h('p', { class: 'note' }, t('co12a.tna.formulaNote')),
    h('div', { class: 'co-tna-top' }, ring(co.readiness, t('co12a.kpi.readiness')),
      h('ul', { class: 'co-kpis' }, kpi(ctx, { key: 'withRole', value: co.with_role, label: t('co12a.tna.withRole'), iconName: 'users', hint: co.without_role ? t('co12a.tna.withoutRole', { n: num(ctx, co.without_role) }) : null }),
        kpi(ctx, { key: 'needs', value: co.needs.length, label: t('co12a.tna.needs'), iconName: 'target' }), kpi(ctx, { key: 'totalGap', value: co.total_gap, label: t('co12a.tna.totalGap'), iconName: 'ladder' }),
        kpi(ctx, { key: 'meanGap', value: co.mean_gap, label: t('co12a.tna.meanGap'), iconName: 'scale' }), kpi(ctx, { key: 'affected', value: co.people_with_needs, label: t('co12a.tna.affected'), iconName: 'user' }))),
    co.needs.length ? [needsTable(ctx, d, co.needs, { caption: t('co12a.tna.company'), limit: 31 }), h('div', { class: 'btnrow' }, Button({ label: t('co12a.tna.toPlan'), variant: 'primary', onClick: () => env.reload('plan', '[role=tab][data-tab="co-plan"]'), attrs: { 'data-action': 'tna-to-plan' } }))]
      : h('p', { class: 'oksum', role: 'status' }, t('co12a.tna.noNeeds')));
  const depts = h('section', { class: 'section', 'aria-labelledby': 'tna-dep-h' }, h('h2', { id: 'tna-dep-h' }, icon('layers'), ' ', t('co12a.tna.departments')),
    d.tna.departments.length ? h('ul', { class: 'co-tna-deps plain' }, d.tna.departments.map(dep => h('li', { class: 'card', dataset: { tnaDepartment: dep.id, people: String(dep.people), totalGap: String(dep.total_gap), meanGap: String(dep.mean_gap ?? ''), readiness: String(dep.readiness ?? ''), needs: String(dep.needs.length) } },
      h('div', { class: 'co-person-head' }, h('h3', null, dep.name), dep.spof ? h('span', { class: 'badge badge-warn' }, icon('shield'), ' ', t('co12a.tna.depSpof', { n: num(ctx, dep.spof) })) : null),
      dep.people ? [h('p', null, t('co12a.tna.depLine', { p: num(ctx, dep.people), r: dep.readiness == null ? '—' : num(ctx, dep.readiness) + '%', g: num(ctx, dep.total_gap), m: dep.mean_gap == null ? '—' : num(ctx, dep.mean_gap), a: num(ctx, dep.people_with_needs) })),
        dep.without_role ? h('p', { class: 'note' }, t('co12a.tna.withoutRole', { n: num(ctx, dep.without_role) })) : null,
        dep.needs.length ? h('details', null, h('summary', null, t('co12a.tna.depNeeds', { n: num(ctx, dep.needs.length) })), needsTable(ctx, d, dep.needs, { caption: dep.name, limit: 8 })) : h('p', { class: 'note' }, t('co12a.tna.noNeeds'))]
        : h('p', { class: 'note', dataset: { empty: 'department' } }, t('co12a.tna.depEmpty'))))) : h('p', { class: 'note' }, t('co12a.setup.depEmpty')),
    d.tna.unplaced.people ? h('p', { class: 'banner banner-info', role: 'note', dataset: { unplaced: String(d.tna.unplaced.people) } }, t('co12a.tna.unplaced', { n: num(ctx, d.tna.unplaced.people) })) : null);
  const people = h('section', { class: 'section', 'aria-labelledby': 'tna-ind-h' }, h('h2', { id: 'tna-ind-h' }, icon('user'), ' ', t('co12a.tna.individuals')),
    h('ul', { class: 'co-tna-inds plain' }, d.tna.individuals.map(ind => h('li', { class: 'card', dataset: { tnaPerson: ind.key, totalGap: String(ind.total_gap), needs: String(ind.needs.length), readiness: String(ind.readiness ?? '') } },
      h('div', { class: 'co-person-head' }, h('h3', null, ind.name), ind.role ? h('span', { class: 'badge badge-neutral' }, L(ctx, ind.role)) : h('span', { class: 'badge badge-warn' }, t('co12a.tna.noRoleBadge')), ind.stale ? h('span', { class: 'badge badge-warn' }, t('co12a.people.staleShort')) : null),
      ind.role ? h('p', null, t('co12a.tna.indLine', { r: ind.readiness == null ? '—' : num(ctx, ind.readiness) + '%', n: num(ctx, ind.needs.length), g: num(ctx, ind.total_gap), c: num(ctx, ind.critical) })) : h('p', { class: 'note' }, t('co12a.tna.noRoleNote')),
      ind.needs.length ? h('details', null, h('summary', null, t('co12a.tna.indNeeds', { n: num(ctx, ind.needs.length) })),
        h('div', { class: 'tablewrap' }, Table({ caption: ind.name, columns: [{ key: 'c', label: t('pf.thCompetency') }, { key: 'r', label: t('co12a.mx.required'), num: true }, { key: 'l', label: t('co12a.mx.shared'), num: true }, { key: 'g', label: t('co12a.mx.gap'), num: true }, { key: 's', label: t('co12a.mx.source') }, { key: 'p', label: t('co12a.tna.col.priority') }, { key: 'a', label: t('co12a.tna.col.suggest') }],
          rows: ind.needs.map(n => { const s = C.suggestFor(n.competency_id, { courses: d.courses, labs: d.labs }); return { c: `${n.competency_id} ${compName(ctx, d, n.competency_id)}`, r: ctx.i18n.digitize(n.required), l: ctx.i18n.digitize(n.current), g: num(ctx, n.gap), s: t('co12a.src.' + n.source), p: prioBadge(ctx, n.priority),
            a: s.course ? h('a', { href: `#/company?tab=assignments&type=course&target=${encodeURIComponent(s.course.id)}&person=${encodeURIComponent(ind.key)}`, dataset: { action: 'assign-need' } }, t('co12a.tna.assign', { name: L(ctx, s.course.title) })) : h('span', { class: 'note' }, t('co12a.plan.noCourse')) }; }) }))) : null))));
  return h('div', { class: 'co-tna' }, company, depts, people, h('p', { class: 'note' }, t('co12a.mx.honest')), d.figsFor('company:tna').map(f => Figure(ctx, f)));
}

/* ------------------------------------------------------------------ annual training plan */

function planTab(ctx, d, env) {
  const { t } = ctx; const r = ctx.repos;
  if (!d.tna.company.with_role) return emptyNeed(ctx, env, 'people', d.people.length ? 'co12a.tna.noRoles' : 'co12a.plan.empty');
  const plan = d.plan; const tt = plan.totals;
  if (!plan.rows.length) return h('div', { class: 'panel', dataset: { empty: 'plan' } }, h('p', { class: 'oksum', role: 'status' }, t('co12a.tna.noNeeds')));
  const saveOverride = async (cid, patch, focusSel) => { const o = { ...(d.planPrefs?.overrides || {}) }; o[cid] = { ...(o[cid] || {}), ...patch }; await r.companyPlan.save({ id: 'me', overrides: o, updated_at: new Date().toISOString() }); env.reload('plan', focusSel); };
  const reset = async () => { await r.companyPlan.save({ id: 'me', overrides: {}, updated_at: new Date().toISOString() }); toast(t('co12a.plan.resetDone')); env.reload('plan'); };
  const doc = () => C.planDocument(plan, { company: d.profile || {}, tna: d.tna, lang: ctx.i18n.locale, labels: labelsOf(ctx), today: d.today });
  const name = ext => `cia-training-plan-${plan.year}.${ext}`;
  const exp = { csv: () => download(name('csv'), C.planCsv(doc()), 'text/csv;charset=utf-8'), xls: () => download(name('xls'), C.planSpreadsheet(doc()), 'application/vnd.ms-excel'), doc: () => download(name('doc'), C.planWord(doc()), 'application/msword') };
  const rows = plan.rows.map(row => {
    const q = h('select', { class: 'select input-short', id: 'pq-' + row.competency_id, 'aria-label': t('co12a.plan.quarterFor', { name: L(ctx, row.name) }) }, C.QUARTERS.map(x => h('option', { value: x, selected: x === row.quarter }, x)));
    q.addEventListener('change', () => saveOverride(row.competency_id, { quarter: q.value }, `#pq-${CSS.escape(row.competency_id)}`));
    const inc = h('input', { type: 'checkbox', id: 'pi-' + row.competency_id, checked: !row.skip, 'aria-label': t('co12a.plan.includeFor', { name: L(ctx, row.name) }) });
    inc.addEventListener('change', () => saveOverride(row.competency_id, { skip: !inc.checked }, `#pi-${CSS.escape(row.competency_id)}`));
    return { i: inc, q: h('span', { dataset: { planRow: row.competency_id, quarter: row.quarter, people: String(row.people_affected), hours: String(row.total_hours), skip: String(row.skip) } }, q, row.moved ? h('span', { class: 'note' }, ' ', t('co12a.plan.moved')) : null),
      p: prioBadge(ctx, row.priority), c: h('span', { class: row.skip ? 'co-skipped' : null }, h('span', { class: 'cid' }, row.competency_id), ' ', L(ctx, row.name)),
      n: h('span', { title: row.people.join(' · ') }, num(ctx, row.people_affected)), m: num(ctx, row.mean_gap),
      s: row.course || row.lab ? h('span', null, row.course ? h('a', { href: row.course.href }, L(ctx, row.course.title)) : null, row.course && row.lab ? h('br') : null, row.lab ? h('a', { class: 'note', href: row.lab.href }, icon('flask'), ' ', L(ctx, row.lab.title)) : null) : h('span', { class: 'note' }, t('co12a.plan.noCourse')),
      h1: num(ctx, row.hours_per_person), h2: num(ctx, row.total_hours) };
  });
  return h('div', { class: 'co-plan', dataset: { plan: String(plan.year), lines: String(tt.lines), hours: String(tt.hours), seats: String(tt.seats) } },
    h('section', { class: 'section', 'aria-labelledby': 'pl-h' }, h('h2', { id: 'pl-h' }, icon('calendar'), ' ', t('co12a.plan.title', { year: ctx.i18n.digitize(plan.year) })), h('p', null, t('co12a.plan.lede')),
      h('ul', { class: 'co-kpis' }, kpi(ctx, { key: 'lines', value: tt.lines, label: t('co12a.plan.fLines'), iconName: 'clipboard', hint: tt.skipped ? t('co12a.plan.skipped', { n: num(ctx, tt.skipped) }) : null }),
        kpi(ctx, { key: 'seats', value: tt.seats, label: t('co12a.plan.fSeats'), iconName: 'users' }), kpi(ctx, { key: 'hours', value: tt.hours, label: t('co12a.plan.fHours'), iconName: 'clock' }),
        C.QUARTERS.map(q => kpi(ctx, { key: q, value: tt.by_quarter[q].hours, label: t('co12a.plan.quarterTile', { q, n: num(ctx, tt.by_quarter[q].lines) }), iconName: 'calendar' }))),
      h('div', { class: 'btnrow co-exports' }, Button({ label: t('co12a.plan.csv'), variant: 'secondary', iconName: 'download', onClick: () => { exp.csv(); toast(t('co12a.exported')); }, attrs: { 'data-action': 'plan-csv' } }),
        Button({ label: t('co12a.plan.xls'), variant: 'secondary', iconName: 'download', onClick: () => { exp.xls(); toast(t('co12a.exported')); }, attrs: { 'data-action': 'plan-xls' } }),
        Button({ label: t('co12a.plan.doc'), variant: 'secondary', iconName: 'download', onClick: () => { exp.doc(); toast(t('co12a.exported')); }, attrs: { 'data-action': 'plan-doc' } }),
        linkBtn('#/company/plan', t('co12a.plan.print'), 'primary', { 'data-action': 'plan-print' }),
        Object.keys(d.planPrefs?.overrides || {}).length ? Button({ label: t('co12a.plan.reset'), variant: 'quiet', onClick: reset, attrs: { 'data-action': 'plan-reset' } }) : null),
      h('div', { class: 'tablewrap' }, Table({ caption: t('co12a.plan.tableTitle'), columns: [{ key: 'c', label: t('pf.thCompetency') }, { key: 'i', label: t('co12a.plan.col.include') }, { key: 'q', label: t('co12a.plan.col.quarter') }, { key: 'p', label: t('co12a.plan.col.priority') },
        { key: 'n', label: t('co12a.plan.col.people'), num: true }, { key: 'm', label: t('co12a.plan.col.meanGap'), num: true }, { key: 's', label: t('co12a.plan.col.course') }, { key: 'h1', label: t('co12a.plan.col.hoursEach'), num: true }, { key: 'h2', label: t('co12a.plan.col.hoursTotal'), num: true }], rows })),
      tt.unmatched ? h('p', { class: 'banner banner-info', role: 'note' }, t('co12a.plan.unmatched', { n: num(ctx, tt.unmatched) })) : null,
      h('p', { class: 'note' }, t('co12a.plan.method')), h('p', { class: 'note' }, t('co12a.plan.honest'))));
}

/** #/company/plan — the printable annual training plan (print / save as PDF from the browser). */
export function companyPlanPrintView(ctx) {
  const { t } = ctx;
  const region = dataRegion({ t, load: () => loadCompany(ctx), render: d => {
    const a = C.planDocument(d.plan, { company: d.profile || {}, tna: d.tna, lang: ctx.i18n.locale, labels: labelsOf(ctx), today: d.today });
    return h('article', { class: 'co-print', dataset: { planPrint: String(a.table.rows.length) } },
      pageHead(ctx, { eyebrow: t('co12a.title'), title: a.title, lede: t('co12a.plan.printLede', { d: fmtDate(ctx, d.today), n: num(ctx, a.table.rows.length) }),
        actions: [Button({ label: t('lab11.print'), variant: 'primary', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print-now' } }), linkBtn('#/company?tab=plan', t('co12a.plan.back'), 'secondary')] }),
      h('p', { class: 'banner banner-info', role: 'note', dataset: { companyLabel: 'true' } }, a.label),
      a.sections.map((s, i) => h('section', { class: 'section', 'aria-labelledby': 'cp-s' + i }, h('h2', { id: 'cp-s' + i }, s.title),
        h('dl', { class: 'facts' }, s.fields.filter(f => f.value !== '').map(f => h('div', null, h('dt', null, f.label), h('dd', null, f.value)))))),
      h('section', { class: 'section', 'aria-labelledby': 'cp-t' }, h('h2', { id: 'cp-t' }, a.table.title),
        a.table.rows.length ? h('div', { class: 'tablewrap' }, Table({ caption: a.table.title, columns: a.table.columns.map((c, i) => ({ key: 'c' + i, label: c })), rows: a.table.rows.map(row => Object.fromEntries(row.map((v, i) => ['c' + i, v]))) })) : h('p', { class: 'note' }, t('co12a.plan.empty'))),
      h('p', { class: 'note' }, t('co12a.plan.honest')));
  } });
  return h('div', { class: 'co-print-page' }, region);
}

/* ------------------------------------------------------------------ assignments */

function assignmentsTab(ctx, d, env) {
  const { t } = ctx; const r = ctx.repos; const q = env.q || {};
  if (!d.people.length) return emptyNeed(ctx, env, 'people', 'co12a.asg.empty');
  const typeSel = h('select', { class: 'select', id: 'as-type' }, C.ASSIGNMENT_TYPES.map(x => h('option', { value: x, selected: x === q.type }, t('co12a.asg.type.' + x))));
  const targetSel = h('select', { class: 'select', id: 'as-target', 'aria-describedby': 'as-target-err' });
  const fillTargets = () => { const list = d.catalog[typeSel.value] || []; put(targetSel, h('option', { value: '' }, t('co12a.people.choose')), ...list.map(x => h('option', { value: x.id, selected: x.id === q.target }, L(ctx, x.title)))); };
  typeSel.addEventListener('change', fillTargets); fillTargets();
  const audType = h('select', { class: 'select', id: 'as-aud' }, C.AUDIENCES.map(x => h('option', { value: x, selected: x === (q.person ? 'person' : q.department ? 'department' : 'person') }, t('co12a.asg.aud.' + x))));
  const audSel = h('select', { class: 'select', id: 'as-who', 'aria-describedby': 'as-who-err' });
  const fillAud = () => { const list = audType.value === 'person' ? d.people.map(p => [p.key, p.name]) : d.departments.map(x => [x.id, `${x.name} (${num(ctx, d.people.filter(p => p.department_id === x.id).length)})`]);
    put(audSel, h('option', { value: '' }, t('co12a.people.choose')), ...list.map(([v, lab]) => h('option', { value: v, selected: v === (q.person || q.department) }, lab))); };
  audType.addEventListener('change', fillAud); fillAud();
  const dueIn = h('input', { class: 'input', id: 'as-due', type: 'date', min: d.today, value: C.addDays(d.today, 30), 'aria-describedby': 'as-due-err' });
  const noteIn = h('input', { class: 'input', id: 'as-note', type: 'text', maxlength: 300, autocomplete: 'off' });
  const errs = { target_id: errSpan('as-target'), audience: errSpan('as-who'), due: errSpan('as-due') };
  const create = async () => {
    const v = C.validateAssignment({ type: typeSel.value, target_id: targetSel.value, due: dueIn.value, note: noteIn.value, audience: { type: audType.value, id: audSel.value } }, { catalog: d.catalog, people: d.people, departments: d.departments, today: d.today });
    errs.target_id.textContent = v.errors.target_id ? t('co12a.err.target') : ''; targetSel.setAttribute('aria-invalid', v.errors.target_id ? 'true' : 'false');
    errs.audience.textContent = v.errors.audience ? t('co12a.err.audience_' + v.errors.audience) : ''; audSel.setAttribute('aria-invalid', v.errors.audience ? 'true' : 'false');
    errs.due.textContent = v.errors.due ? t('co12a.err.due_' + v.errors.due) : ''; dueIn.setAttribute('aria-invalid', v.errors.due ? 'true' : 'false');
    if (!v.value) { (v.errors.target_id ? targetSel : v.errors.audience ? audSel : dueIn).focus(); return; }
    if (d.assignments.length >= C.LIMITS.assignments) { toast(t('co12a.asg.limit')); return; }
    await r.companyAssignments.save(C.makeAssignment(v.value, { id: newId('ASG') }));
    toast(t('co12a.asg.created', { n: num(ctx, v.value.assignees.length) }));
    env.q = {}; setHashQuery('/company', { tab: 'assignments' }); env.reload('assignments', '#as-target');
  };
  const active = d.asg.filter(x => !x.a.cancelled);
  const fileFor = p => { const f = C.assignmentFile({ company: d.profile || {}, person: p, assignments: d.assignments, batchId: newId('BAT') }); download(`cia-assignments-${p.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'employee'}-${localToday()}.json`, JSON.stringify(f, null, 2), 'application/json'); toast(t('co12a.asg.fileDone', { name: p.name, n: num(ctx, f.items.length) })); };
  const cancel = a => openDialog({ title: t('co12a.asg.cancelTitle'), body: t('co12a.asg.cancelBody', { name: L(ctx, a.title) }), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('co12a.asg.cancel'), variant: 'danger', onClick: async () => { await r.companyAssignments.save({ ...a, cancelled: true, cancelled_at: new Date().toISOString() }); toast(t('co12a.asg.cancelled')); env.reload('assignments'); } }] });
  const tracker = () => { download(`cia-assignment-tracker-${localToday()}.csv`, C.trackerCsv(d.assignments, d.people, { labels: labelsOf(ctx), lang: ctx.i18n.locale, today: d.today }), 'text/csv;charset=utf-8'); toast(t('co12a.exported')); };
  const totals = active.reduce((a, x) => ({ completed: a.completed + x.st.completed, overdue: a.overdue + x.st.overdue, due_soon: a.due_soon + x.st.due_soon, open: a.open + x.st.open, awaiting: a.awaiting + x.st.awaiting }), { completed: 0, overdue: 0, due_soon: 0, open: 0, awaiting: 0 });
  const withFiles = d.people.filter(p => active.some(x => x.a.assignees.includes(p.key)));
  const list = active.length ? h('ul', { class: 'co-asg-admin plain' }, [...active].sort((a, b) => a.a.due.localeCompare(b.a.due)).map(({ a, st }) => {
    const aud = a.audience.type === 'department' ? d.departments.find(x => x.id === a.audience.id)?.name || t('co12a.asg.aud.department') : st.rows[0]?.name || t('co12a.asg.withdrawn');
    return h('li', { class: 'card', dataset: { assignment: a.id, due: st.due_state, completed: String(st.completed), total: String(st.total), awaiting: String(st.awaiting) } },
      h('p', { class: 'co-asg-head' }, h('span', { class: 'badge badge-neutral' }, icon(TYPE_ICON[a.type]), ' ', t('co12a.asg.type.' + a.type)), ' ', dueBadge(ctx, st.due_state, a.due, d.today)),
      h('h3', null, h('a', { href: a.href }, L(ctx, a.title))),
      h('p', { class: 'note' }, t('co12a.asg.line', { who: aud, due: fmtDate(ctx, a.due), done: num(ctx, st.completed), n: num(ctx, st.total) }), a.hours ? ' · ' + t('p7.hours', { n: num(ctx, a.hours) }) : ''),
      a.note ? h('p', { class: 'co-note' }, a.note) : null,
      h('div', { class: 'tablewrap' }, Table({ caption: L(ctx, a.title), columns: [{ key: 'n', label: t('co12a.asg.col.person') }, { key: 's', label: t('co12a.asg.col.state') }, { key: 'd', label: t('co12a.asg.col.dueState') }, { key: 'a', label: t('co12a.asg.col.asOf') }],
        rows: st.rows.map(row => ({ n: h('span', { dataset: { assignee: row.key, state: row.state, due: row.due_state, awaiting: String(row.awaiting) } }, row.name || t('co12a.asg.withdrawn')),
          s: row.awaiting ? h('span', { class: 'badge badge-neutral', title: t('co12a.asg.awaitingWhy') }, icon('clock'), ' ', t('co12a.asg.awaiting')) : h('span', null, t('co12a.asg.state.' + row.state), row.percent != null && row.state !== 'completed' ? ` · ${num(ctx, row.percent)}%` : '', row.completed_at ? ' · ' + fmtDate(ctx, row.completed_at) : ''),
          d: dueBadge(ctx, row.due_state, a.due, d.today), a: row.as_of ? fmtDate(ctx, row.as_of) : '—' })) })),
      h('div', { class: 'btnrow' }, Button({ label: t('co12a.asg.cancel'), variant: 'quiet', onClick: () => cancel(a), attrs: { 'data-action': 'cancel-assignment', 'aria-label': t('co12a.asg.cancelNamed', { name: L(ctx, a.title) }) } })));
  })) : h('p', { class: 'note', dataset: { empty: 'assignments' } }, t('co12a.asg.none'));
  return h('div', { class: 'co-assign' },
    h('form', { class: 'panel feature', novalidate: true, 'aria-labelledby': 'as-h', dataset: { form: 'assignment' }, onsubmit: e => { e.preventDefault(); create(); } }, h('h2', { id: 'as-h' }, icon('clipboard'), ' ', t('co12a.asg.new')), h('p', null, t('co12a.asg.newBody')),
      h('div', { class: 'formgrid' }, field('as-type', t('co12a.asg.what'), typeSel), field('as-target', t('co12a.asg.which'), targetSel, { err: errs.target_id, req: true }), field('as-aud', t('co12a.asg.forWhom'), audType),
        field('as-who', t('co12a.asg.who'), audSel, { err: errs.audience, req: true }), field('as-due', t('co12a.asg.dueDate'), dueIn, { err: errs.due, req: true }), field('as-note', t('co12a.asg.note'), noteIn)),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'create-assignment' } }, t('co12a.asg.create')))),
    h('section', { class: 'section', 'aria-labelledby': 'as-files-h', dataset: { files: String(withFiles.length) } }, h('h2', { id: 'as-files-h' }, icon('download'), ' ', t('co12a.asg.files')), h('p', null, t('co12a.asg.filesBody')),
      withFiles.length ? h('ul', { class: 'co-files plain' }, withFiles.map(p => h('li', null, Button({ label: t('co12a.asg.fileFor', { name: p.name, n: num(ctx, active.filter(x => x.a.assignees.includes(p.key)).length) }), variant: 'secondary', iconName: 'download', onClick: () => fileFor(p), attrs: { 'data-action': 'assignment-file', 'data-person': p.key } })))) : h('p', { class: 'note' }, t('co12a.asg.none'))),
    h('section', { class: 'section', 'aria-labelledby': 'as-list-h', dataset: { assignments: String(active.length), completed: String(totals.completed), overdue: String(totals.overdue), dueSoon: String(totals.due_soon), awaiting: String(totals.awaiting) } },
      h('h2', { id: 'as-list-h' }, icon('chart'), ' ', t('co12a.asg.follow', { n: num(ctx, active.length) })),
      active.length ? h('ul', { class: 'co-kpis' }, kpi(ctx, { key: 'completed', value: totals.completed, label: t('co12a.asg.due.completed'), iconName: 'check', tone: 'ok' }), kpi(ctx, { key: 'overdue', value: totals.overdue, label: t('co12a.asg.due.overdue'), iconName: 'alert', tone: totals.overdue ? 'bad' : null }),
        kpi(ctx, { key: 'dueSoon', value: totals.due_soon, label: t('co12a.asg.due.due_soon'), iconName: 'clock', tone: totals.due_soon ? 'warn' : null }), kpi(ctx, { key: 'open', value: totals.open, label: t('co12a.asg.due.open'), iconName: 'calendar' }),
        kpi(ctx, { key: 'awaiting', value: totals.awaiting, label: t('co12a.asg.awaiting'), iconName: 'question' })) : null,
      list,
      active.length ? h('div', { class: 'btnrow' }, Button({ label: t('co12a.asg.csv'), variant: 'secondary', iconName: 'download', onClick: tracker, attrs: { 'data-action': 'tracker-csv' } })) : null,
      h('p', { class: 'note' }, t('co12a.asg.honest'))));
}
