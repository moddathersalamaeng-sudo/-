/**
 * Phase 10A — simplify, restructure and upgrade: navigation registry, redirects, search, data split, onboarding,
 * My space calculations, study plan / .ics, bookmarks and the date helper.
 */
import test from 'node:test'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs'; import { join } from 'node:path';
import { json, text, ROOT } from './_util.mjs';
import { validateRegistry, shellEntries, planEntries, visibleEntries, MAX_TOP, MAX_MENU } from '../../src/nav/registry.js';
import { REDIRECTS, redirectFor, hashFor } from '../../src/nav/redirects.js';
import { resolve, resolveWithRedirect } from '../../src/core/router.js';
import { normalizeText, searchIndex, makeEntry, groupResults } from '../../src/domain/search.mjs';
import { SplitJsonAdapter } from '../../src/data/adapters/split-json.js';
import { validateGovernance, isVisible } from '../../src/data/governance.js';
import { ACADEMIES, academyOfCourse, academyOfAssessment, ASSESSMENT_TYPE, GOALS, goalAcademy, validateOnboarding, onboardingProfile, cardProgress, continueList,
  dashboardSummary, makeBookmark, bookmarkId, weeklyPlan, planToIcs, foldLine } from '../../src/domain/academies.mjs';
import { emptyProfile, createCompetencyCore } from '../../src/domain/competency-core.mjs';
import { I18n } from '../../src/core/i18n.js';
import { build, courseIndexRecord, DETAIL_ONLY } from '../../tools/build_phase10a.mjs';

const nav = json('data/seed/navigation.json').items;
const courses = json('data/seed/courses.json').items;
const questions = json('data/seed/questions.json').items;
const assessments = json('data/seed/assessments.json').items;
const roles = json('data/seed/competency/target-roles.json').items;
const ar = json('data/i18n/ar.json'), en = json('data/i18n/en.json');
const ALL = ['learner', 'instructor', 'reviewer', 'admin', 'company_admin'];

/* ------------------------------------------------------------------ navigation */

test('registry: valid, five top items in order, learner menu ≤ 12, no future-phase entry in the shell', () => {
  assert.deepEqual(validateRegistry(nav), []);
  const top = shellEntries(nav, ['learner'], 'top').map(e => e.id);
  assert.deepEqual(top, ['home', 'academies', 'academy', 'library', 'mySpace']);
  assert.ok(top.length <= MAX_TOP);
  for (const r of [['learner'], ['reviewer'], ['admin'], ['company_admin']]) {
    for (const pl of ['top', 'panel', 'menu', 'user', 'footer', 'button']) assert.ok(shellEntries(nav, r, pl).every(e => e.status === 'active'), `${r}/${pl}`);
  }
  assert.ok(shellEntries(nav, ['learner'], 'menu').length <= MAX_MENU);
  assert.deepEqual(shellEntries(nav, ['learner'], 'panel').map(e => e.id), ACADEMIES.map(a => a.navId));
  assert.equal(planEntries(nav, ['learner']).filter(e => e.status !== 'coming').length, 0);
  assert.ok(planEntries(nav, ['admin']).some(e => e.id === 'admin') && planEntries(nav, ['admin']).some(e => e.id === 'company'));
});

test('registry: no link appears twice in the shell; merged pages are hidden and point to their new home', () => {
  const shown = ['top', 'panel', 'menu', 'user', 'footer', 'button'].flatMap(pl => shellEntries(nav, ALL, pl)).map(e => e.route || e.href);
  assert.equal(new Set(shown).size, shown.length);
  for (const id of ['knowledge', 'guides', 'me', 'profile', 'recommendations', 'learningPath']) {
    const e = nav.find(x => x.id === id); assert.equal(e.placement, 'hidden', id); assert.ok(['library', 'mySpace'].includes(e.mergedInto), id);
  }
});

test('registry validator rejects a sixth top item, a coming entry in the menu and a plan entry that is active', () => {
  const base = { labelKey: 'k', kind: 'route', status: 'active', phase: 1, roles: ['learner'], requiredTier: 'free', placement: 'top' };
  const six = Array.from({ length: 6 }, (_, i) => ({ ...base, id: 't' + i, route: '/t' + i }));
  assert.ok(validateRegistry(six).some(e => e.includes('top items')));
  assert.ok(validateRegistry([{ ...base, id: 'c', status: 'coming', placement: 'menu', route: undefined }]).some(e => e.includes('coming_entry_must_be_plan_only')));
  assert.ok(validateRegistry([{ ...base, id: 'p', placement: 'plan', route: '/p' }]).some(e => e.includes('plan_entry_must_be_coming')));
  assert.ok(validateRegistry([{ ...base, id: 'x', placement: 'sideways', route: '/x' }]).some(e => e.includes('bad_placement')));
});

/* ------------------------------------------------------------------ redirects */

const routePaths = [...text('src/main.js').matchAll(/\{ path: '([^']+)'/g)].map(m => ({ path: m[1] }));

test('every merged address redirects to a registered route, keeps its query and adds the tab', () => {
  assert.ok(routePaths.length > 40);
  for (const r of REDIRECTS) {
    const t = redirectFor(r.from, { route: 'ROUTE-IA' });
    assert.ok(t, r.from);
    assert.ok(resolve(routePaths, hashFor(t)).route, `${r.from} → ${t.path} must be a route`);
    assert.equal(t.query.route, 'ROUTE-IA');
    for (const [k, v] of Object.entries(r.query)) assert.equal(t.query[k], v);
  }
  for (const old of ['/me', '/profile', '/profile/competencies', '/recommendations', '/learning-path', '/knowledge', '/guides', '/my-library', '/academy/programs'])
    assert.ok(redirectFor(old, {}), old);
  assert.equal(redirectFor('/academy/iso', {}), null);
  const { match, hash } = resolveWithRedirect(routePaths, '#/learning-path?route=ROUTE-LA', redirectFor, hashFor);
  assert.equal(match.route.path, '/my'); assert.equal(match.query.tab, 'path'); assert.equal(match.query.route, 'ROUTE-LA'); assert.equal(match.redirectedFrom, '/learning-path');
  assert.match(hash, /^#\/my\?/);
  /* detail pages are not redirected */
  for (const p of ['/knowledge/iso/what-is-iso', '/guides/iso-9001', '/guides/iso-9001/7.2', '/library/LIB-1']) assert.equal(redirectFor(p, {}), null, p);
});

/* ------------------------------------------------------------------ search */

test('search: Arabic normalisation (أ/إ/آ → ا, ة/ه, ى/ي, diacritics, tatweel, Arabic-Indic digits) and dotted numbers', () => {
  assert.equal(normalizeText('إدارة'), normalizeText('ادارة'));
  assert.equal(normalizeText('الجودة'), 'الجوده');
  assert.equal(normalizeText('مستوى'), 'مستوي');
  assert.equal(normalizeText('آمن'), 'امن');
  assert.equal(normalizeText('الجَوْدَةُ'), 'الجوده');
  assert.equal(normalizeText('الجـــودة'), 'الجوده');
  assert.equal(normalizeText('البند ٧٫٢'), normalizeText('البند 7.2').replace('7.2', '7.2'));
  assert.equal(normalizeText('ISO 9001: Clause 7.2!'), 'iso 9001 clause 7.2');
  assert.equal(normalizeText('Café'), 'cafe');
});

test('search: ranking puts exact title matches first and ignores tokens that match nothing', () => {
  const idx = [
    makeEntry({ type: 'lesson', id: 'L1', href: '#/a', title: { en: 'Competence evidence', ar: 'أدلة الكفاءة' }, sub: { en: 'ISO 9001 course', ar: 'دورة' } }),
    makeEntry({ type: 'guide_item', id: 'g#7.2', href: '#/guides/iso-9001/7.2', title: { en: '7.2 Competence', ar: '7.2 الكفاءة' }, sub: { en: 'ISO 9001 · 7.2', ar: 'ISO 9001 · 7.2' }, extra: ['7.2', 'ISO 9001', 'clause بند'] }),
    makeEntry({ type: 'course', id: 'C', href: '#/c', title: { en: 'FMEA', ar: 'تحليل أنماط الفشل' } })
  ];
  const r = searchIndex(idx, 'ISO 9001 clause 7.2');
  assert.equal(r[0].id, 'g#7.2');
  assert.equal(searchIndex(idx, 'بند 7.2')[0].id, 'g#7.2');
  assert.equal(searchIndex(idx, 'الكفاءه')[0].id, 'g#7.2');
  assert.equal(searchIndex(idx, 'fmea zzzz')[0].id, 'C', 'unknown token ignored');
  assert.deepEqual(searchIndex(idx, ''), []);
  assert.deepEqual(searchIndex(idx, 'zzzz'), []);
  assert.deepEqual(groupResults(searchIndex(idx, 'competence')).map(([t]) => t), ['guide_item', 'lesson']);
});

test('search index: built from published records only, every link is an Academy route, and real queries find the right things', () => {
  const doc = json('data/search-index.json');
  assert.equal(doc.schema, 'cia.search-index.v1');
  const pubCourses = new Set(courses.filter(c => validateGovernance(c).length === 0 && c.governance.content_status === 'published').map(c => c.id));
  for (const e of doc.items) {
    assert.match(e.h, /^#\//, e.id);
    assert.ok(resolve(routePaths, e.h).route, e.h);
    if (e.t === 'course') assert.ok(pubCourses.has(e.id), e.id);
  }
  const top = q => searchIndex(doc.items, q, { limit: 5 });
  assert.equal(top('ISO 9001 clause 7.2')[0].id, 'iso-9001#7.2');
  assert.ok(top('FMEA').some(r => r.t === 'course'));
  assert.ok(top('PMP').some(r => r.t === 'certification' && r.ti.en.includes('PMP')));
  assert.ok(top('إدارة المخاطر').length > 0 && top('ادارة المخاطر').map(r => r.id).join() === top('إدارة المخاطر').map(r => r.id).join());
});

/* ------------------------------------------------------------------ data split */

test('data split: shards hold exactly the master records (same objects), manifest hashes match the master files', () => {
  const m = json('data/seed/split/manifest.json');
  const sha = p => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');
  assert.equal(m.source['courses.json'], sha('data/seed/courses.json'), 'run npm run build:phase10a after a course rebuild');
  assert.equal(m.source['questions.json'], sha('data/seed/questions.json'), 'run npm run build:phase10a after a question rebuild');
  const shardC = Object.values(m.collections.courses.shards).flatMap(f => json('data/seed/split/' + f).items);
  const shardQ = Object.values(m.collections.questions.shards).flatMap(f => json('data/seed/split/' + f).items);
  const byId = xs => new Map(xs.map(x => [x.id, JSON.stringify(x)]));
  assert.deepEqual(byId(shardC), byId(courses));
  assert.deepEqual(byId(shardQ), byId(questions));
  for (const [k, ids] of Object.entries(m.collections.questions.ids)) assert.deepEqual(ids, json('data/seed/split/' + m.collections.questions.shards[k]).items.map(q => q.id));
  for (const [k, f] of Object.entries(m.collections.courses.shards)) assert.ok(json('data/seed/split/' + f).items.every(c => academyOfCourse(c) === k), k);
  const idx = json('data/seed/split/courses-index.json').items;
  assert.deepEqual(idx.map(c => c.id), courses.map(c => c.id));
  /* the build is deterministic: rebuilding in memory gives the same manifest */
  assert.deepEqual(build({ check: true }).manifest, m);
});

test('data split: the light index keeps the gate (same status, reviewer, date), lesson ids and card fields; drops lesson bodies', () => {
  const idx = json('data/seed/split/courses-index.json').items;
  for (const c of courses) {
    const x = idx.find(y => y.id === c.id);
    assert.deepEqual(validateGovernance(x), validateGovernance(c), c.id);
    for (const r of [['learner'], ['reviewer']]) assert.equal(isVisible(x, r), isVisible(c, r), c.id);
    assert.deepEqual(x.modules.flatMap(m => m.lessons.map(l => l.id)), c.modules.flatMap(m => m.lessons.map(l => l.id)));
    assert.equal(x.split.full, false);
    for (const k of DETAIL_ONLY) assert.ok(!(k in x), k);
    assert.ok(x.modules.every(m => m.lessons.every(l => !('content_blocks' in l) && !('exercise' in l))));
    assert.equal(Boolean(x.practical_task), Boolean(c.practical_task));
  }
  assert.deepEqual(courseIndexRecord(courses[0]).title, courses[0].title);
});

test('data split loader: reads shards on demand, caches them, and returns the master records', async () => {
  const fetched = [];
  const fetcher = async u => { fetched.push(u.split('/').pop()); const body = readFileSync(join(ROOT, u.replace(/^\.\//, ''))); return { ok: true, json: async () => JSON.parse(body) }; };
  const a = new SplitJsonAdapter({ base: './data/seed/split', fetcher });
  const iso = await a.readShards('courses', ['iso']);
  assert.ok(iso.length > 0 && iso.every(c => academyOfCourse(c) === 'iso'));
  assert.deepEqual(fetched, ['manifest.json', 'courses-iso.json']);
  await a.readShards('courses', ['iso']);
  assert.equal(fetched.length, 2, 'cached');
  const qid = assessments.find(x => x.id === 'ASM-READY-PM-001').question_ids[0];
  const keys = await a.questionShardsFor([qid]);
  assert.deepEqual(keys, ['pmi']);
  const all = await a.read('courses');
  assert.equal(all.length, courses.length);
  assert.equal((await a.read('courses-index')).length, courses.length);
  await assert.rejects(() => a.file('../secrets.json'));
  await assert.rejects(() => a.write());
});

/* ------------------------------------------------------------------ academies, goals and onboarding */

test('academies: every course and assessment belongs to exactly one place; quizzes are kept for the course page', () => {
  const byC = id => courses.find(c => c.id === id);
  const keys = new Set(ACADEMIES.map(a => a.key));
  assert.ok(courses.every(c => keys.has(academyOfCourse(c))));
  for (const a of assessments) assert.ok([...keys, 'general'].includes(academyOfAssessment(a, byC)), a.id);
  for (const a of ACADEMIES) assert.equal(academyOfAssessment(assessments.find(x => x.id === a.ready), byC), a.key, a.ready);
  assert.equal(ASSESSMENT_TYPE({ kind: 'readiness' }), 'diagnostic');
  assert.equal(ASSESSMENT_TYPE({ kind: 'knowledge_quiz' }), 'quiz');
  assert.equal(ASSESSMENT_TYPE({ kind: 'final' }), 'course');
  for (const a of ACADEMIES) assert.ok(assessments.some(x => x.id === a.ready && x.governance.content_status === 'published'), a.ready);
});

test('goals open the right academy, refined by the target role', () => {
  assert.equal(goalAcademy('standard', 'ROLE-PM'), 'iso');
  assert.equal(goalAcademy('certification', 'ROLE-PM'), 'pmi');
  assert.equal(goalAcademy('certification', 'ROLE-QMGR'), 'quality');
  assert.equal(goalAcademy('certification', 'ROLE-OEL'), 'excellence');
  assert.equal(goalAcademy('improve', 'ROLE-QMGR'), 'excellence');
  assert.equal(goalAcademy('improve', 'ROLE-CIS'), 'quality');
  assert.equal(goalAcademy('team', 'ROLE-PMOA'), 'pmi');
  for (const g of GOALS) for (const r of roles) assert.ok(ACADEMIES.some(a => a.key === goalAcademy(g, r.id)), `${g}/${r.id}`);
});

test('onboarding → profile: validation, merge with an existing profile, and the full profile rules still pass', () => {
  const ids = roles.map(r => r.id);
  assert.deepEqual(Object.keys(validateOnboarding({}, ids)).sort(), ['current_role', 'goal', 'target_role', 'weekly_hours']);
  assert.equal(validateOnboarding({ current_role: 'Q', target_role: 'ROLE-QE', goal: 'standard', weekly_hours: '4' }, ids).current_role, 'short');
  assert.equal(validateOnboarding({ current_role: 'QE', target_role: 'ROLE-X', goal: 'standard', weekly_hours: '4' }, ids).target_role, 'role');
  for (const bad of ['0', '41', '4.5', 'x', '-1']) assert.equal(validateOnboarding({ current_role: 'QE', target_role: 'ROLE-QE', goal: 'team', weekly_hours: bad }, ids).weekly_hours, 'range', bad);
  assert.equal(validateOnboarding({ current_role: 'QE', target_role: 'ROLE-QE', goal: 'nope', weekly_hours: '4' }, ids).goal, 'required');
  const input = { current_role: '  Quality Engineer ', target_role: 'ROLE-QE', goal: 'certification', weekly_hours: '06' };
  assert.deepEqual(validateOnboarding(input, ids), {});
  const p = onboardingProfile(null, input, emptyProfile(), '2026-11-12T10:00:00.000Z');
  assert.equal(p.id, 'me'); assert.equal(p.current_role, 'Quality Engineer'); assert.equal(p.weekly_hours, '6'); assert.equal(p.goal, 'certification'); assert.equal(p.onboarded_at, '2026-11-12T10:00:00.000Z');
  const core = createCompetencyCore({ domains: [], competencies: [], roles, evidence: { qualifying: [], non_qualifying: [] } });
  assert.deepEqual(core.validateProfile(p), {});
  const kept = onboardingProfile({ ...p, industry: 'energy', onboarded_at: '2026-01-01T00:00:00Z', experience: { iso: '3to5' } }, { ...input, weekly_hours: '8' }, emptyProfile(), '2026-11-13T00:00:00Z');
  assert.equal(kept.industry, 'energy'); assert.equal(kept.experience.iso, '3to5'); assert.equal(kept.onboarded_at, '2026-01-01T00:00:00Z'); assert.equal(kept.weekly_hours, '8');
});

/* ------------------------------------------------------------------ My space calculations */

const C = { id: 'C1', modules: [{ lessons: [{ id: 'a', estimated_minutes: 10 }, { id: 'b', estimated_minutes: 15 }] }, { lessons: [{ id: 'c', estimated_minutes: 20 }, { id: 'd' }] }] };
const D = { id: 'C2', modules: [{ lessons: [{ id: 'x', estimated_minutes: 30 }] }] };

test('card progress and minutes left; continue list newest first; dashboard totals', () => {
  const prog = [{ id: 'C1', completed_lessons: ['a', 'c', 'zz'], updated_at: '2026-11-10' }, { id: 'C2', completed_lessons: ['x'], updated_at: '2026-11-11' }];
  const p = cardProgress(C, prog);
  assert.deepEqual([p.done, p.total, p.minutesLeft, p.minutesTotal, p.next.id], [2, 4, 15, 45, 'b']);
  assert.equal(cardProgress(C, []).done, 0);
  assert.equal(cardProgress(C, []).next.id, 'a');
  assert.deepEqual(continueList([C, D], prog).map(x => x.c.id), ['C1'], 'finished courses leave the continue list');
  const E = { id: 'C3', modules: [{ lessons: [{ id: 'e1', estimated_minutes: 5 }, { id: 'e2', estimated_minutes: 5 }] }] };
  assert.deepEqual(continueList([C, E], [...prog, { id: 'C3', completed_lessons: ['e1'], updated_at: '2026-11-12' }]).map(x => x.c.id), ['C3', 'C1']);
  const s = dashboardSummary([C, D], prog, [{ assessment_id: 'A', passed: true }, { assessment_id: 'A', passed: true }, { assessment_id: 'B', passed: false }], [{}, {}]);
  assert.deepEqual(s, { started: 2, finished: 1, inProgress: 1, lessons: 3, minutes: 60, attempts: 3, passed: 1, bookmarks: 2 });
});

test('bookmarks: typed ids, Academy links only, bilingual titles', () => {
  const b = makeBookmark({ type: 'guide_item', id: 'iso-9001#7.2', href: '#/guides/iso-9001/7.2', title: { en: '7.2 Competence' } }, '2026-11-12');
  assert.equal(b.id, 'guide_item:iso-9001#7.2'); assert.equal(b.title.ar, '7.2 Competence'); assert.equal(b.saved_at, '2026-11-12');
  assert.equal(bookmarkId('course', 'CRS-1'), 'course:CRS-1');
  assert.throws(() => makeBookmark({ type: 'video', id: 'x', href: '#/x' }));
  assert.throws(() => makeBookmark({ type: 'course', id: 'x', href: 'https://evil.example' }));
});

test('weekly study plan: lessons spread over the chosen days, never split, capped, and invalid input gives no sessions', () => {
  const start = new Date(2026, 10, 12); // Thursday 12 Nov 2026
  const plan = weeklyPlan({ courses: [C, D], progress: [{ id: 'C1', completed_lessons: ['a'] }], weeklyHours: 1, days: ['SU', 'TH'], time: '18:30', start });
  assert.equal(plan.sessionMinutes, 30);
  assert.deepEqual(plan.sessions.map(s => s.date), ['2026-11-12', '2026-11-15', '2026-11-19', '2026-11-22']);
  assert.deepEqual(plan.sessions.map(s => s.items.map(i => i.lesson.id)), [['b'], ['c'], ['d'], ['x']]);
  assert.deepEqual(plan.sessions.flatMap(s => s.items.map(i => i.lesson.id)), ['b', 'c', 'd', 'x']);
  assert.ok(plan.sessions.every(s => s.time === '18:30'));
  assert.ok(plan.sessions.every(s => s.items.length >= 1));
  assert.equal(plan.unplanned, 0);
  assert.deepEqual(weeklyPlan({ courses: [C], days: [] }).sessions, []);
  const capped = weeklyPlan({ courses: Array.from({ length: 30 }, (_, i) => ({ id: 'K' + i, modules: [{ lessons: Array.from({ length: 6 }, (_, j) => ({ id: `k${i}-${j}`, estimated_minutes: 60 })) }] })), weeklyHours: 1, days: ['MO'], start, maxWeeks: 4 });
  assert.equal(capped.sessions.length, 4); assert.ok(capped.unplanned > 0);
});

test('.ics export: valid calendar with one event per session, floating local times, escaped text and folded lines', () => {
  const plan = weeklyPlan({ courses: [{ id: 'C', title: { en: 'Audit, plan; act', ar: 'التدقيق' }, modules: [{ lessons: [{ id: 'l', title: { en: 'Lesson one', ar: 'الدرس الأول' }, estimated_minutes: 50 }] }] }], weeklyHours: 2, days: ['TU'], time: '07:05', start: new Date(2026, 10, 12) });
  const ics = planToIcs(plan, { lang: 'en', now: new Date('2026-11-12T08:00:00Z'), baseUrl: 'https://example.org/academy/#/my?tab=path', uidSeed: 'u1' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /DTSTART:20261117T070500\r\n/);
  assert.match(ics, /DTEND:20261117T075500\r\n/);
  assert.match(ics, /DTSTAMP:20261112T080000Z/);
  assert.ok(ics.replace(/\r\n /g, '').includes('Audit\\, plan\\; act'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const long = 'DESCRIPTION:' + 'الدرس '.repeat(40);
  assert.equal(foldLine(long).split('\r\n ').join(''), long);
  const arIcs = planToIcs(plan, { lang: 'ar', now: new Date('2026-11-12T08:00:00Z') });
  assert.ok(arIcs.replace(/\r\n /g, '').includes('الدرس الأول'));
});

/* ------------------------------------------------------------------ date helper (fixed in Phase 10A) */

test('a YYYY-MM-DD date shows the same day in every time zone; timestamps still use local time', () => {
  const saved = process.env.TZ;
  try {
    for (const tz of ['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Asia/Riyadh', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      const i = new I18n({ dictionaries: { ar, en }, locale: 'en' });
      assert.equal(i.date('2026-11-06'), '6 November 2026', tz);
      assert.equal(i.date('2026-01-01', { year: 'numeric' }), '2026', tz);
    }
    process.env.TZ = 'America/Los_Angeles';
    const i = new I18n({ dictionaries: { ar, en }, locale: 'en' });
    assert.equal(i.date('2026-11-06T03:00:00Z'), '5 November 2026', 'an instant keeps local time');
    assert.equal(i.date('not a date'), '');
  } finally { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved; }
});

/* ------------------------------------------------------------------ copy */

test('Phase 10A strings exist in Arabic and English; learner navigation labels carry no phase numbers', () => {
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
  assert.deepEqual(flat(ar.x10a).sort(), flat(en.x10a).sort());
  for (const e of ['top', 'panel', 'menu', 'user', 'footer', 'button'].flatMap(pl => shellEntries(nav, ['learner'], pl))) {
    const key = e.labelKey.split('.');
    for (const d of [ar, en]) { const v = key.reduce((o, k) => o?.[k], d); assert.ok(typeof v === 'string' && v, e.labelKey); assert.doesNotMatch(v, /phase|المرحلة|\d{2}/i, e.labelKey); }
  }
  assert.equal(en.nav.items.governance, 'About our content'); assert.equal(ar.nav.items.governance, 'عن محتوانا');
  for (const k of ['standard', 'certification', 'improve', 'team']) { assert.ok(ar.x10a.goal[k].t && en.x10a.goal[k].t); }
  assert.equal(ar.x10a.home.question, 'ماذا تريد أن تحقق؟');
  assert.equal(visibleEntries(nav, ['learner']).filter(e => e.status === 'coming' && e.placement !== 'plan').length, 0);
});
