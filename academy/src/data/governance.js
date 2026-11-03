/**
 * Content governance gate (DATA_MODEL §1, spec §25–26).
 * Every content record carries a `governance` block. A record may only be
 * `published` when a named human reviewer and an ISO review date are present.
 * The gate is enforced inside repositories — it is not a UI suggestion.
 */
export const GOVERNANCE_STATES = ['draft', 'needs_review', 'in_review', 'approved', 'published', 'archived'];
export const CONTENT_SOURCES = ['owner', 'spec', 'sme', 'external_public', 'ai_draft', 'system'];
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class GovernanceError extends Error {
  constructor(message, code, recordId) { super(message); this.name = 'GovernanceError'; this.code = code; this.recordId = recordId; }
}

export function isIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Returns a list of violations (empty = valid). */
export function validateGovernance(record) {
  const v = [];
  const g = record?.governance;
  if (!g || typeof g !== 'object') return ['missing_governance_block'];
  if (!GOVERNANCE_STATES.includes(g.content_status)) v.push('invalid_content_status');
  if (!CONTENT_SOURCES.includes(g.content_source)) v.push('invalid_content_source');
  if (typeof g.version !== 'string' || !g.version) v.push('missing_version');
  if (g.content_status === 'published' || g.content_status === 'approved') {
    if (typeof g.reviewer !== 'string' || !g.reviewer.trim()) v.push('published_without_reviewer');
    if (!isIsoDate(g.review_date)) v.push('published_without_iso_review_date');
  }
  if (g.content_status === 'published' && g.content_source === 'ai_draft') v.push('ai_draft_cannot_publish_unreviewed');
  if (g.review_date != null && !isIsoDate(g.review_date)) v.push('invalid_review_date');
  return [...new Set(v)];
}

export function assertValid(record) {
  const v = validateGovernance(record);
  if (v.length) throw new GovernanceError(`Governance gate blocked "${record?.id}": ${v.join(', ')}`, v[0], record?.id);
  return record;
}

/** Learner-facing visibility: only published records. Reviewers/admins see everything. */
export function isVisible(record, roles = []) {
  if (validateGovernance(record).length) return false;
  if (record.governance.content_status === 'published') return true;
  return roles.includes('reviewer') || roles.includes('admin');
}
