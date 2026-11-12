/**
 * Phase 10A data split (F7). Read-only adapter over data/seed/split/ (written by tools/build_phase10a.mjs):
 *   read('courses-index')  light course records for lists and cards (loaded by most pages)
 *   read('courses')        every full course record (all academy shards; used by the review queue only)
 *   read('questions')      every question (all shards; review queue only)
 *   readShards(c, keys)    the full records of some academies only — course pages, lessons and assessments use this
 * Records are returned exactly as written in the master files; the governance gate stays in the repositories / callers.
 * Each shard is fetched once per page load and cached; `fetcher` is injected so unit tests run without a browser.
 */
export class SplitJsonAdapter {
  constructor({ base, fetcher = (u) => fetch(u, { cache: 'no-cache' }) }) {
    this.base = base.replace(/\/$/, ''); this.fetcher = fetcher; this.readOnly = true;
    this.files = new Map(); this.manifestP = null; this.fetched = [];
  }
  async file(name) {
    if (!/^[a-z0-9_-]+\.json$/.test(name)) throw new Error('Bad split file name');
    if (!this.files.has(name)) {
      this.files.set(name, (async () => {
        const res = await this.fetcher(`${this.base}/${name}`);
        if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
        this.fetched.push(name);
        const body = await res.json();
        if (!Array.isArray(body?.items)) throw new Error(`Malformed ${name}`);
        return body.items;
      })().catch(err => { this.files.delete(name); throw err; }));
    }
    return this.files.get(name);
  }
  manifest() {
    if (!this.manifestP) this.manifestP = (async () => {
      const res = await this.fetcher(`${this.base}/manifest.json`);
      if (!res.ok) throw new Error(`Failed to load split manifest (${res.status})`);
      this.fetched.push('manifest.json');
      return res.json();
    })().catch(err => { this.manifestP = null; throw err; });
    return this.manifestP;
  }
  async collectionDef(collection) {
    const m = await this.manifest();
    const def = m.collections?.[collection];
    if (!def) throw new Error(`Unknown split collection ${collection}`);
    return def;
  }
  async read(collection) {
    /* courses-index, labs-index (Phase 11): one light file each. */
    if (/^[a-z]+-index$/.test(collection)) return structuredClone(await this.file(`${collection}.json`));
    const def = await this.collectionDef(collection);
    return this.readShards(collection, Object.keys(def.shards));
  }
  async readShards(collection, keys = []) {
    const def = await this.collectionDef(collection);
    const files = [...new Set(keys)].map(k => def.shards[k]).filter(Boolean);
    const parts = await Promise.all(files.map(f => this.file(f)));
    return structuredClone(parts.flat());
  }
  /** Shard keys holding the given question ids (from the manifest's id map). */
  async questionShardsFor(ids = []) {
    const def = await this.collectionDef('questions');
    const want = new Set(ids);
    return Object.entries(def.ids || {}).filter(([, xs]) => xs.some(id => want.has(id))).map(([k]) => k);
  }
  async write() { throw new Error('Static content is read-only'); }
}
