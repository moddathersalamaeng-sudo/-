/**
 * CIA certificate of completion (decision D-10A-1, built in Phase 11 on the owner's explicit approval, 12 Nov 2026).
 * Certificate type "completion" from the ADD-15 taxonomy: it records that a learner finished a CIA internal course on this
 * device — every lesson marked done and, where the course has one, its final assessment passed. It is NOT a professional
 * certification, carries no accreditation, CPD, PDU or RU, and is not verified by any external body. Pure functions.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { courseStatus } from './learner-model.mjs';
import { makeSerial, sealOf, credentialData, designFor, CRED_VERSION } from './credential.mjs';

export const CERT_TYPE = 'completion';
export const CERT_SCHEMA = 'cia.completion-certificate.v2';
export const CERT_DISCLAIMER = {
  en: 'Certificate of completion of a CIA internal course. It is not a professional certification, is not accredited, carries no CPD, PDU or RU credit and is not verified by any external body.',
  ar: 'شهادة إتمام لدورة داخلية من الأكاديمية. وهي ليست شهادة مهنية، وغير معتمدة، ولا تمنح ساعات تطوير مهني مستمر ولا وحدات PDU أو RU، ولا تتحقق منها أي جهة خارجية.'
};


/** A learner's name for the certificate: trimmed, 2–80 characters, letters (any script), spaces, dots, hyphens and apostrophes. */
export function validateCertName(name) {
  const s = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return 'required';
  if (s.length < 2) return 'short';
  if (s.length > 80) return 'long';
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(s)) return 'chars';
  return '';
}

/** Is the course complete for this learner? Returns { eligible, status } using the existing completion rule. */
export function certificateEligibility(course, progress = [], attempts = []) {
  const st = courseStatus(course, progress, attempts);
  return { eligible: st.state === 'completed', status: st };
}

/**
 * The certificate record (cia:v1:<user>:certificates, id = course id). The number is deterministic for one device user and
 * course; `issued_at` is kept from the first issue. Throws when the course is not complete or the name is invalid.
 */
export function issueCertificate({ course, progress = [], attempts = [], name, userId = 'local', existing = null, now = new Date().toISOString() }) {
  if (!certificateEligibility(course, progress, attempts).eligible) throw new Error('not_complete');
  const err = validateCertName(name);
  if (err) throw new Error('name_' + err);
  const issued = existing?.issued_at || now;
  /* Phase 16: best passed final score (whole per cent) and the first module titles — what this course actually covered. */
  const finals = attempts.filter(a => a.assessment_id === course.assessments?.final && a.passed && Number.isFinite(a.score ?? a.percent));
  const score = finals.length ? Math.round(Math.max(...finals.map(a => a.score ?? a.percent))) : null;
  const rec = {
    id: course.id, schema: CERT_SCHEMA, version: CRED_VERSION, certificate_type: CERT_TYPE, course_id: course.id, course_code: course.code || course.id,
    course_title: { en: course.title?.en || '', ar: course.title?.ar || '' }, hours: course.training_hours ?? null, score,
    academy: designFor(course).academy,
    highlights: (course.modules || []).slice(0, 4).map(m => ({ en: m.title?.en || '', ar: m.title?.ar || '' })).filter(x => x.en || x.ar),
    name: String(name).trim().replace(/\s+/g, ' '), issued_at: issued, updated_at: now,
    /* The serial never changes once issued (a Phase 11 number is kept as it is); the seal follows the details. */
    number: existing?.number || makeSerial({ course, userId, issuedAt: issued }),
    registered: existing?.registered && existing?.name === String(name).trim().replace(/\s+/g, ' ') ? existing.registered : null,
    disclaimer: CERT_DISCLAIMER
  };
  rec.seal = sealOf(credentialData(rec));
  return rec;
}
