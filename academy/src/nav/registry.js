/**
 * Navigation registry: one entry per spec §3 item plus "Library" (ADD-8)
 * and the Company Portal placeholder (ADD-13). `requiredTier` (ADD-16) is
 * stored, not enforced, in Phase 1.
 */
import { ROLES } from '../session/roles.js';
export const TIERS = ['free', 'professional', 'corporate'];
export const STATUSES = ['active', 'coming'];
export const KINDS = ['route', 'platform'];

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
  return v;
}

export function validateRegistry(entries) {
  const errors = [];
  const ids = new Set();
  entries.forEach(e => {
    if (ids.has(e.id)) errors.push(`${e.id}: duplicate_id`); ids.add(e.id);
    validateEntry(e).forEach(x => errors.push(`${e.id}: ${x}`));
  });
  return errors;
}

export const visibleEntries = (entries, roles) => entries.filter(e => e.roles.some(r => roles.includes(r)));
export const groupEntries = entries => entries.reduce((m, e) => ((m[e.group] ||= []).push(e), m), {});
