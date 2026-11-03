/**
 * Read-only adapter over versioned JSON files shipped with the Academy
 * (decision D-03). `fetcher` is injected so tests can run without a browser.
 */
export class StaticJsonAdapter {
  constructor({ base, fetcher = (u) => fetch(u) }) { this.base = base.replace(/\/$/, ''); this.fetcher = fetcher; this.readOnly = true; this.cache = new Map(); }
  async read(collection) {
    if (!/^[a-z0-9_-]+$/.test(collection)) throw new Error('Bad collection name');
    if (this.cache.has(collection)) return structuredClone(this.cache.get(collection));
    const res = await this.fetcher(`${this.base}/${collection}.json`);
    if (!res.ok) throw new Error(`Failed to load ${collection} (${res.status})`);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.items;
    if (!Array.isArray(items)) throw new Error(`Malformed ${collection}.json`);
    this.cache.set(collection, items);
    return structuredClone(items);
  }
  async write() { throw new Error('Static content is read-only'); }
  async collections() { return [...this.cache.keys()]; }
}
