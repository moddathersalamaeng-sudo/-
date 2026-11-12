#!/usr/bin/env node
/**
 * Phase 10A build step — run after build_phase10.py (order: build:guides → build:phase8 → build:phase9 → build:phase10 → build:phase10a).
 *
 *  1. Data split (F7): data/seed/courses.json and questions.json stay the builders' master files (approvals live there);
 *     this step writes per-academy copies under data/seed/split/ that the browser loads on demand:
 *       courses-index.json          every course as a light card record (lesson bodies, day plans and rubrics removed)
 *       courses-<academy>.json      full course records of one academy (same records as courses.json)
 *       questions-<academy>.json    question records grouped by the academy of their course / assessment
 *       manifest.json               shard files, question → shard map, and sha256 of the master files (sync check)
 *     Phase 11: labs.json is split the same way — labs-index.json (no tasks or keys) and labs-<academy>.json (full records).
 *  2. Search index (plan §4): data/search-index.json — published courses, lessons, guides, guide items, certifications,
 *     ISO standards, articles and library items, normalised with src/domain/search.mjs (the same code the browser uses).
 *
 * Nothing in the master files is changed. Usage: node tools/build_phase10a.mjs [--check]
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGovernance } from '../src/data/governance.js';
import { academyOfCourse, academyOfAssessment, ACADEMY_KEYS } from '../src/domain/academies.mjs';
import { makeEntry, SEARCH_SCHEMA } from '../src/domain/search.mjs';
import { labIndexRecord } from '../src/domain/labs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'data', 'seed');
const SPLIT = join(SEED, 'split');
const raw = p => readFileSync(join(ROOT, p));
const json = p => JSON.parse(raw(p).toString('utf8'));
const items = p => json(p).items;
const sha = p => createHash('sha256').update(raw(p)).digest('hex');
const published = r => validateGovernance(r).length === 0 && r.governance.content_status === 'published';
const write = (path, obj) => writeFileSync(path, JSON.stringify(obj) + '\n');

/** Light course record for lists, cards, the dashboard and the recommendation engine. */
/** Fields only the course page shows; the page loads the full record from its academy shard. */
export const DETAIL_ONLY = ['daily_schedule', 'case_studies', 'exercises', 'materials', 'why_it_matters', 'professional_relevance', 'assessment_methodology', 'passing_criteria', 'target_audience'];
export function courseIndexRecord(c) {
  const rest = Object.fromEntries(Object.entries(c).filter(([k]) => !DETAIL_ONLY.includes(k) && k !== 'practical_task' && k !== 'modules'));
  const { change_note, approved_hash, ...gov } = c.governance || {};
  return {
    ...rest,
    governance: gov,
    split: { academy: academyOfCourse(c), full: false },
    practical_task: c.practical_task ? { minutes: c.practical_task.minutes || 0 } : null,
    modules: (c.modules || []).map(m => ({
      id: m.id, order: m.order, title: m.title,
      lessons: (m.lessons || []).map(l => ({ id: l.id, order: l.order, title: l.title, estimated_minutes: l.estimated_minutes, check_question_id: l.check_question_id, ...(l.source ? { source: l.source } : {}) }))
    }))
  };
}

export function build({ check = false } = {}) {
  const courses = items('data/seed/courses.json');
  const hasLabs = existsSync(join(SEED, 'labs.json'));
  const labs = hasLabs ? items('data/seed/labs.json') : [];
  const shardsL = Object.fromEntries(ACADEMY_KEYS.map(k => [k, []]));
  for (const l of labs) (shardsL[l.academy] || shardsL.iso).push(l);
  const questions = items('data/seed/questions.json');
  const assessments = items('data/seed/assessments.json');
  const byCourse = new Map(courses.map(c => [c.id, c]));

  /* ---------- 1. split ---------- */
  const shardsC = Object.fromEntries(ACADEMY_KEYS.map(k => [k, []]));
  for (const c of courses) shardsC[academyOfCourse(c)].push(c);
  const qAcademy = new Map();
  for (const a of assessments) { const k = academyOfAssessment(a, id => byCourse.get(id)); for (const q of a.question_ids || []) if (!qAcademy.has(q)) qAcademy.set(q, k); }
  const shardsQ = Object.fromEntries([...ACADEMY_KEYS, 'general'].map(k => [k, []]));
  for (const q of questions) {
    const k = q.course_id && byCourse.has(q.course_id) ? academyOfCourse(byCourse.get(q.course_id)) : (qAcademy.get(q.id) || 'general');
    shardsQ[k].push(q);
  }
  const manifest = {
    schema: 'cia.split.v1', built_by: 'tools/build_phase10a.mjs',
    source: { 'courses.json': sha('data/seed/courses.json'), 'questions.json': sha('data/seed/questions.json'), ...(hasLabs ? { 'labs.json': sha('data/seed/labs.json') } : {}) },
    collections: {
      courses: { index: 'courses-index.json', shards: Object.fromEntries(ACADEMY_KEYS.map(k => [k, `courses-${k}.json`])), count: courses.length },
      questions: { shards: Object.fromEntries(Object.keys(shardsQ).map(k => [k, `questions-${k}.json`])), ids: Object.fromEntries(Object.entries(shardsQ).map(([k, xs]) => [k, xs.map(q => q.id)])), count: questions.length },
      ...(hasLabs ? { labs: { index: 'labs-index.json', shards: Object.fromEntries(ACADEMY_KEYS.map(k => [k, `labs-${k}.json`])), count: labs.length } } : {})
    }
  };

  /* ---------- 2. search index ---------- */
  const entries = [];
  const lessonKey = (c, l) => (l.id.startsWith(c.id + '-') ? l.id.slice(c.id.length + 1) : l.id);
  const snip = (v, n = 140) => v ? { ar: String(v.ar || '').slice(0, n), en: String(v.en || '').slice(0, n) } : null;
  for (const c of courses.filter(published)) {
    const ac = academyOfCourse(c);
    entries.push(makeEntry({ type: 'course', id: c.id, href: `#/academy/courses/${c.slug}`, title: c.title, sub: snip(c.overview), academy: ac, extra: [c.code, ...(c.standard_ids || []), c.id, c.related_certification].filter(Boolean) }));
    /* Lessons built from a guide item are found through that item; only lessons with their own text are indexed. */
    for (const m of c.modules || []) for (const l of m.lessons || []) if (!l.source)
      entries.push(makeEntry({ type: 'lesson', id: l.id, href: `#/academy/courses/${c.slug}/${encodeURIComponent(lessonKey(c, l))}`, title: l.title, sub: c.title, academy: ac }));
  }
  const guideIndex = items('data/guides/index.json').filter(published);
  for (const g of guideIndex) {
    const ac = ['iso', 'business-continuity', 'risk', 'governance', 'compliance'].includes(g.ecosystem) && g.kind === 'standard' ? 'iso' : g.kind === 'practice' ? 'pmi' : 'quality';
    const code = g.kind === 'standard' ? `ISO ${g.code}` : g.code;
    entries.push(makeEntry({ type: 'guide', id: g.slug, href: `#/guides/${g.slug}`, title: g.title, sub: g.subtitle, academy: ac, extra: [code, g.code, g.slug] }));
    const file = join(ROOT, 'data', 'guides', `${g.slug}.json`);
    if (!existsSync(file)) continue;
    const guide = JSON.parse(readFileSync(file, 'utf8')).guide;
    for (const cl of guide.clauses || []) for (const it of cl.items || []) {
      const extra = [it.ref, code, g.kind === 'standard' ? 'clause بند البند' : 'step خطوة'];
      const title = /^[\d.A-Z]+$/.test(it.ref) && g.kind === 'standard' ? { ar: `${it.ref} ${it.title?.ar || ''}`, en: `${it.ref} ${it.title?.en || ''}` } : it.title;
      entries.push(makeEntry({ type: 'guide_item', id: `${g.slug}#${it.ref}`, href: `#/guides/${g.slug}/${encodeURIComponent(it.ref)}`, title, sub: g.kind === 'standard' ? { ar: `${code} · ${it.ref}`, en: `${code} · ${it.ref}` } : g.title, academy: ac, extra }));
    }
  }
  const bodyBase = { PMI: '/academy/pmi/certifications', ASQ: '/academy/quality/certifications', EFQM: '/academy/excellence/recognition' };
  const bodyAcademy = { PMI: 'pmi', ASQ: 'quality', EFQM: 'excellence' };
  for (const c of items('data/seed/certifications.json').filter(published)) {
    const body = c.body || 'PMI';
    entries.push(makeEntry({ type: 'certification', id: c.id, href: `#${bodyBase[body]}/${c.slug}`, title: { ar: `${c.code || ''} ${c.name?.ar || ''}`.trim(), en: `${c.code || ''} ${c.name?.en || ''}`.trim() }, sub: snip(c.summary), academy: bodyAcademy[body], extra: [body, c.code].filter(Boolean) }));
  }
  for (const s of items('data/seed/iso-standards.json').filter(published))
    entries.push(makeEntry({ type: 'standard', id: s.id, href: `#/academy/iso/${s.slug}`, title: s.name, sub: snip(s.purpose), academy: 'iso', extra: [s.id] }));
  for (const a of items('data/seed/knowledge-articles.json').filter(published))
    entries.push(makeEntry({ type: 'article', id: a.id, href: `#/knowledge/${a.ecosystem}/${a.slug}`, title: a.title, sub: snip(a.content?.[0]?.text), extra: [a.topic, a.domain].filter(x => typeof x === 'string') }));
  for (const x of items('data/seed/library-items.json').filter(published))
    entries.push(makeEntry({ type: 'template', id: x.id, href: `#/library/${x.id}`, title: x.title, sub: snip(x.description), extra: [x.kind, x.standard_reference].filter(x => typeof x === 'string') }));
  /* Phase 11: published practice labs, the EFQM Assessment Lab (Phase 10) and the smart templates. */
  for (const l of labs.filter(published))
    entries.push(makeEntry({ type: 'lab', id: l.id, href: `#/labs/${l.slug}`, title: l.title, sub: snip(l.summary), academy: l.academy, extra: [l.code, 'lab مختبر practice تطبيق', ...(l.competencies || [])] }));
  if (existsSync(join(SEED, 'excellence-lab.json'))) for (const x of items('data/seed/excellence-lab.json').filter(r => r.id === 'LAB-EFQM' && published(r)))
    entries.push(makeEntry({ type: 'lab', id: x.id, href: '#/academy/excellence/lab', title: { en: 'EFQM Assessment Lab', ar: 'مختبر تقييم EFQM' }, sub: x.label, academy: 'excellence', extra: ['EFQM', 'lab مختبر', 'self-assessment تقييم ذاتي'] }));
  if (existsSync(join(SEED, 'smart-templates.json'))) for (const x of items('data/seed/smart-templates.json').filter(published))
    entries.push(makeEntry({ type: 'template', id: x.id, href: `#/templates/${x.slug}`, title: x.title, sub: snip(x.summary), academy: x.academy, extra: ['template قالب smart ذكي', x.slug] }));
  const searchDoc = { schema: SEARCH_SCHEMA, built_by: 'tools/build_phase10a.mjs', note: 'Published records only. Built at build time; rebuild after any content change.', count: entries.length, items: entries };

  if (check) return { manifest, shardsC, shardsQ, shardsL, labs, searchDoc };
  mkdirSync(SPLIT, { recursive: true });
  for (const f of readdirSync(SPLIT)) if (f.endsWith('.json')) unlinkSync(join(SPLIT, f));
  write(join(SPLIT, 'courses-index.json'), { schema: 'cia.courses-index.v1', items: courses.map(courseIndexRecord) });
  for (const [k, xs] of Object.entries(shardsC)) write(join(SPLIT, `courses-${k}.json`), { schema: 'cia.split.v1', academy: k, items: xs });
  for (const [k, xs] of Object.entries(shardsQ)) write(join(SPLIT, `questions-${k}.json`), { schema: 'cia.split.v1', academy: k, items: xs });
  if (hasLabs) {
    write(join(SPLIT, 'labs-index.json'), { schema: 'cia.labs-index.v1', items: labs.map(labIndexRecord) });
    for (const [k, xs] of Object.entries(shardsL)) write(join(SPLIT, `labs-${k}.json`), { schema: 'cia.split.v1', academy: k, items: xs });
  }
  write(join(SPLIT, 'manifest.json'), manifest);
  write(join(ROOT, 'data', 'search-index.json'), searchDoc);
  return { manifest, shardsC, shardsQ, shardsL, labs, searchDoc };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = build({ check: process.argv.includes('--check') });
  const n = o => Object.entries(o).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log(`courses ${n(r.shardsC)} · questions ${n(r.shardsQ)} · labs ${n(r.shardsL)} · search entries ${r.searchDoc.count}`);
}
