/**
 * Smart guided templates (Phase 11, ADD-9).
 *
 *  #/templates/:slug?doc=ID          templateView      — my documents from this template · guided questions · register table
 *                                                         · assembled preview · export (CSV, Excel .xls, Word .doc, print/PDF, JSON)
 *                                                         · version history with restore
 *  #/templates/:slug/print?doc=ID    templatePrintView — the assembled document alone, for the browser's Print / Save as PDF
 *  smartTemplatesBlock(ctx)          the "Smart templates" list at the top of Library → Templates
 *
 * Templates are governed content (data/seed/smart-templates.json). Documents are the learner's own data, saved on this device
 * only (cia:v1:<user>:smart_documents) and never published. Every value is rendered as text; exports escape their own syntax.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, openDialog, toast } from '../ui/components.js';
import { L, linkBtn, notAvailable, setHashQuery, previewBanner } from '../ui/academy.js';
import { BookmarkButton } from '../ui/bookmark.js';
import { courseCover } from '../ui/art.js';
import { academyByKey } from '../domain/academies.mjs';
import { newDocument, emptyRow, cleanDocInput, validateAnswers, validateRows, computeRow, assemble, docProgress, saveVersion, restoreVersion, diffVersions,
  toCsv, toSpreadsheetXml, toWordHtml, toJsonBackup, importBackup, exportName, DOC_LABEL, MAX_ROWS } from '../domain/templates.mjs';

export const templateHref = tpl => `#/templates/${tpl.slug}`;
const newId = () => `DOC-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const loadTemplates = ctx => ctx.repos.smartTemplates.listVisible(ctx.session.roles).catch(() => []);
const draftBadge = (ctx, x) => x.governance?.content_status !== 'published' ? Badge({ label: ctx.t('lab11.preview'), tone: 'warn' }) : null;

function save(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------------ Library → Templates */

export function smartTemplateCard(ctx, tpl, docs = []) {
  const { t, i18n } = ctx;
  const mine = docs.filter(d => d.template_id === tpl.id);
  return h('article', { class: 'card lab-card tpl-card', dataset: { template: tpl.id } },
    h('div', { class: 'lab-cover' }, courseCover({ id: tpl.id, code: tpl.slug }, { family: academyByKey(tpl.academy)?.family || 'iso', topic: tpl.cover, compact: true })),
    h('div', { class: 'lab-card-body' },
      h('p', { class: 'eyebrow' }, icon('doc'), ' ', t('tpl11.eyebrow')),
      h('h3', null, h('a', { href: templateHref(tpl), dataset: { action: 'open-template' } }, L(ctx, tpl.title))),
      h('p', { class: 'note' }, L(ctx, tpl.summary)),
      h('p', { class: 'lab-meta' }, t('tpl11.questionsN', { n: i18n.number(tpl.questions.length) }), ' · ', t('tpl11.columnsN', { n: i18n.number(tpl.table.columns.length) }),
        mine.length ? [' · ', Badge({ label: t('tpl11.myDocsN', { n: i18n.number(mine.length) }), tone: 'info' })] : null, ' ', draftBadge(ctx, tpl))));
}

export function smartTemplatesBlock(ctx) {
  const { t } = ctx;
  return dataRegion({ t, load: async () => ({ tpls: await loadTemplates(ctx), docs: await ctx.repos.smartDocs.list().catch(() => []) }), render: ({ tpls, docs }) => tpls.length
    ? h('section', { class: 'section smart-templates', 'aria-labelledby': 'st11-h', dataset: { smartTemplates: String(tpls.length) } },
      h('h2', { id: 'st11-h' }, icon('doc'), ' ', t('tpl11.blockTitle')), h('p', { class: 'note' }, t('tpl11.blockBody')),
      h('div', { class: 'cards lab-cards' }, tpls.map(x => smartTemplateCard(ctx, x, docs))))
    : h('div', { hidden: true }) });
}

/* ------------------------------------------------------------------ #/templates/:slug */

export function templateView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: async () => {
    const tpls = await loadTemplates(ctx);
    const tpl = tpls.find(x => x.slug === match.params.slug) || null;
    const docs = tpl ? (await ctx.repos.smartDocs.list().catch(() => [])).filter(d => d.template_id === tpl.id) : [];
    const labs = tpl && ctx.repos.labsIndex ? await ctx.repos.labsIndex.listVisible(ctx.session.roles).catch(() => []) : [];
    return { tpl, docs, labs };
  }, render: ({ tpl, docs, labs }) => {
    if (!tpl) return notAvailable(ctx, { title: t('tpl11.notFound'), body: t('tpl11.notFoundBody'), action: linkBtn('#/library?tab=templates', t('nav.items.library')) });
    ctx.setTrail?.([{ label: t('nav.items.library'), href: '#/library?tab=templates' }], L(ctx, tpl.title));
    return templatePage(ctx, tpl, docs, labs, match, region);
  } });
  return h('div', { class: 'tpl-page' }, region);
}

function templatePage(ctx, tpl, docs, labs, match, region) {
  const { t, i18n } = ctx;
  const hero = h('header', { class: 'lab-hero tpl-hero' },
    h('div', { class: 'lab-hero-cover' }, courseCover({ id: tpl.id, code: tpl.slug }, { family: academyByKey(tpl.academy)?.family || 'iso', topic: tpl.cover, code: 'TPL' })),
    h('div', { class: 'lab-hero-text' },
      h('p', { class: 'eyebrow' }, icon('doc'), ' ', t('tpl11.eyebrow'), ' ', draftBadge(ctx, tpl)),
      h('h1', null, L(ctx, tpl.title)), h('p', null, L(ctx, tpl.summary)),
      h('div', { class: 'btnrow' }, BookmarkButton(ctx, { type: 'template', id: tpl.id, href: templateHref(tpl), title: tpl.title }))));
  const label = h('p', { class: 'banner banner-info', role: 'note', dataset: { docLabel: 'true' } }, icon('shield'), ' ', L(ctx, DOC_LABEL));
  const howTo = h('ol', { class: 'tpl-steps', 'aria-label': t('tpl11.howLabel') }, ['q', 'table', 'review', 'export', 'history'].map(k => h('li', null, t('tpl11.how.' + k))));
  const relLabs = (tpl.labs || []).map(id => labs.find(l => l.id === id)).filter(Boolean);
  const practice = relLabs.length ? h('p', { class: 'note' }, icon('flask'), ' ', t('tpl11.practise'), ' ', relLabs.map((l, i) => [i ? ' · ' : '', h('a', { href: `#/labs/${l.slug}` }, L(ctx, l.title))])) : null;

  const host = h('div', { class: 'tpl-host' });
  const list = () => {
    const sorted = [...docs].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return h('section', { class: 'section tpl-docs', 'aria-labelledby': 'tpl-docs-h', dataset: { docs: String(docs.length) } },
      h('h2', { id: 'tpl-docs-h' }, icon('layers'), ' ', t('tpl11.myDocs')),
      sorted.length ? h('ul', { class: 'plain tpl-doc-list' }, sorted.map(d => { const p = docProgress(tpl, d);
        return h('li', { dataset: { doc: d.id } }, h('a', { href: `${templateHref(tpl)}?doc=${encodeURIComponent(d.id)}`, onclick: e => { e.preventDefault(); open(d.id); }, dataset: { action: 'open-doc' } }, d.title || L(ctx, tpl.doc_title)),
          ' ', h('span', { class: 'note' }, d.version ? t('tpl11.versionN', { n: i18n.number(d.version) }) : t('tpl11.unsaved'), ' · ', i18n.date(new Date(d.updated_at), { dateStyle: 'medium' }), ' · ',
            t('tpl11.progressLine', { a: i18n.number(p.answered), q: i18n.number(p.questions), r: i18n.number(p.rows) })), ' ',
          Button({ label: t('tpl11.delete'), variant: 'quiet', attrs: { 'data-action': 'delete-doc', 'aria-label': t('tpl11.deleteNamed', { name: d.title || L(ctx, tpl.doc_title) }) }, onClick: () => confirmDelete(d) })); }))
        : h('p', { class: 'note', dataset: { empty: 'docs' } }, t('tpl11.noDocs')),
      h('div', { class: 'btnrow' }, Button({ label: t('tpl11.new'), variant: 'primary', iconName: 'doc', attrs: { 'data-action': 'new-doc' }, onClick: async () => {
        const d = newDocument(tpl, { id: newId() }); await ctx.repos.smartDocs.save(d); docs.push(d); open(d.id); } }),
        importButton()));
  };
  const importButton = () => {
    const inp = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'tpl-import', tabindex: '-1', 'aria-hidden': 'true', onchange: async e => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const r = importBackup(tpl, JSON.parse(await f.text()), { id: newId() });
        if (r.error) { toast(t('tpl11.importErr.' + r.error)); return; }
        await ctx.repos.smartDocs.save(r.doc); docs.push(r.doc); toast(t('tpl11.imported')); open(r.doc.id);
      } catch { toast(t('tpl11.importErr.not_a_backup')); } finally { e.target.value = ''; }
    } });
    return h('span', null, h('button', { type: 'button', class: 'btn btn-secondary', dataset: { action: 'import-doc' }, onclick: () => inp.click() }, icon('upload'), ' ', t('tpl11.import')), inp);
  };
  const confirmDelete = d => openDialog({ title: t('tpl11.deleteTitle'), body: t('tpl11.deleteBody', { name: d.title || L(ctx, tpl.doc_title) }), actions: [
    { label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('tpl11.delete'), variant: 'danger', onClick: async () => { await ctx.repos.smartDocs.remove(d.id); docs.splice(docs.findIndex(x => x.id === d.id), 1); toast(t('tpl11.deleted')); showList(); } }] });
  const showList = () => { setHashQuery(`/templates/${tpl.slug}`, {}); host.replaceChildren(list()); };
  const open = id => {
    const d = docs.find(x => x.id === id);
    if (!d) { showList(); return; }
    setHashQuery(`/templates/${tpl.slug}`, { doc: id });
    host.replaceChildren(editor(ctx, tpl, d, { onBack: showList, onChange: nd => { const i = docs.findIndex(x => x.id === nd.id); docs[i] = nd; } }));
    host.querySelector('.tpl-editor h2')?.focus();
  };
  if (match.query?.doc && docs.some(d => d.id === match.query.doc)) open(match.query.doc); else host.replaceChildren(list());
  return h('div', { class: 'tpl' }, hero, label, previewBanner(ctx, [tpl]), howTo, practice, host);
}

/* ------------------------------------------------------------------ the editor */

function field(ctx, def, value, id, onInput) {
  const { t } = ctx;
  const common = { id, 'aria-describedby': `${id}-err${def.hint ? ' ' + id + '-hint' : ''}`, dataset: { field: def.id } };
  let control;
  if (def.type === 'textarea') control = h('textarea', { class: 'textarea', rows: 3, maxlength: 2000, ...common, oninput: e => onInput(e.target.value) }, value || '');
  else if (def.type === 'select') control = h('select', { class: 'select', ...common, onchange: e => onInput(e.target.value) }, h('option', { value: '' }, t('pf.choose')), def.options.map(o => h('option', { value: o.value, selected: o.value === value }, L(ctx, o.label))));
  else control = h('input', { class: 'input', type: def.type === 'date' ? 'date' : 'text', inputmode: def.type === 'number' ? 'decimal' : null, maxlength: def.max_length || 2000, value: value || '', ...common, oninput: e => onInput(e.target.value) });
  return h('div', { class: 'field' }, h('label', { for: id }, L(ctx, def.label), def.required ? ' *' : ''), def.hint ? h('span', { class: 'hint', id: `${id}-hint` }, L(ctx, def.hint)) : null, control,
    h('span', { class: 'err', id: `${id}-err`, 'aria-live': 'polite' }));
}

function editor(ctx, tpl, doc0, { onBack, onChange }) {
  const { t, i18n } = ctx;
  let doc = doc0;
  const work = { title: doc.title, answers: { ...doc.answers }, rows: (doc.rows || []).map(r => ({ ...r })) };
  if (!work.rows.length) work.rows.push(emptyRow(tpl));
  const status = h('p', { class: 'note tpl-status', role: 'status', 'aria-live': 'polite', dataset: { saved: 'idle' } });
  let timer = null;
  const autosave = () => { clearTimeout(timer); status.dataset.saved = 'pending'; timer = setTimeout(async () => {
    const c = cleanDocInput(tpl, work);
    doc = { ...doc, ...c, updated_at: new Date().toISOString() };
    try { await ctx.repos.smartDocs.save(doc); onChange(doc); status.dataset.saved = 'ok'; status.textContent = t('tpl11.autosaved'); } catch { status.dataset.saved = 'error'; status.textContent = t('tpl11.saveFailed'); }
    paintPreview();
  }, 350); };

  /* 1. questions */
  const titleIn = h('input', { class: 'input', id: 'tpl-title', maxlength: 200, value: work.title || '', placeholder: L(ctx, tpl.doc_title), oninput: e => { work.title = e.target.value; autosave(); } });
  const qSec = h('section', { class: 'section tpl-q', 'aria-labelledby': 'tpl-q-h' }, h('h2', { id: 'tpl-q-h', tabindex: '-1' }, h('span', { class: 'step-no' }, '1'), ' ', t('tpl11.stepQ')),
    h('div', { class: 'field' }, h('label', { for: 'tpl-title' }, t('tpl11.docTitle')), titleIn),
    tpl.sections.map(s => h('fieldset', { class: 'fs tpl-sec', dataset: { section: s.id } }, h('legend', null, L(ctx, s.title)),
      h('div', { class: 'formgrid' }, tpl.questions.filter(q => q.section === s.id).map(q => field(ctx, q, work.answers[q.id], `tq-${q.id}`, v => { work.answers[q.id] = v; autosave(); }))))));

  /* 2. register */
  const rowsBox = h('div', { class: 'tpl-rows' });
  const editable = tpl.table.columns.filter(c => c.type !== 'computed');
  const computedCols = tpl.table.columns.filter(c => c.type === 'computed');
  const paintRows = (focusRow = null) => {
    rowsBox.replaceChildren(...work.rows.map((r, i) => {
      const comp = computeRow(tpl, r);
      const out = h('p', { class: 'tpl-computed', 'aria-live': 'polite', dataset: { computed: String(i) } }, computedCols.map((c, j) => { const x = comp[c.id];
        return [j ? ' · ' : '', h('strong', null, L(ctx, c.label)), ': ', x.value === null ? '—' : (x.label ? L(ctx, x.label) + ` (${i18n.number(x.value)})` : i18n.number(x.value))]; }));
      const refresh = () => { const cmp = computeRow(tpl, r); out.replaceChildren(...computedCols.map((c, j) => { const x = cmp[c.id];
        return [j ? ' · ' : '', h('strong', null, L(ctx, c.label)), ': ', x.value === null ? '—' : (x.label ? L(ctx, x.label) + ` (${i18n.number(x.value)})` : i18n.number(x.value))]; }).flat()); };
      return h('fieldset', { class: 'fs tpl-row', dataset: { row: String(i) } }, h('legend', null, t('tpl11.rowN', { n: i18n.number(i + 1) })),
        h('div', { class: 'formgrid' }, editable.map(c => field(ctx, c, r[c.id], `tr-${i}-${c.id}`, v => { r[c.id] = v; refresh(); autosave(); }))),
        computedCols.length ? out : null,
        h('div', { class: 'btnrow' }, Button({ label: t('tpl11.removeRow'), variant: 'quiet', attrs: { 'data-action': 'remove-row', 'aria-label': t('tpl11.removeRowN', { n: i18n.number(i + 1) }), disabled: work.rows.length <= 1 },
          onClick: () => { work.rows.splice(i, 1); paintRows(Math.max(0, i - 1)); autosave(); } })));
    }));
    if (focusRow !== null) rowsBox.querySelector(`[data-row="${focusRow}"] input, [data-row="${focusRow}"] select, [data-row="${focusRow}"] textarea`)?.focus();
  };
  paintRows();
  const tSec = h('section', { class: 'section tpl-t', 'aria-labelledby': 'tpl-t-h' }, h('h2', { id: 'tpl-t-h' }, h('span', { class: 'step-no' }, '2'), ' ', L(ctx, tpl.table.title)),
    tpl.guidance?.length ? h('ul', { class: 'note tpl-guide' }, tpl.guidance.map(g => h('li', null, icon('bulb'), ' ', L(ctx, g)))) : null,
    rowsBox, h('div', { class: 'btnrow' }, Button({ label: t('tpl11.addRow'), variant: 'secondary', attrs: { 'data-action': 'add-row' }, onClick: () => {
      if (work.rows.length >= MAX_ROWS) { toast(t('tpl11.maxRows', { n: i18n.number(MAX_ROWS) })); return; } work.rows.push(emptyRow(tpl)); paintRows(work.rows.length - 1); autosave(); } })));

  /* 3. preview */
  const preview = h('div', { class: 'tpl-preview', dataset: { preview: 'true' } });
  const paintPreview = () => preview.replaceChildren(renderAssembled(ctx, assemble(tpl, { ...doc, ...cleanDocInput(tpl, work) }, i18n.locale), true));
  paintPreview();
  const pSec = h('section', { class: 'section', 'aria-labelledby': 'tpl-p-h' }, h('h2', { id: 'tpl-p-h' }, h('span', { class: 'step-no' }, '3'), ' ', t('tpl11.stepReview')), preview);

  /* errors */
  const errBox = h('div', { class: 'errsum', tabindex: '-1', hidden: true, dataset: { errors: '0' } });
  const check = () => {
    const c = cleanDocInput(tpl, work);
    const qe = validateAnswers(tpl, c.answers); const re = validateRows(tpl, c.rows);
    document.querySelectorAll('.tpl-editor [aria-invalid="true"]').forEach(x => x.setAttribute('aria-invalid', 'false'));
    document.querySelectorAll('.tpl-editor .err').forEach(x => { x.textContent = ''; });
    const items = [];
    for (const [qid, code] of Object.entries(qe)) { const el = document.getElementById(`tq-${qid}`); el?.setAttribute('aria-invalid', 'true'); const er = document.getElementById(`tq-${qid}-err`); if (er) er.textContent = t('tpl11.err.' + code);
      items.push({ id: `tq-${qid}`, text: `${L(ctx, tpl.questions.find(q => q.id === qid).label)} — ${t('tpl11.err.' + code)}` }); }
    for (const e of re) {
      if (e.row < 0) { items.push({ id: null, text: t('tpl11.err.' + e.code, { n: i18n.number(tpl.table.min_rows) }) }); continue; }
      const id = `tr-${e.row}-${e.col}`; document.getElementById(id)?.setAttribute('aria-invalid', 'true'); const er = document.getElementById(id + '-err'); if (er) er.textContent = t('tpl11.err.' + e.code);
      items.push({ id, text: `${t('tpl11.rowN', { n: i18n.number(e.row + 1) })} · ${L(ctx, tpl.table.columns.find(c => c.id === e.col).label)} — ${t('tpl11.err.' + e.code)}` });
    }
    if (!items.length) { errBox.hidden = true; errBox.dataset.errors = '0'; return true; }
    errBox.hidden = false; errBox.dataset.errors = String(items.length);
    errBox.replaceChildren(h('p', null, h('strong', null, t('tpl11.errTitle', { n: i18n.number(items.length) }))),
      h('ul', null, items.slice(0, 12).map(x => h('li', null, x.id ? h('a', { href: '#' + x.id, onclick: ev => { ev.preventDefault(); document.getElementById(x.id)?.focus(); } }, x.text) : x.text))));
    errBox.focus();
    return false;
  };

  /* 4. export + save version */
  const noteIn = h('input', { class: 'input', id: 'tpl-note', maxlength: 200, placeholder: t('tpl11.notePh') });
  const saveBtn = Button({ label: t('tpl11.saveVersion'), variant: 'primary', iconName: 'check', attrs: { 'data-action': 'save-version' }, onClick: async () => {
    if (!check()) return;
    clearTimeout(timer);
    doc = saveVersion(tpl, doc, work, { note: noteIn.value });
    await ctx.repos.smartDocs.save(doc); onChange(doc); noteIn.value = '';
    status.dataset.saved = 'version'; status.textContent = t('tpl11.versionSaved', { n: i18n.number(doc.version) });
    toast(t('tpl11.versionSaved', { n: i18n.number(doc.version) })); paintHistory(); paintPreview();
  } });
  const exportAs = kind => {
    if (!check()) return;
    const cur = { ...doc, ...cleanDocInput(tpl, work) };
    const a = assemble(tpl, cur, i18n.locale);
    if (kind === 'csv') save(exportName(tpl, cur, 'csv'), toCsv(a), 'text/csv;charset=utf-8');
    else if (kind === 'xls') save(exportName(tpl, cur, 'xls'), toSpreadsheetXml(a), 'application/vnd.ms-excel');
    else if (kind === 'doc') save(exportName(tpl, cur, 'doc'), '﻿' + toWordHtml(a), 'application/msword');
    else if (kind === 'json') save(exportName(tpl, cur, 'json'), JSON.stringify(toJsonBackup(tpl, cur), null, 2), 'application/json');
    toast(t('tpl11.exported'));
  };
  const eSec = h('section', { class: 'section tpl-e', 'aria-labelledby': 'tpl-e-h' }, h('h2', { id: 'tpl-e-h' }, h('span', { class: 'step-no' }, '4'), ' ', t('tpl11.stepExport')),
    h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: 'tpl-note' }, t('tpl11.note')), noteIn)),
    h('div', { class: 'btnrow' }, saveBtn),
    h('p', { class: 'note' }, t('tpl11.exportNote')),
    h('div', { class: 'btnrow tpl-exports' },
      Button({ label: t('tpl11.exp.csv'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'export-csv' }, onClick: () => exportAs('csv') }),
      Button({ label: t('tpl11.exp.xls'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'export-xls' }, onClick: () => exportAs('xls') }),
      Button({ label: t('tpl11.exp.doc'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'export-doc' }, onClick: () => exportAs('doc') }),
      linkBtn(`#/templates/${tpl.slug}/print?doc=${encodeURIComponent(doc.id)}`, t('tpl11.exp.print'), 'secondary', { 'data-action': 'export-print', onclick: e => { if (!check()) e.preventDefault(); } }),
      Button({ label: t('tpl11.exp.json'), variant: 'quiet', iconName: 'download', attrs: { 'data-action': 'export-json' }, onClick: () => exportAs('json') })));

  /* 5. history */
  const hist = h('div', { class: 'tpl-history', dataset: { history: '0' } });
  const paintHistory = () => {
    const hs = [...(doc.history || [])].reverse();
    hist.dataset.history = String(hs.length);
    hist.replaceChildren(hs.length ? h('ol', { class: 'plain tpl-versions', reversed: true }, hs.map((v, i) => { const prev = hs[i + 1]; const df = diffVersions(prev, v);
      return h('li', { dataset: { version: String(v.version) } }, h('strong', null, t('tpl11.versionN', { n: i18n.number(v.version) })), ' · ', i18n.date(new Date(v.saved_at), { dateStyle: 'medium', timeStyle: 'short' }),
        v.note ? [' · ', h('em', null, v.note)] : null,
        prev ? h('span', { class: 'note block' }, t('tpl11.diff', { q: i18n.number(df.questions.length), r: i18n.number(Math.abs(df.rows)) })) : null,
        v.version !== doc.version ? Button({ label: t('tpl11.restore'), variant: 'quiet', attrs: { 'data-action': 'restore-version', 'aria-label': t('tpl11.restoreN', { n: i18n.number(v.version) }) }, onClick: async () => {
          const nd = restoreVersion(tpl, doc, v.version, { note: t('tpl11.restoredNote', { n: v.version }) }); if (!nd) return;
          doc = nd; await ctx.repos.smartDocs.save(doc); onChange(doc);
          const fresh = editor(ctx, tpl, doc, { onBack, onChange }); root.replaceWith(fresh); toast(t('tpl11.restored', { n: i18n.number(v.version) })); fresh.querySelector('.tpl-history')?.scrollIntoView({ block: 'center' }); } }) : Badge({ label: t('tpl11.current'), tone: 'neutral' })); }))
      : h('p', { class: 'note', dataset: { empty: 'history' } }, t('tpl11.noHistory')));
  };
  paintHistory();
  const hSec = h('section', { class: 'section', 'aria-labelledby': 'tpl-h-h' }, h('h2', { id: 'tpl-h-h' }, h('span', { class: 'step-no' }, '5'), ' ', t('tpl11.stepHistory')), hist,
    doc.dropped_versions ? h('p', { class: 'note' }, t('tpl11.dropped', { n: i18n.number(doc.dropped_versions) })) : null);

  const root = h('div', { class: 'tpl-editor', dataset: { doc: doc.id } },
    h('div', { class: 'btnrow' }, Button({ label: t('tpl11.back'), variant: 'quiet', attrs: { 'data-action': 'back-to-docs' }, onClick: onBack }), status),
    errBox, qSec, tSec, pSec, eSec, hSec);
  return root;
}

/** The assembled document as DOM (text nodes only). */
export function renderAssembled(ctx, a, compact = false) {
  const { t } = ctx;
  const sec = s => h('section', { class: 'doc-sec' }, h(compact ? 'h3' : 'h2', null, s.title),
    h('dl', { class: 'facts' }, s.fields.map(f => h('div', null, h('dt', null, f.label), h('dd', { class: f.long ? 'pre' : null }, f.value || '—')))));
  return h('article', { class: 'doc-assembled', lang: a.lang, dir: a.dir },
    h(compact ? 'h3' : 'h1', { class: 'doc-title' }, a.title), h('p', { class: 'note' }, a.label),
    a.sections.map(sec),
    h(compact ? 'h3' : 'h2', null, a.table.title),
    a.table.rows.length ? h('div', { class: 'tbl-wrap', tabindex: '0', role: 'group', 'aria-label': a.table.title }, h('table', { class: 'tbl' }, h('caption', { class: 'sr-only' }, a.table.title),
      h('thead', null, h('tr', null, a.table.columns.map(c => h('th', { scope: 'col' }, c)))), h('tbody', null, a.table.rows.map(r => h('tr', null, r.map(c => h('td', null, c)))))))
      : h('p', { class: 'note' }, t('tpl11.noRows')),
    h('p', { class: 'note' }, a.template_title, ' · ', t('tpl11.versionN', { n: ctx.i18n.number(a.version || 0) })));
}

/* ------------------------------------------------------------------ print view */

export function templatePrintView(ctx, match) {
  const { t } = ctx;
  const region = dataRegion({ t, load: async () => {
    const tpl = (await loadTemplates(ctx)).find(x => x.slug === match.params.slug) || null;
    const doc = tpl ? await ctx.repos.smartDocs.get(match.query?.doc || '').catch(() => null) : null;
    return { tpl, doc: doc && doc.template_id === tpl?.id ? doc : null };
  }, render: ({ tpl, doc }) => {
    if (!tpl || !doc) return notAvailable(ctx, { title: t('tpl11.printMissing'), body: t('tpl11.printMissingBody'), action: linkBtn(tpl ? templateHref(tpl) : '#/library?tab=templates', t('tpl11.back')) });
    ctx.setTrail?.([{ label: t('nav.items.library'), href: '#/library?tab=templates' }, { label: L(ctx, tpl.title), href: templateHref(tpl) }], t('tpl11.printTitle'));
    return h('div', { class: 'tpl-print' },
      h('div', { class: 'btnrow no-print' }, linkBtn(`${templateHref(tpl)}?doc=${encodeURIComponent(doc.id)}`, t('tpl11.back')),
        Button({ label: t('tpl11.printBtn'), variant: 'primary', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print' } })),
      h('p', { class: 'note no-print' }, t('tpl11.printHint')),
      renderAssembled(ctx, assemble(tpl, doc, ctx.i18n.locale)));
  } });
  return h('div', null, region);
}
