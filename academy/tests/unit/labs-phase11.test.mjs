/**
 * Phase 11 — Practice Labs, smart templates and the certificate of completion.
 * Lab validator, scoring per task type (partial credit, "I don't know", numeric parsing), human-review items excluded from
 * evidence, attempt records, evidence rule inside the existing evidence model, template validation / assembly / export
 * (escaping, Arabic, formula injection), version history, split + search index include labs and templates, registry limits
 * unchanged, governance of published content, and the completion certificate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, OWNER } from './_util.mjs';
import { validateLab, validateTask, validateResponse, validateResponses, gradeTask, scoreLab, labCompetencyEvidence, makeLabAttempt, labEvidenceRows,
  labProgress, nextAttemptNo, parseNumber, pairAgreement, moveItem, shuffledIds, exportAttempt, labIndexRecord, LAB_UNKNOWN, LAB_AUTO_TYPES, LAB_EVIDENCE_MIN_ITEMS } from '../../src/domain/labs.mjs';
import { validateTemplate, newDocument, cleanDocInput, validateAnswers, validateRows, computeRow, assemble, saveVersion, restoreVersion, diffVersions, docProgress,
  toCsv, toSpreadsheetXml, toWordHtml, toJsonBackup, importBackup, csvCell, safeCell, xmlEscape, MAX_HISTORY } from '../../src/domain/templates.mjs';
import { assessmentEvidence } from '../../src/domain/learner-model.mjs';
import { validateGovernance } from '../../src/data/governance.js';
import { validateRegistry, shellEntries, MAX_MENU } from '../../src/nav/registry.js';
import { searchIndex } from '../../src/domain/search.mjs';
import { makeBookmark, BOOKMARK_TYPES } from '../../src/domain/academies.mjs';
import { issueCertificate, validateCertName, certificateEligibility, CERT_DISCLAIMER } from '../../src/domain/certificates.mjs';
import { build } from '../../tools/build_phase10a.mjs';

const LABS = json('data/seed/labs.json').items;
const TPLS = json('data/seed/smart-templates.json').items;
const COMPS = new Set(json('data/seed/competency/competencies.json').items.map(c => c.id));
const FIGS = json('data/seed/figures.json').items;
const COURSES = json('data/seed/courses.json').items;
const pub = r => r.governance.content_status === 'published';
const perfect = l => Object.fromEntries(l.tasks.map(t => [t.id, t.type === 'single_choice' ? t.correct : t.type === 'multi_select' ? t.options.filter(o => o.correct).map(o => o.id)
  : t.type === 'ordering' ? t.items.map(x => x.id) : t.type === 'classify' ? Object.fromEntries(t.items.map(x => [x.id, x.category])) : t.type === 'numeric' ? String(t.answer) : 'x'.repeat(t.min_chars + 5)]));
const AUDIT = LABS.find(l => l.id === 'LAB-AUDIT-SIM');

test('labs: 13 definitions (8 published + 5 governed drafts), all valid against real competencies, figures, courses, lessons and guide clauses', () => {
  const guides = {};
  for (const g of json('data/guides/index.json').items) guides[g.slug] = json(`data/guides/${g.slug}.json`).guide;
  const guideRefs = new Set(Object.entries(guides).flatMap(([s, g]) => g.clauses.flatMap(c => c.items.map(i => `${s}#${i.ref}`))));
  const lessons = new Set(COURSES.flatMap(c => (c.modules || []).flatMap(m => m.lessons.map(l => l.id))));
  const known = { competencies: COMPS, figures: new Set(FIGS.map(f => f.id)), courses: new Set(COURSES.map(c => c.id)), lessons, guideRefs };
  assert.equal(LABS.length, 13);
  assert.equal(LABS.filter(pub).length, 8);
  assert.deepEqual(LABS.filter(l => l.draft).map(l => l.id).sort(), ['LAB-AUDIT-PLAN', 'LAB-KPI-BUILDER', 'LAB-MGMT-REVIEW', 'LAB-PMO-DESIGN', 'LAB-SUPPLIER-AUDIT']);
  for (const l of LABS) assert.deepEqual(validateLab(l, known), [], l.id);
  for (const l of LABS.filter(x => x.draft)) assert.equal(l.governance.content_status, 'needs_review', l.id + ' must stay a draft');
  /* Spec §19 labs covered: the 8 published include the Audit Simulator with the expired-calibration scenario. */
  assert.match(AUDIT.scenario.context.map(c => c.en).join(' '), /calibration/i);
  assert.deepEqual(['LAB-AUDIT-SIM', 'LAB-NC-WRITE', 'LAB-EVIDENCE', 'LAB-CAPA', 'LAB-RCA', 'LAB-RISK', 'LAB-FMEA', 'LAB-PROJECT-RISK'].filter(id => LABS.find(l => l.id === id && pub(l))).length, 8);
});

test('lab validator rejects broken definitions', () => {
  const bad = structuredClone(AUDIT);
  bad.tasks[0].options.forEach(o => { o.correct = true; });
  bad.tasks[3].correct = 'zz';
  bad.tasks[8].rubric = [bad.tasks[8].rubric[0]];
  bad.academy = 'mars'; bad.figures = [];
  const e = validateLab(bad, { competencies: COMPS });
  for (const code of ['T1:needs_right_and_wrong_options', 'T4:correct_not_an_option', 'T9:rubric_missing', 'bad_academy', 'missing_figure']) assert.ok(e.includes(code), code + ' in ' + e);
  assert.ok(validateTask({ id: 'T1', type: 'free_text', review: 'auto', rubric: [], min_chars: 5, weight: 1, competency: 'X', prompt: { en: 'a', ar: 'ب' }, model_answer: { en: 'a', ar: 'ب' }, reasoning: { en: 'a', ar: 'ب' } }, ['X'])
    .includes('free_text_must_be_human_reviewed'));
  assert.ok(validateLab({ ...AUDIT, tasks: AUDIT.tasks.slice(0, 2) }).includes('too_few_tasks'));
});

test('scoring per task type: deterministic keys, partial credit, "I don\'t know", numeric parsing', () => {
  const ms = AUDIT.tasks[0]; // 3 right of 5
  const right = ms.options.filter(o => o.correct).map(o => o.id), wrong = ms.options.filter(o => !o.correct).map(o => o.id);
  assert.equal(gradeTask(ms, right).ratio, 1);
  assert.equal(gradeTask(ms, right.slice(0, 2)).ratio, 2 / 3);
  assert.equal(gradeTask(ms, [...right.slice(0, 2), wrong[0]]).ratio, 1 / 3);
  assert.equal(gradeTask(ms, wrong).ratio, 0);                       // never negative
  const sc = AUDIT.tasks[3];
  assert.equal(gradeTask(sc, sc.correct).earned, sc.weight);
  assert.equal(gradeTask(sc, sc.options.find(o => o.id !== sc.correct).id).earned, 0);
  const u = gradeTask(sc, LAB_UNKNOWN); assert.equal(u.unknown, true); assert.equal(u.earned, 0);
  const cl = AUDIT.tasks[4];
  const half = Object.fromEntries(cl.items.map((x, i) => [x.id, i % 2 ? x.category : cl.categories.find(c => c.id !== x.category).id]));
  assert.equal(gradeTask(cl, half).ratio, 0.5);
  const ord = AUDIT.tasks[7]; const key = ord.items.map(x => x.id);
  assert.equal(gradeTask(ord, key).ratio, 1);
  assert.equal(gradeTask(ord, [...key].reverse()).ratio, 0);
  assert.ok(Math.abs(gradeTask(ord, moveItem(key, 0, 1)).ratio - (1 - 1 / 15)) < 1e-9);
  assert.equal(gradeTask(ord, key.slice(1)).ratio, 0);              // not a permutation
  assert.equal(pairAgreement(['a', 'b', 'c'], ['a', 'c', 'b']), 2 / 3);
  const num = LABS.find(l => l.id === 'LAB-FMEA').tasks[0];
  for (const v of ['240', ' 240 ', '٢٤٠', '240.0', '240,0']) assert.equal(gradeTask(num, v).ratio, 1, v);
  for (const v of ['24', '2.4e2', 'abc']) assert.equal(gradeTask(num, v).ratio, 0, v);
  assert.equal(parseNumber('60,000'), 60000); assert.equal(parseNumber('٦٠٬٠٠٠'), 60000); assert.equal(parseNumber('12٫5'), 12.5); assert.equal(parseNumber('25%'), 25); assert.equal(parseNumber(''), null);
});

test('responses: every task needs an answer; invalid numbers, short text and partial sorting are reported; "I don\'t know" only on auto tasks', () => {
  const errs = validateResponses(AUDIT, {});
  assert.equal(errs.length, AUDIT.tasks.length);
  assert.equal(validateResponse(LABS.find(l => l.id === 'LAB-FMEA').tasks[0], '24o'), 'invalid_number');
  const free = AUDIT.tasks[8];
  assert.equal(validateResponse(free, 'too short'), 'too_short');
  assert.equal(validateResponse(free, LAB_UNKNOWN), 'required');
  assert.equal(validateResponse(free, 'x'.repeat(5000)), 'too_long');
  const cl = AUDIT.tasks[4];
  assert.equal(validateResponse(cl, { [cl.items[0].id]: cl.items[0].category }), 'incomplete');
  assert.equal(validateResponse(cl, LAB_UNKNOWN), '');
  assert.deepEqual(validateResponses(AUDIT, perfect(AUDIT)), []);
});

test('human-review items never count until reviewed; the evidence rule needs two scored tasks per competency', () => {
  const s = scoreLab(AUDIT, perfect(AUDIT));
  assert.equal(s.pending_review, 1); assert.equal(s.status, 'awaiting_review'); assert.equal(s.passed, false); assert.equal(s.mark_met, true);
  const freeMax = AUDIT.tasks.find(t => t.type === 'free_text').weight;
  assert.equal(s.max, AUDIT.tasks.reduce((a, t) => a + t.weight, 0) - freeMax, 'pending task is not in the denominator');
  const ev = labCompetencyEvidence(AUDIT, s.detail);
  assert.equal(ev.breakdown['AUD-03'].items, 4);            // T5–T8 auto; T9 pending is excluded
  assert.ok(!('ISO-01' in ev.breakdown), 'one scored task is too few');
  assert.deepEqual(ev.excluded.find(x => x.competency === 'ISO-01'), { competency: 'ISO-01', items: 1, pending: 0, reason: 'too_few_items' });
  /* Once a named reviewer scores the written task, it counts and the attempt can pass. */
  const reviewed = scoreLab(AUDIT, perfect(AUDIT), { T9: { score: 3, reviewer: 'Named Reviewer', date: '2026-11-12' } });
  assert.equal(reviewed.pending_review, 0); assert.equal(reviewed.passed, true);
  assert.equal(scoreLab(AUDIT, perfect(AUDIT), { T9: { score: 3, reviewer: '', date: '2026-11-12' } }).pending_review, 1, 'a review without a name is ignored');
  assert.equal(LAB_EVIDENCE_MIN_ITEMS, 2);
});

test('attempt records feed the existing evidence model: latest attempt per competency wins; self-check ticks are kept but never evidence', () => {
  const a1 = makeLabAttempt(AUDIT, perfect(AUDIT), { attemptNo: 1, now: '2026-11-12T08:00:00Z', selfCheck: { T9: ['R1', 'R2', 'R99'] } });
  assert.equal(a1.id, 'LAB-AUDIT-SIM#1'); assert.equal(a1.schema, 'cia.lab-attempt.v1'); assert.equal(a1.score, 100);
  assert.deepEqual(a1.self_check.T9, ['R1', 'R2']);
  const wrong = Object.fromEntries(AUDIT.tasks.map(t => [t.id, LAB_AUTO_TYPES.includes(t.type) ? LAB_UNKNOWN : 'x'.repeat(200)]));
  const a2 = makeLabAttempt(AUDIT, wrong, { attemptNo: 2, now: '2026-11-12T09:00:00Z' });
  assert.equal(a2.score, 0); assert.equal(a2.unknown, 8);
  const ev = assessmentEvidence(labEvidenceRows([a1, a2]));
  assert.equal(ev['AUD-02'].percent, 0, 'newest attempt replaces older evidence');
  assert.equal(ev['AUD-02'].assessment_id, 'LAB-AUDIT-SIM');
  assert.equal(nextAttemptNo([a1, a2], AUDIT.id), 3);
  assert.deepEqual(labEvidenceRows([{ schema: 'other', competency_breakdown: {} }]), []);
  const prog = labProgress([AUDIT], [a1, a2]);
  assert.equal(prog[0].attempts, 2); assert.equal(prog[0].best, 100); assert.equal(prog[0].passed, true);
  const exp = exportAttempt(AUDIT, a1, 'ar');
  assert.equal(exp.schema, 'cia.lab-attempt-export.v1'); assert.match(exp.label, /ليست شهادة/); assert.equal(exp.for_reviewer.length, 1);
  assert.equal(makeLabAttempt(AUDIT, { T9: 'y'.repeat(9000) }).answers.T9.length, 4000);
});

test('display helpers: deterministic shuffle never keeps the key order; moves are bounded; the light record hides keys and model answers', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(shuffledIds(ids, 's1'), shuffledIds(ids, 's1'));
  assert.notDeepEqual(shuffledIds(ids, 's1'), ids);
  assert.deepEqual(shuffledIds(ids, 'x').sort(), ids);
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b']);
  const light = labIndexRecord(AUDIT);
  assert.ok(!('tasks' in light)); assert.equal(light.task_count, AUDIT.tasks.length);
  assert.ok(!JSON.stringify(light).includes('model_answer'));
  assert.deepEqual(light.split, { academy: 'iso', full: false });
});

test('labs: honest labels and no claims; original wording; every task has a model answer and reasoning in both languages', () => {
  const claim = /(accredit|CPD|PDU|\bRU\b|certified auditor|EFQM assessment|audit certification)/i;
  for (const l of LABS) {
    assert.match(l.label.en, /not a certification/); assert.match(l.label.ar, /ليست شهادة/);
    for (const t of l.tasks) { assert.ok(t.model_answer.en && t.model_answer.ar && t.reasoning.en && t.reasoning.ar, `${l.id} ${t.id}`); }
    const text = JSON.stringify([l.title, l.summary, l.scenario, l.tasks.map(t => [t.prompt, t.model_answer])]);
    const m = text.match(claim); assert.equal(m, null, `${l.id}: ${m?.[0]}`);
    assert.doesNotMatch(text, /the organization shall/i);
  }
});

test('published labs, templates and figures carry the owner-approval record; drafts and their figures stay drafts', () => {
  const draftFigs = new Set(LABS.filter(l => l.draft).flatMap(l => l.figures));
  for (const r of [...LABS.filter(pub), ...TPLS, ...FIGS.filter(f => f.owner_phase === 11 && !draftFigs.has(f.id))]) {
    assert.deepEqual(validateGovernance(r), [], r.id);
    assert.equal(r.governance.content_status, 'published', r.id);
    assert.equal(r.governance.reviewer, OWNER); assert.equal(r.governance.review_date, '2026-11-12');
    assert.equal(r.governance.approval_basis, 'owner_approval_after_ai_prereview'); assert.equal(r.governance.drafted_by, 'ai_draft');
    assert.match(r.governance.approved_hash, /^[0-9a-f]{64}$/);
  }
  for (const f of FIGS.filter(x => draftFigs.has(x.id))) assert.equal(f.governance.content_status, 'needs_review', f.id);
  for (const l of LABS) assert.ok(json('data/seed/lesson-figures.json').items.some(e => e.id === 'lab:' + l.slug), l.slug);
});

test('smart templates: six types, valid, safe computed columns', () => {
  assert.deepEqual(TPLS.map(t => t.slug).sort(), ['audit-checklist', 'capa', 'ncr', 'quality-plan', 'risk-register', 'training-matrix']);
  for (const t of TPLS) assert.deepEqual(validateTemplate(t), [], t.id);
  const bad = structuredClone(TPLS[0]);
  bad.table.columns.find(c => c.type === 'computed').compute = { op: 'eval', of: ['l'] };
  bad.questions[0].label = { en: 'x', ar: '' };
  const e = validateTemplate(bad);
  assert.ok(e.some(x => x.startsWith('bad_compute')) && e.some(x => x.startsWith('question_not_bilingual')), String(e));
});

test('template documents: validation, computed score / band / gap, assembly in Arabic, progress', () => {
  const rr = TPLS.find(t => t.slug === 'risk-register');
  const doc = newDocument(rr, { id: 'DOC-1', now: '2026-11-12T08:00:00Z' });
  assert.equal(doc.rows.length, rr.table.min_rows); assert.equal(doc.version, 0);
  const errs = validateAnswers(rr, { date: '2026-02-30', appetite: 'nope' });
  assert.equal(errs.date, 'date'); assert.equal(errs.appetite, 'option'); assert.equal(errs.org, 'required');
  assert.deepEqual(validateRows(rr, [{}]).map(x => x.code), ['min_rows']);
  const row = { ref: 'R1', risk: 'Because…', owner: 'Ops', l: '4', c: '4' };
  assert.equal(validateRows(rr, [row]).length, 0);
  assert.deepEqual(computeRow(rr, row).score, { value: 16, label: '' });
  assert.equal(computeRow(rr, row).rating.label.en, 'High');
  assert.equal(computeRow(rr, { l: '5', c: '5' }).rating.label.en, 'Very high');
  assert.equal(computeRow(rr, { l: '4' }).score.value, null, 'missing input gives no guess');
  const tm = TPLS.find(t => t.slug === 'training-matrix');
  assert.equal(computeRow(tm, { req: '3', cur: '1' }).gap.value, 2);
  assert.equal(computeRow(tm, { req: '1', cur: '3' }).gap.value, 0);
  const ans = { org: 'شركة التوزيع', scope: 'المستودعات', owner: 'مدير العمليات', date: '2026-11-12', appetite: 'high', review: 'quarterly' };
  const a = assemble(rr, { ...doc, answers: ans, rows: [row] }, 'ar');
  assert.equal(a.dir, 'rtl'); assert.equal(a.sections[1].fields[0].value, 'مرتفع فأعلى (الدرجة 10+)');
  assert.deepEqual(a.table.rows[0].slice(5, 7), ['16', 'مرتفع']);
  assert.equal(a.title, 'سجل المخاطر');
  assert.deepEqual(docProgress(rr, { answers: ans, rows: [row] }).ready, true);
  const c = cleanDocInput(rr, { answers: { org: ' X\u0007 ', bogus: 'y' }, rows: [{ ref: 'a', score: '999' }] });
  assert.equal(c.answers.org, 'X'); assert.ok(!('bogus' in c.answers)); assert.ok(!('score' in c.rows[0]), 'computed cells are never stored');
});

test('exports: CSV (BOM, quotes, formula injection), Excel XML (escaping, RTL, numbers), Word HTML (escaped, RTL), JSON backup round-trip', () => {
  const rr = TPLS.find(t => t.slug === 'risk-register');
  const evil = { org: '=HYPERLINK("http://x")', scope: 'a "quoted", <b>bold</b> & more\nline 2', owner: '+SUM(1)', date: '2026-11-12', appetite: 'high', review: 'monthly' };
  const row = { ref: '@R1', risk: 'خطر: "تأخر" المورّد, ثم <script>', owner: '-x', l: '2', c: '3' };
  const doc = { ...newDocument(rr, { id: 'D' }), answers: evil, rows: [row], version: 3 };
  for (const lang of ['en', 'ar']) {
    const a = assemble(rr, doc, lang);
    const csv = toCsv(a);
    assert.ok(csv.startsWith('﻿')); assert.ok(csv.includes('\r\n'));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`)); assert.ok(csv.includes("'+SUM(1)")); assert.ok(csv.includes("'@R1"));
    assert.ok(csv.includes('"a ""quoted"", <b>bold</b> & more\nline 2"'));
    const xml = toSpreadsheetXml(a);
    assert.ok(!xml.includes('<script>') && xml.includes('&lt;script&gt;')); assert.ok(xml.includes('&apos;=HYPERLINK(&quot;http://x&quot;)'));
    assert.ok(xml.includes('<Data ss:Type="Number">6</Data>'));
    assert.equal(xml.includes('<DisplayRightToLeft/>'), lang === 'ar');
    const html = toWordHtml(a);
    assert.ok(!html.includes('<script>') && !html.includes('<b>bold</b>')); assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
    if (lang === 'ar') assert.ok(html.includes('خطر: &quot;تأخر&quot; المورّد'));
  }
  assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(safeCell('-12.5'), '-12.5'); assert.equal(safeCell('-x'), "'-x"); assert.equal(xmlEscape(`<&"'>`), '&lt;&amp;&quot;&apos;&gt;');
  const back = importBackup(rr, toJsonBackup(rr, doc), { id: 'NEW', now: '2026-11-12T10:00:00Z' });
  assert.equal(back.doc.id, 'NEW'); assert.equal(back.doc.version, 1); assert.equal(back.doc.answers.org, evil.org);
  assert.equal(importBackup(rr, { app: 'x' }).error, 'not_a_backup');
  assert.equal(importBackup(TPLS[1], toJsonBackup(rr, doc)).error, 'other_template');
});

test('version history: each save is a version, restore creates a new version, history is capped, diffs are reported', () => {
  const nc = TPLS.find(t => t.slug === 'ncr');
  let d = newDocument(nc, { id: 'D', now: '2026-11-12T08:00:00Z' });
  d = saveVersion(nc, d, { title: 'NCR 1', answers: { number: 'NC-1' }, rows: [] }, { now: '2026-11-12T08:01:00Z', note: 'first' });
  d = saveVersion(nc, d, { title: 'NCR 1', answers: { number: 'NC-1', area: 'Stores' }, rows: [{ action: 'Fix' }] }, { now: '2026-11-12T08:02:00Z' });
  assert.equal(d.version, 2); assert.equal(d.history.length, 2); assert.equal(d.history[0].note, 'first');
  assert.deepEqual(diffVersions(d.history[0], d.history[1]).questions, ['area']);
  const r = restoreVersion(nc, d, 1, { now: '2026-11-12T08:03:00Z' });
  assert.equal(r.version, 3); assert.equal(r.answers.area, ''); assert.equal(r.history.at(-1).note, 'restored v1'); assert.equal(r.history.length, 3);
  assert.equal(restoreVersion(nc, d, 99), null);
  let many = d;
  for (let i = 0; i < MAX_HISTORY + 5; i++) many = saveVersion(nc, many, { answers: { number: 'N' + i } });
  assert.equal(many.history.length, MAX_HISTORY); assert.equal(many.dropped_versions, 7); assert.equal(many.history.at(-1).version, many.version);
});

test('split and search: labs are split per academy (index hides keys), manifest tracks labs.json; the index finds published labs and templates only', () => {
  const r = build({ check: true });
  assert.ok(r.manifest.source['labs.json']);
  assert.equal(r.manifest.collections.labs.count, LABS.length);
  for (const [k, xs] of Object.entries(r.shardsL)) for (const l of xs) assert.equal(l.academy, k);
  const onDisk = json('data/seed/split/labs-index.json').items;
  assert.equal(onDisk.length, LABS.length); assert.ok(onDisk.every(x => !('tasks' in x)));
  assert.deepEqual(json('data/seed/split/manifest.json').source, r.manifest.source, 'split is stale — run npm run build:phase10a');
  const idx = json('data/search-index.json').items;
  const labs = idx.filter(e => e.t === 'lab');
  assert.equal(labs.length, LABS.filter(pub).length + 1, '8 labs + the EFQM Assessment Lab');
  assert.ok(!labs.some(e => LABS.find(l => l.id === e.id && l.draft)));
  assert.equal(searchIndex(idx, 'FMEA', { types: ['lab'] })[0].id, 'LAB-FMEA');
  assert.equal(searchIndex(idx, 'مختبر تحليل السبب الجذري', { types: ['lab'] })[0].id, 'LAB-RCA');
  assert.equal(searchIndex(idx, 'سجل المخاطر', { types: ['template'] })[0].h, '#/templates/risk-register');
  assert.ok(idx.filter(e => e.t === 'template' && e.h.startsWith('#/templates/')).length === 6);
});

test('navigation unchanged by Phase 11: five top items, menu ≤ 12, labs entry still on the build plan; bookmarks accept labs', () => {
  const nav = json('data/seed/navigation.json').items;
  assert.deepEqual(validateRegistry(nav), []);
  assert.equal(shellEntries(nav, ['learner'], 'top').length, 5);
  assert.ok(shellEntries(nav, ['learner'], 'menu').length <= MAX_MENU);
  const labsEntry = nav.find(e => e.id === 'labs');
  assert.ok(!labsEntry || labsEntry.placement === 'plan');
  assert.ok(BOOKMARK_TYPES.includes('lab'));
  assert.equal(makeBookmark({ type: 'lab', id: 'LAB-RCA', href: '#/labs/root-cause-analysis', title: { en: 'RCA' } }).id, 'lab:LAB-RCA');
});

test('certificate of completion: only for completed courses, validated name, deterministic number, clear disclaimer', () => {
  const c = COURSES.find(x => x.id === 'CRS-ISO-AUD');
  const ids = c.modules.flatMap(m => m.lessons.map(l => l.id));
  const progress = [{ id: c.id, completed_lessons: ids }];
  const attempts = [{ assessment_id: c.assessments.final, passed: true }];
  assert.equal(certificateEligibility(c, progress, []).eligible, false, 'final not passed');
  assert.equal(certificateEligibility(c, progress, attempts).eligible, true);
  assert.throws(() => issueCertificate({ course: c, progress: [], attempts, name: 'Ali' }), /not_complete/);
  for (const [n, code] of [['', 'required'], ['A', 'short'], ['x'.repeat(81), 'long'], ['<b>Ali</b>', 'chars']]) assert.equal(validateCertName(n), code, n);
  assert.equal(validateCertName('مدثر سلامه'), ''); assert.equal(validateCertName("Anne-Marie O'Neil"), '');
  const a = issueCertificate({ course: c, progress, attempts, name: '  مدثر   سلامه ', userId: 'local', now: '2026-11-12T08:00:00Z' });
  assert.equal(a.name, 'مدثر سلامه'); assert.equal(a.certificate_type, 'completion'); assert.match(a.number, /^CIA-C-[A-Z0-9]+-[0-9A-Z]{7}$/);
  const b = issueCertificate({ course: c, progress, attempts, name: 'X Y', userId: 'local', existing: a, now: '2026-12-01T08:00:00Z' });
  assert.equal(b.number, a.number); assert.equal(b.issued_at, a.issued_at);
  assert.match(CERT_DISCLAIMER.en, /not a professional certification/); assert.match(CERT_DISCLAIMER.ar, /ليست شهادة مهنية/);
});

test('Phase 11 strings exist in Arabic and English and carry no "Phase" wording for learners', () => {
  const en = json('data/i18n/en.json'), ar = json('data/i18n/ar.json');
  for (const ns of ['lab11', 'tpl11', 'cert11']) {
    assert.ok(en[ns] && ar[ns], ns);
    assert.doesNotMatch(JSON.stringify(en[ns]), /\bPhase \d/);
  }
  assert.ok(en.x10a.search.types.lab && ar.x10a.bm.type.lab);
});
