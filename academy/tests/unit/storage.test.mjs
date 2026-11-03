import test from 'node:test'; import assert from 'node:assert/strict';
import { LocalStorageAdapter, storageKey, NamespaceError } from '../../src/data/adapters/local-storage.js';
import { CollectionRepository } from '../../src/data/repository.js';
import { exportData, importData, validateImport } from '../../src/data/transfer.js';
import { MockStorage } from './_util.mjs';
import { MemoryAdapter } from '../../src/data/adapters/memory.js';

const FOREIGN = { 'iso9001tk:v1': '{"x":1}', 'iso9001_clause_4': '1', 'cia-lang': 'en', 'cia-workspace:v1': '{}', 'audit-center:v1': '{}', 'cia:v1:other:prefs': '{"schema":1,"items":[]}' };

test('keys are namespaced and unsafe parts refused', () => {
  assert.equal(storageKey('local', 'prefs'), 'cia:v1:local:prefs');
  for (const bad of ['../x', 'a:b', '', 'A', 'x y']) assert.throws(() => storageKey('local', bad), NamespaceError);
});
test('adapter never reads or writes foreign keys (toolkits, iso9001_*, other users)', async () => {
  const s = new MockStorage(FOREIGN);
  const a = new LocalStorageAdapter({ storage: s, userId: 'local' });
  const repo = new CollectionRepository({ adapter: a, collection: 'enrollments' });
  await repo.save({ id: 'e1', status: 'in_progress' });
  assert.deepEqual(await a.collections(), ['enrollments']);
  for (const c of await a.collections()) await a.clear(c);
  const snap = s.snapshot();
  for (const [k, v] of Object.entries(FOREIGN)) assert.equal(snap[k], v, k);
  assert.equal(Object.keys(snap).length, Object.keys(FOREIGN).length);
});
test('state survives a new adapter instance (reload) and is schema-versioned', async () => {
  const s = new MockStorage();
  await new CollectionRepository({ adapter: new LocalStorageAdapter({ storage: s, userId: 'local' }), collection: 'prefs' }).save({ id: 'ui', theme: 'dark' });
  const again = new CollectionRepository({ adapter: new LocalStorageAdapter({ storage: s, userId: 'local' }), collection: 'prefs' });
  assert.equal((await again.get('ui')).theme, 'dark');
  assert.equal(JSON.parse(s.getItem('cia:v1:local:prefs')).schema, 1);
});
test('corrupt or newer-schema data is rejected, not silently used', async () => {
  const a = new LocalStorageAdapter({ storage: new MockStorage({ 'cia:v1:local:x': 'not json', 'cia:v1:local:y': '{"schema":99,"items":[]}' }), userId: 'local' });
  await assert.rejects(a.read('x'), /Corrupt/); await assert.rejects(a.read('y'), /newer version/);
});
test('adapters are swappable behind the same repository contract', async () => {
  for (const adapter of [new MemoryAdapter(), new LocalStorageAdapter({ storage: new MockStorage(), userId: 'local' })]) {
    const r = new CollectionRepository({ adapter, collection: 'activity' });
    await r.save({ id: 'a' }); await r.save({ id: 'a', v: 2 }); await r.save({ id: 'b' });
    assert.equal((await r.list()).length, 2); assert.equal((await r.get('a')).v, 2);
    assert.equal(await r.remove('a'), true); assert.equal(await r.get('a'), null);
  }
});
test('export / import round-trip and import validation', async () => {
  const src = new LocalStorageAdapter({ storage: new MockStorage(FOREIGN), userId: 'local' });
  await src.write('prefs', [{ id: 'ui', theme: 'dark' }]); await src.write('enrollments', [{ id: 'e1' }]);
  const dump = JSON.parse(JSON.stringify(await exportData(src, 'local')));
  assert.deepEqual(Object.keys(dump.collections), ['enrollments', 'prefs']);
  const dstStorage = new MockStorage(); const dst = new LocalStorageAdapter({ storage: dstStorage, userId: 'local' });
  assert.equal(await importData(dst, dump), 2);
  assert.deepEqual(await dst.read('prefs'), [{ id: 'ui', theme: 'dark' }]);
  assert.ok(Object.keys(dstStorage.snapshot()).every(k => k.startsWith('cia:v1:local:')));
  assert.deepEqual(validateImport({ app: 'x', schema: 1, collections: {} }), ['wrong_app']);
  assert.ok(validateImport({ app: 'cia-academy', schema: 1, collections: { 'iso9001tk:v1': [] } }).includes('bad_collection_name'));
  assert.ok(validateImport({ app: 'cia-academy', schema: 7, collections: {} }).includes('unsupported_schema'));
  assert.deepEqual(validateImport('nope'), ['not_json_object']);
  await assert.rejects(importData(dst, { app: 'x' }), /Import rejected/);
});
