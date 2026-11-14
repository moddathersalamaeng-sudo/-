/**
 * Company Portal (Phase 12A, spec §22A / ADD-13). Pure functions, no storage, no DOM.
 *
 * An organisation sees — only for the employees who chose to share — the competency picture of a team against the roles it
 * needs, analyses training needs and assigns learning. There is no server in this phase: data travels as files the person
 * downloads and hands over themselves (COMPANY_PORTAL_SPEC.md).
 *
 * Rules:
 *  - nothing about an employee reaches the company without that employee's explicit share: a share file lists exactly the parts
 *    the employee ticked, carries the consent text in both languages, the employee's name and the date; the importer reads ONLY
 *    the listed parts and drops anything else that may be in the file;
 *  - an import never upgrades a status (D-65 / D-72): a level arrives with the source the employee's device recorded (verified ·
 *    assessment · self). "verified" is kept only with a named reviewer, a date and a known method — otherwise the level falls
 *    back to the assessed / self-rated level or is dropped. An assessed level is always recomputed from its percentage;
 *  - an import never overwrites: a share whose id is already stored is skipped; a newer share from the same person becomes the
 *    current one and the older one stays in the history until the administrator deletes it;
 *  - a share is withdrawn by deleting it: the person then disappears from the matrix, the analysis and the plan;
 *  - the matrix and the training-needs analysis are planning aids — never a performance appraisal or a hiring decision; CIA
 *    certifies neither employees nor companies and awards no recognised CPD;
 *  - the digest inside a file detects accidental damage and casual edits; it is NOT a cryptographic signature.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { severity, currentLevel, PRIORITY } from './recommendations.mjs';
import { courseStatus } from './learner-model.mjs';
import { csvCell, toCsv, toSpreadsheetXml, toWordHtml } from './templates.mjs';
import { VERIFY_METHODS } from './passport.mjs';

export const SHARE_SCHEMA = 'cia.passport-share.v1';
export const ASSIGNMENT_SCHEMA = 'cia.assignment.v1';
export const COMPANY_SCHEMA = 'cia.company.v1';
export const APP = 'cia-academy';
/** What an employee may choose to share. `assignments` is offered only when the employee holds company assignments. */
export const SHARE_PARTS = ['competencies', 'verified', 'cpd', 'credentials', 'roadmap', 'assignments'];
export const LEVEL_SOURCES = ['verified', 'assessment', 'self', 'none'];
/** How much weight a level's source carries in prioritisation — the recommendation engine's own confidence values. */
export const SOURCE_CONFIDENCE = { verified: 1, assessment: 0.85, self: 0.55, none: 0.35 };
export const ASSIGNMENT_TYPES = ['course', 'lab', 'assessment', 'route'];
export const AUDIENCES = ['person', 'department'];
export const PROGRESS_STATES = ['not_started', 'in_progress', 'completed'];
export const DUE_STATES = ['completed', 'overdue', 'due_soon', 'open'];
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
/** Even spread in priority order: line i (0-based) of n → Q1…Q4. */
export const planQuarter = (i, n) => QUARTERS[Math.min(3, Math.floor(i * 4 / Math.max(1, n)))];
export const CRITICAL_GAP = 2;
export const DUE_SOON_DAYS = 14;
export const STALE_DAYS = 90;
export const DEFAULT_MIN_HOLDERS = 2;
export const MAX_FILE_BYTES = 1_000_000;
export const LIMITS = { departments: 40, roles: 40, people: 500, assignments: 1000, items: 200 };

export const CONSENT_TEXT = {
  en: 'I choose to share the parts listed in this file with my company for training planning. I checked the list before downloading. Nothing else leaves my device. I can ask the administrator to delete this file at any time, and a deleted share is no longer used.',
  ar: 'أختار مشاركة الأجزاء المذكورة في هذا الملف مع شركتي لأغراض تخطيط التدريب. راجعتُ القائمة قبل التنزيل. لا يغادر جهازي أي شيء آخر. ويمكنني أن أطلب من المسؤول حذف هذا الملف في أي وقت، ولا تُستخدم المشاركة المحذوفة بعد ذلك.'
};
export const COMPANY_LABEL = {
  en: 'Company workspace — a planning aid built only from what employees chose to share. It is not a performance appraisal and not a hiring decision. CIA does not certify employees or companies, and awards no accreditation or recognised CPD.',
  ar: 'مساحة الشركة — أداة تخطيط مبنية فقط على ما اختار الموظفون مشاركته. ليست تقييم أداء ولا قرار توظيف. والأكاديمية لا تمنح شهادات للموظفين أو الشركات، ولا تمنح اعتمادًا ولا ساعات تطوير مهني معترفًا بها.'
};
export const SHARE_LABEL = {
  en: 'Passport share — a snapshot the employee chose to give to their company. Levels keep the source recorded on the employee\'s device; this file certifies nothing.',
  ar: 'مشاركة الجواز — لقطة اختار الموظف تقديمها لشركته. تحتفظ المستويات بمصدرها المسجّل على جهاز الموظف، وهذا الملف لا يُثبت أي شهادة.'
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[\w.:#-]{3,80}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const day = s => String(s || '').slice(0, 10);
const str = v => String(v ?? '').trim().replace(/\s+/g, ' ');
const isIsoDate = s => { if (!ISO.test(s || '')) return false; const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const round2 = n => Math.round(n * 100) / 100;
const tt = v => (v && typeof v === 'object' ? { en: str(v.en || v.ar), ar: str(v.ar || v.en) } : { en: str(v), ar: str(v) });
const daysBetween = (a, b) => Math.round((Date.parse(day(b) + 'T00:00:00Z') - Date.parse(day(a) + 'T00:00:00Z')) / 86400000);
export const addDays = (iso, n) => { const d = new Date(day(iso) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const levelFromPercent = p => currentLevel({ assessmentPercent: p }).level;
const isLevel = (n, min = 0) => Number.isInteger(n) && n >= min && n <= 5;

/* ------------------------------------------------------------------ integrity digest (not a signature) */

/** Stable JSON: object keys sorted, so the same content always gives the same text. */
export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
const fnv = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
/** 16 hex characters over the canonical content. Detects accidental damage and casual edits; not a cryptographic signature. */
export const digestOf = obj => { const s = canonical(obj); return fnv(s, 2166136261) + fnv(s, 0x9747b28c); };
const digestBody = f => { const { digest, ...rest } = f; return rest; };

/* ------------------------------------------------------------------ company profile, departments, roles */

/** { errors, value } — the administrator's company profile (cia:v1:<user>:company_profile, id "me"). */
export function validateCompany(input = {}) {
  const e = {};
  const name = str(input.name);
  if (!name) e.name = 'required'; else if (name.length < 2) e.name = 'short'; else if (name.length > 120) e.name = 'long';
  const sector = str(input.sector); if (sector.length > 80) e.sector = 'long';
  const admin = str(input.admin_name); if (admin.length > 80) e.admin_name = 'long';
  const mh = input.min_holders === '' || input.min_holders == null ? DEFAULT_MIN_HOLDERS : Number(input.min_holders);
  if (!Number.isInteger(mh) || mh < 1 || mh > 5) e.min_holders = 'range';
  const year = input.plan_year === '' || input.plan_year == null ? null : Number(input.plan_year);
  if (year !== null && (!Number.isInteger(year) || year < 2024 || year > 2100)) e.plan_year = 'range';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { id: 'me', schema: COMPANY_SCHEMA, name, sector, admin_name: admin, min_holders: mh, plan_year: year } };
}

/** A department: a name and the roles it needs (CIA target roles or company-defined roles). */
export function validateDepartment(input = {}, { roleIds = [], existing = [] } = {}) {
  const e = {};
  const name = str(input.name);
  if (!name) e.name = 'required'; else if (name.length < 2) e.name = 'short'; else if (name.length > 80) e.name = 'long';
  else if (existing.some(d => d.id !== input.id && str(d.name).toLowerCase() === name.toLowerCase())) e.name = 'duplicate';
  const roles = [...new Set(Array.isArray(input.roles) ? input.roles : [])];
  if (roles.some(r => !roleIds.includes(r))) e.roles = 'unknown';
  if (!input.id && existing.length >= LIMITS.departments) e.name = 'limit';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { id: input.id || null, name, roles } };
}

/**
 * A company-defined role built from the competency framework: a name and a required level 0–5 per competency
 * (at least one above 0). Usually started from a CIA target role and adjusted.
 */
export function validateCustomRole(input = {}, { competencyIds = [], existing = [] } = {}) {
  const e = {};
  const name = str(input.name);
  if (!name) e.name = 'required'; else if (name.length < 2) e.name = 'short'; else if (name.length > 80) e.name = 'long';
  else if (existing.some(r => r.id !== input.id && [r.name?.en, r.name?.ar].some(n => str(n).toLowerCase() === name.toLowerCase()))) e.name = 'duplicate';
  const targets = {};
  for (const cid of competencyIds) {
    const v = Number(input.targets?.[cid] ?? 0);
    if (!isLevel(v)) { e.targets = 'range'; break; }
    targets[cid] = v;
  }
  if (!e.targets && !Object.values(targets).some(v => v > 0)) e.targets = 'empty';
  if (!input.id && existing.length >= LIMITS.roles) e.name = 'limit';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { id: input.id || null, type: 'company_role', custom: true, name: { en: name, ar: name }, based_on: str(input.based_on) || null, targets } };
}

/** CIA target roles first, then the company's own. */
export const allRoles = (ciaRoles = [], customRoles = []) => [...ciaRoles.map(r => ({ ...r, custom: false })), ...customRoles.map(r => ({ ...r, custom: true }))];

/* ------------------------------------------------------------------ employee side: build a share */

/** Check the share form: the employee's name, at least one part, and the explicit consent tick. */
export function validateShareInput(input = {}, available = SHARE_PARTS) {
  const e = {};
  const name = str(input.name);
  if (!name) e.name = 'required'; else if (name.length < 3) e.name = 'short'; else if (name.length > 80) e.name = 'long';
  if (str(input.job_title).length > 120) e.job_title = 'long';
  if (str(input.employee_no).length > 40) e.employee_no = 'long';
  const parts = SHARE_PARTS.filter(p => (input.parts || []).includes(p) && available.includes(p));
  if (!parts.length) e.parts = 'required';
  if (input.consent !== true) e.consent = 'required';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { name, job_title: str(input.job_title), employee_no: str(input.employee_no), parts } };
}

/**
 * The competency rows of a share, straight from the device's own evidence model (currentLevel): one row per competency that
 * has anything to show. `withLevels` shares assessed and self-rated levels; `withVerified` shares reviewer-verified levels
 * (with the reviewer, date and method). A verified competency shared without `withVerified` falls back to its assessed or
 * self-rated level — a status is never invented.
 */
export function shareCompetencies({ competencies = [], selfLevels = {}, evidence = {}, verifications = [], withLevels = true, withVerified = false, today = todayIso() } = {}) {
  const out = [];
  for (const c of competencies) {
    const ev = evidence[c.id];
    const pct = ev && Number.isFinite(ev.percent) ? ev.percent : null;
    const base = currentLevel({ selfLevel: selfLevels[c.id] || 0, assessmentPercent: pct });
    const v = verifications.find(x => x && x.target_kind === 'competency' && x.target_id === c.id && x.decision === 'verified' && isLevel(x.level, 1)
      && str(x.reviewer).length >= 3 && isIsoDate(x.date) && x.date <= today && VERIFY_METHODS.includes(x.method));
    if (withVerified && v) { out.push({ id: c.id, level: v.level, source: 'verified', date: v.date, verification: { reviewer: str(v.reviewer), date: v.date, method: v.method } }); continue; }
    if (!withLevels || base.source === 'insufficient') continue;
    out.push(base.source === 'assessment' ? { id: c.id, level: base.level, source: 'assessment', percent: Math.round(pct), date: day(ev.at) || null } : { id: c.id, level: base.level, source: 'self', date: null });
  }
  return out;
}

/**
 * Assemble the share file. `data` holds candidate content per part; only the parts in `parts` are written.
 * { app, schema, share_id, employee, shared_at, includes, consent, label, data, digest }
 */
export function buildShare({ employee = {}, parts = [], data = {}, shareId, now = new Date().toISOString(), sample = false } = {}) {
  const includes = SHARE_PARTS.filter(p => parts.includes(p));
  const out = {};
  if (includes.includes('competencies') || includes.includes('verified')) out.competencies = (data.competencies || []).filter(r => (r.source === 'verified' ? includes.includes('verified') : includes.includes('competencies')));
  if (includes.includes('cpd')) out.cpd = data.cpd || { total: 0, count: 0, by_year: {} };
  if (includes.includes('credentials')) out.credentials = data.credentials || [];
  if (includes.includes('roadmap')) out.roadmap = data.roadmap || null;
  if (includes.includes('assignments')) out.assignments = data.assignments || [];
  const file = {
    app: APP, schema: SHARE_SCHEMA, share_id: shareId, shared_at: now,
    employee: { key: employee.key, name: str(employee.name), job_title: str(employee.job_title), employee_no: str(employee.employee_no), ...(sample ? { sample: true } : {}) },
    includes, consent: { accepted: true, name: str(employee.name), accepted_at: now, text: CONSENT_TEXT }, label: SHARE_LABEL, data: out
  };
  return { ...file, digest: digestOf(file) };
}

/** CPD totals only (never the entries): { total, count, by_year: { "2026": hours } }. */
export const shareCpd = totals => ({ total: round2(totals?.total || 0), count: totals?.count || 0, by_year: Object.fromEntries(Object.entries(totals?.byYear || {}).map(([y, v]) => [y, round2(v.total)])) });
/** Wallet rows as declared: name, issuer, dates and state. Rejected rows are left out. */
export const shareCredentials = (wallet = [], L = v => (typeof v === 'string' ? v : v?.en || '')) => wallet.filter(w => w.state !== 'rejected').slice(0, LIMITS.items).map(w => ({
  name: str(L(w.name)), issuer: str(w.issuer), issued: day(w.issued) || null, expires: day(w.expires) || null, kind: w.kind === 'cia_completion' ? 'cia_completion' : 'external',
  state: w.kind === 'cia_completion' ? 'issued' : w.state, checked_by: w.checked_by ? { reviewer: str(w.checked_by.reviewer), date: w.checked_by.date, method: w.checked_by.method } : null }));
/** The roadmap in short: target role, open gaps, hours and milestones. */
export const shareRoadmap = (rm, role) => (rm && role ? { target_role: role.id, target_role_name: tt(role.name), gaps: rm.gaps, met: rm.met, total_hours: rm.total_hours, finish: rm.finish || null,
  milestones: (rm.milestones || []).map(m => ({ id: m.id, competencies: m.competencies.map(c => c.id), due: m.due || null, done: !!m.done })) } : null);

/* ------------------------------------------------------------------ administrator side: read a share */

const cleanVerification = (v, today) => (v && typeof v === 'object' && str(v.reviewer).length >= 3 && isIsoDate(v.date) && v.date <= today && VERIFY_METHODS.includes(v.method)
  ? { reviewer: str(v.reviewer).slice(0, 80), date: v.date, method: v.method } : null);

/**
 * Validate and clean a share file. Returns { ok:false, err } or { ok:true, share, notes }.
 * err: json · size · schema (not a passport share — e.g. a passport backup) · employee · date · parts · consent · digest · duplicate.
 * notes: { stripped: parts present in the file but not consented, downgraded: verified levels without a valid reviewer record,
 *          dropped: rows that could not be read, unknown: competencies not in this framework }.
 */
export function readShare(raw, { competencyIds = [], existingIds = [], today = todayIso() } = {}) {
  let d = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_FILE_BYTES) return { ok: false, err: 'size' };
    try { d = JSON.parse(raw); } catch { return { ok: false, err: 'json' }; }
  }
  if (!d || typeof d !== 'object' || d.app !== APP || d.schema !== SHARE_SCHEMA || !d.data || typeof d.data !== 'object') return { ok: false, err: 'schema' };
  if (!ID.test(String(d.share_id || ''))) return { ok: false, err: 'schema' };
  const emp = d.employee;
  if (!emp || typeof emp !== 'object' || !ID.test(String(emp.key || '')) || str(emp.name).length < 3 || str(emp.name).length > 80) return { ok: false, err: 'employee' };
  if (!isIsoDate(day(d.shared_at)) || day(d.shared_at) > today) return { ok: false, err: 'date' };
  if (!Array.isArray(d.includes) || !d.includes.length || d.includes.some(p => !SHARE_PARTS.includes(p))) return { ok: false, err: 'parts' };
  if (!d.consent || d.consent.accepted !== true || str(d.consent.name) !== str(emp.name)) return { ok: false, err: 'consent' };
  if (d.digest !== digestOf(digestBody(d))) return { ok: false, err: 'digest' };
  if (existingIds.includes(d.share_id)) return { ok: false, err: 'duplicate' };

  const inc = new Set(d.includes);
  const notes = { stripped: [], downgraded: 0, dropped: 0, unknown: 0 };
  const allowedKeys = { competencies: inc.has('competencies') || inc.has('verified'), cpd: inc.has('cpd'), credentials: inc.has('credentials'), roadmap: inc.has('roadmap'), assignments: inc.has('assignments') };
  for (const k of Object.keys(d.data)) if (!allowedKeys[k]) notes.stripped.push(k);
  const known = new Set(competencyIds);
  const data = {};
  if (allowedKeys.competencies) {
    const seen = new Set(); const rows = [];
    for (const r of (Array.isArray(d.data.competencies) ? d.data.competencies : []).slice(0, LIMITS.items)) {
      if (!r || typeof r !== 'object' || seen.has(r.id)) { notes.dropped++; continue; }
      if (!known.has(r.id)) { notes.unknown++; continue; }
      seen.add(r.id);
      const pct = Number.isFinite(r.percent) && r.percent >= 0 && r.percent <= 100 ? Math.round(r.percent) : null;
      if (r.source === 'verified') {
        const v = cleanVerification(r.verification, today);
        if (inc.has('verified') && v && isLevel(r.level, 1)) { rows.push({ id: r.id, level: r.level, source: 'verified', date: v.date, verification: v }); continue; }
        /* No valid reviewer record (or verified levels were not consented): never keep the higher status. */
        notes.downgraded++;
        if (inc.has('competencies') && pct !== null) rows.push({ id: r.id, level: levelFromPercent(pct), source: 'assessment', percent: pct, date: null });
        continue;
      }
      if (!inc.has('competencies')) { notes.stripped.includes('competencies') || notes.stripped.push('competencies'); continue; }
      if (r.source === 'assessment' && pct !== null) rows.push({ id: r.id, level: levelFromPercent(pct), source: 'assessment', percent: pct, date: isIsoDate(day(r.date)) ? day(r.date) : null });
      else if (r.source === 'self' && isLevel(r.level, 1)) rows.push({ id: r.id, level: r.level, source: 'self', date: null });
      else notes.dropped++;
    }
    data.competencies = rows;
  }
  if (allowedKeys.cpd) {
    const c = d.data.cpd && typeof d.data.cpd === 'object' ? d.data.cpd : {};
    const num = v => (Number.isFinite(v) && v >= 0 && v <= 100000 ? round2(v) : 0);
    data.cpd = { total: num(c.total), count: Number.isInteger(c.count) && c.count >= 0 ? c.count : 0,
      by_year: Object.fromEntries(Object.entries(c.by_year && typeof c.by_year === 'object' ? c.by_year : {}).filter(([y]) => /^\d{4}$/.test(y)).slice(0, 60).map(([y, v]) => [y, num(v)])) };
  }
  if (allowedKeys.credentials) {
    data.credentials = (Array.isArray(d.data.credentials) ? d.data.credentials : []).slice(0, LIMITS.items).filter(c => c && typeof c === 'object' && str(c.name)).map(c => {
      const checked = cleanVerification(c.checked_by, today);
      const state = ['self_declared', 'evidence_uploaded', 'pending_verification', 'verified', 'expired', 'issued'].includes(c.state) ? c.state : 'self_declared';
      return { name: str(c.name).slice(0, 160), issuer: str(c.issuer).slice(0, 120), issued: isIsoDate(day(c.issued)) ? day(c.issued) : null, expires: isIsoDate(day(c.expires)) ? day(c.expires) : null,
        kind: c.kind === 'cia_completion' ? 'cia_completion' : 'external', state: state === 'verified' && !checked ? 'self_declared' : state, checked_by: state === 'verified' ? checked : null };
    });
  }
  if (allowedKeys.roadmap) {
    const r = d.data.roadmap;
    data.roadmap = r && typeof r === 'object' && str(r.target_role) ? { target_role: str(r.target_role).slice(0, 80), target_role_name: tt(r.target_role_name), gaps: Number.isInteger(r.gaps) ? r.gaps : 0, met: Number.isInteger(r.met) ? r.met : 0,
      total_hours: Number.isFinite(r.total_hours) ? round2(r.total_hours) : 0, finish: isIsoDate(day(r.finish)) ? day(r.finish) : null,
      milestones: (Array.isArray(r.milestones) ? r.milestones : []).slice(0, 12).map(m => ({ id: str(m?.id).slice(0, 8), competencies: (Array.isArray(m?.competencies) ? m.competencies : []).filter(c => known.has(c)), due: isIsoDate(day(m?.due)) ? day(m.due) : null, done: m?.done === true })) } : null;
  }
  if (allowedKeys.assignments) {
    data.assignments = (Array.isArray(d.data.assignments) ? d.data.assignments : []).slice(0, LIMITS.assignments).filter(a => a && ID.test(String(a.id || '')) && PROGRESS_STATES.includes(a.state))
      .map(a => ({ id: a.id, state: a.state, completed_at: a.state === 'completed' && isIsoDate(day(a.completed_at)) ? day(a.completed_at) : null, percent: Number.isFinite(a.percent) ? Math.max(0, Math.min(100, Math.round(a.percent))) : null }));
  }
  const share = { id: d.share_id, employee_key: emp.key, name: str(emp.name), job_title: str(emp.job_title).slice(0, 120), employee_no: str(emp.employee_no).slice(0, 40), sample: emp.sample === true,
    shared_at: d.shared_at, includes: SHARE_PARTS.filter(p => inc.has(p)), consent: { name: str(d.consent.name), accepted_at: str(d.consent.accepted_at) || d.shared_at }, data, digest: d.digest };
  return { ok: true, share, notes };
}

/**
 * People of the workspace: one per employee key, from the newest share; the administrator's own placement
 * (department, role) comes from `placements` ([{ id: key, department_id, role_id }]).
 */
export function peopleFrom(shares = [], placements = [], today = todayIso()) {
  const by = new Map();
  for (const s of [...shares].sort((a, b) => String(a.shared_at).localeCompare(String(b.shared_at)))) { const p = by.get(s.employee_key) || { shares: [] }; p.shares.push(s); by.set(s.employee_key, p); }
  const place = new Map(placements.map(p => [p.id, p]));
  return [...by.entries()].map(([key, p]) => {
    const share = p.shares.at(-1);
    const age = daysBetween(share.shared_at, today);
    const levels = Object.fromEntries((share.data.competencies || []).map(r => [r.id, r]));
    return { key, name: share.name, job_title: share.job_title, employee_no: share.employee_no, sample: !!share.sample, share, history: p.shares.length, age_days: age, stale: age > STALE_DAYS,
      has_levels: share.includes.includes('competencies') || share.includes.includes('verified'), levels, department_id: place.get(key)?.department_id || null, role_id: place.get(key)?.role_id || null };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/* ------------------------------------------------------------------ competency matrix */

/**
 * One cell: what the role requires against what the person shared.
 * { required, level, source verified|assessment|self|none, gap, met, critical (gap ≥ 2), priority, priority_value }.
 * A level counts in the order verified → assessment → self; the share already carries the strongest one that was consented.
 */
export function matrixCell(required, row = null) {
  const source = row && LEVEL_SOURCES.includes(row.source) ? row.source : 'none';
  const level = source === 'none' ? 0 : row.level;
  const gap = Math.max(0, required - level);
  const conf = SOURCE_CONFIDENCE[source];
  const rel = required / 5;
  return { required, level, source, gap, met: gap === 0, critical: gap >= CRITICAL_GAP, priority: severity(gap, rel, conf), priority_value: round2(gap * rel * conf),
    percent: row?.percent ?? null, date: row?.date ?? null, verification: row?.verification ?? null };
}

/**
 * The matrix: employees × the competencies their roles require.
 * rows: [{ person, role, department, cells: { [competencyId]: cell | null }, summary }]; columns: competencies required by at
 * least one listed person; coverage per competency; people without a role are listed with `role: null` and no cells.
 * filter: { department_id, role_id, domain }.
 */
export function buildMatrix({ people = [], roles = [], departments = [], competencies = [], filter = {} } = {}) {
  const roleBy = new Map(roles.map(r => [r.id, r])); const deptBy = new Map(departments.map(d => [d.id, d]));
  const listed = people.filter(p => (!filter.department_id || p.department_id === filter.department_id) && (!filter.role_id || p.role_id === filter.role_id));
  const comps = competencies.filter(c => !filter.domain || c.domain === filter.domain);
  const rows = listed.map(person => {
    const role = roleBy.get(person.role_id) || null;
    const cells = {};
    let required = 0, met = 0, totalGap = 0, critical = 0, noEvidence = 0;
    if (role) for (const c of comps) {
      const req = role.targets?.[c.id] || 0;
      if (!req) { cells[c.id] = null; continue; }
      const cell = matrixCell(req, person.levels[c.id]);
      cells[c.id] = cell; required++; if (cell.met) met++; totalGap += cell.gap; if (cell.critical) critical++; if (cell.source === 'none') noEvidence++;
    }
    return { person, role, department: deptBy.get(person.department_id) || null, cells,
      summary: { required, met, gaps: required - met, total_gap: totalGap, critical, no_evidence: noEvidence, readiness: required ? Math.round(met / required * 100) : null } };
  });
  const columns = comps.filter(c => rows.some(r => r.cells[c.id]));
  const coverage = Object.fromEntries(columns.map(c => { const cs = rows.map(r => r.cells[c.id]).filter(Boolean); return [c.id, { required: cs.length, met: cs.filter(x => x.met).length, total_gap: cs.reduce((a, x) => a + x.gap, 0) }]; }));
  return { rows, columns, coverage, without_role: rows.filter(r => !r.role).length, people: rows.length };
}

/**
 * Single points of failure per department. For every competency a department needs — the highest level among the roles the
 * department lists (or, when it lists none, among the roles of its people) — count the people in the department whose shared
 * level reaches it. Fewer than `minHolders` (default 2) is flagged: 0 → "none", 1 → "single", otherwise "thin".
 */
export function singlePoints({ people = [], roles = [], departments = [], competencies = [], minHolders = DEFAULT_MIN_HOLDERS } = {}) {
  const roleBy = new Map(roles.map(r => [r.id, r]));
  const out = [];
  for (const d of departments) {
    const staff = people.filter(p => p.department_id === d.id);
    if (!staff.length) continue;
    const roleIds = d.roles?.length ? d.roles : [...new Set(staff.map(p => p.role_id).filter(Boolean))];
    const needRoles = roleIds.map(id => roleBy.get(id)).filter(Boolean);
    for (const c of competencies) {
      const need = Math.max(0, ...needRoles.map(r => r.targets?.[c.id] || 0));
      if (!need) continue;
      const holders = staff.filter(p => (p.levels[c.id]?.level || 0) >= need);
      if (holders.length < minHolders) out.push({ department_id: d.id, department: d.name, competency_id: c.id, required_level: need, holders: holders.map(p => p.key), holder_names: holders.map(p => p.name), count: holders.length,
        kind: holders.length === 0 ? 'none' : holders.length === 1 ? 'single' : 'thin' });
    }
  }
  return out.sort((a, b) => a.count - b.count || b.required_level - a.required_level || a.department.localeCompare(b.department) || a.competency_id.localeCompare(b.competency_id));
}

/* ------------------------------------------------------------------ training needs analysis */

const topPriority = list => list.reduce((best, p) => (PRIORITY.indexOf(p) > PRIORITY.indexOf(best) ? p : best), 'Achieved');

/** Roll individual needs up per competency: people affected, total / mean / max gap, highest priority, summed priority value. */
function rollNeeds(individuals) {
  const by = new Map();
  for (const ind of individuals) for (const n of ind.needs) {
    const x = by.get(n.competency_id) || { competency_id: n.competency_id, people_affected: 0, people: [], departments: new Set(), total_gap: 0, max_gap: 0, priorities: [], priority_value: 0, no_evidence: 0 };
    x.people_affected++; x.people.push({ key: ind.key, name: ind.name, gap: n.gap }); if (ind.department_id) x.departments.add(ind.department_id);
    x.total_gap += n.gap; x.max_gap = Math.max(x.max_gap, n.gap); x.priorities.push(n.priority); x.priority_value += n.priority_value; if (n.source === 'none') x.no_evidence++;
    by.set(n.competency_id, x);
  }
  return [...by.values()].map(x => ({ competency_id: x.competency_id, people_affected: x.people_affected, people: x.people, departments: [...x.departments], total_gap: x.total_gap, mean_gap: round2(x.total_gap / x.people_affected),
    max_gap: x.max_gap, priority: topPriority(x.priorities), priority_value: round2(x.priority_value), no_evidence: x.no_evidence }))
    .sort((a, b) => PRIORITY.indexOf(b.priority) - PRIORITY.indexOf(a.priority) || b.priority_value - a.priority_value || b.people_affected - a.people_affected || a.competency_id.localeCompare(b.competency_id));
}
const groupTotals = inds => {
  const withRole = inds.filter(i => i.role_id);
  const required = withRole.reduce((a, i) => a + i.required, 0), met = withRole.reduce((a, i) => a + i.met, 0), totalGap = withRole.reduce((a, i) => a + i.total_gap, 0);
  return { people: inds.length, with_role: withRole.length, without_role: inds.length - withRole.length, required_cells: required, met_cells: met, readiness: required ? Math.round(met / required * 100) : null,
    total_gap: totalGap, mean_gap: required ? round2(totalGap / required) : null, gap_per_person: withRole.length ? round2(totalGap / withRole.length) : null, critical_cells: withRole.reduce((a, i) => a + i.critical, 0), people_with_needs: withRole.filter(i => i.needs.length).length };
};

/**
 * required − current = development need, per employee, rolled up per department and for the company.
 * Individual needs are ordered by the recommendation engine's severity (gap × relevance × confidence of the source).
 * mean_gap of a need = total gap ÷ people affected; mean_gap of a department / the company = total gap ÷ required cells
 * (levels short per required competency); gap_per_person = total gap ÷ people with a role.
 * Departments with no people are listed with zero counts; people without a role are counted but have no needs.
 */
export function buildTna({ people = [], roles = [], departments = [], competencies = [], minHolders = DEFAULT_MIN_HOLDERS } = {}) {
  const m = buildMatrix({ people, roles, departments, competencies });
  const individuals = m.rows.map(r => {
    const needs = Object.entries(r.cells).filter(([, c]) => c && c.gap > 0).map(([cid, c]) => ({ competency_id: cid, required: c.required, current: c.level, source: c.source, gap: c.gap, priority: c.priority, priority_value: c.priority_value, critical: c.critical }))
      .sort((a, b) => b.priority_value - a.priority_value || b.gap - a.gap || a.competency_id.localeCompare(b.competency_id));
    return { key: r.person.key, name: r.person.name, job_title: r.person.job_title, department_id: r.person.department_id, department: r.department?.name || null, role_id: r.role?.id || null, role: r.role?.name || null,
      stale: r.person.stale, has_levels: r.person.has_levels, needs, required: r.summary.required, met: r.summary.met, total_gap: r.summary.total_gap, critical: r.summary.critical, readiness: r.summary.readiness,
      mean_gap: r.summary.required ? round2(r.summary.total_gap / r.summary.required) : null };
  });
  const spof = singlePoints({ people, roles, departments, competencies, minHolders });
  const depts = departments.map(d => { const inds = individuals.filter(i => i.department_id === d.id); return { id: d.id, name: d.name, ...groupTotals(inds), needs: rollNeeds(inds), spof: spof.filter(s => s.department_id === d.id).length }; });
  const unplaced = individuals.filter(i => !i.department_id || !departments.some(d => d.id === i.department_id));
  return { individuals, departments: depts, unplaced: { ...groupTotals(unplaced), needs: rollNeeds(unplaced) }, company: { ...groupTotals(individuals), needs: rollNeeds(individuals), spof: spof.length, departments: departments.length }, spof };
}

/* ------------------------------------------------------------------ annual training plan */

/** A course and a lab that develop one competency (lowest level first, then shortest, then id) — the roadmap's own rule. */
export function suggestFor(competencyId, { courses = [], labs = [] } = {}) {
  const c = courses.filter(x => (x.competency_mappings || []).some(m => m.competency === competencyId)).sort((a, b) => (a.level || 9) - (b.level || 9) || (a.training_hours || 0) - (b.training_hours || 0) || a.id.localeCompare(b.id))[0] || null;
  const l = labs.filter(x => (x.competencies || []).includes(competencyId)).sort((a, b) => (a.minutes || 0) - (b.minutes || 0) || a.id.localeCompare(b.id))[0] || null;
  return { course: c ? { id: c.id, title: tt(c.title), hours: Number(c.training_hours) || 1, href: `#/academy/courses/${c.slug}` } : null,
    lab: l ? { id: l.id, title: tt(l.title), hours: Math.max(0.25, Math.round((Number(l.minutes) || 30) / 60 * 4) / 4), href: `#/labs/${l.slug}` } : null };
}

/**
 * The annual training plan from the company-level needs: one line per competency with people affected, mean gap, priority,
 * a suggested CIA course and lab, hours per person and in total, and a quarter. Lines keep the needs' priority order (the
 * recommendation engine's severity, then its priority value) and are spread evenly over the year: line i of n goes to quarter
 * floor(i × 4 ÷ n) + 1, so the most urgent quarter of the lines lands in Q1. The administrator may move or skip a line:
 * overrides { [competencyId]: { quarter, skip } }.
 * A suggestion is one possible route, not the only one; hours are the Academy's own training hours, not awarded CPD.
 */
export function annualPlan({ tna, competencies = [], departments = [], courses = [], labs = [], year, overrides = {} } = {}) {
  const compBy = new Map(competencies.map(c => [c.id, c])); const deptBy = new Map(departments.map(d => [d.id, d]));
  const needs = tna?.company?.needs || [];
  const rows = needs.map((n, i) => {
    const s = suggestFor(n.competency_id, { courses, labs });
    const per = round2((s.course?.hours || 0) + (s.lab?.hours || 0));
    const o = overrides[n.competency_id] || {};
    const c = compBy.get(n.competency_id);
    return { competency_id: n.competency_id, name: c ? tt(c.name) : tt(n.competency_id), domain: c?.domain || '', priority: n.priority, priority_value: n.priority_value, people_affected: n.people_affected,
      people: n.people.map(p => p.name), departments: n.departments.map(id => deptBy.get(id)?.name).filter(Boolean), mean_gap: n.mean_gap, max_gap: n.max_gap, course: s.course, lab: s.lab,
      hours_per_person: per, total_hours: round2(per * n.people_affected), quarter: QUARTERS.includes(o.quarter) ? o.quarter : planQuarter(i, needs.length), moved: QUARTERS.includes(o.quarter), skip: o.skip === true, unmatched: !s.course && !s.lab };
  });
  const active = rows.filter(r => !r.skip);
  const byQuarter = Object.fromEntries(QUARTERS.map(q => [q, { lines: active.filter(r => r.quarter === q).length, hours: round2(active.filter(r => r.quarter === q).reduce((a, r) => a + r.total_hours, 0)) }]));
  return { year, rows, totals: { lines: active.length, skipped: rows.length - active.length, hours: round2(active.reduce((a, r) => a + r.total_hours, 0)), seats: active.reduce((a, r) => a + r.people_affected, 0), unmatched: active.filter(r => r.unmatched).length, by_quarter: byQuarter } };
}

/**
 * The plan as the document model of the Phase 11 exporters (D-60): { title, label, lang, dir, sections, table, template_title, version }
 * so toCsv / toSpreadsheetXml / toWordHtml escape it and neutralise formulas exactly as they do for smart templates.
 * `labels` is a function key → text in the export language.
 */
export function planDocument(plan, { company = {}, tna = null, lang = 'en', labels = k => k, today = todayIso() } = {}) {
  const L = v => (typeof v === 'string' ? v : v?.[lang] || v?.en || '');
  const active = plan.rows.filter(r => !r.skip);
  const t = plan.totals; const co = tna?.company || {};
  return {
    title: labels('plan.docTitle', { year: plan.year, company: company.name || '' }), label: COMPANY_LABEL[lang] || COMPANY_LABEL.en, lang, dir: lang === 'ar' ? 'rtl' : 'ltr',
    sections: [
      { title: labels('plan.secCompany'), fields: [{ label: labels('plan.fCompany'), value: company.name || '' }, { label: labels('plan.fSector'), value: company.sector || '' }, { label: labels('plan.fYear'), value: String(plan.year ?? '') },
        { label: labels('plan.fPrepared'), value: today }, { label: labels('plan.fPreparedBy'), value: company.admin_name || '' }] },
      { title: labels('plan.secBasis'), fields: [{ label: labels('plan.fPeople'), value: String(co.people ?? 0) }, { label: labels('plan.fWithRole'), value: String(co.with_role ?? 0) }, { label: labels('plan.fReadiness'), value: co.readiness == null ? '' : co.readiness + '%' },
        { label: labels('plan.fTotalGap'), value: String(co.total_gap ?? 0) }, { label: labels('plan.fCritical'), value: String(co.critical_cells ?? 0) }, { label: labels('plan.fSpof'), value: String(co.spof ?? 0) }] },
      { title: labels('plan.secTotals'), fields: [{ label: labels('plan.fLines'), value: String(t.lines) }, { label: labels('plan.fSeats'), value: String(t.seats) }, { label: labels('plan.fHours'), value: String(t.hours) },
        ...QUARTERS.map(q => ({ label: labels('plan.fQuarter', { q }), value: labels('plan.quarterLine', { n: t.by_quarter[q].lines, h: t.by_quarter[q].hours }) })),
        { label: labels('plan.fMethod'), value: labels('plan.method'), long: true }] }
    ],
    table: { title: labels('plan.tableTitle'), columns: ['quarter', 'priority', 'competency', 'people', 'meanGap', 'names', 'departments', 'course', 'lab', 'hoursEach', 'hoursTotal'].map(c => labels('plan.col.' + c)),
      rows: active.sort((a, b) => QUARTERS.indexOf(a.quarter) - QUARTERS.indexOf(b.quarter) || PRIORITY.indexOf(b.priority) - PRIORITY.indexOf(a.priority) || b.priority_value - a.priority_value || a.competency_id.localeCompare(b.competency_id))
        .map(r => [r.quarter, labels('priority.' + r.priority), `${r.competency_id} ${L(r.name)}`, String(r.people_affected), String(r.mean_gap), r.people.join('; '), r.departments.join('; '),
          r.course ? L(r.course.title) : labels('plan.noCourse'), r.lab ? L(r.lab.title) : '', String(r.hours_per_person), String(r.total_hours)]) },
    template_title: labels('plan.footer'), version: String(plan.year ?? '')
  };
}
export const planCsv = doc => toCsv(doc);
export const planSpreadsheet = doc => toSpreadsheetXml(doc);
export const planWord = (doc, opts) => toWordHtml(doc, opts);

/** The matrix as CSV: one line per person, one column per competency ("level/required source"). Formula-safe. */
export function matrixCsv(matrix, { labels = k => k, lang = 'en' } = {}) {
  const L = v => (typeof v === 'string' ? v : v?.[lang] || v?.en || '');
  const head = [labels('mx.col.person'), labels('mx.col.department'), labels('mx.col.role'), labels('mx.col.readiness'), ...matrix.columns.map(c => `${c.id} ${L(c.name)}`)];
  const lines = matrix.rows.map(r => [r.person.name, r.department?.name || '', r.role ? L(r.role.name) : '', r.summary.readiness == null ? '' : r.summary.readiness + '%',
    ...matrix.columns.map(c => { const x = r.cells[c.id]; return x ? `${x.level}/${x.required} ${labels('src.' + x.source)}` : ''; })]);
  return '﻿' + [head, ...lines].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ assignments */

/**
 * Check a new assignment: a known target of a known type, a due date from today on, and an audience that has people.
 * catalog: { course: [{id,title,slug,…}], lab: […], assessment: […], route: […] }.
 */
export function validateAssignment(input = {}, { catalog = {}, people = [], departments = [], today = todayIso() } = {}) {
  const e = {};
  if (!ASSIGNMENT_TYPES.includes(input.type)) e.type = 'required';
  const target = !e.type ? (catalog[input.type] || []).find(x => x.id === input.target_id) : null;
  if (!e.type && !target) e.target_id = 'required';
  if (!input.due) e.due = 'required'; else if (!isIsoDate(input.due)) e.due = 'invalid'; else if (input.due < today) e.due = 'past';
  const aud = input.audience || {};
  let assignees = [];
  if (!AUDIENCES.includes(aud.type)) e.audience = 'required';
  else if (aud.type === 'person') { const p = people.find(x => x.key === aud.id); if (!p) e.audience = 'required'; else assignees = [p.key]; }
  else { const d = departments.find(x => x.id === aud.id); if (!d) e.audience = 'required'; else { assignees = people.filter(p => p.department_id === d.id).map(p => p.key); if (!assignees.length) e.audience = 'empty'; } }
  const note = str(input.note); if (note.length > 300) e.note = 'long';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { type: input.type, target_id: target.id, title: tt(target.title), href: targetHref(input.type, target), hours: targetHours(input.type, target), due: input.due, note, audience: { type: aud.type, id: aud.id }, assignees } };
}
export const targetHref = (type, t) => (type === 'course' ? `#/academy/courses/${t.slug}` : type === 'lab' ? `#/labs/${t.slug}` : type === 'assessment' ? `#/assessments/${t.slug}` : `#/my?tab=path&route=${encodeURIComponent(t.id)}`);
export const targetHours = (type, t) => (type === 'course' ? Number(t.training_hours) || null : type === 'lab' ? Math.max(0.25, Math.round((Number(t.minutes) || 30) / 60 * 4) / 4) : null);

export function makeAssignment(value, { id, now = new Date().toISOString() } = {}) {
  return { id, schema: ASSIGNMENT_SCHEMA, ...value, created_at: now, cancelled: false };
}

/**
 * The file one employee imports: every active assignment that names them (directly or through their department).
 * { app, schema, batch_id, company, issued_by, issued_at, employee: { key, name }, items, label, digest }
 */
export function assignmentFile({ company = {}, person, assignments = [], batchId, now = new Date().toISOString() } = {}) {
  const items = assignments.filter(a => !a.cancelled && a.assignees.includes(person.key)).map(a => ({ id: a.id, type: a.type, target_id: a.target_id, title: a.title, due: a.due, note: a.note || '', hours: a.hours ?? null, created_at: a.created_at }));
  const file = { app: APP, schema: ASSIGNMENT_SCHEMA, batch_id: batchId, company: { name: str(company.name) }, issued_by: str(company.admin_name), issued_at: now, employee: { key: person.key, name: person.name }, items,
    label: { en: 'Learning assigned by your company. Importing it adds the items to My space on this device; nothing is sent back until you choose to share.', ar: 'تعلّم كلّفتك به شركتك. استيراده يضيف العناصر إلى مساحتي على هذا الجهاز، ولا يُرسل شيء إلى الشركة إلا إذا اخترت المشاركة.' } };
  return { ...file, digest: digestOf(file) };
}

/**
 * Employee side: read an assignment file. Never overwrites — an item already held is skipped; an item whose target this device
 * cannot open (unknown or not published) is skipped and counted. A file addressed to another person is refused.
 * known: { course: Set|Array of ids, lab, assessment, route }.
 */
export function readAssignmentFile(raw, { myKey = null, existing = [], known = {}, today = todayIso() } = {}) {
  let d = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_FILE_BYTES) return { ok: false, err: 'size' };
    try { d = JSON.parse(raw); } catch { return { ok: false, err: 'json' }; }
  }
  if (!d || typeof d !== 'object' || d.app !== APP || d.schema !== ASSIGNMENT_SCHEMA || !Array.isArray(d.items) || !d.employee || typeof d.employee !== 'object') return { ok: false, err: 'schema' };
  if (d.digest !== digestOf(digestBody(d))) return { ok: false, err: 'digest' };
  if (!isIsoDate(day(d.issued_at)) || day(d.issued_at) > today) return { ok: false, err: 'date' };
  if (myKey && d.employee.key && d.employee.key !== myKey) return { ok: false, err: 'other_person', name: str(d.employee.name) };
  const have = new Set(existing.map(x => x.id));
  const skipped = { duplicate: 0, unknown: 0, invalid: 0 };
  const add = [];
  for (const x of d.items.slice(0, LIMITS.items)) {
    if (!x || typeof x !== 'object' || !ID.test(String(x.id || '')) || !ASSIGNMENT_TYPES.includes(x.type) || !isIsoDate(x.due)) { skipped.invalid++; continue; }
    if (have.has(x.id)) { skipped.duplicate++; continue; }
    const ids = known[x.type]; const ok = ids instanceof Set ? ids.has(x.target_id) : Array.isArray(ids) && ids.includes(x.target_id);
    if (!ok) { skipped.unknown++; continue; }
    have.add(x.id);
    add.push({ id: x.id, type: x.type, target_id: x.target_id, title: tt(x.title), due: x.due, note: str(x.note).slice(0, 300), hours: Number.isFinite(x.hours) ? x.hours : null, company: str(d.company?.name).slice(0, 120), issued_by: str(d.issued_by).slice(0, 80),
      issued_at: d.issued_at, imported_at: new Date().toISOString(), batch_id: str(d.batch_id).slice(0, 80) });
  }
  return { ok: true, add, skipped, company: str(d.company?.name), employee_key: d.employee.key || null };
}

/**
 * Where one assignment stands on the employee's device, from the same records the passport uses:
 * course → courseStatus; assessment → a passed attempt; lab → an attempt that met the practice mark; route → its course and
 * assessment steps finished. { state, percent, completed_at }.
 */
export function assignmentProgress(item, { courses = [], progress = [], attempts = [], labs = [], labAttempts = [], routes = [], completedIds = [] } = {}) {
  if (item.type === 'course') {
    const c = courses.find(x => x.id === item.target_id); if (!c) return { state: 'not_started', percent: 0, completed_at: null };
    const st = courseStatus(c, progress, attempts);
    return { state: st.state, percent: st.state === 'completed' ? 100 : st.percent || 0, completed_at: st.state === 'completed' ? day(progress.find(p => p.id === c.id)?.updated_at) || null : null };
  }
  if (item.type === 'assessment') {
    const mine = attempts.filter(a => a.assessment_id === item.target_id).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
    const pass = mine.filter(a => a.passed).at(-1);
    return pass ? { state: 'completed', percent: 100, completed_at: day(pass.submitted_at) || null } : { state: mine.length ? 'in_progress' : 'not_started', percent: mine.length ? Math.round(mine.at(-1).score || 0) : 0, completed_at: null };
  }
  if (item.type === 'lab') {
    const mine = labAttempts.filter(a => a.lab_id === item.target_id).sort((a, b) => (a.attempt_no || 0) - (b.attempt_no || 0));
    const pass = mine.filter(a => a.mark_met || a.passed).at(-1);
    return pass ? { state: 'completed', percent: 100, completed_at: day(pass.submitted_at) || null } : { state: mine.length ? 'in_progress' : 'not_started', percent: mine.length ? Math.round(mine.at(-1).score || 0) : 0, completed_at: null };
  }
  const r = routes.find(x => x.id === item.target_id);
  const steps = (r?.steps || []).filter(s => ['course', 'assessment'].includes(s.type));
  if (!steps.length) return { state: 'not_started', percent: 0, completed_at: null };
  const done = steps.filter(s => completedIds.includes(s.target_id)).length;
  return { state: done === steps.length ? 'completed' : done ? 'in_progress' : 'not_started', percent: Math.round(done / steps.length * 100), completed_at: null };
}

/** completed · overdue (due date passed) · due_soon (within 14 days) · open. */
export function dueState(due, state, today = todayIso(), soonDays = DUE_SOON_DAYS) {
  if (state === 'completed') return 'completed';
  if (due < today) return 'overdue';
  return daysBetween(today, due) <= soonDays ? 'due_soon' : 'open';
}
export const daysLeft = (due, today = todayIso()) => daysBetween(today, due);

/** The `assignments` part of a share: the state of every assignment the employee holds. */
export const shareAssignments = (items = [], facts = {}) => items.map(it => { const p = assignmentProgress(it, facts); return { id: it.id, state: p.state, completed_at: p.completed_at, percent: p.percent }; });

/**
 * Administrator side: where an assignment stands for each assignee, from that person's newest share.
 * A person whose newest share is older than the assignment, or does not include the assignments part, is "awaiting" —
 * the company has no news yet, which is not the same as "not started".
 */
export function assignmentStatus(assignment, people = [], today = todayIso()) {
  const by = new Map(people.map(p => [p.key, p]));
  const rows = assignment.assignees.map(key => {
    const p = by.get(key);
    if (!p) return { key, name: null, known: false, state: 'not_started', due_state: dueState(assignment.due, 'not_started', today), awaiting: true, withdrawn: true, completed_at: null, percent: null };
    const rep = p.share.includes.includes('assignments') ? (p.share.data.assignments || []).find(a => a.id === assignment.id) : null;
    const state = rep ? rep.state : 'not_started';
    return { key, name: p.name, known: true, state, due_state: dueState(assignment.due, state, today), awaiting: !rep, withdrawn: false, completed_at: rep?.completed_at || null, percent: rep?.percent ?? null, as_of: day(p.share.shared_at) };
  });
  const count = s => rows.filter(r => r.due_state === s).length;
  return { rows, total: rows.length, completed: count('completed'), overdue: count('overdue'), due_soon: count('due_soon'), open: count('open'), awaiting: rows.filter(r => r.awaiting && r.due_state !== 'completed').length,
    due_state: assignment.cancelled ? 'cancelled' : rows.length && count('completed') === rows.length ? 'completed' : count('overdue') ? 'overdue' : count('due_soon') ? 'due_soon' : 'open' };
}

/** Assignment tracker as CSV (one line per person per assignment). Formula-safe. */
export function trackerCsv(assignments = [], people = [], { labels = k => k, lang = 'en', today = todayIso() } = {}) {
  const L = v => (typeof v === 'string' ? v : v?.[lang] || v?.en || '');
  const head = ['title', 'type', 'person', 'due', 'state', 'dueState', 'completed', 'asOf'].map(c => labels('asg.col.' + c));
  const lines = [];
  for (const a of assignments.filter(x => !x.cancelled)) for (const r of assignmentStatus(a, people, today).rows)
    lines.push([L(a.title), labels('asg.type.' + a.type), r.name || labels('asg.withdrawn'), a.due, r.awaiting ? labels('asg.awaiting') : labels('asg.state.' + r.state), labels('asg.due.' + r.due_state), r.completed_at || '', r.as_of || '']);
  return '﻿' + [head, ...lines].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ workspace backup */

export function exportCompany({ profile = null, departments = [], roles = [], placements = [], shares = [], assignments = [], plan = null } = {}, now = new Date().toISOString()) {
  const file = { app: APP, schema: COMPANY_SCHEMA, exported_at: now, label: COMPANY_LABEL, data: { profile, departments, roles, placements, shares, assignments, plan } };
  return { ...file, digest: digestOf(file) };
}

/** Read a workspace backup. Never overwrites: records whose id exists are skipped; the profile is taken only when none exists. */
export function importCompany(raw, existing = {}) {
  let d = raw;
  if (typeof raw === 'string') { try { d = JSON.parse(raw); } catch { return { ok: false, err: 'json' }; } }
  if (!d || typeof d !== 'object' || d.app !== APP || d.schema !== COMPANY_SCHEMA || !d.data || typeof d.data !== 'object') return { ok: false, err: 'schema' };
  if (d.digest !== digestOf(digestBody(d))) return { ok: false, err: 'digest' };
  const skipped = { duplicate: 0, invalid: 0 };
  const take = key => {
    const ids = new Set((existing[key] || []).map(x => x.id)); const out = [];
    for (const x of (Array.isArray(d.data[key]) ? d.data[key] : []).slice(0, 2000)) {
      if (!x || typeof x !== 'object' || !ID.test(String(x.id || ''))) { skipped.invalid++; continue; }
      if (ids.has(x.id)) { skipped.duplicate++; continue; }
      ids.add(x.id); out.push(x);
    }
    return out;
  };
  const profile = existing.profile ? null : validateCompany(d.data.profile || {}).value;
  return { ok: true, profile, add: { departments: take('departments'), roles: take('roles'), placements: take('placements'), shares: take('shares'), assignments: take('assignments') },
    plan: existing.plan ? null : d.data.plan && typeof d.data.plan === 'object' ? { id: 'me', overrides: d.data.plan.overrides && typeof d.data.plan.overrides === 'object' ? d.data.plan.overrides : {} } : null, skipped };
}

/* ------------------------------------------------------------------ sample company (clearly labelled, removable) */

/**
 * A fictional company for trying the workspace: three departments and six fictional employees whose shares are built by the
 * same buildShare as real ones (flagged `sample: true`, shown with a "Sample" badge, removed in one action).
 * Levels are derived from each sample's role targets by a fixed pattern — no real person, no real organisation.
 */
export function sampleCompany({ ciaRoles = [], competencies = [], today = todayIso() } = {}) {
  const role = id => ciaRoles.find(r => r.id === id) || ciaRoles[0];
  const departments = [
    { id: 'DEP-SAMPLE-1', name: 'Quality & HSE (sample)', roles: ['ROLE-QMGR', 'ROLE-QE', 'ROLE-HSEQM'].filter(id => ciaRoles.some(r => r.id === id)), sample: true },
    { id: 'DEP-SAMPLE-2', name: 'Internal Audit (sample)', roles: ['ROLE-LA', 'ROLE-IA'].filter(id => ciaRoles.some(r => r.id === id)), sample: true },
    { id: 'DEP-SAMPLE-3', name: 'Projects & PMO (sample)', roles: ['ROLE-PM', 'ROLE-PMOA'].filter(id => ciaRoles.some(r => r.id === id)), sample: true }
  ];
  const staff = [
    ['EMP-SAMPLE-01', 'Sample · Layla Haddad', 'Quality Manager', 'ROLE-QMGR', 'DEP-SAMPLE-1', 0, 5],
    ['EMP-SAMPLE-02', 'Sample · Omar Saleh', 'Quality Engineer', 'ROLE-QE', 'DEP-SAMPLE-1', 1, 12],
    ['EMP-SAMPLE-03', 'Sample · Noura Aziz', 'HSEQ Engineer', 'ROLE-HSEQM', 'DEP-SAMPLE-1', 2, 40],
    ['EMP-SAMPLE-04', 'Sample · Khalid Mansour', 'Lead Auditor', 'ROLE-LA', 'DEP-SAMPLE-2', 0, 8],
    ['EMP-SAMPLE-05', 'Sample · Mona Farouk', 'Internal Auditor', 'ROLE-IA', 'DEP-SAMPLE-2', 2, 120],
    ['EMP-SAMPLE-06', 'Sample · Yousef Karim', 'Project Manager', 'ROLE-PM', 'DEP-SAMPLE-3', 1, 20]
  ];
  const files = []; const placements = [];
  staff.forEach(([key, name, job, roleId, dept, pattern, ageDays], si) => {
    const r = role(roleId);
    const rows = [];
    competencies.forEach((c, i) => {
      const req = r?.targets?.[c.id] || 0; if (!req) return;
      const k = (i + si * 3 + pattern) % 6;
      /* a fixed pattern: met by assessment, met by self-rating, one below, two below, verified (or nothing shared), met by assessment */
      if (k === 0 || k === 5) rows.push({ id: c.id, level: Math.min(4, req), source: 'assessment', percent: [0, 45, 60, 75, 90][Math.min(4, req)], date: addDays(today, -ageDays - 10) });
      else if (k === 1 || (k === 3 && req < 3)) rows.push({ id: c.id, level: req, source: 'self', date: null });
      else if (k === 2) rows.push({ id: c.id, level: Math.max(1, req - 1), source: 'self', date: null });
      else if (k === 3) rows.push({ id: c.id, level: req - 2, source: 'assessment', percent: [0, 45, 60, 75, 90][req - 2], date: addDays(today, -ageDays - 20) });
      else if (k === 4 && pattern === 0) rows.push({ id: c.id, level: req, source: 'verified', date: addDays(today, -ageDays - 30), verification: { reviewer: 'Sample Reviewer', date: addDays(today, -ageDays - 30), method: 'work_sample' } });
    });
    const parts = pattern === 0 ? ['competencies', 'verified', 'cpd', 'credentials'] : ['competencies', 'cpd'];
    files.push(buildShare({ employee: { key, name, job_title: job, employee_no: 'S-' + String(si + 1).padStart(3, '0') }, parts, sample: true, shareId: `SHR-SAMPLE-${String(si + 1).padStart(2, '0')}`, now: addDays(today, -ageDays) + 'T09:00:00.000Z',
      data: { competencies: rows, cpd: { total: 12 + si * 6, count: 3 + si, by_year: { [today.slice(0, 4)]: 12 + si * 6 } }, credentials: pattern === 0 ? [{ name: 'Sample credential (fictional)', issuer: 'Sample Issuer', issued: addDays(today, -400), expires: null, kind: 'external', state: 'self_declared', checked_by: null }] : [] } }));
    placements.push({ id: key, department_id: dept, role_id: r?.id || null });
  });
  return { profile: { id: 'me', schema: COMPANY_SCHEMA, name: 'Sample Company (fictional)', sector: 'Sample data', admin_name: '', min_holders: DEFAULT_MIN_HOLDERS, plan_year: null, sample: true }, departments, placements, files };
}
