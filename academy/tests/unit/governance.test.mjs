import test from 'node:test'; import assert from 'node:assert/strict';
import { validateGovernance, isVisible, isIsoDate, GovernanceError } from '../../src/data/governance.js';
import { CollectionRepository, ContentRepository } from '../../src/data/repository.js';
import { MemoryAdapter } from '../../src/data/adapters/memory.js';
const g = (o) => ({ id: 'x', governance: { content_status: 'draft', content_source: 'owner', version: '1', reviewer: null, review_date: null, ...o } });

test('ISO date validation', () => {
  assert.ok(isIsoDate('2026-09-27')); assert.ok(!isIsoDate('2026-02-30')); assert.ok(!isIsoDate('27/09/2026')); assert.ok(!isIsoDate(null));
});
test('published requires named reviewer and ISO review date', () => {
  assert.deepEqual(validateGovernance(g({ content_status: 'published' })).sort(), ['published_without_iso_review_date', 'published_without_reviewer']);
  assert.deepEqual(validateGovernance(g({ content_status: 'published', reviewer: '  ', review_date: '2026-09-27' })), ['published_without_reviewer']);
  assert.deepEqual(validateGovernance(g({ content_status: 'published', reviewer: 'مدثر سلامه', review_date: '2026-09-27' })), []);
});
test('AI drafts can never be published', () => {
  assert.ok(validateGovernance(g({ content_status: 'published', content_source: 'ai_draft', reviewer: 'R', review_date: '2026-09-27' })).includes('ai_draft_cannot_publish_unreviewed'));
});
test('missing block and bad enums are rejected', () => {
  assert.deepEqual(validateGovernance({ id: 'y' }), ['missing_governance_block']);
  assert.ok(validateGovernance(g({ content_status: 'live' })).includes('invalid_content_status'));
});
test('repository save enforces the gate', async () => {
  const repo = new CollectionRepository({ adapter: new MemoryAdapter(), collection: 'articles', governed: true });
  await assert.rejects(repo.save(g({ content_status: 'published' })), GovernanceError);
  assert.deepEqual(await repo.list(), []);
  await repo.save(g({ content_status: 'needs_review' }));
  assert.equal((await repo.list()).length, 1);
});
test('content repository withholds invalid records and reports them', async () => {
  const bad = { ...g({ content_status: 'published' }), id: 'bad' };
  const pub = { ...g({ content_status: 'published', reviewer: 'R', review_date: '2026-09-27' }), id: 'pub' };
  const draft = { ...g({ content_status: 'needs_review' }), id: 'draft' };
  const repo = new ContentRepository({ adapter: new MemoryAdapter({ c: [bad, pub, draft] }), collection: 'c' });
  assert.deepEqual((await repo.listVisible(['learner'])).map(r => r.id), ['pub']);
  assert.deepEqual((await repo.listVisible(['reviewer'])).map(r => r.id), ['pub', 'draft']);
  assert.equal(repo.diagnostics[0].id, 'bad');
  assert.equal(isVisible(draft, ['admin']), true);
});
