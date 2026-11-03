/**
 * Learner data export / import (JSON round-trip). Only the Academy namespace
 * for the current user is ever read or written.
 */
import { SCHEMA_VERSION } from './adapters/local-storage.js';
export const APP_ID = 'cia-academy';

export async function exportData(adapter, userId) {
  const collections = {};
  for (const c of await adapter.collections()) collections[c] = await adapter.read(c);
  return { app: APP_ID, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), userId, collections };
}

export function validateImport(payload) {
  const e = [];
  if (!payload || typeof payload !== 'object') return ['not_json_object'];
  if (payload.app !== APP_ID) e.push('wrong_app');
  if (typeof payload.schema !== 'number' || payload.schema > SCHEMA_VERSION) e.push('unsupported_schema');
  if (!payload.collections || typeof payload.collections !== 'object' || Array.isArray(payload.collections)) e.push('missing_collections');
  else for (const [k, v] of Object.entries(payload.collections)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(k)) e.push('bad_collection_name');
    if (!Array.isArray(v)) e.push('collection_not_array');
  }
  return [...new Set(e)];
}

export async function importData(adapter, payload) {
  const errors = validateImport(payload);
  if (errors.length) { const err = new Error('Import rejected: ' + errors.join(', ')); err.codes = errors; throw err; }
  const names = Object.keys(payload.collections);
  for (const c of names) await adapter.write(c, payload.collections[c]);
  return names.length;
}
