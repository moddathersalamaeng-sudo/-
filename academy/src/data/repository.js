/**
 * Repository layer: views talk to repositories, never to storage directly,
 * so adapters are swappable (static JSON → API later) without touching UI.
 */
import { assertValid, isVisible, validateGovernance } from './governance.js';

export class CollectionRepository {
  /** @param {{adapter, collection, governed?:boolean, idField?:string}} o */
  constructor({ adapter, collection, governed = false, idField = 'id' }) {
    Object.assign(this, { adapter, collection, governed, idField });
  }
  async list() { return this.adapter.read(this.collection); }
  async get(id) { return (await this.list()).find(r => r[this.idField] === id) ?? null; }
  async save(record) {
    if (this.adapter.readOnly) throw new Error(`${this.collection} is read-only`);
    if (!record || typeof record[this.idField] !== 'string' || !record[this.idField]) throw new Error('Record needs a string id');
    if (this.governed) assertValid(record);
    const items = await this.list();
    const i = items.findIndex(r => r[this.idField] === record[this.idField]);
    if (i >= 0) items[i] = record; else items.push(record);
    await this.adapter.write(this.collection, items);
    return record;
  }
  async remove(id) {
    if (this.adapter.readOnly) throw new Error(`${this.collection} is read-only`);
    const items = await this.list();
    const next = items.filter(r => r[this.idField] !== id);
    await this.adapter.write(this.collection, next);
    return next.length !== items.length;
  }
}

/**
 * Governed content repository (read path). Records failing the gate are
 * withheld from every caller and reported through `diagnostics`.
 */
export class ContentRepository {
  constructor({ adapter, collection }) { this.adapter = adapter; this.collection = collection; this.diagnostics = []; }
  async listAll() {
    const items = await this.adapter.read(this.collection);
    this.diagnostics = [];
    return items.filter(r => {
      const v = validateGovernance(r);
      if (v.length) { this.diagnostics.push({ id: r?.id, violations: v }); return false; }
      return true;
    });
  }
  async listVisible(roles) { return (await this.listAll()).filter(r => isVisible(r, roles)); }
}
