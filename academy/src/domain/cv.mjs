/**
 * CV Builder (Phase 12, ADD-12 Career Center — without Job Matching and without the AI Interview Simulator, which needs the
 * Phase 13 coach). Pure functions: the learner's own CV details + profile + passport → one ATS-friendly CV (plain structure,
 * no tables or images) exported as print / PDF, Word (.doc HTML) and plain text.
 * Honesty: credentials are listed as the learner declared them; "issuer record checked" appears only when a named reviewer
 * checked the issuer's record; CIA certificates are named "certificate of completion (CIA internal course)"; competencies are
 * listed only with assessed or verified evidence; CPD is "hours recorded", never awarded. No public link or QR code: the
 * passport stays on this device. © 2026 Modather Salama — Continual Improvement Academy.
 */
import { validateCertName } from './certificates.mjs';
import { walletEntries, cpdTotals, logTotals, verificationFor, logState } from './passport.mjs';

export const CV_SCHEMA = 'cia.cv.v1';
export const CV_SECTIONS = ['summary', 'competencies', 'practice', 'credentials', 'learning', 'cpd', 'education'];
const str = v => String(v ?? '').trim().replace(/[ \t]+/g, ' ');

/** Validate the learner's CV details; returns { errors, value }. */
export function validateCv(input = {}) {
  const e = {};
  const nameErr = validateCertName(input.name);
  if (nameErr) e.name = nameErr === 'chars' ? 'chars' : nameErr;
  const headline = str(input.headline); if (headline.length > 120) e.headline = 'long';
  const email = str(input.email); if (email && (email.length > 120 || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email))) e.email = 'email';
  const phone = str(input.phone); if (phone && !/^\+?[0-9٠-٩ ()\-]{6,24}$/.test(phone)) e.phone = 'phone';
  const location = str(input.location); if (location.length > 80) e.location = 'long';
  const summary = String(input.summary ?? '').trim(); if (summary.length > 1200) e.summary = 'long';
  const include = Object.fromEntries(CV_SECTIONS.map(s => [s, input.include ? input.include[s] !== false : true]));
  if (Object.keys(e).length) return { errors: e, value: null };
  return { errors: {}, value: { id: 'me', schema: CV_SCHEMA, name: str(input.name), headline, email, phone, location, summary, include } };
}

/**
 * The CV model. `rows` is the competency record (passport competencyRecord); `labels(key, params)` localises fixed words;
 * `L(v)` localises a {en, ar} value. Returns { header, sections: [{ id, title, items: [{ title, sub?, note? }] }] }.
 */
export function buildCv({ cv, profile = null, role = null, credentials = [], certificates = [], logs = [], cpd = [], verifications = [], rows = [], today, labels = k => k, L = v => (typeof v === 'string' ? v : v?.en || '') } = {}) {
  const inc = cv?.include || {};
  const on = s => inc[s] !== false;
  const sections = [];
  const header = { name: cv?.name || '', headline: cv?.headline || profile?.current_role || '', location: cv?.location || profile?.country || '', email: cv?.email || '', phone: cv?.phone || '' };
  if (on('summary')) {
    const items = [];
    if (cv?.summary) items.push({ title: cv.summary });
    if (role) items.push({ title: labels('cv.targetLine', { role: L(role.name) }) });
    if (profile?.years_experience) items.push({ title: labels('cv.yearsLine', { n: profile.years_experience }) });
    if (items.length) sections.push({ id: 'summary', title: labels('cv.s.summary'), items });
  }
  if (on('competencies')) {
    const items = rows.filter(r => r.level >= 3 && (r.status === 'platform_assessed' || r.status === 'reviewer_verified'))
      .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))
      .map(r => ({ title: L(r.competency?.name) || r.id, sub: labels(r.status === 'reviewer_verified' ? 'cv.compVerified' : 'cv.compAssessed', { n: r.level }) }));
    if (items.length) sections.push({ id: 'competencies', title: labels('cv.s.competencies'), items, note: labels('cv.compNote') });
  }
  if (on('practice')) {
    const lt = logTotals(logs, verifications, today);
    const items = [];
    const checked = x => logState(x, verificationFor(verifications, 'log', x.id, today), today) === 'verified';
    for (const x of logs.filter(l => l.kind === 'auditor').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8))
      items.push({ title: labels('cv.auditLine', { std: x.standard, type: labels('log.opt.audit_type.' + x.audit_type), role: labels('log.opt.role.' + x.role) }), sub: `${String(x.date).slice(0, 7)} · ${labels('cv.days', { n: x.days })}${checked(x) ? ' · ' + labels('cv.reviewerVerified') : ''}` });
    for (const x of logs.filter(l => l.kind === 'consultant').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6))
      items.push({ title: x.project, sub: `${labels('log.opt.crole.' + x.role)} · ${labels('cv.months', { n: x.months })}${x.standard ? ' · ' + x.standard : ''}${checked(x) ? ' · ' + labels('cv.reviewerVerified') : ''}`, note: x.deliverables || '' });
    for (const x of logs.filter(l => l.kind === 'trainer').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6))
      items.push({ title: x.course, sub: `${labels('cv.trainLine', { h: x.hours, p: x.participants })}${checked(x) ? ' · ' + labels('cv.reviewerVerified') : ''}` });
    if (items.length) sections.push({ id: 'practice', title: labels('cv.s.practice'), items,
      note: [lt.auditor.entries ? labels('cv.auditTotal', { n: lt.auditor.entries, d: lt.auditor.days }) : '', lt.trainer.entries ? labels('cv.trainTotal', { h: lt.trainer.hours }) : ''].filter(Boolean).join(' · ') });
  }
  const wallet = walletEntries({ certificates, credentials, verifications, today });
  if (on('credentials')) {
    const items = wallet.filter(w => w.kind === 'external' && w.state !== 'rejected' && w.state !== 'expired').map(w => ({ title: w.name,
      sub: `${w.issuer} · ${String(w.issued).slice(0, 4)}${w.expires ? ' – ' + String(w.expires).slice(0, 4) : ''}${w.number ? ' · ' + w.number : ''}${w.state === 'verified' ? ' · ' + labels('cv.issuerChecked') : ''}`,
      note: w.verify_url || '' }));
    if (items.length) sections.push({ id: 'credentials', title: labels('cv.s.credentials'), items });
  }
  if (on('learning')) {
    const items = wallet.filter(w => w.kind === 'cia_completion').map(w => ({ title: L(w.name), sub: `${labels('cv.ciaCompletion')} · ${String(w.issued).slice(0, 4)} · ${w.number}` }));
    if (items.length) sections.push({ id: 'learning', title: labels('cv.s.learning'), items });
  }
  if (on('cpd')) {
    const tot = cpdTotals(cpd);
    const y = String(today).slice(0, 4);
    if (tot.total) sections.push({ id: 'cpd', title: labels('cv.s.cpd'), items: [{ title: labels('cv.cpdLine', { n: tot.total, y, ny: tot.byYear[y]?.total || 0 }) }], note: labels('cv.cpdNote') });
  }
  if (on('education')) {
    const items = [];
    if (profile?.education) items.push({ title: labels('cv.edu.' + profile.education) });
    if (profile?.languages?.length) items.push({ title: labels('cv.languages', { list: profile.languages.map(l => labels('cv.lng.' + l)).join(', ') }) });
    if (profile?.memberships) items.push({ title: labels('cv.memberships', { list: str(profile.memberships) }) });
    if (items.length) sections.push({ id: 'education', title: labels('cv.s.education'), items });
  }
  return { header, sections };
}

/** Plain-text CV (ATS: no tables, no images, one fact per line). */
export function cvText(model) {
  const h = model.header;
  const out = [h.name, h.headline, [h.location, h.email, h.phone].filter(Boolean).join(' | '), ''];
  for (const s of model.sections) {
    out.push(s.title.toUpperCase());
    for (const it of s.items) { out.push('- ' + it.title); if (it.sub) out.push('  ' + it.sub); if (it.note) out.push('  ' + it.note); }
    if (s.note) out.push('  (' + s.note + ')');
    out.push('');
  }
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\r\n').trim() + '\r\n';
}

const esc = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Word-compatible HTML (.doc) — headings and lists only, right-to-left in Arabic. */
export function cvWordHtml(model, { lang = 'en' } = {}) {
  const rtl = lang === 'ar';
  const h = model.header;
  const body = [`<h1>${esc(h.name)}</h1>`, h.headline ? `<p><b>${esc(h.headline)}</b></p>` : '', `<p>${esc([h.location, h.email, h.phone].filter(Boolean).join(' | '))}</p>`,
    ...model.sections.map(s => `<h2>${esc(s.title)}</h2><ul>${s.items.map(it => `<li>${esc(it.title)}${it.sub ? `<br><span>${esc(it.sub)}</span>` : ''}${it.note ? `<br><span>${esc(it.note)}</span>` : ''}</li>`).join('')}</ul>${s.note ? `<p><i>${esc(s.note)}</i></p>` : ''}`)].join('\n');
  return `<!DOCTYPE html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(h.name)}</title>`
    + `<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#0B1E3D;direction:${rtl ? 'rtl' : 'ltr'}}h1{font-family:Georgia,serif;font-size:20pt;margin:0}h2{font-family:Georgia,serif;font-size:13pt;border-bottom:1px solid #C6A15B;margin-top:14pt}span{color:#3A4660}</style></head><body>${body}</body></html>`;
}
