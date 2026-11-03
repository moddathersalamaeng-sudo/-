/** Settings: language (platform-wide), theme, digits, learner data export/import/clear, dev role switcher. */
import { h, icon } from '../core/dom.js';
import { RadioGroup, Select, Button, toast, openDialog } from '../ui/components.js';
import { exportData, importData, validateImport } from '../data/transfer.js';
import { ROLES } from '../session/roles.js';

export function settingsView(ctx) {
  const { t, i18n, prefs, session, userAdapter } = ctx;

  const lang = RadioGroup({ name: 'locale', legend: t('settings.language'), value: i18n.locale,
    options: [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }],
    onChange: v => { ctx.setLocale(v); toast(ctx.t('settings.saved')); } });
  lang.append(h('span', { class: 'hint note' }, t('settings.languageHint')));

  const theme = RadioGroup({ name: 'theme', legend: t('settings.theme.label'), value: prefs.theme,
    options: ['system', 'light', 'dark'].map(v => ({ value: v, label: t('settings.theme.' + v) })),
    onChange: v => { ctx.setPref('theme', v); toast(t('settings.saved')); } });

  const digits = Select({ name: 'digits', label: t('settings.digits.label'), value: prefs.digits,
    hint: t('settings.digits.hint', { sample: i18n.list([i18n.number(2026.5), i18n.date('2026-09-27')]) }),
    options: [{ value: 'latn', label: t('settings.digits.latn') }, { value: 'arab', label: t('settings.digits.arab') }] });
  digits.querySelector('select').addEventListener('change', e => { ctx.setPref('digits', e.target.value); toast(ctx.t('settings.saved')); });

  const countEl = h('p', { class: 'note', 'aria-live': 'polite' });
  const refreshCount = async () => { countEl.textContent = t('settings.data.count', { n: i18n.number((await userAdapter.collections()).length) }); };
  refreshCount();

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]; fileInput.value = '';
    if (!f) return;
    let payload;
    try { payload = JSON.parse(await f.text()); } catch { toast(t('settings.data.importFailed', { reason: t('settings.data.notJson') })); return; }
    const errs = validateImport(payload);
    if (errs.length) { toast(t('settings.data.importFailed', { reason: errs.includes('wrong_app') ? t('settings.data.wrongApp') : errs.join(', ') })); return; }
    const n = await importData(userAdapter, payload);
    toast(t('settings.data.imported', { n: i18n.number(n) })); refreshCount(); ctx.reloadPrefs();
  });

  const doExport = async () => {
    const data = await exportData(userAdapter, session.user.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `cia-academy-export-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(t('settings.data.exported'));
  };
  const doClear = () => openDialog({ title: t('settings.data.clearTitle'), body: t('settings.data.clearBody'), actions: [
    { label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('settings.data.confirmClear'), variant: 'danger', onClick: async () => {
      for (const c of await userAdapter.collections()) await userAdapter.clear(c);
      toast(t('settings.data.cleared')); refreshCount(); ctx.reloadPrefs();
    } }] });

  const data = h('section', { class: 'panel', 'aria-labelledby': 'dt-h' },
    h('h2', { id: 'dt-h' }, t('settings.data.title')), h('p', null, t('settings.data.body')), countEl,
    h('div', { class: 'btnrow' },
      Button({ label: t('settings.data.export'), variant: 'secondary', iconName: 'download', onClick: doExport, attrs: { 'data-action': 'export' } }),
      Button({ label: t('settings.data.import'), variant: 'secondary', iconName: 'upload', onClick: () => fileInput.click(), attrs: { 'data-action': 'import', title: t('settings.data.importHint') } }),
      Button({ label: t('settings.data.clear'), variant: 'quiet', onClick: doClear, attrs: { 'data-action': 'clear' } })),
    fileInput);

  let dev = null;
  if (session.devMode) {
    const boxes = ROLES.map(r => h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'dev-role', value: r, checked: session.hasRole(r) }),
      t('roles.' + r), r === 'company_admin' ? h('span', { class: 'badge badge-neutral' }, t('roles.placeholder')) : null));
    dev = h('section', { class: 'panel', 'aria-labelledby': 'dv-h', dataset: { dev: 'roles' } },
      h('h2', { id: 'dv-h' }, t('settings.dev.title')), h('p', { class: 'note' }, t('settings.dev.body')),
      h('fieldset', { class: 'fs' }, h('legend', null, t('settings.dev.roles')), boxes),
      Button({ label: t('settings.dev.apply'), variant: 'secondary', attrs: { 'data-action': 'apply-roles' }, onClick: () => {
        const picked = boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => i.value);
        if (!session.setRoles(picked)) { toast(t('settings.dev.pickOne')); return; }
        toast(ctx.t('settings.dev.applied'));
      } }));
  }

  return h('div', null,
    h('div', { class: 'phead' }, h('h1', null, t('settings.title')), h('p', null, t('settings.lede'))),
    h('div', { class: 'split' },
      h('section', { class: 'panel', 'aria-label': t('settings.title') }, lang, theme, digits),
      data),
    dev ? h('div', { class: 'section' }, dev) : null);
}
