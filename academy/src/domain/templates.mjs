/**
 * Smart guided templates (Phase 11, ADD-9, spec §19.1). Pure functions — no DOM, no storage.
 *   structured Q&A (questions) + a register / table (columns, rows) → assembled document → edit → export → version history.
 * A template is governed data (data/seed/smart-templates.json). A generated document is the learner's own data
 * (cia:v1:<user>:smart_documents) and is never published content.
 * Exports, all built in the browser without a server:
 *   CSV (UTF-8 with BOM so Excel shows Arabic) · Excel 2003 XML spreadsheet (.xls, two sheets, right-to-left in Arabic)
 *   · Word-compatible HTML (.doc) · print view (the browser's "Save as PDF") · JSON backup.
 * Every export escapes its own syntax; CSV and spreadsheet cells starting with = + - @ are neutralised (formula injection).
 * Spec: SMART_TEMPLATES_SPEC.md. © 2026 Modather Salama — Continual Improvement Academy.
 */
export const TEMPLATE_SCHEMA = 'cia.smart-template.v1';
export const DOC_SCHEMA = 'cia.smart-doc.v1';
export const FIELD_TYPES = ['text', 'textarea', 'select', 'date', 'number'];
export const COLUMN_TYPES = ['text', 'textarea', 'select', 'number', 'date', 'computed'];
export const COMPUTE_OPS = ['product', 'sum', 'gap', 'band'];
export const EXPORTS = ['csv', 'xls', 'doc', 'print', 'json'];
export const MAX_ROWS = 200;
export const MAX_HISTORY = 25;
export const MAX_TEXT = 2000;
export const DOC_LABEL = {
  en: 'Your own document, generated with a CIA smart template on this device. It becomes a controlled document only when your organisation reviews and adopts it.',
  ar: 'مستندك الخاص، أُنشئ بقالب ذكي من الأكاديمية على هذا الجهاز. ولا يصبح مستندًا مضبوطًا إلا عندما تراجعه منظمتك وتعتمده.'
};

const bi = v => !!(v && typeof v.en === 'string' && v.en.trim() && typeof v.ar === 'string' && v.ar.trim());
const uniq = a => [...new Set(a)];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = s => ISO_DATE.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const L = (v, lang) => (typeof v === 'string' ? v : v?.[lang] || v?.en || v?.ar || '');
const toNum = v => {
  const s = String(v ?? '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/,/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

/* ------------------------------------------------------------------ template validation */

export function validateTemplate(tpl) {
  const e = [];
  const t = tpl || {};
  if (typeof t.id !== 'string' || !/^TPL-[A-Z0-9-]+$/.test(t.id)) e.push('bad_id');
  if (typeof t.slug !== 'string' || !/^[a-z0-9-]+$/.test(t.slug)) e.push('bad_slug');
  for (const k of ['title', 'summary', 'doc_title']) if (!bi(t[k])) e.push(k + '_not_bilingual');
  const sections = Array.isArray(t.sections) ? t.sections : [];
  if (!sections.length) e.push('no_sections');
  if (sections.some(s => !bi(s.title) || typeof s.id !== 'string')) e.push('section_not_bilingual');
  const qs = Array.isArray(t.questions) ? t.questions : [];
  if (qs.length < 3) e.push('too_few_questions');
  if (new Set(qs.map(q => q.id)).size !== qs.length) e.push('duplicate_question');
  for (const q of qs) {
    if (!/^[a-z][a-z0-9_]*$/.test(q.id || '')) e.push('bad_question_id');
    if (!FIELD_TYPES.includes(q.type)) e.push('bad_field_type:' + q.id);
    if (!bi(q.label)) e.push('question_not_bilingual:' + q.id);
    if (q.hint && !bi(q.hint)) e.push('hint_not_bilingual:' + q.id);
    if (!sections.some(s => s.id === q.section)) e.push('question_without_section:' + q.id);
    if (q.type === 'select' && (!Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => !bi(o.label) || typeof o.value !== 'string'))) e.push('bad_options:' + q.id);
  }
  const tb = t.table;
  if (!tb || !bi(tb.title) || !Array.isArray(tb.columns) || tb.columns.length < 3) e.push('table_incomplete');
  else {
    const ids = tb.columns.map(c => c.id);
    if (new Set(ids).size !== ids.length) e.push('duplicate_column');
    for (const c of tb.columns) {
      if (!/^[a-z][a-z0-9_]*$/.test(c.id || '')) e.push('bad_column_id');
      if (!COLUMN_TYPES.includes(c.type)) e.push('bad_column_type:' + c.id);
      if (!bi(c.label)) e.push('column_not_bilingual:' + c.id);
      if (c.type === 'select' && (!Array.isArray(c.options) || c.options.length < 2 || c.options.some(o => !bi(o.label) || typeof o.value !== 'string'))) e.push('bad_options:' + c.id);
      if (c.type === 'computed') {
        const f = c.compute || {};
        if (!COMPUTE_OPS.includes(f.op)) e.push('bad_compute:' + c.id);
        const src = f.op === 'band' ? [f.of] : f.of;
        if (!Array.isArray(src) || !src.length || src.some(s => !ids.includes(s) || s === c.id)) e.push('compute_source_unknown:' + c.id);
        if (f.op === 'band' && (!Array.isArray(f.bands) || !f.bands.length || f.bands.some(b => !bi(b.label) || typeof b.max !== 'number'))) e.push('bad_bands:' + c.id);
        if (f.op === 'gap' && (f.of || []).length !== 2) e.push('gap_needs_two:' + c.id);
      }
    }
    if (!(Number.isInteger(tb.min_rows) && tb.min_rows >= 1)) e.push('bad_min_rows');
  }
  if (!Array.isArray(t.exports) || !t.exports.length || t.exports.some(x => !EXPORTS.includes(x))) e.push('bad_exports');
  return uniq(e);
}

/* ------------------------------------------------------------------ documents */

export function newDocument(tpl, { id, now = new Date().toISOString() } = {}) {
  const rows = Array.from({ length: tpl.table?.min_rows || 1 }, () => emptyRow(tpl));
  return { id: id || `DOC-${Date.parse(now).toString(36)}`, schema: DOC_SCHEMA, template_id: tpl.id, template_version: tpl.governance?.version || null,
    title: '', answers: {}, rows, version: 0, created_at: now, updated_at: now, history: [] };
}

export const emptyRow = tpl => Object.fromEntries((tpl.table?.columns || []).filter(c => c.type !== 'computed').map(c => [c.id, '']));

const clip = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX_TEXT);

/** Keep only known fields, as trimmed strings; computed columns are never stored (they are recalculated). */
export function cleanDocInput(tpl, { title = '', answers = {}, rows = [] } = {}) {
  const qa = {};
  for (const q of tpl.questions || []) qa[q.id] = clip(answers[q.id]).trim();
  const cols = (tpl.table?.columns || []).filter(c => c.type !== 'computed');
  const rs = (Array.isArray(rows) ? rows : []).slice(0, MAX_ROWS).map(r => Object.fromEntries(cols.map(c => [c.id, clip(r?.[c.id]).trim()])));
  return { title: clip(title).trim().slice(0, 200), answers: qa, rows: rs };
}

function checkValue(def, v) {
  if (v === '' || v == null) return def.required ? 'required' : '';
  if (def.type === 'number' && toNum(v) === null) return 'number';
  if (def.type === 'number' && def.min != null && toNum(v) < def.min) return 'range';
  if (def.type === 'number' && def.max != null && toNum(v) > def.max) return 'range';
  if (def.type === 'date' && !isDate(v)) return 'date';
  if (def.type === 'select' && !def.options.some(o => o.value === v)) return 'option';
  if (String(v).length > (def.max_length || MAX_TEXT)) return 'long';
  return '';
}

/** Problems in the questions: { questionId: code } (empty = fine). */
export function validateAnswers(tpl, answers = {}) {
  const out = {};
  for (const q of tpl.questions || []) { const c = checkValue(q, answers[q.id]); if (c) out[q.id] = c; }
  return out;
}

/** Problems in the table: [{ row, col, code }]. A row with every cell empty is ignored; at least min_rows filled rows. */
export function validateRows(tpl, rows = []) {
  const cols = (tpl.table?.columns || []).filter(c => c.type !== 'computed');
  const out = [];
  const filled = rows.filter(r => cols.some(c => String(r?.[c.id] ?? '').trim()));
  rows.forEach((r, i) => {
    if (!cols.some(c => String(r?.[c.id] ?? '').trim())) return;
    for (const c of cols) { const code = checkValue(c, r?.[c.id]); if (code) out.push({ row: i, col: c.id, code }); }
  });
  if (filled.length < (tpl.table?.min_rows || 1)) out.push({ row: -1, col: null, code: 'min_rows' });
  if (rows.length > MAX_ROWS) out.push({ row: -1, col: null, code: 'max_rows' });
  return out;
}

/** Computed cells of one row: { colId: { value, label } }. Missing inputs give an empty value, never a guess. */
export function computeRow(tpl, row = {}) {
  const out = {};
  const val = id => { if (id in out) return out[id].value; return toNum(row[id]); };
  for (const c of (tpl.table?.columns || []).filter(x => x.type === 'computed')) {
    const f = c.compute; let value = null, label = '';
    if (f.op === 'product' || f.op === 'sum') {
      const xs = f.of.map(val);
      if (xs.every(x => x !== null)) value = f.op === 'product' ? xs.reduce((a, b) => a * b, 1) : xs.reduce((a, b) => a + b, 0);
    } else if (f.op === 'gap') {
      const [a, b] = f.of.map(val);
      if (a !== null && b !== null) value = Math.max(0, a - b);
    } else if (f.op === 'band') {
      const x = val(f.of);
      if (x !== null) { const b = f.bands.find(z => x <= z.max) || f.bands.at(-1); value = x; label = b.label; }
    }
    out[c.id] = { value, label };
  }
  return out;
}

const optLabel = (def, v, lang) => (def.options || []).find(o => o.value === v)?.label;

/**
 * The assembled document in one language: title, document facts, sections of answered questions and the table with
 * computed cells resolved. Every value is plain text; callers escape for their output format.
 */
export function assemble(tpl, doc, lang = 'en') {
  const qv = q => { const v = doc.answers?.[q.id] ?? ''; return q.type === 'select' ? L(optLabel(q, v), lang) || v : v; };
  const sections = (tpl.sections || []).map(s => ({ id: s.id, title: L(s.title, lang),
    fields: (tpl.questions || []).filter(q => q.section === s.id).map(q => ({ id: q.id, label: L(q.label, lang), value: qv(q), long: q.type === 'textarea' })) }));
  const cols = tpl.table.columns;
  const rows = (doc.rows || []).filter(r => cols.some(c => c.type !== 'computed' && String(r?.[c.id] ?? '').trim())).map(r => {
    const comp = computeRow(tpl, r);
    return cols.map(c => {
      if (c.type === 'computed') { const x = comp[c.id]; return x.value === null ? '' : (x.label ? L(x.label, lang) : String(x.value)); }
      const v = r[c.id] ?? '';
      return c.type === 'select' ? L(optLabel(c, v), lang) || v : String(v);
    });
  });
  return {
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', template: tpl.id, template_title: L(tpl.title, lang),
    title: doc.title || L(tpl.doc_title, lang), version: doc.version, updated_at: doc.updated_at, label: L(DOC_LABEL, lang),
    sections, table: { title: L(tpl.table.title, lang), columns: cols.map(c => L(c.label, lang)), rows }
  };
}

/** Completeness for the progress line: answered questions and filled rows. */
export function docProgress(tpl, doc) {
  const qs = tpl.questions || [];
  const answered = qs.filter(q => String(doc.answers?.[q.id] ?? '').trim()).length;
  const required = qs.filter(q => q.required);
  const reqDone = required.filter(q => String(doc.answers?.[q.id] ?? '').trim()).length;
  const cols = (tpl.table?.columns || []).filter(c => c.type !== 'computed');
  const rows = (doc.rows || []).filter(r => cols.some(c => String(r?.[c.id] ?? '').trim())).length;
  return { answered, questions: qs.length, required: required.length, requiredDone: reqDone, rows, ready: reqDone === required.length && rows >= (tpl.table?.min_rows || 1) };
}

/* ------------------------------------------------------------------ version history */

const snapshot = d => ({ title: d.title, answers: { ...d.answers }, rows: d.rows.map(r => ({ ...r })) });

/**
 * Save a new version. The document keeps its id; `history` holds every saved version (newest last, capped at MAX_HISTORY
 * — the oldest are dropped first and the count is kept in `dropped_versions`).
 */
export function saveVersion(tpl, doc, input, { note = '', now = new Date().toISOString() } = {}) {
  const c = cleanDocInput(tpl, input);
  const version = (doc.version || 0) + 1;
  const entry = { version, saved_at: now, note: clip(note).trim().slice(0, 200), ...snapshot({ ...doc, ...c }) };
  let history = [...(doc.history || []), entry];
  let dropped = doc.dropped_versions || 0;
  if (history.length > MAX_HISTORY) { dropped += history.length - MAX_HISTORY; history = history.slice(-MAX_HISTORY); }
  return { ...doc, ...c, version, updated_at: now, history, dropped_versions: dropped };
}

/** Restore an earlier version as a NEW version (history is never rewritten). Returns null when the version is unknown. */
export function restoreVersion(tpl, doc, version, { now = new Date().toISOString(), note } = {}) {
  const h = (doc.history || []).find(x => x.version === version);
  if (!h) return null;
  return saveVersion(tpl, doc, snapshot(h), { now, note: note ?? `restored v${version}` });
}

/** What changed between two versions: question ids and the row-count difference (for the history list). */
export function diffVersions(a, b) {
  if (!a || !b) return { questions: [], rows: 0, title: false };
  const ids = uniq([...Object.keys(a.answers || {}), ...Object.keys(b.answers || {})]);
  return { questions: ids.filter(k => (a.answers?.[k] || '') !== (b.answers?.[k] || '')), rows: (b.rows || []).length - (a.rows || []).length,
    title: (a.title || '') !== (b.title || ''), cells: JSON.stringify(a.rows) !== JSON.stringify(b.rows) };
}

/* ------------------------------------------------------------------ exports */

/** Neutralise spreadsheet formulas: a value starting with = + - @ (or a tab / CR) gets a leading apostrophe. */
export const safeCell = v => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" + s : s; };
export const csvCell = v => { const s = safeCell(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const xmlEscape = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const htmlEscape = v => xmlEscape(v).replace(/&apos;/g, '&#39;');

/** CSV: document facts as "field,value" lines, a blank line, then the table. CRLF line ends, UTF-8 BOM. */
export function toCsv(a) {
  const lines = [[a.title], [a.label], []];
  for (const s of a.sections) { lines.push([s.title]); for (const f of s.fields) lines.push([f.label, f.value]); lines.push([]); }
  lines.push([a.table.title]); lines.push(a.table.columns); for (const r of a.table.rows) lines.push(r);
  return '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Excel 2003 XML spreadsheet (opens in Excel and LibreOffice as .xls): sheet 1 the document, sheet 2 the register. */
export function toSpreadsheetXml(a) {
  const cell = (v, style) => {
    const s = String(v ?? '');
    const num = /^-?\d+(\.\d+)?$/.test(s) && s.length < 15;
    return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${num ? 'Number' : 'String'}">${xmlEscape(num ? s : safeCell(s))}</Data></Cell>`;
  };
  const row = (cells, style) => `<Row>${cells.map(c => cell(c, style)).join('')}</Row>`;
  const opts = a.dir === 'rtl' ? '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/></WorksheetOptions>' : '';
  const sheet = (name, rows) => `<Worksheet ss:Name="${xmlEscape(name).slice(0, 31)}"><Table>${rows.join('')}</Table>${opts}</Worksheet>`;
  const docRows = [row([a.title], 'h'), row([a.label], 'n')];
  for (const s of a.sections) { docRows.push(row([s.title], 'h')); for (const f of s.fields) docRows.push(row([f.label, f.value])); }
  const regRows = [row([a.table.title], 'h'), row(a.table.columns, 'th'), ...a.table.rows.map(r => row(r))];
  const names = a.lang === 'ar' ? ['المستند', 'السجل'] : ['Document', 'Register'];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
    + '<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Size="12"/></Style><Style ss:ID="th"><Font ss:Bold="1"/><Interior ss:Color="#E8E2D2" ss:Pattern="Solid"/></Style><Style ss:ID="n"><Font ss:Italic="1"/></Style></Styles>'
    + sheet(names[0], docRows) + sheet(names[1], regRows) + '</Workbook>\n';
}

/** Word-compatible HTML (.doc) — also the body of the print view. Right-to-left in Arabic. */
export function toWordHtml(a, { forPrint = false } = {}) {
  const field = f => f.long ? `<h3>${htmlEscape(f.label)}</h3><p>${htmlEscape(f.value || '—').replace(/\n/g, '<br>')}</p>`
    : `<tr><th scope="row">${htmlEscape(f.label)}</th><td>${htmlEscape(f.value || '—')}</td></tr>`;
  const section = s => {
    const short = s.fields.filter(f => !f.long), long = s.fields.filter(f => f.long);
    return `<h2>${htmlEscape(s.title)}</h2>${short.length ? `<table class="facts">${short.map(field).join('')}</table>` : ''}${long.map(field).join('')}`;
  };
  const table = `<h2>${htmlEscape(a.table.title)}</h2><table class="reg"><thead><tr>${a.table.columns.map(c => `<th scope="col">${htmlEscape(c)}</th>`).join('')}</tr></thead><tbody>${a.table.rows.map(r => `<tr>${r.map(c => `<td>${htmlEscape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const css = `body{font-family:Calibri,Aptos,Arial,sans-serif;font-size:11pt;color:#0B1E3D}h1{font-family:Georgia,serif;font-size:18pt;border-bottom:2px solid #C6A15B}h2{font-family:Georgia,serif;font-size:13pt;margin-top:14pt}h3{font-size:11pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9AA3B2;padding:4pt;vertical-align:top;text-align:start}thead th{background:#E8E2D2}.facts th{width:32%;background:#F4F1EA}.note{font-style:italic;color:#555}`;
  const head = `<meta charset="utf-8"><title>${htmlEscape(a.title)}</title><style>${css}</style>`;
  const body = `<h1>${htmlEscape(a.title)}</h1><p class="note">${htmlEscape(a.label)}</p>${a.sections.map(section).join('')}${table}<p class="note">${htmlEscape(a.template_title)} · v${htmlEscape(a.version)}</p>`;
  if (forPrint) return body;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="${a.lang}" dir="${a.dir}"><head>${head}</head><body dir="${a.dir}">${body}</body></html>`;
}

/** JSON backup of one document (re-importable). */
export function toJsonBackup(tpl, doc, now = new Date().toISOString()) {
  return { app: 'cia-academy', schema: 'cia.smart-doc-export.v1', exported_at: now, template: { id: tpl.id, version: tpl.governance?.version || null }, document: doc };
}

/** Validate an imported backup for this template; returns a clean document or { error }. */
export function importBackup(tpl, data, { now = new Date().toISOString(), id } = {}) {
  if (!data || data.app !== 'cia-academy' || data.schema !== 'cia.smart-doc-export.v1') return { error: 'not_a_backup' };
  if (data.template?.id !== tpl.id || data.document?.template_id !== tpl.id) return { error: 'other_template' };
  const d = data.document;
  const base = newDocument(tpl, { id: id || d.id, now });
  const saved = saveVersion(tpl, base, { title: d.title, answers: d.answers, rows: d.rows }, { now, note: 'imported' });
  return { doc: saved };
}

/** File name for an export: slug, version and extension (ASCII only). */
export const exportName = (tpl, doc, ext) => `cia-${tpl.slug}-v${doc.version || 0}.${ext}`;
