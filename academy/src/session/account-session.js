/**
 * Phase 14 — account session behind the existing session interface (D-04): `user`, `roles`, `hasRole`, `setRoles`, `on('change')`.
 * Signed out it behaves exactly like LocalSession outside dev mode (one local learner). Signed in, roles come from the
 * server (`/auth/me`); the token is kept under `cia:v1:auth` and the cached user lets the Academy open offline.
 * Roles shown here only shape the interface: the server and the database check every action again.
 */
import { Emitter } from '../core/events.js';
import { isRole } from './roles.js';
import { DEFAULT_USER } from './session.js';

export const AUTH_KEY = 'cia:v1:auth';

export class AccountSession extends Emitter {
  constructor({ storage, api }) {
    super(); this.storage = storage; this.api = api; this.devMode = false;
    const saved = this.#read();
    this.token = saved?.token || null;
    this.user = saved?.user ? this.#user(saved.user) : { ...DEFAULT_USER };
    this.orgs = saved?.orgs || [];
    api.getToken = () => this.token;
    api.onUnauthorized = () => this.#forget(true);
  }
  #read() { try { return JSON.parse(this.storage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  #save() { try { this.storage.setItem(AUTH_KEY, JSON.stringify({ token: this.token, user: this.user, orgs: this.orgs })); } catch { /* storage blocked */ } }
  #user(u) {
    const roles = (Array.isArray(u.roles) ? u.roles : []).filter(isRole);
    return { id: String(u.id).toLowerCase(), email: u.email || '', display_name: u.display_name || '', roles: roles.length ? roles : ['learner'], provider: 'account' };
  }
  #forget(emit) {
    this.token = null; this.user = { ...DEFAULT_USER }; this.orgs = [];
    try { this.storage.removeItem(AUTH_KEY); } catch { /* ignore */ }
    if (emit) this.emit('signedout');
  }
  get signedIn() { return !!this.token && this.user.provider === 'account'; }
  get roles() { return this.user.roles; }
  hasRole(r) { return this.user.roles.includes(r); }
  setRoles() { return false; }               // roles are granted on the server, never switched in the browser

  async #take(d) { this.token = d.token; this.user = this.#user(d.user); this.#save(); await this.refresh(); return this.user; }
  async signUp({ email, password, display_name }) { return this.#take(await this.api.post('/auth/signup', { email, password, display_name })); }
  async signIn({ email, password }) { return this.#take(await this.api.post('/auth/signin', { email, password })); }
  async signOut() { try { await this.api.post('/auth/signout', {}); } catch { /* offline: the token is dropped anyway */ } this.#forget(false); }
  /** Refresh roles and organisations. Offline keeps the cached user (offline-first). */
  async refresh() {
    if (!this.token) return this.user;
    try {
      const d = await this.api.get('/auth/me');
      this.user = this.#user(d.user); this.orgs = d.orgs || []; this.#save(); this.emit('change', this.user);
    } catch (e) { if (e?.status === 401) this.#forget(true); }
    return this.user;
  }
  requestReset(email) { return this.api.post('/auth/reset/request', { email }); }
  confirmReset(token, password) { return this.api.post('/auth/reset/confirm', { token, password }); }
  async deleteAccount(password) { await this.api.del('/account', { password }); this.#forget(false); }
}
