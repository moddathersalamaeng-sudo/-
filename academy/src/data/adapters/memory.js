/** In-memory adapter (tests). Same contract as the localStorage adapter. */
export class MemoryAdapter {
  constructor(seed = {}) { this.data = structuredClone(seed); this.readOnly = false; }
  async read(collection) { return structuredClone(this.data[collection] ?? []); }
  async write(collection, items) { this.data[collection] = structuredClone(items); }
  async collections() { return Object.keys(this.data); }
  async clear(collection) { delete this.data[collection]; }
}
