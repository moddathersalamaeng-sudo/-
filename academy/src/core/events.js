/** Minimal synchronous event emitter used by services (i18n, session, prefs). */
export class Emitter {
  #m = new Map();
  on(type, fn) { (this.#m.get(type) || this.#m.set(type, new Set()).get(type)).add(fn); return () => this.off(type, fn); }
  off(type, fn) { this.#m.get(type)?.delete(fn); }
  emit(type, payload) { for (const fn of [...(this.#m.get(type) || [])]) fn(payload); }
}
