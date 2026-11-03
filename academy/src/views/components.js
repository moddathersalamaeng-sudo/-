/** Component showcase (#/dev/components) — admin role only. Every shared component in AR and EN. */
import { h } from '../core/dom.js';
import {
  Button, LinkButton, Link, Badge, StatusLabel, Card, Table, TextField, TextArea, Select, RadioGroup, Checkbox,
  validateForm, ProgressBar, ProgressRing, Tabs, openDialog, toast, EmptyState, ErrorState, LoadingState, Skeleton
} from '../ui/components.js';
import { LevelMeter, Radar } from '../ui/charts.js';
import { GapTable } from './recommendations.js';

export function componentsView(ctx) {
  const { t, i18n, taxonomies } = ctx;
  const sec = (id, title, ...kids) => h('section', { 'aria-labelledby': id, dataset: { showcase: id } }, h('h2', { id }, title), ...kids);
  const msgs = { required: t('components.validation.required'), email: t('components.validation.email'), minLength: n => t('components.validation.minLength', { n: i18n.number(n) }) };

  const summary = h('div', { 'aria-live': 'assertive' });
  const form = h('form', { novalidate: true, dataset: { form: 'demo' } },
    summary,
    h('div', { class: 'formgrid' },
      TextField({ name: 'fullName', label: t('components.fullName'), required: true, autocomplete: 'name', rules: { minLength: 3 } }),
      TextField({ name: 'email', label: t('components.email'), type: 'email', required: true, autocomplete: 'email' }),
      Select({ name: 'role', label: t('components.role'), required: true, placeholder: t('components.rolePick'), options: [{ value: 'qe', label: t('components.roleQ') }, { value: 'aud', label: t('components.roleA') }] }),
      RadioGroup({ name: 'level', legend: t('components.level'), required: true, options: [{ value: 'low', label: t('components.levelLow') }, { value: 'high', label: t('components.levelHigh') }] })),
    TextArea({ name: 'notes', label: t('components.notes'), rules: { minLength: 10 } }),
    Checkbox({ name: 'agree', label: t('components.agree'), required: true }),
    Button({ label: t('components.submit'), type: 'submit' }));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const first = validateForm(form, msgs);
    summary.replaceChildren(first ? h('p', { class: 'errsum', role: 'alert' }, t('components.formErr')) : h('p', { class: 'oksum', role: 'status' }, t('components.formOk')));
    first?.focus();
  });

  return h('div', { class: 'showcase' },
    h('div', { class: 'phead' }, h('h1', null, t('components.title')), h('p', null, t('components.lede'))),
    sec('c-buttons', t('components.buttons'), h('div', { class: 'btnrow' },
      Button({ label: t('components.primary') }), Button({ label: t('components.secondary'), variant: 'secondary' }),
      Button({ label: t('components.quiet'), variant: 'quiet' }), Button({ label: t('components.disabled'), disabled: true }),
      LinkButton({ label: t('nav.items.settings'), href: '#/settings' }), Link({ label: t('components.link'), href: '#/about-governance' }))),
    sec('c-badges', t('components.badges'),
      h('div', { class: 'stack' },
        h('div', { class: 'badges' }, taxonomies.courseStatus.map(v => StatusLabel({ kind: 'course', value: v, label: t('labels.courseStatus.' + v) }))),
        h('div', { class: 'badges' }, taxonomies.certificateType.map(v => StatusLabel({ kind: 'certificate', value: v, label: t('labels.certificateType.' + v) }))),
        h('div', { class: 'badges' }, taxonomies.governanceStates.map(v => StatusLabel({ kind: 'governance', value: v, label: t('labels.governance.' + v) }))),
        h('div', { class: 'badges' }, Badge({ label: t('nav.phase', { phase: i18n.digitize(2) }), tone: 'gold' }), Badge({ label: t('roles.learner') })))),
    sec('c-progress', t('components.progress'), h('div', { class: 'split' },
      ProgressBar({ value: 3, max: 8, label: t('components.progress'), valueText: i18n.percent(3 / 8) }),
      ProgressRing({ ratio: 0.62, label: t('components.ring'), valueText: i18n.percent(0.62) }))),
    sec('c-charts', t('p7.showcase.charts'), h('div', { class: 'split' },
      Radar({ title: t('p7.comp.radarTitle'), targetLabel: t('p7.comp.target'), currentLabel: t('p7.comp.current'),
        axes: [['p7.showcase.axisA', 4, 3], ['p7.showcase.axisB', 3, 1], ['p7.showcase.axisC', 3, 3], ['p7.showcase.axisD', 2, 0], ['p7.showcase.axisE', 4, 2]].map(([k, tg, cu]) => ({ label: t(k), target: tg, current: cu })) }),
      h('div', { class: 'stack' }, [0, 1, 2, 3, 4, 5].map(n => h('p', null, LevelMeter({ level: n, label: n ? t('p7.level', { n: i18n.digitize(n) }) : t('pf.notAssessed') })))))),
    sec('c-gaps', t('phase6.gaps'), GapTable(ctx, [
      { competency_id: 'AUD-02', name: { en: t('p7.showcase.axisA'), ar: t('p7.showcase.axisA') }, current: 1, required: 3, gap: 2, evidence_source: 'assessment', priority: 'High' },
      { competency_id: 'ISO-01', name: { en: t('p7.showcase.axisB'), ar: t('p7.showcase.axisB') }, current: 2, required: 3, gap: 1, evidence_source: 'self', priority: 'Medium' },
      { competency_id: 'RSK-01', name: { en: t('p7.showcase.axisC'), ar: t('p7.showcase.axisC') }, current: 0, required: 2, gap: 2, evidence_source: 'insufficient', priority: 'Low' }])),
    sec('c-cards', t('components.cards'), h('div', { class: 'split' },
      Card({ title: t('components.cardTitle'), body: t('components.cardBody') }), Card({ title: t('components.cardTitle'), body: t('components.cardBody') }))),
    sec('c-table', t('components.table'), Table({ caption: t('components.table'), columns: [{ key: 'a', label: t('components.colName') }, { key: 'b', label: t('components.colValue'), num: true }],
      rows: [{ a: t('components.row1'), b: i18n.number(24) }, { a: t('components.row2'), b: i18n.number(6) }] })),
    sec('c-form', t('components.form'), form),
    sec('c-tabs', t('components.tabs'), Tabs({ label: t('components.tabs'), tabs: ['A', 'B', 'C'].map(k => ({ label: t('components.tab' + k), content: () => h('p', null, t('components.tab' + k + 'Text')) })) })),
    sec('c-dialog', t('components.dialog'), Button({ label: t('components.openDialog'), variant: 'secondary', attrs: { 'data-action': 'open-dialog' },
      onClick: () => openDialog({ title: t('components.dialogTitle'), body: t('components.dialogBody'), actions: [{ label: t('settings.data.cancel') }, { label: t('components.confirm'), variant: 'primary' }] }) })),
    sec('c-toast', t('components.toast'), Button({ label: t('components.showToast'), variant: 'secondary', attrs: { 'data-action': 'toast' }, onClick: () => toast(t('components.toastText')) })),
    sec('c-states', t('components.statesTitle'), h('div', { class: 'split' },
      EmptyState({ title: t('components.emptyTitle'), body: t('components.emptyBody') }),
      ErrorState({ title: t('states.errorTitle'), body: t('states.errorBody'), retryLabel: t('states.retry'), onRetry: () => toast(t('states.retry')) }),
      h('div', null, LoadingState({ label: t('states.loading') }), Skeleton({ label: t('components.skeleton') })))));
}
