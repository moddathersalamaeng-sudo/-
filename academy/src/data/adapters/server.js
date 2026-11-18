/**
 * Phase 14 — server adapter and synced adapter (D-04, D-112).
 *
 *  ApiClient      fetch wrapper for /api/v1 with the session token; errors become ApiError { status, code }.
 *  ServerAdapter  the adapter contract (read, write, collections, clear) against the account's records. Each write carries
 *                 the collection's version; when another device changed it in between, the copies are merged by record id
 *                 (mergeCollection) and written again.
 *  SyncedAdapter  the adapter the app uses when signed in: the device copy (LocalStorageAdapter for the account id) is the
 *                 working copy, so the Academy keeps working offline; changes are queued and pushed to the account; on start
 *                 the account copy is pulled for every collection without pending changes. `onChange` lets the app count
 *                 first-party analytics events from record changes (D-119) without touching views.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { mergeCollection, SERVER_GUARDED, DEVICE_ONLY } from '../../domain/migration.mjs';

export class ApiError extends Error {
  constructor(status, code, detail = null) { super(`${status} ${code}`); this.name = 'ApiError'; this.status = status; this.code = code; this.detail = detail; }
  get offline() { return this.status === 0; }
}

export class ApiClient {
  /** @param {{ base: string, getToken?: () => string|null, fetchImpl?: Function, onUnauthorized?: Function }} o */
  constructor({ base, getToken = () => null, fetchImpl = (...a) => globalThis.fetch(...a), onUnauthorized = null }) {
    this.base = String(base || '').replace(/\/+$/, ''); this.getToken = getToken; this.fetch = fetchImpl; this.onUnauthorized = onUnauthorized;
  }
  async req(method, path, body) {
    const token = this.getToken();
    let res;
    try {
      res = await this.fetch(this.base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' });
    } catch { throw new ApiError(0, 'offline'); }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = null; } }
    if (res.status === 401 && token) this.onUnauthorized?.();
    if (!res.ok && res.status !== 409) throw new ApiError(res.status, data?.code || 'error', data?.detail || null);
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p).then(r => r.data); }
  post(p, b = {}) { return this.req('POST', p, b).then(r => r.data); }
  put(p, b = {}) { return this.req('PUT', p, b).then(r => r.data); }
  patch(p, b = {}) { return this.req('PATCH', p, b).then(r => r.data); }
  del(p, b) { return this.req('DELETE', p, b).then(r => r.data); }
}

export class ServerAdapter {
  constructor({ api }) { this.api = api; this.readOnly = false; this.versions = new Map(); }
  async read(collection) {
    const d = await this.api.get(`/collections/${encodeURIComponent(collection)}`);
    this.versions.set(collection, d.version);
    return d.items;
  }
  /** Returns the items as stored (lab attempts come back re-scored by the server). */
  async write(collection, items) {
    if (SERVER_GUARDED.includes(collection)) return this.read(collection);
    let base = this.versions.has(collection) ? this.versions.get(collection) : null;
    let payload = items;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await this.api.req('PUT', `/collections/${encodeURIComponent(collection)}`, { items: payload, base_version: base });
      if (r.status !== 409) { this.versions.set(collection, r.data.version); return r.data.items || payload; }
      payload = mergeCollection(collection, payload, r.data.items || []);
      base = r.data.version;
    }
    throw new ApiError(409, 'version');
  }
  async collections() { return (await this.api.get('/collections')).collections.filter(c => c.count > 0).map(c => c.collection).sort(); }
  async clear(collection) { const d = await this.api.del(`/collections/${encodeURIComponent(collection)}`); this.versions.set(collection, d.version); }
}

export const QUEUE_COLLECTION = 'sync_queue';

export class SyncedAdapter {
  /** @param {{ local, server, onChange?: (collection, before, after) => void, onStatus?: (s) => void }} o */
  constructor({ local, server, onChange = null, onStatus = null }) {
    Object.assign(this, { local, server, onChange, onStatus }); this.readOnly = false; this.flushing = null; this.state = 'idle';
  }
  #status(s) { this.state = s; this.onStatus?.(s); }
  async #queue() { return (await this.local.read(QUEUE_COLLECTION).catch(() => [])).map(x => x.id); }
  async #setQueue(ids) { await this.local.write(QUEUE_COLLECTION, [...new Set(ids)].map(id => ({ id }))); }

  async read(collection) { return this.local.read(collection); }
  async write(collection, items) {
    let before = null;
    if (this.onChange) before = await this.local.read(collection).catch(() => []);
    await this.local.write(collection, items);
    if (this.onChange) { try { this.onChange(collection, before, items); } catch { /* analytics never breaks a save */ } }
    if (DEVICE_ONLY.includes(collection) || SERVER_GUARDED.includes(collection)) return;
    await this.#setQueue([...(await this.#queue()), collection]);
    this.flush();
  }
  async collections() { return (await this.local.collections()).filter(c => c !== QUEUE_COLLECTION); }
  async clear(collection) {
    await this.local.clear(collection);
    if (DEVICE_ONLY.includes(collection) || SERVER_GUARDED.includes(collection)) return;
    await this.#setQueue([...(await this.#queue()), collection]);
    this.flush();
  }
  /** Push every queued collection. Offline: keep the queue and stop; it is sent on the next change or when the connection returns. */
  flush() {
    this.flushing ||= (async () => {
      try {
        for (;;) {
          const q = await this.#queue();
          if (!q.length) { this.#status('synced'); return; }
          this.#status('syncing');
          const c = q[0];
          const stored = await this.server.write(c, await this.local.read(c));
          if (c === 'lab_attempts') await this.local.write(c, stored);
          await this.#setQueue((await this.#queue()).filter(x => x !== c));
        }
      } catch (e) {
        this.#status(e?.offline ? 'offline' : 'error');
      } finally { this.flushing = null; }
    })();
    return this.flushing;
  }
  /** After sign-in or on start: take the account copy of every collection that has no pending local change. Returns how many collections changed on the device. */
  async pull() {
    try {
      const pending = new Set(await this.#queue());
      const names = await this.server.collections();
      let changed = 0;
      const take = async (c, items) => {
        const mine = await this.local.read(c).catch(() => []);
        if (JSON.stringify(mine) !== JSON.stringify(items)) { await this.local.write(c, items); changed++; }
      };
      for (const c of names) if (!pending.has(c)) await take(c, await this.server.read(c));
      for (const c of SERVER_GUARDED) if (!pending.has(c)) await take(c, await this.server.read(c).catch(() => []));
      await this.flush();
      return changed;
    } catch (e) { this.#status(e?.offline ? 'offline' : 'error'); return 0; }
  }
  pending() { return this.#queue(); }
}
