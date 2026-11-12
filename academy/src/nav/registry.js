/**
 * Navigation registry: one entry per spec §3 item plus "Library" (ADD-8)
 * and the Company Portal placeholder (ADD-13). `requiredTier` (ADD-16) is
 * stored, not enforced, in Phase 1.
 */
import { ROLES } from '../session/roles.js';
export const TIERS = ['free', 'professional', 'corporate'];
export const STATUSES = ['active', 'coming'];
export const KINDS = ['route', 'platform'];
/** Phase 10A: where an entry is shown (see navigation.json `note`). */
export const PLACEMENTS = ['top', 'panel', 'menu', 'user', 'footer', 'button', 'hidden', 'plan'];
export const MAX_TOP = 5;
export const MAX_MENU = 12;

export function validateEntry(e) {
  const v = [];
  for (const f of ['id', 'labelKey', 'kind', 'status']) if (typeof e[f] !== 'string' || !e[f]) v.push('missing_' + f);
  if (!Number.isInteger(e.phase) && e.phase !== '12A') v.push('missing_phase');
  if (!TIERS.includes(e.requiredTier)) v.push('bad_requiredTier');
  if (!STATUSES.includes(e.status)) v.push('bad_status');
  if (!KINDS.includes(e.kind)) v.push('bad_kind');
  if (!Array.isArray(e.roles) || !e.roles.length || !e.roles.every(r => ROLES.includes(r))) v.push('bad_roles');
  if (e.status === 'active' && e.kind === 'route' && !(typeof e.route === 'string' && e.route.startsWith('/'))) v.push('active_route_without_path');
  if (e.status === 'active' && e.kind === 'platform' && typeof e.href !== 'string') v.push('platform_without_href');
  if (e.status === 'coming' && (e.route || e.href)) v.push('coming_entry_must_not_link');
  if (!PLACEMENTS.includes(e.placement)) v.push('bad_placement');
  if (e.status === 'coming' && e.placement !== 'plan') v.push('coming_entry_must_be_plan_only');
  if (e.placement === 'plan' && e.status !== 'coming') v.push('plan_entry_must_be_coming');
  if (e.placement === 'top' && (e.status !== 'active' || e.kind !== 'route' || !e.roles.includes('learner'))) v.push('top_entry_must_be_active_learner_route');
  return v;
}

export function validateRegistry(entries) {
  const errors = [];
  const ids = new Set();
  entries.forEach(e => {
    if (ids.has(e.id)) errors.push(`${e.id}: duplicate_id`); ids.add(e.id);
    validateEntry(e).forEach(x => errors.push(`${e.id}: ${x}`));
  });
  if (entries.every(e => 'placement' in e)) {
    const top = entries.filter(e => e.placement === 'top');
    if (top.length > MAX_TOP) errors.push(`registry: ${top.length} top items (max ${MAX_TOP})`);
    const menu = shellEntries(entries, ['learner'], 'menu');
    if (menu.length > MAX_MENU) errors.push(`registry: ${menu.length} learner menu entries (max ${MAX_MENU})`);
    const routes = new Map();
    for (const e of entries.filter(x => x.status === 'active' && x.placement !== 'hidden' && x.route)) {
      if (routes.has(e.route)) errors.push(`registry: ${e.id} duplicates the link of ${routes.get(e.route)}`); else routes.set(e.route, e.id);
    }
  }
  return errors;
}

/**
 * Entries the shell shows in one place for these roles. Future-phase ("coming") entries are never shown in the shell:
 * reviewers and admins see them on the build plan (About our content). Top items keep their `order`.
 */
export function shellEntries(entries, roles, placement) {
  return visibleEntries(entries, roles).filter(e => e.placement === placement && e.status === 'active')
    .sort((a, b) => (a.order || 99) - (b.order || 99));
}
/** Future-phase entries, for the build plan only. */
export const planEntries = (entries, roles) => visibleEntries(entries, roles).filter(e => e.placement === 'plan');

export const visibleEntries = (entries, roles) => entries.filter(e => e.roles.some(r => roles.includes(r)));
export const groupEntries = entries => entries.reduce((m, e) => ((m[e.group] ||= []).push(e), m), {});
