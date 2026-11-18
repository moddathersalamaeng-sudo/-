/**
 * Phase 14 — moving device records into an account, and merging two copies of a collection (D-111, D-112).
 * Pure: the device computes the preview with this module and the server applies the same function again, so what the
 * learner previewed is what happens.
 *
 * Rules
 *  - never overwrite: a record already in the account stays as it is; the device copy is reported as "kept in account";
 *  - never upgrade a status: verifications are not moved (same rule as backups, D-72) and lab attempts lose any
 *    same-device review, so the server re-scores them with the published lab (a status can stay or go down, never up);
 *  - idempotent: planning again after applying moves nothing;
 *  - device-only collections (reviewer screens, sync bookkeeping) are not moved.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */

export const SAFE_COLLECTION = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const MAX_RECORDS = 2000;
export const MAX_RECORD_BYTES = 200_000;

/** Collections that never leave the device: reviewer screens of the same-device workflow and the sync queue itself. */
export const DEVICE_ONLY = ['review_decisions', 'review_session', 'prefs', 'sync_queue', 'sync_meta'];
/** Collections the server writes and the learner can only read (verifications are made by a named reviewer, D-110). */
export const SERVER_GUARDED = ['passport_verifications'];
/** Collections whose records carry a status the server recomputes. */
export const RESCORED = ['lab_attempts'];

const idOf = r => (r && typeof r === 'object' && typeof r.id === 'string' && r.id ? r.id : null);
const sizeOf = r => { try { return JSON.stringify(r).length; } catch { return Infinity; } };
const stamp = r => String(r?.updated_at || r?.updatedAt || r?.saved_at || r?.submitted_at || r?.created_at || '');

/** A lab attempt without same-device reviews: the server re-scores it, so nothing is upgraded on the way. */
export function stripDeviceReviews(attempt) {
  if (!attempt || typeof attempt !== 'object') return attempt;
  const had = attempt.reviews && Object.keys(attempt.reviews).length > 0;
  return had ? { ...attempt, reviews: {}, reviewed_at: undefined, moved_without_reviews: Object.keys(attempt.reviews).length } : attempt;
}

/**
 * Plan a move. `device` and `account` are { collection: items[] }.
 * Returns { collections: [{ collection, add: [ids], kept: [ids], invalid: n }], skipped: [{ collection, reason }],
 *           reviewsNotMoved: n, totals: { add, kept, invalid } }.
 */
export function planMigration(device = {}, account = {}) {
  const out = { collections: [], skipped: [], reviewsNotMoved: 0, totals: { add: 0, kept: 0, invalid: 0 } };
  for (const c of Object.keys(device).sort()) {
    if (!SAFE_COLLECTION.test(c)) { out.skipped.push({ collection: c, reason: 'bad_name' }); continue; }
    if (DEVICE_ONLY.includes(c)) { out.skipped.push({ collection: c, reason: 'device_only' }); continue; }
    if (SERVER_GUARDED.includes(c)) { out.skipped.push({ collection: c, reason: 'verification' }); continue; }
    const items = Array.isArray(device[c]) ? device[c] : [];
    const have = new Set((Array.isArray(account[c]) ? account[c] : []).map(idOf).filter(Boolean));
    const row = { collection: c, add: [], kept: [], invalid: 0 };
    const seen = new Set();
    for (const r of items.slice(0, MAX_RECORDS)) {
      const id = idOf(r);
      if (!id || id.length > 200 || seen.has(id) || sizeOf(r) > MAX_RECORD_BYTES) { row.invalid++; continue; }
      seen.add(id);
      if (have.has(id)) { row.kept.push(id); continue; }
      row.add.push(id);
      if (RESCORED.includes(c) && r.reviews && Object.keys(r.reviews).length) out.reviewsNotMoved += Object.keys(r.reviews).length;
    }
    row.invalid += Math.max(0, items.length - MAX_RECORDS);
    if (row.add.length || row.kept.length || row.invalid) out.collections.push(row);
    out.totals.add += row.add.length; out.totals.kept += row.kept.length; out.totals.invalid += row.invalid;
  }
  return out;
}

/**
 * Apply a plan: returns { collection: newItems[] } for the collections that change (account items first, unchanged,
 * then the added device records). Records are prepared with `prepare(collection, record)` (the server re-scores lab attempts).
 */
export function applyMigration(device = {}, account = {}, { prepare = (c, r) => (RESCORED.includes(c) ? stripDeviceReviews(r) : r) } = {}) {
  const plan = planMigration(device, account);
  const result = {};
  for (const row of plan.collections) {
    if (!row.add.length) continue;
    const want = new Set(row.add);
    const added = [];
    for (const r of device[row.collection]) {
      const id = idOf(r);
      if (id && want.has(id)) { added.push(prepare(row.collection, r)); want.delete(id); }
    }
    result[row.collection] = [...(Array.isArray(account[row.collection]) ? account[row.collection] : []), ...added];
  }
  return { plan, result };
}

/**
 * Merge two copies of one collection after a version conflict (sync between two devices).
 * Records only on one side are kept; for a record on both sides the account copy wins unless the device copy carries a
 * later time stamp (updated_at / saved_at / submitted_at / created_at). Guarded collections always take the account copy.
 */
export function mergeCollection(collection, deviceItems = [], accountItems = []) {
  if (SERVER_GUARDED.includes(collection)) return [...accountItems];
  const byId = new Map();
  for (const r of accountItems) { const id = idOf(r); if (id) byId.set(id, r); }
  const order = accountItems.map(idOf).filter(Boolean);
  for (const r of deviceItems) {
    const id = idOf(r);
    if (!id) continue;
    if (!byId.has(id)) { byId.set(id, r); order.push(id); continue; }
    const a = byId.get(id);
    if (stamp(r) && stamp(r) > stamp(a)) byId.set(id, r);
  }
  return order.map(id => byId.get(id));
}
