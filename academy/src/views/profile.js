/**
 * Professional profile and competency views (Phase 2, rebuilt in Phase 7).
 *
 *  #/profile                 profileView          — the §13 profile form (saved on this device only)
 *  #/profile/competencies    myCompetenciesView   — target vs current level, radar + tables, self-levels
 *  #/competencies            frameworkView        — the competency framework (published records only)
 *  #/competencies/roles      rolesView            — target roles and how many competencies each requires
 *
 * Governance: competency targets, definitions and roles are shown to learners only once published.
 * Role *names* are always offered in the profile form so a learner can state the role they aim for.
 * Self-declared levels are context; assessment evidence takes precedence (see recommendations.mjs currentLevel).
 */
import { h } from '../core/dom.js';
import { dataRegion, EmptyState, Button, Badge, toast, openDialog, Table } from '../ui/components.js';
import { createCompetencyCore, emptyProfile, PROFILE_ENUMS } from '../domain/competency-core.mjs';
import { currentLevel } from '../domain/recommendations.mjs';
import { MASTERY_THRESHOLD } from '../domain/learner-model.mjs';
import { loadAll } from '../data/learner-state.js';
import { L, srHeading, pageHead, previewBanner, linkBtn, section } from '../ui/academy.js';
import { LevelMeter, Radar } from '../ui/charts.js';

const ENUM_KEYS = {
  industry: [PROFILE_ENUMS.INDUSTRIES, v => 'pf.ind' + ({ it: 'IT' }[v] || v[0].toUpperCase() + v.slice(1))],
  education: [PROFILE_ENUMS.EDUCATION, v => 'pf.edu' + v[0].toUpperCase() + v.slice(1)],
  band: [PROFILE_ENUMS.EXP_BANDS, v => 'pf.exp' + ({ none: 'None', lt1: 'Lt1', '1to3': '1to3', '3to5': '3to5', '5to10': '5to10', '10p': '10p' }[v])],
  lang: [PROFILE_ENUMS.LANGS, v => 'pf.lng' + v[0].toUpperCase() + v.slice(1)],
  method: [PROFILE_ENUMS.METHODS, v => 'pf.m' + v[0].toUpperCase() + v.slice(1)]
};
const EXP_LABEL = f => 'pf.exp' + f[0].toUpperCase() + f.slice(1);

/* ------------------------------------------------------------------ profile form */

export function profileView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.profile.eyebrow'), title: t('profile.title'), lede: t('p7.profile.lede') });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => profileForm(ctx, content, learner, region) });
  return h('div', null, head, h('div', { class: 'banner banner-info', role: 'note' }, h('strong', null, t('pf.privacyTitle')), ' ', t('pf.privacyBody')), region);
}

function profileForm(ctx, content, learner, region) {
  const { t } = ctx;
  const p = { ...emptyProfile(), iso_focus: '', ...(learner.profile || {}) };
  p.experience = { ...emptyProfile().experience, ...(p.experience || {}) };
  const core = createCompetencyCore({ domains: [], competencies: [], roles: content.rolesAll, evidence: { qualifying: [], non_qualifying: [] } });
  const fieldIds = {};
  let n = 0;
  const id = name => (fieldIds[name] = fieldIds[name] || `pf-${name}-${++n}`);

  const field = (name, label, control, hint) => h('div', { class: 'field', dataset: { field: name } },
    h('label', { for: id(name) }, label),
    hint ? h('span', { class: 'hint', id: id(name) + '-hint' }, hint) : null,
    control,
    h('span', { class: 'err', id: id(name) + '-err', 'aria-live': 'polite' }));
  const described = (name, hint) => [hint ? id(name) + '-hint' : null, id(name) + '-err'].filter(Boolean).join(' ');
  const text = (name, label, { required, type = 'text', hint, min, max, autocomplete } = {}) =>
    field(name, label + (required ? ' *' : ''), h('input', { class: 'input', id: id(name), name, type, required, min, max, autocomplete, inputmode: type === 'number' ? 'numeric' : null, value: p[name] ?? '', 'aria-describedby': described(name, hint) }), hint);
  const area = (name, label, hint) => field(name, label, h('textarea', { class: 'textarea', id: id(name), name, rows: '3', 'aria-describedby': described(name, hint) }, p[name] || ''), hint);
  const select = (name, label, options, { required, value = p[name], placeholder = t('pf.choose') } = {}) =>
    field(name, label + (required ? ' *' : ''), h('select', { class: 'select', id: id(name), name, required, 'aria-describedby': described(name) },
      h('option', { value: '' }, placeholder), options.map(o => h('option', { value: o.value, selected: o.value === value }, o.label))));
  const enumOptions = key => ENUM_KEYS[key][0].map(v => ({ value: v, label: t(ENUM_KEYS[key][1](v)) }));
  const checks = (name, legend, key) => h('fieldset', { class: 'fs', dataset: { field: name } }, h('legend', null, legend),
    h('div', { class: 'checks' }, ENUM_KEYS[key][0].map(v => h('label', { class: 'choice' },
      h('input', { type: 'checkbox', name, value: v, checked: (p[name] || []).includes(v) }), t(ENUM_KEYS[key][1](v))))));

  const roleOptions = content.rolesAll.map(r => ({ value: r.id, label: L(ctx, r.name) }));
  const focusOptions = content.standards.map(s => ({ value: s.id, label: L(ctx, s.name) }));
  const summary = h('div', { class: 'errsum', role: 'alert', tabindex: '-1', hidden: true });
  const status = h('div', { 'aria-live': 'polite' });

  const form = h('form', { class: 'pform', novalidate: true, dataset: { form: 'profile' } },
    summary,
    h('fieldset', { class: 'panel fsx' }, h('legend', null, t('pf.fsRole')),
      h('div', { class: 'formgrid' },
        text('current_role', t('pf.fCurrentRole'), { required: true, autocomplete: 'organization-title' }),
        select('target_role', t('pf.fTargetRole'), roleOptions, { required: true }),
        text('target_certifications', t('pf.fTargetCerts')),
        focusOptions.length ? select('iso_focus', t('p7.profile.isoFocus'), focusOptions, { placeholder: t('p7.profile.isoFocusNone') }) : null),
      area('career_objectives', t('pf.fObjectives'))),
    h('fieldset', { class: 'panel fsx' }, h('legend', null, t('pf.fsBackground')),
      h('div', { class: 'formgrid' },
        select('industry', t('pf.fIndustry'), enumOptions('industry')),
        text('years_experience', t('pf.fYears'), { type: 'number', min: '0', max: '60', hint: t('p7.profile.yearsHint') }),
        select('education', t('pf.fEducation'), enumOptions('education')),
        text('country', t('pf.fCountry'), { autocomplete: 'country-name' }),
        text('memberships', t('pf.fMemberships'))),
      checks('languages', t('pf.fLanguages'), 'lang'),
      area('certifications', t('pf.fCerts'), t('pf.fCertsHint'))),
    h('fieldset', { class: 'panel fsx' }, h('legend', null, t('pf.fsExperience')),
      h('p', { class: 'note' }, t('p7.profile.expHint')),
      h('div', { class: 'formgrid' }, PROFILE_ENUMS.EXP_FIELDS.map(f =>
        select('exp_' + f, t(EXP_LABEL(f)), enumOptions('band'), { value: p.experience[f] })))),
    h('fieldset', { class: 'panel fsx' }, h('legend', null, t('pf.fsLearning')),
      h('div', { class: 'formgrid' },
        text('weekly_hours', t('pf.fWeekly'), { type: 'number', min: '0', max: '40' }),
        text('interests', t('pf.fInterests'), { hint: t('p7.profile.interestsHint') })),
      checks('learning_methods', t('pf.fMethods'), 'method')),
    h('div', { class: 'btnrow' },
      Button({ label: t('pf.save'), type: 'submit', attrs: { 'data-action': 'save-profile' } }),
      learner.profile ? Button({ label: t('p7.profile.delete'), variant: 'quiet', onClick: () => confirmDelete(ctx, region), attrs: { 'data-action': 'delete-profile' } }) : null),
    status);

  const read = () => {
    const fd = new FormData(form);
    const v = k => String(fd.get(k) ?? '').trim();
    const out = { ...p, id: 'me' };
    for (const k of ['current_role', 'target_role', 'target_certifications', 'career_objectives', 'industry', 'years_experience', 'education', 'country', 'memberships', 'certifications', 'weekly_hours', 'interests', 'iso_focus']) out[k] = v(k);
    out.languages = fd.getAll('languages').map(String);
    out.learning_methods = fd.getAll('learning_methods').map(String);
    out.experience = Object.fromEntries(PROFILE_ENUMS.EXP_FIELDS.map(f => [f, v('exp_' + f)]));
    return out;
  };

  const showErrors = errs => {
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.err').forEach(el => { el.textContent = ''; });
    const names = Object.keys(errs);
    for (const name of names) {
      const [key, params] = errs[name];
      const el = form.querySelector(`[name="${name}"]`);
      el?.setAttribute('aria-invalid', 'true');
      const err = document.getElementById(id(name) + '-err');
      if (err) err.textContent = t('pf.' + key, params);
    }
    summary.replaceChildren(h('p', null, t('pf.fixErrors')), h('ul', null, names.map(name => {
      const label = form.querySelector(`label[for="${id(name)}"]`)?.textContent || name;
      return h('li', null, h('a', { href: '#' + id(name), onclick: e => { e.preventDefault(); document.getElementById(id(name))?.focus(); } }, label));
    })));
    summary.hidden = names.length === 0;
    if (names.length) summary.focus();
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const rec = read();
    const errs = core.validateProfile(rec);
    showErrors(errs);
    if (Object.keys(errs).length) return;
    rec.updated = new Date().toISOString();
    await ctx.repos.profile.save(rec);
    toast(t('pf.saved'));
    status.replaceChildren(h('div', { class: 'oksum' }, t('p7.profile.savedNext'),
      h('div', { class: 'btnrow' }, linkBtn('#/academy/iso', t('nav.items.isoAcademy')), linkBtn('#/recommendations', t('nav.items.recommendations')), linkBtn('#/profile/competencies', t('profile.competencies')))));
  });
  return form;
}

function confirmDelete(ctx, region) {
  const { t } = ctx;
  openDialog({ title: t('p7.profile.deleteTitle'), body: t('p7.profile.deleteBody'), actions: [
    { label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('p7.profile.delete'), variant: 'danger', onClick: async () => { await ctx.repos.profile.remove('me'); toast(t('p7.profile.deleted')); region.refresh(); } }
  ] });
}

/* ------------------------------------------------------------------ my competencies */

/** Rows for every competency the target role requires. Pure apart from labels. */
export function competencyRows({ role, competencies, selfLevels, evidence }) {
  return competencies.filter(c => (role.targets?.[c.id] || 0) > 0).map(c => {
    const target = role.targets[c.id];
    const ev = evidence[c.id] || null;
    const cur = currentLevel({ selfLevel: selfLevels[c.id] || 0, assessmentPercent: ev ? ev.percent : null });
    const status = cur.source === 'insufficient' ? 'not_assessed' : cur.level >= target ? 'met' : 'gap';
    return { c, target, self: selfLevels[c.id] || null, ev, current: cur.level, source: cur.source, gap: Math.max(0, target - cur.level), status };
  });
}

export function myCompetenciesView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.profile.eyebrow'), title: t('profile.competencies'), lede: t('p7.comp.lede') });
  const region = dataRegion({ t, load: async () => ({ ...(await loadAll(ctx)), levels: await ctx.repos.levels.list() }), render: data => competencyBoard(ctx, data, region) });
  return h('div', null, head, region);
}

function competencyBoard(ctx, { content, learner, levels }, region) {
  const { t, i18n } = ctx;
  const profile = learner.profile;
  if (!profile?.target_role) return EmptyState({ title: t('profile.noTarget'), body: t('profile.noTargetBody'), action: linkBtn('#/profile', t('profile.title'), 'primary') });
  const role = content.roles.find(r => r.id === profile.target_role);
  if (!role || !content.competencies.length) return EmptyState({ title: t('p7.comp.pendingTitle'), body: t('p7.comp.pendingBody'), iconName: 'lock', action: linkBtn('#/knowledge', t('knowledge.title')) });

  const rows = competencyRows({ role, competencies: content.competencies, selfLevels: learner.selfLevels, evidence: learner.evidence });
  const levelName = lv => L(ctx, levels.find(x => x.level === lv)?.name) || i18n.digitize(lv);
  const count = s => rows.filter(r => r.status === s).length;
  const stats = h('ul', { class: 'stats' },
    [['required', rows.length], ['met', count('met')], ['gap', count('gap')], ['notAssessed', count('not_assessed')]].map(([k, v]) =>
      h('li', null, h('span', { class: 'bigpct' }, i18n.number(v)), h('span', null, t('p7.comp.stat.' + k)))));

  // Radar by domain: average target vs average current level of the required competencies.
  const doms = content.domains.map(d => {
    const rs = rows.filter(r => r.c.domain === d.id);
    if (!rs.length) return null;
    const avg = k => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length * 10) / 10;
    return { d, target: avg('target'), current: avg('current'), n: rs.length };
  }).filter(Boolean);
  const radar = doms.length >= 3 ? Radar({ axes: doms.map(x => ({ label: L(ctx, x.d.short || x.d.name), target: x.target, current: x.current })), title: t('p7.comp.radarTitle'), targetLabel: t('p7.comp.target'), currentLabel: t('p7.comp.current') }) : null;
  const domainTable = Table({ caption: t('p7.comp.domainTable'), columns: [{ key: 'd', label: t('pf.thDomain') }, { key: 'n', label: t('p7.comp.count'), num: true }, { key: 't', label: t('p7.comp.target'), num: true }, { key: 'c', label: t('p7.comp.current'), num: true }],
    rows: doms.map(x => ({ d: L(ctx, x.d.name), n: i18n.number(x.n), t: i18n.number(x.target), c: i18n.number(x.current) })) });

  const selfSelect = r => h('select', { class: 'select select-sm', 'aria-label': t('p7.comp.selfFor', { name: L(ctx, r.c.name) }), dataset: { self: r.c.id },
    onchange: async e => {
      const v = parseInt(e.target.value, 10);
      if (Number.isInteger(v)) await ctx.repos.selfLevels.save({ id: r.c.id, level: v, updated: new Date().toISOString() });
      else await ctx.repos.selfLevels.remove(r.c.id);
      toast(t('pf.saved'));
      await region.refresh();
      document.querySelector(`[data-self="${r.c.id}"]`)?.focus();
    } },
    h('option', { value: '' }, t('pf.selfNone')), [1, 2, 3, 4, 5].map(lv => h('option', { value: String(lv), selected: r.self === lv }, `${i18n.digitize(lv)} · ${levelName(lv)}`)));
  const evidenceCell = r => r.ev
    ? h('span', null, t('p7.comp.assessed', { pct: i18n.number(r.ev.percent) }), r.ev.percent >= MASTERY_THRESHOLD ? ' ' : null, r.ev.percent >= MASTERY_THRESHOLD ? Badge({ label: t('p7.comp.demonstrated'), tone: 'ok' }) : null)
    : h('span', { class: 'note' }, t('p7.comp.noEvidence'));
  const statusTone = { met: 'ok', gap: 'warn', not_assessed: 'neutral' };
  const compTable = Table({ caption: t('p7.comp.table'), columns: [
    { key: 'name', label: t('pf.thCompetency') }, { key: 'target', label: t('p7.comp.target') }, { key: 'self', label: t('p7.comp.self') },
    { key: 'ev', label: t('p7.comp.evidence') }, { key: 'cur', label: t('p7.comp.current') }, { key: 'status', label: t('pf.thStatus') }],
  rows: rows.sort((a, b) => b.gap - a.gap).map(r => ({
    name: h('span', null, h('span', { class: 'cid' }, r.c.id), ' ', L(ctx, r.c.name)),
    target: LevelMeter({ level: r.target, label: t('p7.level', { n: i18n.digitize(r.target) }) }),
    self: selfSelect(r),
    ev: evidenceCell(r),
    cur: LevelMeter({ level: r.current, label: r.source === 'insufficient' ? t('pf.notAssessed') : t('p7.comp.levelFrom', { n: i18n.digitize(r.current), src: t('p7.comp.src.' + r.source) }) }),
    status: Badge({ label: t('p7.comp.status.' + r.status), tone: statusTone[r.status] })
  })) });

  return h('div', null,
    previewBanner(ctx, [role, ...content.competencies]),
    h('section', { class: 'panel feature' }, h('h2', null, t('p7.comp.target_role', { role: L(ctx, role.name) })), stats,
      h('p', { class: 'note' }, t('p7.comp.evidenceRule'))),
    section('cmp-radar', t('p7.comp.radarTitle'), h('div', { class: 'split' }, radar || h('p', { class: 'note' }, t('p7.comp.radarFew')), domainTable), h('p', { class: 'note' }, t('pf.radarNote'))),
    section('cmp-table', t('p7.comp.table'), compTable, h('p', { class: 'note' }, t('pf.verifiedNote'))),
    h('div', { class: 'btnrow' }, linkBtn('#/recommendations', t('nav.items.recommendations'), 'primary'), linkBtn('#/assessments', t('nav.items.assessments')), linkBtn('#/competencies', t('profile.framework'))));
}

/* ------------------------------------------------------------------ framework & roles */

export function frameworkView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.profile.eyebrow'), title: t('profile.framework'), lede: t('pf.fwLede') });
  const region = dataRegion({ t, load: async () => ({ content: (await loadAll(ctx)).content, levels: await ctx.repos.levels.list() }), render: ({ content, levels }) => {
    if (!content.competencies.length) return EmptyState({ title: t('p7.comp.pendingTitle'), body: t('p7.comp.pendingBody'), iconName: 'lock', action: linkBtn('#/knowledge', t('knowledge.title')) });
    return h('div', null, previewBanner(ctx, content.competencies),
      content.domains.map(d => {
        const cs = content.competencies.filter(c => c.domain === d.id);
        if (!cs.length) return null;
        return section('dom-' + d.id, L(ctx, d.name), h('div', { class: 'cards' }, cs.map(c => h('article', { class: 'card', dataset: { competency: c.id } },
          h('p', { class: 'eyebrow' }, c.id), h('h3', null, L(ctx, c.name)), h('p', null, L(ctx, c.definition)),
          c.level_descriptors?.length ? h('details', null, h('summary', null, t('pf.levelDesc')),
            h('ol', { class: 'levels' }, c.level_descriptors.map(x => h('li', null, h('strong', null, L(ctx, levels.find(lv => lv.level === x.level)?.name) || x.level), ' — ', L(ctx, x))))) : null))));
      }));
  } });
  return h('div', null, head, region);
}

export function rolesView(ctx) {
  const { t, i18n } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.profile.eyebrow'), title: t('profile.roles'), lede: t('pf.rolesLede') });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => {
    if (!content.roles.length) return EmptyState({ title: t('p7.comp.pendingTitle'), body: t('p7.comp.pendingBody'), iconName: 'lock', action: linkBtn('#/profile', t('profile.title')) });
    const setTarget = async r => {
      if (!learner.profile) { location.hash = '#/profile'; return; }
      await ctx.repos.profile.save({ ...learner.profile, target_role: r.id, updated: new Date().toISOString() });
      toast(t('pf.saved')); region.refresh();
    };
    return h('div', null, previewBanner(ctx, content.roles), srHeading(t('profile.roles')), h('div', { class: 'cards' }, content.roles.map(r => {
      const req = Object.values(r.targets || {}).filter(v => v > 0).length;
      const isTarget = learner.profile?.target_role === r.id;
      return h('article', { class: ['card', isTarget && 'card-current'], dataset: { role: r.id } },
        h('h3', null, L(ctx, r.name)), h('p', null, L(ctx, r.description)),
        h('p', { class: 'note' }, t('pf.reqCount', { n: i18n.number(req) })),
        isTarget ? Badge({ label: t('pf.isTarget'), tone: 'gold' }) : Button({ label: t('pf.setTarget'), variant: 'secondary', onClick: () => setTarget(r) }));
    })));
  } });
  return h('div', null, head, region);
}
