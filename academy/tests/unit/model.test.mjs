import test from 'node:test'; import assert from 'node:assert/strict';
import { RelationshipIndex, validateRelationship } from '../../src/data/relationships.js';
import { validateRegistry, visibleEntries } from '../../src/nav/registry.js';
import { summarizeProgress, buildCompletion } from '../../src/data/progress.js';
import { validateGovernance } from '../../src/data/governance.js';
import { LocalSession } from '../../src/session/session.js';
import { validateValue } from '../../src/ui/components.js';
import { json, text, walk, MockStorage, ROOT, ownerApproved } from './_util.mjs';
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';

const nav = json('data/seed/navigation.json').items;

test('navigation registry is valid and complete (spec §3 + Library + Company Portal)', () => {
  assert.deepEqual(validateRegistry(nav), []);
  const ids = nav.map(e => e.id);
  for (const id of ['home', 'standards', 'knowledge', 'academy', 'certification', 'assessments', 'labs', 'tools', 'career', 'passport', 'cpd', 'resources', 'coach', 'me', 'profile', 'admin', 'library', 'company'])
    assert.ok(ids.includes(id), id);
  for (const e of nav) { assert.ok('phase' in e && 'requiredTier' in e, e.id); if (e.status === 'coming') assert.ok(!e.route && !e.href, e.id); }
});
test('registry validator catches bad entries', () => {
  const errs = validateRegistry([{ id: 'x', labelKey: 'k', kind: 'route', status: 'coming', phase: 2, roles: ['learner'], requiredTier: 'gold', route: '/x' }, { id: 'x', labelKey: 'k', kind: 'route', status: 'active', phase: 1, roles: ['nobody'], requiredTier: 'free' }]);
  assert.ok(errs.some(e => e.includes('bad_requiredTier'))); assert.ok(errs.some(e => e.includes('coming_entry_must_not_link')));
  assert.ok(errs.some(e => e.includes('duplicate_id'))); assert.ok(errs.some(e => e.includes('bad_roles'))); assert.ok(errs.some(e => e.includes('active_route_without_path')));
});
test('navigation is role-aware', () => {
  const learner = visibleEntries(nav, ['learner']).map(e => e.id);
  const admin = visibleEntries(nav, ['admin']).map(e => e.id);
  assert.ok(!learner.includes('admin') && !learner.includes('components') && !learner.includes('company'));
  assert.ok(admin.includes('admin') && admin.includes('components') && admin.includes('company'));
  assert.ok(visibleEntries(nav, ['company_admin']).some(e => e.id === 'company'));
});
test('relationships: validation, dedupe, cross-type count, dangling', () => {
  assert.ok(validateRelationship({ fromType: 'course', fromId: 'a', relation: 'teleports', toType: 'x', toId: 'b' }).includes('unknown_relation'));
  assert.ok(validateRelationship({ fromType: 'course', fromId: 'a', relation: 'related_to', toType: 'course', toId: 'a' }).includes('self_reference'));
  const idx = new RelationshipIndex();
  assert.equal(idx.add({ fromType: 'article', fromId: 'a1', relation: 'related_to', toType: 'course', toId: 'c1' }), true);
  assert.equal(idx.add({ fromType: 'article', fromId: 'a1', relation: 'related_to', toType: 'course', toId: 'c1' }), false);
  idx.add({ fromType: 'competency', fromId: 'k1', relation: 'develops', toType: 'article', toId: 'a1' });
  idx.add({ fromType: 'article', fromId: 'a1', relation: 'related_to', toType: 'article', toId: 'a2' });
  assert.equal(idx.crossTypeCount('article', 'a1'), 2);
  assert.equal(idx.dangling(new Set(['article:a1', 'course:c1', 'competency:k1'])).length, 1);
  assert.throws(() => idx.add({ fromType: 'nope' }));
});
test('seed relationships are valid and every endpoint exists', () => {
  const rels = json('data/seed/relationships.json').items;
  const ids = (file, type) => json(file).items.map(x => `${type}:${x.id}`);
  const known = new Set([...ids('data/seed/ecosystems.json', 'ecosystem'), ...ids('data/seed/platform-modules.json', 'platform_module'), ...ids('data/seed/knowledge-articles.json', 'article'),
    ...ids('data/seed/courses.json', 'course'), ...ids('data/seed/iso-standards.json', 'standard_family'), ...ids('data/seed/assessments.json', 'assessment'),
    ...ids('data/seed/learning-paths.json', 'learning_path'), ...ids('data/seed/library-items.json', 'library_resource'), ...ids('data/seed/competency/competencies.json', 'competency'),
    ...ids('data/seed/certifications.json', 'certification')]);  // Phase 8: courses prepare for / relate to PMI certifications
  const idx = new RelationshipIndex(rels);
  assert.equal(idx.items.length, rels.length); assert.deepEqual(idx.dangling(known), []);
});
test('seed ecosystems: the 14 of spec §4, governance-valid, published on the owner\'s recorded approval', () => {
  const eco = json('data/seed/ecosystems.json').items;
  assert.equal(eco.length, 14);
  for (const e of eco) { assert.deepEqual(validateGovernance(e), [], e.id); ownerApproved(assert, e, 'spec'); assert.ok(e.name.ar && e.name.en); }
});
test('Phase 3 seed adds governed knowledge and library while courses/questions remain absent', () => {
  const arts=json('data/seed/knowledge-articles.json').items, lib=json('data/seed/library-items.json').items;
  const tools = json('data/seed/platform-modules.json').items.length;
  assert.ok(arts.length >= 24); assert.equal(lib.filter(x => x.kind === 'tool').length, tools); assert.ok(lib.filter(x => x.kind !== 'tool').length >= 6);
  assert.ok(arts.every(a => validateGovernance(a).length === 0)); assert.ok(lib.every(a => validateGovernance(a).length === 0));
});
test('platform-modules mirror the live hub exactly (every hub toolkit, drift check)', () => {
  const hub = readFileSync(join(ROOT, '..', 'index.html'), 'utf8');
  const urlBlock = hub.slice(hub.indexOf('const URLS'), hub.indexOf('};', hub.indexOf('const URLS')));
  const hubKeys = [...urlBlock.matchAll(/^\s*(\w+):\s*"\.\/modules\//gm)].map(m => m[1]).sort();
  const mods = json('data/seed/platform-modules.json').items;
  assert.deepEqual(mods.map(m => m.id).sort(), hubKeys);
  for (const m of mods) { assert.ok(existsSync(join(ROOT, m.file.replace('../', '../'))), m.file); assert.equal(m.href, '../#m=' + m.id); assert.deepEqual(validateGovernance(m), []); }
});
test('progress tracker: empty → null percent (empty state), and build completion', () => {
  assert.deepEqual(summarizeProgress([]), { total: 0, completed: 0, inProgress: 0, remaining: 0, percent: null });
  const s = summarizeProgress([{ status: 'completed' }, { status: 'in_progress' }, { status: 'saved' }, { status: 'completed' }]);
  assert.equal(s.completed, 2); assert.equal(s.remaining, 2); assert.equal(s.percent, 0.5);
  const bs = json('data/seed/build-status.json');
  assert.equal(bs.phases.reduce((a, p) => a + p.weight, 0), 112);
  const expected = bs.phases.reduce((a, p) => a + p.weight * (p.status === 'complete' ? 1 : p.status === 'in_progress' ? (p.partial ?? 0.5) : 0), 0) / 112;
  assert.equal(buildCompletion(bs.phases), expected);
  assert.ok(bs.phases.every(p => ['complete', 'in_progress', 'next', 'planned'].includes(p.status)) && bs.phases.every(p => p.partial == null || (p.partial > 0 && p.partial < 1)));
  assert.equal(buildCompletion([{ weight: 2, status: 'in_progress' }, { weight: 2, status: 'planned' }]), 0.25);
});
test('session stub: role switching only in dev mode, only valid roles', () => {
  const prod = new LocalSession({ storage: new MockStorage({ 'cia:v1:session': '{"roles":["admin"]}' }), devMode: false });
  assert.deepEqual(prod.roles, ['learner'], 'stored roles ignored outside dev'); assert.equal(prod.setRoles(['admin']), false);
  const dev = new LocalSession({ storage: new MockStorage(), devMode: true });
  assert.equal(dev.setRoles(['admin', 'hacker']), true); assert.deepEqual(dev.roles, ['admin']);
  assert.equal(dev.setRoles(['hacker']), false);
  assert.deepEqual(new LocalSession({ storage: new MockStorage({ 'cia:v1:session': '{"roles":["root"]}' }), devMode: true }).roles, ['learner']);
});
test('form validation rules', () => {
  const m = { required: 'R', email: 'E', minLength: n => 'M' + n };
  assert.equal(validateValue('  ', { required: true }, m), 'R'); assert.equal(validateValue(false, { required: true }, m), 'R');
  assert.equal(validateValue('a@b', { type: 'email' }, m), 'E'); assert.equal(validateValue('a@b.co', { type: 'email' }, m), '');
  assert.equal(validateValue('ab', { minLength: 3 }, m), 'M3'); assert.equal(validateValue('', { minLength: 3 }, m), '');
});
test('isolation: source never touches staging data or other toolkits\' stores; no innerHTML', () => {
  for (const f of walk('src', '.js')) {
    const s = text(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(s, /_staging/, f);
    assert.doesNotMatch(s, /iso9001_|iso9001tk|audit-center:v1|cia-workspace:v1/, f);
    assert.doesNotMatch(s, /\.innerHTML\s*=|insertAdjacentHTML|document\.write/, f);
  }
});
test('CSS uses logical properties only', () => {
  for (const f of walk('assets/css', '.css')) assert.doesNotMatch(text(f), /(margin|padding|border)-(left|right)|[^-](left|right)\s*:|text-align:\s*(left|right)|float\s*:/, f);
});
