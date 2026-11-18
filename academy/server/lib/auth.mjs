/**
 * Passwords (scrypt), session and one-time tokens (random, stored only as SHA-256), and session lifetimes.
 * Nothing here logs or returns a password, a hash or a raw token except the token handed to its owner once.
 */
import { scrypt as _scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export const SESSION_IDLE_DAYS = 14;
export const SESSION_MAX_DAYS = 30;
export const RESET_MINUTES = 60;
export const INVITE_DAYS = 14;
export const MIN_PASSWORD = 10;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password).normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(password).normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A dummy verification so a sign-in for an unknown e-mail takes as long as one for a known e-mail. */
let dummy = null;
export async function dummyVerify(password) { dummy ||= await hashPassword('dummy-password-for-timing'); await verifyPassword(password, dummy); return false; }

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = t => createHash('sha256').update(String(t)).digest('hex');

export function passwordProblems(pw) {
  const s = String(pw ?? '');
  const e = [];
  if (s.length < MIN_PASSWORD) e.push('too_short');
  if (s.length > 200) e.push('too_long');
  if (/^(.)\1+$/.test(s)) e.push('repeated');
  return e;
}

export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
export const cleanEmail = e => String(e ?? '').trim().toLowerCase();
export const cleanName = n => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);

export const days = n => new Date(Date.now() + n * 86_400_000).toISOString();
export const minutes = n => new Date(Date.now() + n * 60_000).toISOString();
