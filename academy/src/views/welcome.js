/**
 * First-visit onboarding (Phase 10A, plan §3.3) — #/welcome?goal=<goal>
 * Three questions (your role, your goal, your weekly hours) create the profile on this device and open the matching
 * readiness check, so My space, recommendations and starting points have something to work from. Answers can be
 * changed later in My space → Profile. Nothing is sent anywhere.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, toast } from '../ui/components.js';
import { loadAll } from '../data/learner-state.js';
import { emptyProfile, createCompetencyCore } from '../domain/competency-core.mjs';
import { GOALS, goalAcademy, validateOnboarding, onboardingProfile, academyByKey } from '../domain/academies.mjs';
import { L, pageHead } from '../ui/academy.js';

const GOAL_ICON = { standard: 'shield', certification: 'award', improve: 'trend', team: 'users' };
const HOURS = ['2', '4', '6', '10'];

export function welcomeView(ctx, match) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('x10a.welcome.eyebrow'), title: t('x10a.welcome.title'), lede: t('x10a.welcome.lede') });
  const region = dataRegion({ t, load: () => loadAll(ctx), render: ({ content, learner }) => form(ctx, content, learner, match.query || {}) });
  return h('div', { class: 'welcome' }, head, region);
}

function form(ctx, content, learner, query) {
  const { t, i18n } = ctx;
  const p = learner.profile || {};
  const roles = content.roles.length ? content.roles : content.rolesAll;
  const goal0 = GOALS.includes(query.goal) ? query.goal : (p.goal || '');
  const err = name => h('span', { class: 'err', id: `ob-${name}-err`, 'aria-live': 'polite' });
  const summary = h('div', { class: 'errsum', role: 'alert', tabindex: '-1', hidden: true });
  const step = (n, legend, ...kids) => h('fieldset', { class: 'panel fsx ob-step', dataset: { step: String(n) } },
    h('legend', null, h('span', { class: 'ob-n' }, t('x10a.welcome.stepOf', { n: i18n.number(n), total: i18n.number(3) })), ' ', legend), ...kids);

  const roleIn = h('input', { class: 'input', id: 'ob-current_role', name: 'current_role', autocomplete: 'organization-title', required: true, value: p.current_role || '', list: 'ob-role-list', 'aria-describedby': 'ob-current_role-hint ob-current_role-err' });
  const target = h('select', { class: 'select', id: 'ob-target_role', name: 'target_role', required: true, 'aria-describedby': 'ob-target_role-err' },
    h('option', { value: '' }, t('pf.choose')), roles.map(r => h('option', { value: r.id, selected: r.id === p.target_role }, L(ctx, r.name))));
  const hoursIn = h('input', { class: 'input input-short', id: 'ob-weekly_hours', name: 'weekly_hours', type: 'number', min: '1', max: '40', inputmode: 'numeric', required: true, value: p.weekly_hours || '4', 'aria-describedby': 'ob-weekly_hours-hint ob-weekly_hours-err' });

  const f = h('form', { class: 'pform ob-form', novalidate: true, dataset: { form: 'onboarding' } },
    summary,
    step(1, t('x10a.welcome.q1'),
      h('div', { class: 'formgrid' },
        h('div', { class: 'field' }, h('label', { for: 'ob-current_role' }, t('pf.fCurrentRole'), ' *'), h('span', { class: 'hint', id: 'ob-current_role-hint' }, t('x10a.welcome.roleHint')), roleIn, err('current_role'),
          h('datalist', { id: 'ob-role-list' }, roles.map(r => h('option', { value: L(ctx, r.name) })))),
        h('div', { class: 'field' }, h('label', { for: 'ob-target_role' }, t('pf.fTargetRole'), ' *'), target, err('target_role')))),
    step(2, t('x10a.welcome.q2'),
      h('div', { class: 'goal-pick', role: 'radiogroup', 'aria-labelledby': 'ob-goal-l', id: 'ob-goal', 'aria-describedby': 'ob-goal-err' },
        h('span', { id: 'ob-goal-l', class: 'sr-only' }, t('x10a.welcome.q2')),
        GOALS.map(g => h('label', { class: 'goal-opt', dataset: { goal: g } },
          h('input', { type: 'radio', name: 'goal', value: g, checked: g === goal0 }),
          icon(GOAL_ICON[g]), h('strong', null, t('x10a.goal.' + g + '.t')), h('span', null, t('x10a.goal.' + g + '.d'))))),
      err('goal')),
    step(3, t('x10a.welcome.q3'),
      h('div', { class: 'field' }, h('label', { for: 'ob-weekly_hours' }, t('x10a.welcome.hoursLabel'), ' *'), h('span', { class: 'hint', id: 'ob-weekly_hours-hint' }, t('x10a.welcome.hoursHint')),
        h('div', { class: 'hours-row' }, hoursIn, h('div', { class: 'chips-btns', role: 'group', 'aria-label': t('x10a.welcome.hoursQuick') },
          HOURS.map(n => h('button', { type: 'button', class: 'chip-btn', dataset: { hours: n }, onclick: () => { hoursIn.value = n; } }, t('x10a.welcome.hoursN', { n: i18n.number(Number(n)) }))))),
        err('weekly_hours'))),
    h('p', { class: 'note' }, icon('lock'), ' ', t('x10a.welcome.privacy')),
    h('div', { class: 'btnrow' }, Button({ label: t('x10a.welcome.submit'), type: 'submit', attrs: { 'data-action': 'finish-onboarding' } }),
      h('a', { class: 'btn btn-quiet', href: '#/academies' }, t('x10a.welcome.skip'))));

  const read = () => { const fd = new FormData(f); return { current_role: String(fd.get('current_role') || ''), target_role: String(fd.get('target_role') || ''), goal: String(fd.get('goal') || ''), weekly_hours: String(fd.get('weekly_hours') || '') }; };
  const show = errs => {
    f.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    f.querySelectorAll('.err').forEach(el => { el.textContent = ''; });
    const names = Object.keys(errs);
    for (const n of names) {
      document.getElementById(`ob-${n}-err`).textContent = t('x10a.welcome.err.' + errs[n]);
      (n === 'goal' ? document.getElementById('ob-goal') : f.querySelector(`[name="${n}"]`))?.setAttribute('aria-invalid', 'true');
    }
    summary.replaceChildren(h('p', null, t('pf.fixErrors')), h('ul', null, names.map(n => h('li', null, h('a', { href: '#ob-' + n, onclick: e => { e.preventDefault(); (n === 'goal' ? f.querySelector('input[name=goal]') : document.getElementById('ob-' + n))?.focus(); } }, t('x10a.welcome.field.' + n))))));
    summary.hidden = !names.length;
    if (names.length) summary.focus();
  };

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const input = read();
    const errs = validateOnboarding(input, roles.map(r => r.id));
    show(errs);
    if (Object.keys(errs).length) return;
    const rec = onboardingProfile(learner.profile, input, emptyProfile());
    /* The full profile rules still apply (same validator as the profile form). */
    const core = createCompetencyCore({ domains: [], competencies: [], roles: content.rolesAll, evidence: { qualifying: [], non_qualifying: [] } });
    const deep = core.validateProfile(rec);
    if (Object.keys(deep).length) { show(Object.fromEntries(Object.keys(deep).filter(k => ['current_role', 'target_role', 'weekly_hours'].includes(k)).map(k => [k, 'required']))); return; }
    await ctx.repos.profile.save(rec);
    toast(t('x10a.welcome.saved'));
    const ac = academyByKey(goalAcademy(input.goal, input.target_role));
    const ready = content.byId(content.assessments, ac.ready);
    ctx.navigate(ready ? `/assessments/${ready.slug}?from=welcome&academy=${ac.key}` : `${ac.route}?from=welcome`);
  });
  return f;
}
