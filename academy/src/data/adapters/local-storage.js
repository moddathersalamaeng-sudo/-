/**
 * Namespaced, schema-versioned localStorage adapter.
 * Keys: `cia:v1:<userId>:<collection>`. The adapter refuses to touch any key
 * outside its own namespace — in particular the existing toolkits' stores
 * (`iso9001tk:v1`, `audit-center:v1`, `cia-workspace:v1`, …) and legacy `iso9001_*`.
 */
export const NS = 'cia:v1';
export const SCHEMA_VERSION = 1;
const SAFE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export class NamespaceError extends Error { constructor(m) { super(m); this.name = 'NamespaceError'; } }

export function storageKey(userId, collection) {
  if (!SAFE.test(userId) || !SAFE.test(collection)) throw new NamespaceError(`Unsafe key part: ${userId}/${collection}`);
  return `${NS}:${userId}:${collection}`;
}

/** Schema migrations: from version n to n+1. Empty until a schema change needs one. */
export const MIGRATIONS = {};

export function migrate(envelope) {
  let env = envelope;
  while (env.schema < SCHEMA_VERSION) {
    const step = MIGRATIONS[env.schema];
    if (!step) throw new Error(`No migration from schema ${env.schema}`);
    env = step(env);
  }
  return env;
}

export class LocalStorageAdapter {
  constructor({ storage, userId }) { this.storage = storage; this.userId = userId; this.readOnly = false; }
  key(c) { return storageKey(this.userId, c); }
  async read(collection) {
    const raw = this.storage.getItem(this.key(collection));
    if (!raw) return [];
    let env;
    try { env = JSON.parse(raw); } catch { throw new Error(`Corrupt data in ${collection}`); }
    if (!env || typeof env.schema !== 'number' || !Array.isArray(env.items)) throw new Error(`Corrupt data in ${collection}`);
    if (env.schema > SCHEMA_VERSION) throw new Error(`Data in ${collection} is from a newer version`);
    return migrate(env).items;
  }
  async write(collection, items) {
    this.storage.setItem(this.key(collection), JSON.stringify({ schema: SCHEMA_VERSION, updatedAt: new Date().toISOString(), items }));
  }
  async collections() {
    const prefix = `${NS}:${this.userId}:`; const out = [];
    for (let i = 0; i < this.storage.length; i++) { const k = this.storage.key(i); if (k?.startsWith(prefix)) out.push(k.slice(prefix.length)); }
    return out.sort();
  }
  async clear(collection) { this.storage.removeItem(this.key(collection)); }
}
