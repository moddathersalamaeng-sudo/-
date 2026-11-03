/**
 * Local session stub (decision D-04). No real authentication is claimed:
 * every visitor is a local learner. The auth interface below is what a real
 * provider will implement later; the role switcher exists only in dev mode.
 */
import { Emitter } from '../core/events.js';
import { isRole } from './roles.js';

export const SESSION_KEY = 'cia:v1:session';
export const DEFAULT_USER = Object.freeze({ id: 'local', roles: ['learner'], provider: 'local-stub' });

/** Contract for a future auth provider. */
export const AuthProviderInterface = ['getUser', 'signIn', 'signOut'];

export class LocalSession extends Emitter {
  constructor({ storage, devMode = false, defaultRoles = null }) {
    super(); this.storage = storage; this.devMode = devMode;
    this.defaultRoles = Array.isArray(defaultRoles) && defaultRoles.length && defaultRoles.every(isRole) ? defaultRoles : null;
    this.user = this.#load();
  }
  #load() {
    if (!this.devMode) return { ...DEFAULT_USER };
    try {
      const s = JSON.parse(this.storage.getItem(SESSION_KEY) || 'null');
      if (s && Array.isArray(s.roles) && s.roles.length && s.roles.every(isRole)) return { ...DEFAULT_USER, roles: s.roles };
    } catch { /* fall through */ }
    return this.defaultRoles ? { ...DEFAULT_USER, roles: [...this.defaultRoles] } : { ...DEFAULT_USER };
  }
  get roles() { return this.user.roles; }
  hasRole(r) { return this.user.roles.includes(r); }
  /** Dev-only. Silently refused outside dev mode. */
  setRoles(roles) {
    if (!this.devMode) return false;
    const clean = [...new Set(roles.filter(isRole))];
    if (!clean.length) return false;
    this.user = { ...this.user, roles: clean };
    try { this.storage.setItem(SESSION_KEY, JSON.stringify({ roles: clean })); } catch { /* ignore */ }
    this.emit('change', this.user);
    return true;
  }
}
