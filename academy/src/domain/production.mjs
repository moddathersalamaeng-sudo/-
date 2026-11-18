/**
 * Phase 14 — production rules shared by the browser and the server (pure, no I/O).
 *  - CAN: the role matrix (PRODUCTION_ARCHITECTURE.md §4, D-113). The server checks it before every action and the
 *    database repeats it with row-level policies; the interface uses it only to hide what would be refused anyway.
 *  - Tiers (ADD-16, D-120): definitions and the feature matrix; enforcement is off unless the owner switches it on.
 *  - Analytics (D-119): event whitelist, dimension cleaning (no e-mail, no digits run, no free text beyond 60 chars),
 *    suppression of counts under 5.
 *  - Verification center (D-117): record validation, status line, reminders.
 *  - Review queue (D-116): references without names, service-level state (no target unless the owner sets one — B-04).
 *  - Admin CMS (D-115): editable collections (the apply_review_decisions.py allow-list), draft validation, export files.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { validateGovernance, isIsoDate } from '../data/governance.js';

/* ------------------------------------------------------------------ roles */
export const ACCOUNT_ROLES = ['learner', 'instructor', 'reviewer', 'admin'];   // held in user_roles
export const DERIVED_ROLES = ['company_admin'];                               // from organisation membership

/** Action → roles allowed. `self:false` actions are refused when the subject is the actor (no self-review). */
export const CAN = {
  'records.own':          ['learner', 'instructor', 'reviewer', 'company_admin', 'admin'],
  'account.export':       ['learner', 'instructor', 'reviewer', 'company_admin', 'admin'],
  'account.delete':       ['learner', 'instructor', 'reviewer', 'company_admin', 'admin'],
  'records.other':        [],
  'review.request':       ['learner', 'instructor', 'reviewer', 'company_admin', 'admin'],
  'review.queue':         ['reviewer', 'admin'],
  'review.score':         ['reviewer', 'admin'],
  'review.assign':        ['admin'],
  'org.create':           ['admin'],
  'org.manage':           ['company_admin'],
  'org.shares':           ['company_admin'],
  'consent.grant':        ['learner', 'instructor', 'reviewer', 'company_admin', 'admin'],
  'cms.read':             ['reviewer', 'admin'],
  'cms.write':            ['admin'],
  'cms.decide':           ['reviewer', 'admin'],
  'cms.export':           ['admin'],
  'verification.write':   ['admin'],
  'users.manage':         ['admin'],
  'analytics.read':       ['admin'],
  'settings.write':       ['admin']
};
export const NO_SELF = new Set(['review.score', 'review.assign', 'cms.decide']);

/** Can someone holding `roles` do `action`? With `actor` and `subject` ids, self-review actions are refused. */
export function can(roles = [], action, { actor = null, subject = null, ownerApproval = false } = {}) {
  const allowed = CAN[action];
  if (!allowed || !roles.some(r => allowed.includes(r))) return false;
  if (NO_SELF.has(action) && actor && subject && actor === subject) return action === 'cms.decide' && ownerApproval === true;
  return true;
}

/* ------------------------------------------------------------------ tiers (ADD-16) */
export const TIERS = ['free', 'professional', 'corporate'];
export const TIER_RANK = { free: 0, professional: 1, corporate: 2 };
/** Tier-to-feature matrix (master spec §27A.2). Recorded for administrators; enforced only when the owner switches it on. */
export const FEATURE_TIERS = [
  { feature: 'knowledge', tiers: ['free', 'professional', 'corporate'] },
  { feature: 'courses_selected', tiers: ['free', 'professional', 'corporate'] },
  { feature: 'assessment_basic', tiers: ['free', 'professional', 'corporate'] },
  { feature: 'profile_basic', tiers: ['free', 'professional', 'corporate'] },
  { feature: 'programs_full', tiers: ['professional', 'corporate'] },
  { feature: 'practice_labs', tiers: ['professional', 'corporate'] },
  { feature: 'coach', tiers: ['professional', 'corporate'] },
  { feature: 'assessment_advanced', tiers: ['professional', 'corporate'] },
  { feature: 'passport', tiers: ['professional', 'corporate'] },
  { feature: 'career_tools', tiers: ['professional', 'corporate'] },
  { feature: 'company_portal', tiers: ['corporate'] }
];
/** Is a navigation entry or feature open for this tier? Always true while enforcement is off (the default). */
export function tierAllows(required = 'free', userTier = 'free', enforced = false) {
  if (!enforced) return true;
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[required] ?? 0);
}

/* ------------------------------------------------------------------ analytics (D-119) */
export const EVENTS = {
  page_view: 'route', course_start: 'id', course_complete: 'id', lesson_complete: 'id', assessment_submit: 'id',
  assessment_outcome: 'competency_band', lab_attempt: 'id', coach_use: 'feature', search: 'none', search_no_result: 'term',
  sign_up: 'none', sign_in: 'none', move_to_account: 'none', review_request: 'none', review_complete: 'none',
  consent_grant: 'none', consent_withdraw: 'none', content_needs_review: 'collection'
};
export const COACH_FEATURES = ['weak', 'ask', 'scenario', 'week', 'interview', 'mistakes', 'lesson', 'course'];
export const SUPPRESS_BELOW = 5;
const ID_DIM = /^[A-Za-z0-9._-]{1,80}$/;
const ROUTE_DIM = /^\/[a-z0-9/_:-]{0,79}$/;

/** A search term safe to count: lower case, no e-mail, no run of 6+ digits (phone or ID numbers; standard numbers such as 9001 or 45001 stay), at most 60 characters; null when nothing is left. */
export function cleanTerm(s) {
  let x = String(s ?? '').normalize('NFKC').toLowerCase().replace(/\S+@\S+/g, ' ').replace(/\d{6,}/g, ' ').replace(/[<>"'`]/g, ' ').replace(/\s+/g, ' ').trim();
  if (x.length > 60) x = x.slice(0, 60).trim();
  return x.length >= 2 ? x : null;
}

/** Validate one event from the browser. Returns { event, dim } or null (unknown event or a dimension that is not allowed). */
export function cleanEvent(name, dim = '') {
  const kind = EVENTS[name];
  if (!kind) return null;
  const d = String(dim ?? '');
  if (kind === 'none') return { event: name, dim: '' };
  if (kind === 'id') return ID_DIM.test(d) ? { event: name, dim: d } : null;
  if (kind === 'route') { const p = d.split('?')[0].replace(/\/[A-Za-z0-9._-]*\d[A-Za-z0-9._-]*/g, '/:id'); return ROUTE_DIM.test(p) ? { event: name, dim: p } : null; }
  if (kind === 'feature') return COACH_FEATURES.includes(d) ? { event: name, dim: d } : null;
  if (kind === 'collection') return /^[a-z0-9/-]{1,64}$/.test(d) ? { event: name, dim: d } : null;
  if (kind === 'competency_band') { const m = /^([A-Za-z0-9._-]{1,60}):(low|mid|high)$/.exec(d); return m ? { event: name, dim: d } : null; }
  if (kind === 'term') { const t = cleanTerm(d); return t ? { event: name, dim: t } : null; }
  return null;
}

/** Band of a percentage for assessment outcomes (no raw scores leave the device). */
export const band = pct => (pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low');

/** Rows → display: counts below 5 become null and are flagged. */
export function suppress(rows = []) {
  return rows.map(r => (r.count == null || r.count < SUPPRESS_BELOW ? { ...r, count: null, suppressed: true } : { ...r, suppressed: false }));
}

/** Summary sections for the administrator page, from suppressed rows. */
export function analyticsSections(rows = []) {
  const by = ev => rows.filter(r => r.event === ev);
  const total = ev => by(ev).reduce((s, r) => s + (r.count || 0), 0);
  const active = rows.find(r => r.event === 'active_learners') || { count: null, suppressed: true };
  return {
    active,
    starts: total('course_start'), completions: total('course_complete'),
    outcomes: by('assessment_outcome'), labs: total('lab_attempt'),
    coach: by('coach_use'), noResult: by('search_no_result'), needsReview: by('content_needs_review'),
    pages: by('page_view')
  };
}

/* ------------------------------------------------------------------ verification center (D-117) */
export const VERIFICATION_STATUSES = ['verified', 'pending', 'changed'];
export const REMIND_DAYS = 30;
const addDaysIso = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Validate an edit from the verification center. Returns a list of error codes (empty = valid). */
export function validateCertVerification(v = {}, today) {
  const e = [];
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(String(v.cert_id || ''))) e.push('cert_id');
  if (!VERIFICATION_STATUSES.includes(v.status)) e.push('status');
  if (v.source_url != null && v.source_url !== '' && !/^https:\/\/[^\s]+$/.test(v.source_url)) e.push('source_url');
  if (v.last_verified && (!isIsoDate(v.last_verified) || (today && v.last_verified > today))) e.push('last_verified');
  if (v.next_review && !isIsoDate(v.next_review)) e.push('next_review');
  if (v.last_verified && v.next_review && v.next_review <= v.last_verified) e.push('next_before_last');
  if (v.verifier != null && v.verifier !== '' && String(v.verifier).trim().length < 3) e.push('verifier');
  if (v.status === 'verified' && (!v.verifier || !v.last_verified || !v.source_url)) e.push('verified_needs_who_when_where');
  if (v.facts != null && (typeof v.facts !== 'object' || Array.isArray(v.facts))) e.push('facts');
  if (String(v.notes || '').length > 2000) e.push('notes');
  return e;
}

/** Records due for review: next review date within `days` (or past). Sorted soonest first, with `overdue` flags. */
export function verificationReminders(list = [], today, days = REMIND_DAYS) {
  const limit = addDaysIso(today, days);
  return list.filter(v => !v.next_review || v.next_review <= limit || v.status === 'changed')
    .map(v => ({ ...v, overdue: !!v.next_review && v.next_review < today, missing_date: !v.next_review }))
    .sort((a, b) => String(a.next_review || '0000').localeCompare(String(b.next_review || '0000')));
}

/** Short status line shown on a certification page: { status, last_verified, verifier, next_review, overdue }. */
export function statusLine(v, today) {
  if (!v) return null;
  return { status: v.status, last_verified: v.last_verified || null, verifier: v.verifier || null, next_review: v.next_review || null,
    overdue: !!(v.next_review && today && v.next_review < today), source_url: v.source_url || null };
}

/* ------------------------------------------------------------------ shared review queue (D-116) */
/** A reference that tells reviewers apart from each other without a name or e-mail: "A-" + 4 hex characters of the request id. */
export const reviewReference = id => 'A-' + String(id || '').replace(/[^0-9a-f]/gi, '').slice(0, 4).toUpperCase();

/**
 * Service-level state of a request. `slaHours` null (the default until the owner sets it, B-04) gives
 * { state: 'not_set', age_hours }. Otherwise ok · due_soon (last 20 %) · overdue.
 */
export function slaState(createdAt, slaHours = null, now = new Date().toISOString()) {
  const age = Math.max(0, (Date.parse(now) - Date.parse(createdAt)) / 3_600_000);
  const age_hours = Math.round(age * 10) / 10;
  if (!Number.isFinite(slaHours) || slaHours <= 0) return { state: 'not_set', age_hours, due_at: null };
  const due_at = new Date(Date.parse(createdAt) + slaHours * 3_600_000).toISOString();
  const state = age > slaHours ? 'overdue' : age > slaHours * 0.8 ? 'due_soon' : 'ok';
  return { state, age_hours, due_at };
}

/** What travels to the queue: the written tasks of the attempt only (same parts as the reviewer file). */
export function reviewPayload(lab, attempt) {
  const tasks = (lab?.tasks || []).filter(t => t.type === 'free_text').map(t => ({
    task_id: t.id, prompt: t.prompt, rubric: t.rubric || [], answer: String(attempt?.answers?.[t.id] ?? '').slice(0, 4000), max: Number(t.weight) || 1
  }));
  return { lab_id: lab?.id, lab_title: lab?.title || null, attempt_no: attempt?.attempt_no || 1, submitted_at: attempt?.submitted_at || null, tasks };
}

/* ------------------------------------------------------------------ Admin CMS (D-115) */
/** Collections the CMS may edit = the publishing script's allow-list (tools/apply_review_decisions.py ALLOWED). */
export const CMS_COLLECTIONS = ['courses', 'assessments', 'questions', 'iso-standards', 'learning-paths', 'competency/competencies', 'competency/target-roles',
  'competency/domains', 'ecosystems', 'programs', 'sources', 'certifications', 'figures', 'excellence-lab', 'labs', 'smart-templates', 'coach'];
export const CMS_GROUPS = {
  courses: 'learning', assessments: 'assessment', questions: 'assessment', 'iso-standards': 'reference', 'learning-paths': 'learning', 'competency/competencies': 'framework',
  'competency/target-roles': 'framework', 'competency/domains': 'framework', ecosystems: 'reference', programs: 'learning', sources: 'reference', certifications: 'reference',
  figures: 'media', 'excellence-lab': 'practice', labs: 'practice', 'smart-templates': 'practice', coach: 'practice'
};
const RECORD_ID = /^[A-Za-z0-9._:-]{1,120}$/;

/**
 * Validate a draft before it is saved. A CMS draft is never published by saving: its governance status must be a
 * pre-publication state (draft · needs_review · in_review) — publication happens only through a named decision and the
 * publishing script. Returns a list of error codes.
 */
export function validateDraft(collection, data) {
  const e = [];
  if (!CMS_COLLECTIONS.includes(collection)) e.push('collection');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [...e, 'not_object'];
  if (!RECORD_ID.test(String(data.id || ''))) e.push('id');
  const g = data.governance;
  if (!g || typeof g !== 'object') e.push('governance');
  else {
    if (!['draft', 'needs_review', 'in_review'].includes(g.content_status)) e.push('status_must_be_pre_publication');
    for (const v of validateGovernance(data)) if (v !== 'invalid_content_status') e.push('gov_' + v);
  }
  let size = 0; try { size = JSON.stringify(data).length; } catch { e.push('not_json'); }
  if (size > 400_000) e.push('too_large');
  return [...new Set(e)];
}

/** A new draft version: bump governance.version (x.y → x.(y+1)) and mark it needs_review. */
export function nextDraftData(data, prev = null) {
  const g = { ...(data.governance || {}) };
  const base = String(prev?.governance?.version || g.version || '0.1');
  const m = /^(\d+)\.(\d+)/.exec(base);
  if (prev && (!g.version || g.version === prev.governance?.version)) g.version = m ? `${m[1]}.${Number(m[2]) + 1}` : '0.1';
  if (!g.version) g.version = '0.1';
  if (!['draft', 'needs_review', 'in_review'].includes(g.content_status)) g.content_status = 'needs_review';
  delete g.reviewer; delete g.review_date; delete g.approved_hash;
  return { ...data, governance: g };
}

/** The decisions file in the existing format (cia.review-decisions.v1) for approved drafts. */
export function decisionsFile(rows = [], now = new Date().toISOString()) {
  return {
    app: 'cia-academy', schema: 'cia.review-decisions.v1', exported_at: now, source: 'admin-cms',
    decisions: rows.map(r => ({ collection: r.collection, record_id: r.record_id, version: r.data?.governance?.version, decision: r.decision,
      reviewer: r.reviewer_name, review_date: r.review_date, basis: r.basis || 'expert_review', comment: r.comment || '' }))
  };
}

/** The drafts file (cia.cms-drafts.v1): what tools/cms_publish.py writes into the seed files as needs_review. */
export function draftsFile(rows = [], now = new Date().toISOString()) {
  return { app: 'cia-academy', schema: 'cia.cms-drafts.v1', exported_at: now,
    drafts: rows.map(r => ({ collection: r.collection, record_id: r.record_id, version: r.version, data: r.data })) };
}

/** A compact field-level difference between two versions (for history): [{ path, before, after }] up to `limit`. */
export function diffRecords(a = {}, b = {}, limit = 40, path = '') {
  const out = [];
  const walk = (x, y, p) => {
    if (out.length >= limit) return;
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) walk(x[k], y[k], p ? `${p}.${k}` : k);
      return;
    }
    out.push({ path: p || '(record)', before: x === undefined ? null : x, after: y === undefined ? null : y });
  };
  walk(a, b, path);
  return out;
}
