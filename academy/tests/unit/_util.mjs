import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const json = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
export const text = p => readFileSync(join(ROOT, p), 'utf8');
export function walk(dir, ext) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...walk(p, ext)); else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
/** Minimal Web Storage mock. */
export class MockStorage {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  snapshot() { return Object.fromEntries(this.m); }
}

/**
 * Phase 7 closure (3 Nov 2026): the platform owner approved publication after the AI-assisted pre-review.
 * A published record must say exactly that — owner as reviewer, ISO date, content hash, the basis, the original drafter,
 * and a change note that it is not an independent expert review. Future-phase records stay drafts.
 */
export const OWNER = 'مدثر سلامه';
export const FUTURE_DRAFTS = new Set(['Q-PM-001', 'Q-RISK-001', 'Q-PMO-001',
  'Q-GOV-001', 'Q-AI-001', 'ASM-DIAG-001', 'ASM-QUIZ-001', 'ASM-SCEN-001', 'ASM-PRACT-001']);
/*
 * Phase 8 (PMI / PMO / P3O): records are drafts (needs_review, no reviewer) until a person approves them through
 * tools/apply_review_decisions.py — then they must carry the full approval record. CRS-PM-101 and CRS-P3O-101 left the
 * future-draft set: they are Phase 8 courses now.
 */
export const PHASE8_ID = /^(CRS-(P|PM|PMO|PFM|P3O|PMP)-|Q-(P|PM|PMO|PFM|P3O|PMP|AGL)-|ASM-(P|PM|PMO|PFM|P3O|PMP)-|ASM-READY-PM-|CERT-|ROUTE-(PM-FOUND|PMP|PMO|PORTFOLIO|AGILE)$|ROLE-PM$|SRC-PMI-|SRC-CIA-PM$)/;
/*
 * Phase 9 (Quality, ASQ-informed): same rule as Phase 8 — draft until approved, then a full approval record. CRS-QMS-201,
 * Q-QMS-001 and PRG-CIA-FOUNDATIONS left the future-draft set: they are Phase 9 records now. Figures (FIG-) are governed too.
 */
export const PHASE9_ID = /^(CRS-(Q|LSS|CMQOE)-|CRS-QMS-201$|Q-(Q|LSS|CMQOE|QMS-201|QF|QE|QA|QS|CMQ)-|Q-QMS-001$|ASM-(Q|LSS|CMQOE|QMS-201)-|ASM-READY-Q-|ROUTE-Q-|ROLE-CIS$|SRC-ASQ-|SRC-QG-|SRC-CIA-Q$|FIG-|PRG-CIA-FOUNDATIONS$)/;
/*
 * Phase 10 (Excellence, EFQM-informed): same rule — draft until approved, then a full approval record. CRS-EFQM-101 and
 * Q-EFQM-001 left the future-draft set: they are Phase 10 records now. LAB-EFQM is the governed EFQM Assessment Lab definition.
 */
export const PHASE10_ID = /^(CRS-(EFQM|EX)-|Q-(EFQM-101|EX)-|Q-EFQM-001$|ASM-(EFQM-101|EX)-|ASM-READY-EX-|ROUTE-EX-|ROLE-OEL$|SRC-EFQM-|SRC-KAQA-|SRC-CIA-EX$|LAB-EFQM$|REG-KAQA$)/;
export const isPhase8 = r => (PHASE8_ID.test(r.id) || PHASE9_ID.test(r.id) || PHASE10_ID.test(r.id)) && !FUTURE_DRAFTS.has(r.id);
export function governedPhase8(assert, r, draftedBy) {
  const g = r.governance;
  if (g.content_status === 'published') { ownerOrExpertApproved(assert, r, draftedBy); return; }
  assert.equal(g.content_status, 'needs_review', r.id);
  assert.equal(g.reviewer, null, r.id);
  if (draftedBy) assert.ok([].concat(draftedBy).includes(g.content_source), `${r.id}: source ${g.content_source}`);
}
export function ownerOrExpertApproved(assert, r, draftedBy) {
  const g = r.governance;
  if (g.approval_basis === 'expert_review') { assert.equal(g.content_status, 'published', r.id); assert.ok(g.reviewer, r.id); assert.match(g.approved_hash || '', /^[0-9a-f]{64}$/, r.id); return; }
  ownerApproved(assert, r, draftedBy);
}
export function ownerApproved(assert, r, draftedBy) {
  const g = r.governance;
  assert.equal(g.content_status, 'published', r.id);
  assert.equal(g.content_source, 'owner', r.id);
  assert.equal(g.approval_basis, 'owner_approval_after_ai_prereview', r.id);
  assert.equal(g.reviewer, OWNER, r.id);
  assert.match(g.review_date, /^\d{4}-\d{2}-\d{2}$/, r.id);
  assert.match(g.approved_hash || '', /^[0-9a-f]{64}$/, r.id);
  assert.match(g.change_note, /not an independent expert review/, r.id);
  if (draftedBy) assert.ok([].concat(draftedBy).includes(g.drafted_by), `${r.id}: drafted_by ${g.drafted_by}`);
}
export function futureDraft(assert, r) {
  assert.equal(r.governance.content_status, 'needs_review', r.id);
  assert.equal(r.governance.reviewer, null, r.id);
}
