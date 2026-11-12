/**
 * Professional Passport, CPD log, credential wallet, practice logs and career roadmap (Phase 12). Pure functions, no storage.
 *
 * The passport is ONE honest record of the learner's development on this device: what was learned, what was shown in practice,
 * what is verified and by whom. It is a record of learning and practice — not a certification, not an accreditation, and it
 * awards no recognised CPD, PDU or RU. Rules (PASSPORT_EVIDENCE_RULES.md):
 *  - every entry carries ONE evidence status: self_declared · course_assessed · platform_assessed · reviewer_verified ·
 *    externally_certified (spec §20);
 *  - the status comes from the source of the evidence; it is never upgraded without the rule that allows it:
 *      course completion with its final assessment passed → course_assessed (lessons only, no final → self_declared);
 *      an automatically scored assessment or lab attempt → platform_assessed (written tasks stay "awaiting review");
 *      a smart-template document, a CPD activity typed by the learner, a practice-log entry → self_declared;
 *      reviewer_verified only with a valid verification record (named reviewer ≥ 3 characters, ISO date not in the future,
 *        a known method, decision "verified");
 *      externally_certified only for an external credential whose issuer record a named reviewer checked (method
 *        issuer_check or document_review) — the issuer certified it; CIA never claims to have verified or awarded it;
 *  - imported files never bring verifications or reviews with them (they would upgrade without the rule);
 *  - the record is on this device only; real multi-user review is Phase 14.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { courseStatus, MASTERY_THRESHOLD } from './learner-model.mjs';
import { currentLevel } from './recommendations.mjs';
import { parseNumber, makeLabAttempt, LAB_ATTEMPT_SCHEMA } from './labs.mjs';
import { csvCell } from './templates.mjs';

export const PASSPORT_SCHEMA = 'cia.passport.v1';
export const EVIDENCE = ['self_declared', 'course_assessed', 'platform_assessed', 'reviewer_verified', 'externally_certified'];
/** Rank only orders how strong the basis is; it never turns into a score. */
export const EVIDENCE_RANK = Object.fromEntries(EVIDENCE.map((s, i) => [s, i]));
export const ENTRY_KINDS = ['course', 'assessment', 'lab', 'document', 'certificate', 'credential', 'cpd', 'log'];
export const VERIFY_METHODS = ['document_review', 'work_sample', 'observation', 'interview', 'issuer_check'];
export const VERIFY_DECISIONS = ['verified', 'rejected'];
export const CREDENTIAL_TYPES = ['professional_cert', 'training_cert', 'academic', 'membership', 'license', 'award'];
export const CREDENTIAL_STATES = ['self_declared', 'evidence_uploaded', 'pending_verification', 'verified', 'expired', 'rejected'];
export const LOG_KINDS = ['auditor', 'consultant', 'trainer'];
export const LOG_STATES = ['self_declared', 'evidence_uploaded', 'verified'];
export const CPD_CATEGORIES = ['course', 'practice_lab', 'workshop', 'conference', 'self_study', 'mentoring', 'teaching', 'work_project', 'other'];
export const AUDIT_TYPES = ['internal', 'first_party', 'second_party', 'supplier', 'third_party'];
export const AUDIT_ROLES = ['lead', 'member', 'observer', 'technical_expert'];
export const CONSULT_ROLES = ['lead', 'member', 'advisor'];
export const REASSESS_MONTHS = 24;
export const KNOWLEDGE_KINDS = ['diagnostic', 'readiness', 'knowledge_quiz', 'final'];
export const SCENARIO_KINDS = ['scenario'];
export const PRACTICAL_KINDS = ['practical'];
export const MAX_ITEMS = 500;
export const PASSPORT_LABEL = {
  en: 'Professional Passport — a record of learning and practice on this device. It is not a certification, not an accreditation and awards no recognised CPD, PDU or RU.',
  ar: 'الجواز المهني — سجل للتعلّم والممارسة على هذا الجهاز. وهو ليس شهادة ولا اعتمادًا، ولا يمنح ساعات تطوير مهني معترفًا بها ولا وحدات PDU أو RU.'
};
/** Badges are labels for patterns in the record. They are never certificates and never carry a certificate_type. */
export const BADGES = [
  { id: 'verified_auditor_log', kind: 'badge', rule: 'one auditor-log entry verified by a named reviewer' },
  { id: 'cpd_100', kind: 'badge', rule: '100 CPD hours recorded in total' },
  { id: 'trainer_50', kind: 'badge', rule: '50 training-delivery hours logged' },
  { id: 'lab_practitioner', kind: 'badge', rule: 'practice mark met in three different labs' }
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const day = s => String(s || '').slice(0, 10);
const str = v => String(v ?? '').trim().replace(/\s+/g, ' ');
const isIsoDate = s => { if (!ISO.test(s || '')) return false; const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const safeUrl = u => { const s = str(u); if (!s) return ''; try { const x = new URL(s); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };
const round2 = n => Math.round(n * 100) / 100;
const quarter = n => Math.round(n * 4) / 4;
const tt = v => (v && typeof v === 'object' ? { en: v.en || '', ar: v.ar || v.en || '' } : { en: String(v ?? ''), ar: String(v ?? '') });
export function addMonths(iso, months) {
  if (!isIsoDate(day(iso))) return null;
  const d = new Date(day(iso) + 'T00:00:00Z'); const dd = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dd, last));
  return d.toISOString().slice(0, 10);
}
const addDays = (iso, n) => { const d = new Date(day(iso) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ------------------------------------------------------------------ verification records (the only way up) */

/** Key of the thing a verification is about. */
export const targetKey = (kind, id) => `${kind}:${id}`;

/**
 * A verification by a named reviewer on this device: { id: "<kind>:<id>", target_kind, target_id, reviewer, reviewer_role?,
 * date (ISO, not in the future), method, decision verified|rejected, note?, level? (competency 1–5), recorded_at }.
 * Returns '' or an error code.
 */
export function validateVerification(v, today = todayIso()) {
  if (!v || typeof v !== 'object') return 'shape';
  if (![...ENTRY_KINDS, 'competency'].includes(v.target_kind) || !str(v.target_id)) return 'target';
  if (str(v.reviewer).length < 3) return 'reviewer';
  if (!isIsoDate(v.date) || v.date > today) return 'date';
  if (!VERIFY_METHODS.includes(v.method)) return 'method';
  if (!VERIFY_DECISIONS.includes(v.decision)) return 'decision';
  if (v.target_kind === 'competency' && v.decision === 'verified' && !(Number.isInteger(v.level) && v.level >= 1 && v.level <= 5)) return 'level';
  if (v.method === 'issuer_check' && v.target_kind !== 'credential') return 'method';
  if (str(v.note).length > 500) return 'note';
  return '';
}

export function makeVerification(input, today = todayIso(), now = new Date().toISOString()) {
  const v = { id: targetKey(input.target_kind, input.target_id), target_kind: input.target_kind, target_id: str(input.target_id), reviewer: str(input.reviewer),
    reviewer_role: str(input.reviewer_role).slice(0, 80), date: input.date, method: input.method, decision: input.decision, note: str(input.note).slice(0, 500), recorded_at: now };
  if (input.target_kind === 'competency' && input.decision === 'verified') v.level = Number(input.level);
  const err = validateVerification(v, today);
  if (err) throw new Error('verification_' + err);
  return v;
}

/** The valid verification for one target, or null (an invalid record is ignored: it cannot upgrade anything). */
export function verificationFor(verifications = [], kind, id, today = todayIso()) {
  const v = verifications.find(x => x && x.id === targetKey(kind, id));
  return v && !validateVerification(v, today) ? v : null;
}

/**
 * The evidence status of an entry from its base status and an optional verification. This is the ONLY function that
 * produces reviewer_verified or externally_certified.
 */
export function evidenceStatus(kind, base, verification = null, today = todayIso()) {
  if (!EVIDENCE.includes(base)) base = 'self_declared';
  if (base === 'externally_certified' || base === 'reviewer_verified') base = 'self_declared'; /* a base can never claim verification */
  const ok = verification && !validateVerification(verification, today) && verification.decision === 'verified' && verification.target_kind === kind;
  if (!ok) return base;
  if (kind === 'credential') return ['issuer_check', 'document_review'].includes(verification.method) ? 'externally_certified' : base;
  return 'reviewer_verified';
}

/** Can `to` be shown for this entry? (unit-tested: no upgrade without its rule) */
export const canHaveStatus = (kind, base, to, verification = null, today = todayIso()) => evidenceStatus(kind, base, verification, today) === to;

/* ------------------------------------------------------------------ CPD log (spec §21) */

/** Validate one CPD activity; returns { errors: {field: code}, value } with a clean record when there are no errors. */
export function validateCpd(input = {}, { today = todayIso(), competencyIds = null } = {}) {
  const e = {};
  const title = str(input.title);
  if (!title) e.title = 'required'; else if (title.length < 3) e.title = 'short'; else if (title.length > 160) e.title = 'long';
  if (!CPD_CATEGORIES.includes(input.category)) e.category = 'required';
  if (!isIsoDate(input.date)) e.date = 'invalid'; else if (input.date > today) e.date = 'future';
  const hours = typeof input.hours === 'number' ? input.hours : parseNumber(input.hours);
  if (hours === null || !Number.isFinite(hours)) e.hours = 'number'; else if (hours < 0.25 || hours > 100) e.hours = 'range';
  const provider = str(input.provider); if (provider.length > 120) e.provider = 'long';
  const url = safeUrl(input.evidence_url); if (url === null) e.evidence_url = 'url';
  const note = str(input.evidence_note); if (note.length > 500) e.evidence_note = 'long';
  if (input.competency && competencyIds && !competencyIds.includes(input.competency)) e.competency = 'unknown';
  const cert = str(input.certification); if (cert.length > 80) e.certification = 'long';
  const src = input.source && typeof input.source === 'object' && ['course', 'lab', 'certificate'].includes(input.source.type) && str(input.source.id) ? { type: input.source.type, id: str(input.source.id) } : null;
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { id: str(input.id) || null, title, category: input.category, provider, date: input.date, hours: quarter(hours), evidence_url: url || '', evidence_note: note,
    competency: input.competency || '', certification: cert, source: src, status: 'confirmed' } };
}

export function makeCpd(input, { today = todayIso(), now = new Date().toISOString(), competencyIds = null, existing = null } = {}) {
  const { errors, value } = validateCpd(input, { today, competencyIds });
  if (!value) { const err = new Error('cpd_invalid'); err.fields = errors; throw err; }
  return { ...value, id: existing?.id || value.id || 'cpd-' + now.replace(/\D/g, '').slice(0, 17) + '-' + Math.abs(hashNum(value.title + value.date)).toString(36).slice(0, 4),
    created_at: existing?.created_at || now, updated_at: now };
}

const hashNum = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; };

/** Totals: overall, per year and per category (hours to two decimals). */
export function cpdTotals(entries = []) {
  const out = { total: 0, count: 0, byYear: {}, byCategory: {} };
  for (const x of entries) {
    if (!x || x.status === 'dismissed' || !Number.isFinite(x.hours)) continue;
    const y = day(x.date).slice(0, 4);
    out.total += x.hours; out.count++;
    out.byCategory[x.category] = round2((out.byCategory[x.category] || 0) + x.hours);
    const yy = out.byYear[y] || (out.byYear[y] = { total: 0, count: 0, byCategory: {} });
    yy.total = round2(yy.total + x.hours); yy.count++; yy.byCategory[x.category] = round2((yy.byCategory[x.category] || 0) + x.hours);
  }
  out.total = round2(out.total);
  return out;
}

/**
 * Suggestions the learner may confirm (never added automatically): completed courses (their training hours), submitted lab
 * attempts (lab minutes) and certificates of completion (the course they certify — one suggestion per course, never two).
 * `cpd` holds confirmed entries (with `source`) and `dismissed` the keys the learner turned down.
 */
export function cpdSuggestions({ courses = [], progress = [], attempts = [], labs = [], labAttempts = [], certificates = [], cpd = [], dismissed = [] } = {}) {
  const taken = new Set([...cpd.filter(x => x.source).map(x => `${x.source.type === 'certificate' ? 'course' : x.source.type}:${x.source.id}`), ...dismissed]);
  const out = [];
  const certBy = new Map(certificates.map(c => [c.course_id, c]));
  for (const c of courses) {
    const st = courseStatus(c, progress, attempts);
    if (st.state !== 'completed') continue;
    const key = `course:${c.id}`;
    if (taken.has(key)) continue;
    const p = progress.find(x => x.id === c.id);
    const cert = certBy.get(c.id);
    out.push({ key, source: { type: cert ? 'certificate' : 'course', id: c.id }, title: tt(c.title), hours: Number(c.training_hours) || 1, category: 'course',
      date: day(cert?.issued_at || p?.updated_at || p?.completed_at) || null, certificate_number: cert?.number || null });
  }
  const labBy = new Map(labs.map(l => [l.id, l]));
  for (const a of labAttempts) {
    const l = labBy.get(a.lab_id);
    if (!l || a.schema !== LAB_ATTEMPT_SCHEMA) continue;
    const key = `lab:${a.id}`;
    if (taken.has(key)) continue;
    out.push({ key, source: { type: 'lab', id: a.id }, title: tt(l.title), hours: Math.max(0.25, quarter((Number(l.minutes) || 30) / 60)), category: 'practice_lab', date: day(a.submitted_at) || null, attempt_no: a.attempt_no });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** A confirmed suggestion as a CPD record (the learner may change hours and date before confirming). */
export function confirmSuggestion(s, edits = {}, opts = {}) {
  return makeCpd({ title: s.title?.[opts.lang || 'en'] || s.title?.en || '', category: s.category, date: edits.date || s.date || (opts.today || todayIso()), hours: edits.hours ?? s.hours,
    provider: 'CIA', evidence_note: s.certificate_number ? s.certificate_number : '', source: s.source, competency: '' }, opts);
}

export const CPD_COLUMNS = ['date', 'title', 'category', 'provider', 'hours', 'competency', 'certification', 'evidence', 'status'];
/** CSV of the CPD log (UTF-8 BOM, formula-like cells neutralised). `labels` maps column ids and categories to display text. */
export function cpdCsv(entries = [], { labels = {}, statusOf = () => '' } = {}) {
  const head = CPD_COLUMNS.map(c => csvCell(labels[c] || c)).join(',');
  const rows = [...entries].filter(x => x.status !== 'dismissed').sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(x => [x.date, x.title, labels['cat.' + x.category] || x.category, x.provider, String(x.hours), x.competency, x.certification, x.evidence_url || x.evidence_note, statusOf(x)].map(csvCell).join(','));
  return '﻿' + [head, ...rows].join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ credential wallet (ADD-14) */

export function validateCredential(input = {}, today = todayIso()) {
  const e = {};
  if (!CREDENTIAL_TYPES.includes(input.type)) e.type = 'required';
  const name = str(input.name); if (!name) e.name = 'required'; else if (name.length < 2) e.name = 'short'; else if (name.length > 160) e.name = 'long';
  const issuer = str(input.issuer); if (!issuer) e.issuer = 'required'; else if (issuer.length < 2) e.issuer = 'short'; else if (issuer.length > 120) e.issuer = 'long';
  if (!isIsoDate(input.issued)) e.issued = 'invalid'; else if (input.issued > today) e.issued = 'future';
  if (input.expires) { if (!isIsoDate(input.expires)) e.expires = 'invalid'; else if (isIsoDate(input.issued) && input.expires < input.issued) e.expires = 'before'; }
  const cid = str(input.credential_id); if (cid.length > 80) e.credential_id = 'long';
  const vu = safeUrl(input.verify_url); if (vu === null || (vu && !vu.startsWith('https://'))) e.verify_url = 'url';
  const eu = safeUrl(input.evidence_url); if (eu === null) e.evidence_url = 'url';
  const note = str(input.evidence_note); if (note.length > 500) e.evidence_note = 'long';
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { type: input.type, name, issuer, issued: input.issued, expires: input.expires || '', credential_id: cid, verify_url: vu || '', evidence_url: eu || '', evidence_note: note } };
}

/** Create or edit an external credential; every change appends to its audit trail. */
export function saveCredential(input, { existing = null, today = todayIso(), now = new Date().toISOString(), by = 'learner' } = {}) {
  const { errors, value } = validateCredential(input, today);
  if (!value) { const err = new Error('credential_invalid'); err.fields = errors; throw err; }
  const trail = [...(existing?.trail || [])];
  if (!existing) trail.push({ at: now, event: 'declared', by });
  const hadEv = !!(existing && (existing.evidence_url || existing.evidence_note));
  if ((value.evidence_url || value.evidence_note) && !hadEv) trail.push({ at: now, event: 'evidence_added', by });
  else if (existing) trail.push({ at: now, event: 'edited', by });
  return { ...value, id: existing?.id || 'cred-' + now.replace(/\D/g, '').slice(0, 17) + '-' + Math.abs(hashNum(value.name + value.issuer)).toString(36).slice(0, 4),
    requested_at: existing?.requested_at || null, trail, created_at: existing?.created_at || now, updated_at: now };
}

export function requestVerification(cred, now = new Date().toISOString()) {
  if (!(cred.evidence_url || cred.evidence_note)) throw new Error('credential_no_evidence');
  return { ...cred, requested_at: cred.requested_at || now, trail: [...(cred.trail || []), { at: now, event: 'verification_requested', by: 'learner' }], updated_at: now };
}

/** Wallet state: Self-Declared → Evidence Uploaded → Pending Verification → Verified → Expired / Rejected. */
export function credentialState(c, verification = null, today = todayIso()) {
  const v = verification && !validateVerification(verification, today) && verification.target_kind === 'credential' ? verification : null;
  if (v?.decision === 'rejected') return 'rejected';
  if (c.expires && isIsoDate(c.expires) && c.expires < today) return 'expired';
  if (v?.decision === 'verified') return 'verified';
  if (c.requested_at) return 'pending_verification';
  if (c.evidence_url || c.evidence_note) return 'evidence_uploaded';
  return 'self_declared';
}

/** The trail with the reviewer's decision added (for the admin/reviewer view). */
export function credentialTrail(c, verification = null, today = todayIso()) {
  const t = [...(c.trail || [])];
  const v = verification && !validateVerification(verification, today) ? verification : null;
  if (v) t.push({ at: v.recorded_at || v.date, event: v.decision, by: v.reviewer, method: v.method, date: v.date });
  if (c.expires && c.expires < today) t.push({ at: c.expires, event: 'expired', by: 'system' });
  return t.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/**
 * Wallet rows: CIA certificates of completion and declared external credentials. External rows NEVER say "verified by CIA":
 * `verified_by` is always the issuer; `checked_by` is the named reviewer who looked at the issuer's record.
 */
export function walletEntries({ certificates = [], credentials = [], verifications = [], today = todayIso() } = {}) {
  const cia = certificates.map(c => ({ key: `certificate:${c.id}`, kind: 'cia_completion', id: c.id, name: tt(c.course_title), issuer: 'CIA', issued: day(c.issued_at), expires: '', number: c.number,
    state: 'issued', certificate_type: 'completion', href: null, verified_by: null, checked_by: null }));
  const ext = credentials.map(c => {
    const v = verificationFor(verifications, 'credential', c.id, today);
    const state = credentialState(c, v, today);
    return { key: `credential:${c.id}`, kind: 'external', id: c.id, type: c.type, name: c.name, issuer: c.issuer, issued: c.issued, expires: c.expires, number: c.credential_id,
      state, verify_url: c.verify_url || '', verified_by: c.issuer, checked_by: state === 'verified' ? { reviewer: v.reviewer, date: v.date, method: v.method } : null,
      evidence_status: evidenceStatus('credential', 'self_declared', state === 'verified' ? v : null, today), expiring_soon: !!(c.expires && c.expires >= today && c.expires <= addDays(today, 90)) };
  });
  return [...cia, ...ext];
}

/* ------------------------------------------------------------------ specialized passports (ADD-11) */

const FIELDS = {
  auditor: { audit_type: AUDIT_TYPES, standard: 60, industry: 80, role: AUDIT_ROLES, days: [0.5, 60], scope: 200, findings: [0, 500, 'int'] },
  consultant: { project: 120, standard: 60, industry: 80, role: CONSULT_ROLES, months: [0.5, 60], scope: 200, deliverables: 300 },
  trainer: { course: 120, subjects: 160, hours: [0.5, 200], participants: [1, 1000, 'int'], organization: 120, rating: [1, 5, 'opt'] }
};
const REQUIRED = { auditor: ['audit_type', 'standard', 'role', 'days'], consultant: ['project', 'role', 'months'], trainer: ['course', 'hours', 'participants'] };
export const LOG_FIELDS = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, Object.keys(v)]));

export function validateLog(kind, input = {}, today = todayIso()) {
  const spec = FIELDS[kind];
  if (!spec) return { errors: { kind: 'unknown' }, value: null };
  const e = {}; const value = { kind };
  for (const [f, rule] of Object.entries(spec)) {
    const raw = input[f];
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (empty) { if (REQUIRED[kind].includes(f)) e[f] = 'required'; value[f] = Array.isArray(rule) && typeof rule[0] === 'number' ? null : ''; continue; }
    if (Array.isArray(rule) && typeof rule[0] === 'number') {
      const n = typeof raw === 'number' ? raw : parseNumber(raw);
      if (n === null || !Number.isFinite(n)) e[f] = 'number';
      else if (rule[2] === 'int' && !Number.isInteger(n)) e[f] = 'int';
      else if (n < rule[0] || n > rule[1]) e[f] = 'range';
      else value[f] = rule[2] === 'int' || rule[2] === 'opt' ? n : round2(n);
    } else if (Array.isArray(rule)) { if (!rule.includes(raw)) e[f] = 'required'; else value[f] = raw; }
    else { const s = str(raw); if (s.length > rule) e[f] = 'long'; else value[f] = s; }
  }
  if (!isIsoDate(input.date)) e.date = 'invalid'; else if (input.date > today) e.date = 'future'; else value.date = input.date;
  const eu = safeUrl(input.evidence_url); if (eu === null) e.evidence_url = 'url'; else value.evidence_url = eu || '';
  const note = str(input.evidence_note); if (note.length > 500) e.evidence_note = 'long'; else value.evidence_note = note;
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value };
}

export function makeLog(kind, input, { existing = null, today = todayIso(), now = new Date().toISOString() } = {}) {
  const { errors, value } = validateLog(kind, input, today);
  if (!value) { const err = new Error('log_invalid'); err.fields = errors; throw err; }
  return { ...value, id: existing?.id || `log-${kind}-` + now.replace(/\D/g, '').slice(0, 17) + '-' + Math.abs(hashNum(JSON.stringify(value))).toString(36).slice(0, 4), created_at: existing?.created_at || now, updated_at: now };
}

/** Self-declared → evidence uploaded → verified (only with a valid verification). */
export function logState(entry, verification = null, today = todayIso()) {
  const v = verification && !validateVerification(verification, today) && verification.target_kind === 'log' ? verification : null;
  if (v?.decision === 'verified') return 'verified';
  if (entry.evidence_url || entry.evidence_note) return 'evidence_uploaded';
  return 'self_declared';
}

export function logTotals(logs = [], verifications = [], today = todayIso()) {
  const by = k => logs.filter(x => x.kind === k);
  const verified = k => by(k).filter(x => logState(x, verificationFor(verifications, 'log', x.id, today), today) === 'verified').length;
  return {
    auditor: { entries: by('auditor').length, days: round2(by('auditor').reduce((a, x) => a + (x.days || 0), 0)), findings: by('auditor').reduce((a, x) => a + (x.findings || 0), 0), lead: by('auditor').filter(x => x.role === 'lead').length, verified: verified('auditor') },
    consultant: { entries: by('consultant').length, months: round2(by('consultant').reduce((a, x) => a + (x.months || 0), 0)), verified: verified('consultant') },
    trainer: { entries: by('trainer').length, hours: round2(by('trainer').reduce((a, x) => a + (x.hours || 0), 0)), participants: by('trainer').reduce((a, x) => a + (x.participants || 0), 0), verified: verified('trainer') }
  };
}

/** Badges earned (labels only). Each carries `kind: "badge"` and never a certificate_type. */
export function earnedBadges({ logs = [], cpd = [], labAttempts = [], verifications = [], today = todayIso() } = {}) {
  const lt = logTotals(logs, verifications, today);
  const labsMet = new Set(labAttempts.filter(a => a.mark_met || a.passed).map(a => a.lab_id)).size;
  const have = { verified_auditor_log: lt.auditor.verified >= 1, cpd_100: cpdTotals(cpd).total >= 100, trainer_50: lt.trainer.hours >= 50, lab_practitioner: labsMet >= 3 };
  return BADGES.filter(b => have[b.id]).map(b => ({ id: b.id, kind: 'badge', rule: b.rule }));
}

/* ------------------------------------------------------------------ passport entries */

/**
 * Every entry of the passport, newest first: { key, kind, id, title {en,ar}|string, date, base, status, verification, href, detail }.
 * Inputs are the viewer's visible content and the learner's own records.
 */
export function buildEntries({ courses = [], assessments = [], labs = [], templates = [], progress = [], attempts = [], labAttempts = [], docs = [], certificates = [], credentials = [], cpd = [], logs = [], verifications = [], today = todayIso() } = {}) {
  const out = [];
  const V = (kind, id) => verificationFor(verifications, kind, id, today);
  const push = (kind, id, base, rest) => { const v = V(kind, id); out.push({ key: targetKey(kind, id), kind, id, base, status: evidenceStatus(kind, base, v, today), verification: v, ...rest }); };
  const courseById = new Map(courses.map(c => [c.id, c]));
  for (const c of courses) {
    const st = courseStatus(c, progress, attempts);
    if (st.state === 'not_started') continue;
    const p = progress.find(x => x.id === c.id);
    /* Lessons marked done are the learner's own statement; completion with the final passed is course-assessed. */
    const base = st.state === 'completed' && c.assessments?.final ? 'course_assessed' : 'self_declared';
    push('course', c.id, base, { title: tt(c.title), date: day(p?.updated_at) || null, href: `#/academy/courses/${c.slug}`,
      detail: { state: st.state, done: st.done, lessons: st.total, hours: c.training_hours ?? null, final: c.assessments?.final || null, finalPassed: !!st.finalPassed } });
  }
  const asmById = new Map(assessments.map(a => [a.id, a]));
  const latestAsm = new Map();
  for (const a of [...attempts].sort((x, y) => String(x.submitted_at).localeCompare(String(y.submitted_at)))) latestAsm.set(a.assessment_id, a);
  for (const a of latestAsm.values()) {
    const def = asmById.get(a.assessment_id);
    const auto = !(a.pending_review && !(a.detail || []).some(d => d.auto));
    const base = auto ? 'platform_assessed' : 'self_declared';
    push('assessment', a.assessment_id, base, { title: def ? tt(def.title) : a.assessment_id, date: day(a.submitted_at) || null, href: def ? `#/assessments/${def.slug}` : null,
      detail: { kind: def?.kind || null, score: a.score, passed: !!a.passed, awaiting: a.pending_review || 0, attempts: attempts.filter(x => x.assessment_id === a.assessment_id).length, course: def?.course_id ? tt(courseById.get(def.course_id)?.title) : null } });
  }
  const labById = new Map(labs.map(l => [l.id, l]));
  const latestLab = new Map();
  for (const a of [...labAttempts].filter(x => x.schema === LAB_ATTEMPT_SCHEMA).sort((x, y) => (x.attempt_no || 0) - (y.attempt_no || 0))) latestLab.set(a.lab_id, a);
  for (const a of latestLab.values()) {
    const l = labById.get(a.lab_id);
    const reviewed = (a.detail || []).filter(d => d.reviewed).length;
    const auto = (a.detail || []).some(d => d.auto) || reviewed > 0;
    push('lab', a.id, auto ? 'platform_assessed' : 'self_declared', { title: l ? tt(l.title) : a.lab_id, date: day(a.submitted_at) || null, href: l ? `#/labs/${l.slug}?attempt=${a.attempt_no}` : null,
      detail: { score: a.score, mark_met: !!a.mark_met, passed: !!a.passed, awaiting: a.pending_review || 0, reviewed, reviewers: [...new Set(Object.values(a.reviews || {}).map(r => r.reviewer).filter(Boolean))], attempt_no: a.attempt_no, lab_id: a.lab_id } });
  }
  const tplById = new Map(templates.map(t => [t.id, t]));
  for (const d of docs) {
    const tpl = tplById.get(d.template_id);
    if (!tpl) continue;
    push('document', d.id, 'self_declared', { title: d.title || tt(tpl.doc_title || tpl.title), date: day(d.updated_at) || null, href: `#/templates/${tpl.slug}?doc=${encodeURIComponent(d.id)}`, detail: { template: tt(tpl.title), version: d.version || 0 } });
  }
  for (const c of certificates) {
    const course = courseById.get(c.course_id);
    const base = course?.assessments?.final ? 'course_assessed' : 'self_declared';
    push('certificate', c.id, base, { title: tt(c.course_title), date: day(c.issued_at) || null, href: course ? `#/certificate/${course.slug}` : null, detail: { number: c.number, certificate_type: 'completion' } });
  }
  for (const c of credentials) {
    const v = V('credential', c.id);
    const state = credentialState(c, v, today);
    out.push({ key: targetKey('credential', c.id), kind: 'credential', id: c.id, base: 'self_declared', status: evidenceStatus('credential', 'self_declared', state === 'verified' ? v : null, today), verification: v,
      title: c.name, date: c.issued, href: null, detail: { issuer: c.issuer, state, expires: c.expires || '', verify_url: c.verify_url || '' } });
  }
  for (const x of cpd) {
    if (x.status === 'dismissed') continue;
    let base = 'self_declared';
    if (x.source?.type === 'course' || x.source?.type === 'certificate') { const c = courseById.get(x.source.id); if (c && courseStatus(c, progress, attempts).state === 'completed') base = c.assessments?.final ? 'course_assessed' : 'self_declared'; }
    if (x.source?.type === 'lab' && labAttempts.some(a => a.id === x.source.id && (a.detail || []).some(d => d.auto))) base = 'platform_assessed';
    push('cpd', x.id, base, { title: x.title, date: x.date, href: null, detail: { hours: x.hours, category: x.category, provider: x.provider, source: x.source } });
  }
  for (const x of logs) {
    const v = V('log', x.id);
    out.push({ key: targetKey('log', x.id), kind: 'log', id: x.id, base: 'self_declared', status: evidenceStatus('log', 'self_declared', v, today), verification: v,
      title: x.kind === 'auditor' ? `${x.standard}` : x.kind === 'consultant' ? x.project : x.course, date: x.date, href: null, detail: { log: x.kind, state: logState(x, v, today), entry: x } });
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.key.localeCompare(b.key));
}

export function statusCounts(entries = []) {
  const c = Object.fromEntries(EVIDENCE.map(s => [s, 0]));
  for (const e of entries) c[e.status] = (c[e.status] || 0) + 1;
  return c;
}

/* ------------------------------------------------------------------ competency record (spec §20 example) */

/**
 * One row per competency of the target role (or every competency with evidence when no role is set):
 * knowledge / scenario / practical results (latest of each), the evidence, the verification method, the level and its
 * source (verified · assessment · self · insufficient), the date and the reassessment date (date + 24 months).
 */
export function competencyRecord({ competencies = [], role = null, assessments = [], attempts = [], labs = [], labAttempts = [], selfLevels = {}, evidence = {}, verifications = [], today = todayIso() } = {}) {
  const asmById = new Map(assessments.map(a => [a.id, a]));
  const labById = new Map(labs.map(l => [l.id, l]));
  const rows = [];
  const results = {};
  const note = (cid, bucket, r) => { const x = results[cid] || (results[cid] = {}); if (!x[bucket] || String(r.at) >= String(x[bucket].at)) x[bucket] = r; };
  for (const a of attempts) for (const [cid, v] of Object.entries(a.competency_breakdown || {})) {
    if (!(v && v.max > 0)) continue;
    const def = asmById.get(a.assessment_id);
    const kind = def?.kind;
    const bucket = SCENARIO_KINDS.includes(kind) ? 'scenario' : PRACTICAL_KINDS.includes(kind) ? 'practical' : 'knowledge';
    note(cid, bucket, { percent: v.percent, at: a.submitted_at, source: 'assessment', id: a.assessment_id, title: def ? tt(def.title) : a.assessment_id });
  }
  for (const a of labAttempts) if (a.schema === LAB_ATTEMPT_SCHEMA) for (const [cid, v] of Object.entries(a.competency_breakdown || {})) {
    const l = labById.get(a.lab_id);
    note(cid, 'practical', { percent: v.percent, at: a.submitted_at, source: 'lab', id: a.id, title: l ? tt(l.title) : a.lab_id, awaiting: a.pending_review || 0 });
  }
  const ids = role ? competencies.filter(c => (role.targets?.[c.id] || 0) > 0).map(c => c.id) : competencies.filter(c => results[c.id] || selfLevels[c.id] || verificationFor(verifications, 'competency', c.id, today)).map(c => c.id);
  for (const cid of ids) {
    const c = competencies.find(x => x.id === cid);
    const v = verificationFor(verifications, 'competency', cid, today);
    const verifiedLevel = v?.decision === 'verified' ? v.level : 0;
    const ev = evidence[cid] || null;
    const cur = currentLevel({ selfLevel: selfLevels[cid] || 0, assessmentPercent: ev ? ev.percent : null, verifiedLevel });
    const r = results[cid] || {};
    const dates = [r.knowledge?.at, r.scenario?.at, r.practical?.at, v?.date].filter(Boolean).map(day).sort();
    const date = dates.at(-1) || null;
    const status = verifiedLevel ? 'reviewer_verified' : (r.knowledge || r.scenario || r.practical) ? 'platform_assessed' : selfLevels[cid] ? 'self_declared' : null;
    const target = role?.targets?.[cid] || null;
    rows.push({ competency: c, id: cid, target, knowledge: r.knowledge || null, scenario: r.scenario || null, practical: r.practical || null,
      level: cur.level, source: cur.source, self: selfLevels[cid] || null, status, verification: v, method: v ? v.method : (r.knowledge || r.scenario || r.practical) ? 'auto_scored' : selfLevels[cid] ? 'self_rating' : null,
      date, reassess: date ? addMonths(date, REASSESS_MONTHS) : null, due: !!(date && addMonths(date, REASSESS_MONTHS) <= today), demonstrated: !!(ev && ev.percent >= MASTERY_THRESHOLD),
      gap: target ? Math.max(0, target - cur.level) : null });
  }
  return rows;
}

/** Radar axes per domain: mean target vs mean current level of the rows (≥ 3 domains needed to draw). */
export function radarAxes(rows = [], domains = []) {
  return domains.map(d => {
    const rs = rows.filter(r => r.competency?.domain === d.id && r.target);
    if (!rs.length) return null;
    const avg = k => Math.round(rs.reduce((a, r) => a + (r[k] || 0), 0) / rs.length * 10) / 10;
    return { domain: d, target: avg('target'), current: avg('level'), n: rs.length };
  }).filter(Boolean);
}

/** The verified level per competency (for calculateGaps' verifiedLevels). */
export function verifiedLevels(verifications = [], today = todayIso()) {
  return Object.fromEntries(verifications.filter(v => v.target_kind === 'competency' && v.decision === 'verified' && !validateVerification(v, today)).map(v => [v.target_id, v.level]));
}

/* ------------------------------------------------------------------ career roadmap (§22) */

/**
 * A development plan from the role gaps (output of calculateGaps). For each gap, in priority order, one course that develops
 * it (not completed, visible, lowest level first; recommendation-engine order breaks ties via `recOrder`) and one lab that
 * practises it. Milestones hold up to three competencies; due dates follow the weekly hours (D-54). One possible route —
 * never the only correct one.
 */
export function buildRoadmap({ gaps = [], courses = [], labs = [], completed = [], recOrder = [], weeklyHours = 4, start = todayIso(), perMilestone = 3, maxMilestones = 4, done = [] } = {}) {
  const open = gaps.filter(g => g.gap > 0);
  const done_ = new Set(completed);
  const rank = new Map(recOrder.map((id, i) => [id, i]));
  const used = new Set();
  const pickCourse = cid => courses.filter(c => !done_.has(c.id) && !used.has(c.id) && (c.competency_mappings || []).some(m => m.competency === cid))
    .sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999) || (a.level || 9) - (b.level || 9) || (a.training_hours || 0) - (b.training_hours || 0) || a.id.localeCompare(b.id))[0] || null;
  const pickLab = cid => labs.filter(l => !used.has(l.id) && (l.competencies || []).includes(cid)).sort((a, b) => (a.minutes || 0) - (b.minutes || 0) || a.id.localeCompare(b.id))[0] || null;
  const hrs = Math.max(1, Number(weeklyHours) || 4);
  const milestones = [];
  let cum = 0;
  for (let i = 0; i < open.length && milestones.length < maxMilestones; i += perMilestone) {
    const group = open.slice(i, i + perMilestone);
    const actions = [];
    for (const g of group) {
      const c = pickCourse(g.competency_id); if (c) { used.add(c.id); actions.push({ type: 'course', id: c.id, title: tt(c.title), href: `#/academy/courses/${c.slug}`, hours: Number(c.training_hours) || 1, competency: g.competency_id }); }
      const l = pickLab(g.competency_id); if (l) { used.add(l.id); actions.push({ type: 'lab', id: l.id, title: tt(l.title), href: `#/labs/${l.slug}`, hours: Math.max(0.25, quarter((Number(l.minutes) || 30) / 60)), competency: g.competency_id }); }
    }
    const id = 'M' + (milestones.length + 1);
    const hours = round2(actions.reduce((a, x) => a + x.hours, 0));
    const isDone = done.includes(id);
    if (!isDone) cum += hours;
    milestones.push({ id, competencies: group.map(g => ({ id: g.competency_id, name: g.name, current: g.current, required: g.required, gap: g.gap, priority: g.priority })), actions, hours,
      weeks: Math.ceil(hours / hrs), due: isDone ? null : addDays(start, Math.ceil(cum / hrs) * 7), done: isDone, unmatched: group.filter(g => !actions.some(a => a.competency === g.competency_id)).map(g => g.competency_id) });
  }
  const remaining = open.length - milestones.reduce((a, m) => a + m.competencies.length, 0);
  const totalHours = round2(milestones.filter(m => !m.done).reduce((a, m) => a + m.hours, 0));
  return { gaps: open.length, met: gaps.length - open.length, milestones, remaining, total_hours: totalHours, weeks: Math.ceil(totalHours / hrs), finish: totalHours ? addDays(start, Math.ceil(totalHours / hrs) * 7) : null, weekly_hours: hrs };
}

/* ------------------------------------------------------------------ lab review hook (D-58 + Phase 12) */

/**
 * Apply a named reviewer's scores to the written tasks of one lab attempt. Every review needs a reviewer name (≥ 3), an ISO
 * date not in the future and a score from 0 to the task's weight; only free_text tasks can be reviewed. The attempt keeps its
 * id, number and submission time, and is re-scored by the Phase 11 engine — so the competency evidence changes only through
 * the existing rule. Returns { attempt, errors }.
 */
export function reviewLabAttempt(lab, attempt, reviews = {}, { today = todayIso(), now = new Date().toISOString() } = {}) {
  const errors = {};
  const clean = { ...(attempt.reviews || {}) };
  for (const [tid, r] of Object.entries(reviews)) {
    const task = (lab.tasks || []).find(t => t.id === tid);
    if (!task || task.type !== 'free_text') { errors[tid] = 'not_written'; continue; }
    const score = typeof r.score === 'number' ? r.score : parseNumber(r.score);
    if (str(r.reviewer).length < 3) errors[tid] = 'reviewer';
    else if (!isIsoDate(r.date) || r.date > today) errors[tid] = 'date';
    else if (score === null || score < 0 || score > (Number(task.weight) || 1)) errors[tid] = 'score';
    else clean[tid] = { score: round2(score), reviewer: str(r.reviewer), date: r.date, comment: str(r.comment).slice(0, 500) };
  }
  if (Object.keys(errors).length) return { attempt, errors };
  const re = makeLabAttempt(lab, attempt.answers || {}, { attemptNo: attempt.attempt_no, now: attempt.submitted_at, selfCheck: attempt.self_check || {}, reviews: clean });
  return { attempt: { ...re, id: attempt.id, reviewed_at: now }, errors: {} };
}

/** Lab attempts with written tasks that still await a person's review (reviewer queue). */
export const awaitingReview = (labAttempts = []) => labAttempts.filter(a => a.schema === LAB_ATTEMPT_SCHEMA && a.pending_review > 0);

/* ------------------------------------------------------------------ export / import */

export function exportPassport({ cpd = [], credentials = [], logs = [], career = null, dismissed = [], entries = [], lang = 'en' } = {}, now = new Date().toISOString()) {
  return {
    app: 'cia-academy', schema: PASSPORT_SCHEMA, exported_at: now, label: PASSPORT_LABEL[lang] || PASSPORT_LABEL.en,
    note: 'Reviewer verifications and lab reviews are not part of this file: they are made by a named reviewer on the device where the evidence is.',
    data: { cpd, credentials, practice_logs: logs, career_plan: career, cpd_dismissed: dismissed },
    summary: { entries: entries.length, by_status: statusCounts(entries), cpd_hours: cpdTotals(cpd).total }
  };
}

/**
 * Validate a passport backup. Never overwrites: records whose id already exists are skipped and reported; invalid records are
 * dropped and counted; verifications are never imported. Returns { ok, err?, add: {cpd, credentials, logs}, career, skipped }.
 */
export function importPassport(raw, existing = {}, { today = todayIso(), competencyIds = null } = {}) {
  let d = raw;
  if (typeof raw === 'string') { try { d = JSON.parse(raw); } catch { return { ok: false, err: 'json' }; } }
  if (!d || typeof d !== 'object' || d.app !== 'cia-academy' || d.schema !== PASSPORT_SCHEMA || !d.data || typeof d.data !== 'object') return { ok: false, err: 'schema' };
  const have = k => new Set((existing[k] || []).map(x => x.id));
  const skipped = { duplicate: 0, invalid: 0, verifications: 0 };
  const take = (list, key, fn) => {
    const ids = have(key); const out = [];
    for (const x of (Array.isArray(list) ? list : []).slice(0, MAX_ITEMS)) {
      if (!x || typeof x !== 'object' || !str(x.id) || !/^[\w.:#-]{3,80}$/.test(String(x.id))) { skipped.invalid++; continue; }
      if (ids.has(x.id)) { skipped.duplicate++; continue; }
      const v = fn(x);
      if (!v) { skipped.invalid++; continue; }
      ids.add(x.id); out.push(v);
    }
    return out;
  };
  const cpd = take(d.data.cpd, 'cpd', x => { const { value } = validateCpd(x, { today, competencyIds }); return value ? { ...value, id: x.id, created_at: str(x.created_at) || today, updated_at: str(x.updated_at) || today, imported: true } : null; });
  const credentials = take(d.data.credentials, 'credentials', x => {
    const { value } = validateCredential(x, today);
    if (!value) return null;
    const trail = (Array.isArray(x.trail) ? x.trail : []).filter(t => t && ['declared', 'evidence_added', 'edited', 'verification_requested'].includes(t.event)).slice(0, 50).map(t => ({ at: str(t.at), event: t.event, by: 'learner' }));
    return { ...value, id: x.id, requested_at: x.requested_at && trail.some(t => t.event === 'verification_requested') ? str(x.requested_at) : null, trail: [...trail, { at: new Date().toISOString(), event: 'imported', by: 'learner' }], created_at: str(x.created_at) || today, updated_at: str(x.updated_at) || today };
  });
  const logs = take(d.data.practice_logs, 'logs', x => { const { value } = validateLog(x.kind, x, today); return value ? { ...value, id: x.id, created_at: str(x.created_at) || today, updated_at: str(x.updated_at) || today, imported: true } : null; });
  if (Array.isArray(d.data.verifications)) skipped.verifications = d.data.verifications.length;
  const career = existing.career ? null : d.data.career_plan && typeof d.data.career_plan === 'object' ? cleanCareer(d.data.career_plan) : null;
  return { ok: true, add: { cpd, credentials, logs }, career, skipped };
}

export function cleanCareer(p = {}) {
  const target_date = isIsoDate(p.target_date) ? p.target_date : '';
  const done = (Array.isArray(p.done) ? p.done : []).filter(x => /^M\d{1,2}$/.test(x)).slice(0, 12);
  return { id: 'me', target_date, done, note: str(p.note).slice(0, 500), updated_at: str(p.updated_at) || new Date().toISOString() };
}
