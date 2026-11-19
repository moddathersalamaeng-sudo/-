/**
 * Phase 16 — certificate serials, the verification link carried by the QR code, and the per-course design.
 * Pure functions (browser, tests and API).
 *
 *  - Serial  CIA-C-<COURSE>-<YYMM>-<6 chars><check>  e.g. CIA-C-ISO101-2611-K7Q2M94. Stable for one learner and course;
 *    the last character is a check character, so a mistyped serial is caught before any lookup.
 *  - Seal    10 characters of SHA-256 over the certificate's own details (serial, course, name, date, hours, score).
 *    Change one letter of the name or the date and the seal no longer matches.
 *  - Link    <academy>/#/verify/<serial>?p=<details>. The QR code carries the details, so verification works without a
 *    server: the page recomputes the seal. That proves the details were not edited after the certificate was made; it
 *    does NOT prove the Academy issued it. Only the Academy register (accounts, Phase 14 API) can say that — the
 *    verification page says which of the two checks it ran.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { sha256, utf8 } from './sha256.mjs';
import { academyOfCourse } from './academies.mjs';

export const CRED_VERSION = 2;
export const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';          // Crockford base32: no I, L, O, U
export const SERIAL_RE = /^CIA-C-[A-Z0-9]{1,10}-\d{4}-[0-9A-HJKMNP-TV-Z]{7}$/;
export const LEGACY_SERIAL_RE = /^CIA-C-[A-Z0-9]{1,10}-[0-9A-Z]{7}$/;

export function base32(bytes, n) {
  let out = '', acc = 0, bits = 0;
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5 && out.length < n) { out += B32[(acc >>> (bits - 5)) & 31]; bits -= 5; } acc &= 0xff; if (out.length >= n) break; }
  return out;
}

/** Weighted check character over the serial (letters and digits only). Catches any single typo and adjacent swaps. */
export function checkChar(body) {
  const v = [...String(body).toUpperCase().replace(/[^0-9A-Z]/g, '')].map(c => /\d/.test(c) ? +c : c.charCodeAt(0) - 55);
  let s = 0; v.forEach((x, i) => { s = (s + x * (i + 1) * (i % 2 ? 3 : 7)) % 31; });
  return B32[s];
}

export const courseCode = course => String(course?.code || course?.id || 'COURSE').replace(/^CRS-/i, '').replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase() || 'COURSE';

export function makeSerial({ course, userId = 'local', issuedAt }) {
  const ym = String(issuedAt).slice(2, 4) + String(issuedAt).slice(5, 7);
  const body = `CIA-C-${courseCode(course)}-${ym}-${base32(sha256(`cia-serial|${userId}|${course.id}|${issuedAt}`), 6)}`;
  return body + checkChar(body);
}

/** 'ok' | 'typo' (shape right, check character wrong) | 'legacy' (Phase 11 number) | 'malformed'. */
export function serialState(serial) {
  const s = String(serial || '').trim().toUpperCase();
  if (SERIAL_RE.test(s)) return checkChar(s.slice(0, -1)) === s.slice(-1) ? 'ok' : 'typo';
  if (LEGACY_SERIAL_RE.test(s)) return 'legacy';
  return 'malformed';
}

const canonical = d => ['cia-certificate', CRED_VERSION, d.serial, d.course_id, d.name, d.date, d.hours ?? '', d.score ?? ''].join('\n');
export const sealOf = d => base32(sha256(canonical(d)), 10);

/* base64url over UTF-8 bytes (names are often Arabic). */
const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function b64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += A64[(n >> 18) & 63] + A64[(n >> 12) & 63] + (i + 1 < bytes.length ? A64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? A64[n & 63] : '');
  }
  return out;
}
export function unb64url(str) {
  const s = String(str); if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('b64');
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map(k => (i + k < s.length ? A64.indexOf(s[i + k]) : 0));
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    out.push((n >> 16) & 255); if (i + 2 < s.length) out.push((n >> 8) & 255); if (i + 3 < s.length) out.push(n & 255);
  }
  return new Uint8Array(out);
}

/** The details a certificate carries (and the QR code repeats). */
export const credentialData = rec => ({ serial: rec.number, course_id: rec.course_id, name: rec.name, date: String(rec.issued_at).slice(0, 10), hours: rec.hours ?? null, score: rec.score ?? null });

/** QR details, compact: [version, course, name, date, hours, score, seal] — the serial is already in the address and inside the seal. */
export function encodePayload(rec) {
  const d = credentialData(rec);
  return b64url(utf8(JSON.stringify([CRED_VERSION, d.course_id, d.name, d.date, d.hours, d.score, sealOf(d)])));
}

/** Read a payload for a serial: { ok: true, data, seal } or { ok: false, reason }. Never throws. */
export function decodePayload(p, serial = '') {
  try {
    if (!p) return { ok: false, reason: 'missing' };
    if (String(p).length > 1200) return { ok: false, reason: 'malformed' };
    const a = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unb64url(p)));
    if (!Array.isArray(a) || a.length !== 7 || a[0] !== CRED_VERSION) return { ok: false, reason: 'malformed' };
    const [, c, n, d, hrs, g, f] = a;
    if (typeof c !== 'string' || typeof n !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d || '') || typeof f !== 'string') return { ok: false, reason: 'malformed' };
    if (hrs != null && typeof hrs !== 'number') return { ok: false, reason: 'malformed' };
    if (g != null && !(Number.isInteger(g) && g >= 0 && g <= 100)) return { ok: false, reason: 'malformed' };
    return { ok: true, data: { serial: String(serial).trim().toUpperCase(), course_id: c, name: n.slice(0, 80), date: d, hours: hrs ?? null, score: g ?? null }, seal: f };
  } catch { return { ok: false, reason: 'malformed' }; }
}

/**
 * Verify what a QR link carries against the serial in the address.
 * state: 'intact' (details match their seal, which includes the serial) | 'altered' (a detail or the serial was changed) |
 * 'typo' | 'malformed' | 'missing'.
 */
export function verifyLink(serial, payload) {
  const ss = serialState(serial);
  if (ss === 'malformed' || ss === 'typo') return { state: ss };
  const r = decodePayload(payload, serial);
  if (!r.ok) return { state: r.reason, serialState: ss };
  return { state: sealOf(r.data) === r.seal ? 'intact' : 'altered', data: r.data, seal: r.seal };
}

export const verifyHref = (base, rec) => `${String(base).replace(/#.*$/, '')}#/verify/${encodeURIComponent(rec.number)}?p=${encodePayload(rec)}`;

/* ------------------------------------------------------------ design: one look per academy, one seal per course */
export const THEMES = {
  iso:        { ink: '#0E2A47', accent: '#C6A15B', soft: '#F4ECDC', label: { en: 'ISO Academy', ar: 'أكاديمية الأيزو' } },
  pmi:        { ink: '#13294B', accent: '#3E7CB1', soft: '#E6EFF8', label: { en: 'Project & PMO Academy', ar: 'أكاديمية المشاريع ومكاتب إدارة المشاريع' } },
  quality:    { ink: '#10313A', accent: '#1F8A7A', soft: '#E3F2EF', label: { en: 'Quality Academy', ar: 'أكاديمية الجودة' } },
  excellence: { ink: '#1B2A3A', accent: '#2E8B57', soft: '#E5F2EA', label: { en: 'Excellence Academy', ar: 'أكاديمية التميز المؤسسي' } }
};

/** Everything the certificate needs to look like *this* course's certificate: academy colours and a seal drawn from the course id. */
export function designFor(course) {
  const key = academyOfCourse(course) || 'iso';
  const b = sha256('cia-seal|' + course.id);
  return {
    academy: key, theme: THEMES[key] || THEMES.iso,
    seal: { petals: 9 + (b[0] % 12), rings: 3 + (b[1] % 3), waves: 5 + (b[2] % 7), twist: (b[3] % 60) - 30, turn: b[4] % 360, depth: 0.10 + (b[5] % 8) / 100, dots: 24 + (b[6] % 4) * 6 },
    frame: { waves: 28 + (b[7] % 18), amp: 1.4 + (b[8] % 10) / 10, phase: b[9] % 360, strands: 2 + (b[10] % 2) },
    code: courseCode(course)
  };
}

/* ------------------------------------------------------------ drawing helpers (pure: return path strings) */
const f = n => (Math.round(n * 100) / 100).toString();
/** Rosette (guilloche) — closed curve r(θ) = R·(1 + depth·sin(petals·θ + phase)) with a twist; one path per ring. */
export function rosettePaths(seal, R = 46) {
  const out = [];
  for (let k = 0; k < seal.rings; k++) {
    const r0 = R * (1 - k * 0.17), ph = (seal.turn + k * seal.twist) * Math.PI / 180, pts = [];
    for (let i = 0; i <= 360; i++) {
      const t = i * Math.PI / 180;
      const r = r0 * (1 + seal.depth * Math.sin(seal.petals * t + ph) + seal.depth * 0.45 * Math.sin(seal.waves * t - ph));
      pts.push(`${f(r * Math.cos(t))},${f(r * Math.sin(t))}`);
    }
    out.push('M' + pts.join('L') + 'Z');
  }
  return out;
}
/** Wavy guilloche band around a W×H rectangle at inset m. */
export function framePaths(frame, W, H, m = 9) {
  const out = [];
  for (let s = 0; s < frame.strands; s++) {
    const ph = (frame.phase + s * 180 / frame.strands) * Math.PI / 180, pts = [];
    const per = 2 * (W - 2 * m) + 2 * (H - 2 * m), N = 900;
    for (let i = 0; i <= N; i++) {
      let d = i / N * per, x, y, nx, ny;
      const w = W - 2 * m, hh = H - 2 * m;
      if (d < w) { x = m + d; y = m; nx = 0; ny = 1; } else if ((d -= w) < hh) { x = W - m; y = m + d; nx = -1; ny = 0; }
      else if ((d -= hh) < w) { x = W - m - d; y = H - m; nx = 0; ny = -1; } else { d -= w; x = m; y = H - m - d; nx = 1; ny = 0; }
      const o = frame.amp * Math.sin(i / N * frame.waves * 2 * Math.PI + ph);
      pts.push(`${f(x + nx * o)},${f(y + ny * o)}`);
    }
    out.push('M' + pts.join('L') + 'Z');
  }
  return out;
}
