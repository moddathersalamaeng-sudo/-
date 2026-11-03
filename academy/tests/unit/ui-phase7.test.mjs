/** Phase 7 UI contracts: every data-driven label has a translation, pure view helpers behave, review workflow is safe. */
import test from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { I18n } from '../../src/core/i18n.js';
import { competencyRows } from '../../src/views/profile.js';
import { effortMinutes } from '../../src/views/iso.js';
import { validateGovernance, isVisible } from '../../src/data/governance.js';
import { CONTENT_SOURCES } from '../../src/data/governance.js';
import { json, text, ROOT } from './_util.mjs';

const ar = json('data/i18n/ar.json'), en = json('data/i18n/en.json');
const i18n = new I18n({ dictionaries: { ar, en } });
const has = k => ['ar', 'en'].every(l => { i18n.locale = l; return i18n.has(k); });
const items = f => json('data/seed/' + f).items;

test('every data-driven label used by the Phase 7 views has AR + EN text', () => {
  const courses = items('courses.json'), qs = items('questions.json'), as = items('assessments.json');
  const paths = items('learning-paths.json'), cat = items('recommendation-catalog.json'), lib = items('library-items.json');
  const keys = new Set([
    ...courses.flatMap(c => c.delivery_modes).map(v => 'p7.delivery.' + v),
    ...courses.flatMap(c => (c.daily_schedule || []).flatMap(d => d.sessions.map(s => 'p7.session.' + s.kind))),
    ...courses.flatMap(c => c.modules.flatMap(m => m.lessons.flatMap(l => (l.content_blocks || []).map(b => b.type))))
      .map(t => 'p7.block.' + (['concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'].includes(t) ? t : 'other')),
    ...courses.map(c => 'labels.certificateType.' + c.certificate_type),
    ...qs.map(q => 'p7.qtype.' + q.type), ...as.map(a => 'p7.asmKind.' + a.kind),
    ...[...paths.flatMap(p => p.steps.map(s => s.type)), ...cat.map(r => r.recommendation_type)].map(t => 'p7.recType.' + t),
    ...lib.map(x => 'p7.libKind.' + x.kind), ...lib.map(x => 'p7.tier.' + x.access_tier),
    ...CONTENT_SOURCES.map(s => 'p7.gov.src.' + s),
    ...['completed', 'skipped', 'locked', 'recommended', 'available', 'pending'].map(s => 'p7.stepStatus.' + s),
    ...['critical', 'high', 'medium', 'low', 'achieved'].map(s => 'p7.priority.' + s),
    ...['COMPETENCY_GAP', 'CAREER_GOAL', 'ROLE_REQUIREMENT', 'PREREQUISITE', 'LEARNING_PATH'].map(s => 'p7.reason.' + s),
    ...['competency_gap', 'career_goal', 'assessment_gap', 'prerequisite_fit', 'experience_fit', 'certification_alignment', 'user_interest'].map(s => 'p7.factor.' + s),
    ...['verified', 'assessment', 'self', 'insufficient'].map(s => 'p7.comp.src.' + s),
    ...['foundation_evidence', 'audit_evidence', 'foundation_completed', 'target_role', 'focus_standard'].map(s => 'p7.iso.factor.' + s),
    ...['courses', 'assessments', 'questions', 'iso_standards', 'learning_paths', 'competencies', 'target_roles', 'domains', 'ecosystems', 'programs', 'sources'].map(s => 'p7.review.col.' + s),
    ...qs.filter(q => q.type === 'matching').flatMap(q => q.pairs.flatMap(p => [p.left, ...p.right])).map(v => 'p7.asm.term.' + v),
    'nav.items.review', 'p7.iso.foundationCourse', 'p7.iso.implementerCourse', 'p7.iso.auditorCourse', 'p7.path.required', 'p7.path.recommended'
  ]);
  assert.deepEqual([...keys].filter(k => !has(k)), []);
});

test('competencyRows: assessment evidence overrides a self-declared level; no evidence = not assessed', () => {
  const role = { targets: { A: 3, B: 2, C: 2, D: 0 } };
  const comps = ['A', 'B', 'C', 'D'].map(id => ({ id, domain: 'X', name: { en: id, ar: id } }));
  const rows = competencyRows({ role, competencies: comps, selfLevels: { A: 5, B: 1 }, evidence: { A: { percent: 40 } } });
  const by = Object.fromEntries(rows.map(r => [r.c.id, r]));
  assert.equal(rows.length, 3, 'only required competencies');
  assert.equal(by.A.source, 'assessment'); assert.equal(by.A.current, 1); assert.equal(by.A.status, 'gap');
  assert.equal(by.B.source, 'self'); assert.equal(by.B.gap, 1);
  assert.equal(by.C.status, 'not_assessed'); assert.equal(by.C.current, 0);
});

test('effort strings convert to minutes for route totals', () => {
  assert.equal(effortMinutes('9 h'), 540); assert.equal(effortMinutes('6.5 h'), 390); assert.equal(effortMinutes('20 min'), 20); assert.equal(effortMinutes(''), 0);
});

test('review queue never pre-fills the reviewer name and never writes governance itself', () => {
  const src = text('src/views/review.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /value: session\?\.name \|\| ''/, 'name comes only from what this reviewer typed before');
  assert.doesNotMatch(src, /content_status\s*[:=]\s*'published'/);
  assert.doesNotMatch(src, /\.(courses|questions|assessments)\.save\(/, 'content repositories are read-only from the queue');
});

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'cia-review-'));
  cpSync(join(ROOT, 'data'), join(dir, 'data'), { recursive: true });
  cpSync(join(ROOT, 'tools'), join(dir, 'tools'), { recursive: true });
  return dir;
}
/* CRS-PM-101 and the Phase 5 demo items are still drafts after the Phase 7 closure, so the workflow is exercised on them. */
const decision = (o) => ({ collection: 'courses', record_id: 'CRS-PM-101', version: DRAFT_VERSION, decision: 'approve', comment: '', checklist: [], reviewer: 'Dr. Example Reviewer', reviewer_role: 'Lead Auditor', review_date: '2026-10-26', ...o });
const DRAFT_VERSION = json('data/seed/courses.json').items.find(x => x.id === 'CRS-PM-101').governance.version;
const Q_VERSION = json('data/seed/questions.json').items.find(x => x.id === 'Q-PM-001').governance.version;

test('apply_review_decisions: dry run changes nothing; --apply publishes through the gate (expert review or owner approval) and skips unsafe decisions', () => {
  const dir = sandbox();
  try {
    const file = join(dir, 'decisions.json');
    writeFileSync(file, JSON.stringify({ schema: 'cia.review-decisions.v1', app: 'cia-academy', reviewer: { name: 'Dr. Example Reviewer' }, decisions: [
      decision({}),
      decision({ record_id: 'CRS-P3O-101', basis: 'owner_approval', reviewer: 'مدثر سلامه', reviewer_role: 'Platform owner', review_date: '2026-11-03' }),
      decision({ collection: 'questions', record_id: 'Q-PM-001', version: Q_VERSION, decision: 'changes_requested', comment: 'Tighten option c.' }),
      decision({ record_id: 'CRS-QMS-201', version: '0.0.1' }),
      decision({ record_id: 'CRS-EFQM-101', reviewer: '' }),
      decision({ record_id: 'CRS-EFQM-101', basis: 'rubber_stamp' }),
      decision({ collection: 'users', record_id: 'x' })
    ] }));
    const before = readFileSync(join(dir, 'data/seed/courses.json'), 'utf8');
    execFileSync('python3', ['-I', join(dir, 'tools/apply_review_decisions.py'), file], { encoding: 'utf8' });
    assert.equal(readFileSync(join(dir, 'data/seed/courses.json'), 'utf8'), before, 'dry run');
    const out = execFileSync('python3', ['-I', join(dir, 'tools/apply_review_decisions.py'), file, '--apply'], { encoding: 'utf8' });
    assert.match(out, /approved: 2/); assert.match(out, /changes_requested: 1/); assert.match(out, /skipped: 4/);
    const courses = JSON.parse(readFileSync(join(dir, 'data/seed/courses.json'), 'utf8')).items;
    const c = courses.find(x => x.id === 'CRS-PM-101');
    assert.deepEqual(validateGovernance(c), []); assert.equal(isVisible(c, ['learner']), true);
    assert.equal(c.governance.content_source, 'sme'); assert.equal(c.governance.approval_basis, 'expert_review');
    assert.equal(c.governance.reviewer, 'Dr. Example Reviewer'); assert.ok(c.governance.approved_hash);
    const o = courses.find(x => x.id === 'CRS-P3O-101');
    assert.equal(o.governance.content_source, 'owner'); assert.equal(o.governance.drafted_by, 'ai_draft');
    assert.equal(o.governance.approval_basis, 'owner_approval_after_ai_prereview'); assert.match(o.governance.change_note, /not an independent expert review/);
    assert.equal(courses.find(x => x.id === 'CRS-EFQM-101').governance.content_status, 'needs_review');
    assert.equal(courses.find(x => x.id === 'CRS-QMS-201').governance.content_status, 'needs_review');
    const q = JSON.parse(readFileSync(join(dir, 'data/seed/questions.json'), 'utf8')).items.find(x => x.id === 'Q-PM-001');
    assert.equal(q.governance.content_status, 'needs_review'); assert.equal(q.review_comments[0].comment, 'Tighten option c.');
    const log = JSON.parse(readFileSync(join(dir, 'data/review-log.json'), 'utf8')).items;
    assert.equal(log.at(-1).approved, 2);
    // An approval survives a rebuild while the content is unchanged …
    execFileSync('python3', ['-I', join(dir, 'tools/build_phase7.py')], { encoding: 'utf8' });
    assert.equal(JSON.parse(readFileSync(join(dir, 'data/seed/courses.json'), 'utf8')).items.find(x => x.id === 'CRS-ISO-101').governance.content_status, 'published');
    // … and is dropped as soon as the content changes.
    const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(join(dir, 'tools'))}); from review_hash import keep_approvals
old = json.load(open(${JSON.stringify(join(dir, 'data/seed/courses.json'))}))['items']
new = json.loads(json.dumps(old)); c = next(x for x in new if x['id'] == 'CRS-ISO-101'); c['overview']['en'] += ' Edited.'; c['governance'] = {'content_status': 'needs_review'}
print(json.dumps(keep_approvals(old, new)))`;
    assert.deepEqual(JSON.parse(execFileSync('python3', ['-I', '-c', py], { encoding: 'utf8' })), ['CRS-ISO-101']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
