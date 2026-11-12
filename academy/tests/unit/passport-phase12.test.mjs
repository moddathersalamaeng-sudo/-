/**
 * Phase 12 — Professional Passport, CPD and career roadmap.
 * Evidence status rules (no upgrade without its rule), verification records, lab-review scoring (named reviewer + ISO date),
 * CPD validation / totals / suggestions / CSV, wallet (never "verified by CIA" for external credentials, full status
 * progression with an audit trail), specialized passports, badges (never certificates), competency record, roadmap gaps and
 * milestones, passport export / import (validated, never overwriting, verifications never imported), registry limits
 * unchanged, the passport tab and routes exist, i18n strings bilingual and free of credential claims, figures governed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { json, text } from './_util.mjs';
import * as P from '../../src/domain/passport.mjs';
import { makeLabAttempt, labEvidenceRows } from '../../src/domain/labs.mjs';
import { assessmentEvidence } from '../../src/domain/learner-model.mjs';
import { calculateGaps } from '../../src/domain/recommendations.mjs';
import { validateRegistry, shellEntries, MAX_MENU } from '../../src/nav/registry.js';

const TODAY = '2026-11-12';
const LABS = json('data/seed/labs.json').items;
const COURSES = json('data/seed/courses.json').items;
const COMPS = json('data/seed/competency/competencies.json').items;
const ROLES = json('data/seed/competency/target-roles.json').items;
const DOMAINS = json('data/seed/competency/domains.json').items;
const ASM = json('data/seed/assessments.json').items;
const lab = LABS.find(l => l.id === 'LAB-NC-WRITE') || LABS.find(l => l.tasks.some(t => t.type === 'free_text') && l.tasks.filter(t => t.type !== 'free_text').length >= 2);
const perfect = l => Object.fromEntries(l.tasks.map(t => [t.id, t.type === 'single_choice' ? t.correct : t.type === 'multi_select' ? t.options.filter(o => o.correct).map(o => o.id)
  : t.type === 'ordering' ? t.items.map(x => x.id) : t.type === 'classify' ? Object.fromEntries(t.items.map(x => [x.id, x.category])) : t.type === 'numeric' ? String(t.answer) : 'x'.repeat((t.min_chars || 40) + 5)]));
const V = (o = {}) => ({ id: P.targetKey(o.target_kind || 'document', o.target_id || 'D1'), target_kind: 'document', target_id: 'D1', reviewer: 'Sara Reviewer', date: '2026-11-10', method: 'document_review', decision: 'verified', ...o });

/* ------------------------------------------------------------------ evidence status rules */

test('evidence status: five statuses in spec order; a base can never claim verification by itself', () => {
  assert.deepEqual(P.EVIDENCE, ['self_declared', 'course_assessed', 'platform_assessed', 'reviewer_verified', 'externally_certified']);
  for (const k of P.ENTRY_KINDS) {
    assert.equal(P.evidenceStatus(k, 'reviewer_verified'), 'self_declared', k);
    assert.equal(P.evidenceStatus(k, 'externally_certified'), 'self_declared', k);
    assert.equal(P.evidenceStatus(k, 'nonsense'), 'self_declared', k);
  }
  assert.equal(P.evidenceStatus('assessment', 'platform_assessed'), 'platform_assessed');
  assert.equal(P.evidenceStatus('course', 'course_assessed'), 'course_assessed');
});

test('no upgrade without its rule: an invalid, rejected or mismatched verification changes nothing', () => {
  const bad = [V({ reviewer: 'Al' }), V({ date: '2026-13-01' }), V({ date: '2027-01-01' }), V({ method: 'gut_feeling' }), V({ decision: 'maybe' }), V({ decision: 'rejected' }), V({ target_kind: 'cpd' })];
  for (const v of bad) assert.equal(P.evidenceStatus('document', 'self_declared', v, TODAY), 'self_declared', JSON.stringify(v));
  assert.equal(P.evidenceStatus('document', 'self_declared', V(), TODAY), 'reviewer_verified');
  assert.ok(!P.canHaveStatus('document', 'self_declared', 'reviewer_verified', null, TODAY));
  assert.ok(P.canHaveStatus('document', 'self_declared', 'reviewer_verified', V(), TODAY));
  /* externally_certified only for a credential whose issuer record was checked; never for CIA's own entries */
  assert.ok(!P.canHaveStatus('course', 'course_assessed', 'externally_certified', V({ target_kind: 'course' }), TODAY));
  assert.equal(P.evidenceStatus('credential', 'self_declared', V({ target_kind: 'credential', method: 'issuer_check' }), TODAY), 'externally_certified');
  assert.equal(P.evidenceStatus('credential', 'self_declared', V({ target_kind: 'credential', method: 'interview' }), TODAY), 'self_declared');
  assert.equal(P.validateVerification(V({ method: 'issuer_check' }), TODAY), 'method', 'issuer_check is only for credentials');
  assert.equal(P.validateVerification(V({ target_kind: 'competency', target_id: 'AUD-01' }), TODAY), 'level', 'a verified competency needs a level');
  assert.throws(() => P.makeVerification({ target_kind: 'log', target_id: 'L1', reviewer: '  ', date: TODAY, method: 'work_sample', decision: 'verified' }, TODAY), /verification_reviewer/);
});

/* ------------------------------------------------------------------ entries flow from the learner's records */

const course = COURSES.find(c => c.id === 'CRS-ISO-AUD');
const lessons = course.modules.flatMap(m => m.lessons.map(l => l.id));
const progress = [{ id: course.id, completed_lessons: lessons, updated_at: '2026-11-01T10:00:00Z' }];
const finalAttempt = { id: 'a1', assessment_id: course.assessments.final, submitted_at: '2026-11-02T10:00:00Z', score: 90, passed: true, pending_review: 0, competency_breakdown: { 'AUD-01': { earned: 9, max: 10, percent: 90, items: 3 } }, detail: [{ auto: true }] };

test('entries: completed course with a passed final is course-assessed; lessons only is self-declared; assessment and lab attempts are platform-assessed; documents and CPD typed by the learner are self-declared', () => {
  const noFinal = { ...course, id: 'CRS-X', slug: 'x', assessments: {} };
  const att = makeLabAttempt(lab, perfect(lab), { attemptNo: 1, now: '2026-11-03T10:00:00Z' });
  const e = P.buildEntries({ courses: [course, noFinal], assessments: ASM, labs: LABS, templates: [{ id: 'T1', slug: 'ncr', title: { en: 'NCR', ar: 'NCR' } }],
    progress: [...progress, { id: 'CRS-X', completed_lessons: lessons, updated_at: '2026-11-01T00:00:00Z' }], attempts: [finalAttempt], labAttempts: [att],
    docs: [{ id: 'D1', template_id: 'T1', title: 'My NCR', version: 1, updated_at: '2026-11-04T00:00:00Z' }],
    cpd: [P.makeCpd({ title: 'Read a book', category: 'self_study', date: '2026-11-05', hours: 2 }, { today: TODAY })], today: TODAY });
  const by = k => e.find(x => x.key === k);
  assert.equal(by('course:' + course.id).status, 'course_assessed');
  assert.equal(by('course:CRS-X').status, 'self_declared');
  const partial = P.buildEntries({ courses: [course], progress: [{ id: course.id, completed_lessons: lessons.slice(0, 1), updated_at: '2026-11-01T00:00:00Z' }], attempts: [finalAttempt], today: TODAY }).find(x => x.kind === 'course');
  assert.equal(partial.status, 'self_declared', 'one lesson marked done is the learner\'s own statement, even with the final passed');
  assert.equal(partial.detail.state, 'in_progress');
  assert.equal(by('assessment:' + course.assessments.final).status, 'platform_assessed');
  const le = by('lab:' + att.id);
  assert.equal(le.status, 'platform_assessed');
  assert.ok(le.detail.awaiting >= 1, 'the written task stays awaiting review');
  assert.equal(by('document:D1').status, 'self_declared');
  assert.equal(e.find(x => x.kind === 'cpd').status, 'self_declared');
  /* a reviewer verification upgrades only the entry it names */
  const e2 = P.buildEntries({ templates: [{ id: 'T1', slug: 'ncr', title: { en: 'NCR', ar: 'NCR' } }], docs: [{ id: 'D1', template_id: 'T1' }, { id: 'D2', template_id: 'T1' }], verifications: [V()], today: TODAY });
  assert.equal(e2.find(x => x.id === 'D1').status, 'reviewer_verified');
  assert.equal(e2.find(x => x.id === 'D2').status, 'self_declared');
});

/* ------------------------------------------------------------------ lab review */

test('lab review: a written task changes the evidence only with a named reviewer, an ISO date and a score in range', () => {
  const att = makeLabAttempt(lab, perfect(lab), { attemptNo: 1, now: '2026-11-03T10:00:00Z' });
  const w = lab.tasks.find(t => t.type === 'free_text');
  assert.ok(att.pending_review >= 1 && att.status === 'awaiting_review');
  for (const r of [{ score: w.weight, reviewer: 'Al', date: TODAY }, { score: w.weight, reviewer: 'Sara Reviewer', date: '12/11/2026' }, { score: w.weight, reviewer: 'Sara Reviewer', date: '2027-01-01' },
    { score: w.weight + 1, reviewer: 'Sara Reviewer', date: TODAY }, { score: -1, reviewer: 'Sara Reviewer', date: TODAY }]) {
    const out = P.reviewLabAttempt(lab, att, { [w.id]: r }, { today: TODAY });
    assert.ok(Object.keys(out.errors).length, JSON.stringify(r));
    assert.equal(out.attempt, att, 'nothing changes on an invalid review');
  }
  assert.equal(P.reviewLabAttempt(lab, att, { [lab.tasks.find(t => t.type !== 'free_text').id]: { score: 1, reviewer: 'Sara Reviewer', date: TODAY } }, { today: TODAY }).errors[lab.tasks.find(t => t.type !== 'free_text').id], 'not_written');
  const reviews = Object.fromEntries(lab.tasks.filter(t => t.type === 'free_text').map(t => [t.id, { score: t.weight, reviewer: 'Sara Reviewer', date: TODAY }]));
  const ok = P.reviewLabAttempt(lab, att, reviews, { today: TODAY, now: '2026-11-12T09:00:00Z' });
  assert.deepEqual(ok.errors, {});
  const r = ok.attempt;
  assert.equal(r.id, att.id); assert.equal(r.submitted_at, att.submitted_at); assert.equal(r.attempt_no, att.attempt_no);
  assert.equal(r.pending_review, 0); assert.equal(r.status, 'complete'); assert.equal(r.reviewed_at, '2026-11-12T09:00:00Z');
  assert.ok(r.detail.filter(d => d.reviewed).length === Object.keys(reviews).length);
  assert.ok(r.max > att.max, 'reviewed tasks now count');
  const before = assessmentEvidence(labEvidenceRows([att])); const after = assessmentEvidence(labEvidenceRows([r]));
  assert.notDeepEqual(before, after, 'evidence changed through the existing rule');
  assert.equal(P.awaitingReview([att, r]).length, 1);
});

/* ------------------------------------------------------------------ CPD */

test('CPD: validation (required, future dates, hours range, Arabic digits, safe links), totals per year and category, CSV escaping', () => {
  const bad = P.validateCpd({ title: 'x', category: 'party', date: '2026-12-01', hours: '0', evidence_url: 'javascript:alert(1)' }, { today: TODAY }).errors;
  assert.deepEqual(Object.keys(bad).sort(), ['category', 'date', 'evidence_url', 'hours', 'title']);
  assert.equal(P.validateCpd({ title: 'Workshop', category: 'workshop', date: TODAY, hours: '101' }, { today: TODAY }).errors.hours, 'range');
  const ar = P.validateCpd({ title: 'ورشة عمل', category: 'workshop', date: TODAY, hours: '٢٫٥' }, { today: TODAY });
  assert.equal(ar.value.hours, 2.5);
  const xs = [
    P.makeCpd({ title: 'Audit course', category: 'course', date: '2025-03-01', hours: 8 }, { today: TODAY, now: '2026-01-01T00:00:00Z' }),
    P.makeCpd({ title: 'B workshop', category: 'workshop', date: '2026-02-01', hours: 3.5 }, { today: TODAY, now: '2026-01-02T00:00:00Z' }),
    P.makeCpd({ title: '=HYPERLINK("x")', category: 'workshop', date: '2026-06-01', hours: 1.25, provider: 'A, "B"' }, { today: TODAY, now: '2026-01-03T00:00:00Z' })
  ];
  const tot = P.cpdTotals(xs);
  assert.equal(tot.total, 12.75); assert.equal(tot.byYear['2026'].total, 4.75); assert.equal(tot.byYear['2025'].byCategory.course, 8); assert.equal(tot.byCategory.workshop, 4.75);
  const csv = P.cpdCsv(xs);
  assert.ok(csv.startsWith('﻿')); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"A, ""B"""'));
  assert.equal(csv.trim().split('\r\n').length, 4);
  assert.throws(() => P.makeCpd({ title: '' }, { today: TODAY }), e => e.message === 'cpd_invalid' && e.fields.title === 'required');
});

test('CPD suggestions: from completed courses (once even with a certificate), lab attempts; confirmed or dismissed ones disappear; nothing is added automatically', () => {
  const att = makeLabAttempt(lab, perfect(lab), { attemptNo: 1, now: '2026-11-03T10:00:00Z' });
  const cert = { id: course.id, course_id: course.id, number: 'CIA-C-ISOAUD-123', issued_at: '2026-11-06T00:00:00Z' };
  const s = P.cpdSuggestions({ courses: [course], progress, attempts: [finalAttempt], labs: LABS, labAttempts: [att], certificates: [cert] });
  assert.equal(s.length, 2);
  const cs = s.find(x => x.key === 'course:' + course.id);
  assert.equal(cs.source.type, 'certificate'); assert.equal(cs.hours, course.training_hours); assert.equal(cs.date, '2026-11-06');
  const ls = s.find(x => x.key === 'lab:' + att.id); assert.ok(ls.hours >= 0.25 && ls.category === 'practice_lab');
  const confirmed = P.confirmSuggestion(cs, { hours: 6 }, { today: TODAY });
  assert.equal(confirmed.hours, 6); assert.equal(confirmed.source.type, 'certificate');
  assert.equal(P.cpdSuggestions({ courses: [course], progress, attempts: [finalAttempt], labs: LABS, labAttempts: [att], certificates: [cert], cpd: [confirmed], dismissed: ['lab:' + att.id] }).length, 0);
  /* a confirmed course activity inherits the course's evidence status */
  const e = P.buildEntries({ courses: [course], progress, attempts: [finalAttempt], cpd: [confirmed], today: TODAY });
  assert.equal(e.find(x => x.kind === 'cpd').status, 'course_assessed');
});

/* ------------------------------------------------------------------ wallet */

test('wallet: external credentials move Self-Declared → Evidence Uploaded → Pending → Verified → Expired / Rejected with an audit trail; never "verified by CIA"', () => {
  let c = P.saveCredential({ type: 'professional_cert', name: 'Lead Auditor ISO 9001', issuer: 'Example Body', issued: '2024-01-10', expires: '2027-01-09' }, { today: TODAY, now: '2026-11-01T00:00:00Z' });
  assert.equal(P.credentialState(c, null, TODAY), 'self_declared');
  assert.throws(() => P.requestVerification(c), /no_evidence/);
  c = P.saveCredential({ ...c, evidence_url: 'https://issuer.example/verify/123' }, { existing: c, today: TODAY, now: '2026-11-02T00:00:00Z' });
  assert.equal(P.credentialState(c, null, TODAY), 'evidence_uploaded');
  c = P.requestVerification(c, '2026-11-03T00:00:00Z');
  assert.equal(P.credentialState(c, null, TODAY), 'pending_verification');
  const v = P.makeVerification({ target_kind: 'credential', target_id: c.id, reviewer: 'Sara Reviewer', date: TODAY, method: 'issuer_check', decision: 'verified' }, TODAY, '2026-11-12T08:00:00Z');
  assert.equal(P.credentialState(c, v, TODAY), 'verified');
  assert.equal(P.credentialState(c, v, '2027-02-01'), 'expired');
  assert.equal(P.credentialState(c, { ...v, decision: 'rejected' }, TODAY), 'rejected');
  const trail = P.credentialTrail(c, v, TODAY).map(x => x.event);
  assert.deepEqual(trail, ['declared', 'evidence_added', 'verification_requested', 'verified']);
  const w = P.walletEntries({ certificates: [{ id: course.id, course_id: course.id, course_title: course.title, number: 'CIA-C-X', issued_at: '2026-11-06T00:00:00Z' }], credentials: [c], verifications: [v], today: TODAY });
  const ext = w.find(x => x.kind === 'external'); const cia = w.find(x => x.kind === 'cia_completion');
  assert.equal(ext.verified_by, 'Example Body'); assert.notEqual(ext.verified_by, 'CIA');
  assert.equal(ext.checked_by.reviewer, 'Sara Reviewer'); assert.equal(ext.evidence_status, 'externally_certified');
  assert.equal(cia.certificate_type, 'completion'); assert.equal(cia.verified_by, null);
  assert.ok(!JSON.stringify(w).match(/verified[_ ]by[_ ]cia/i));
  /* validation */
  const bad = P.validateCredential({ type: 'x', name: '', issuer: 'I', issued: '2027-01-01', expires: '2020-01-01', verify_url: 'http://insecure.example' }, TODAY).errors;
  assert.deepEqual(Object.keys(bad).sort(), ['expires', 'issued', 'issuer', 'name', 'type', 'verify_url']);
});

/* ------------------------------------------------------------------ specialized passports and badges */

test('specialized passports: auditor, consultant and trainer entries validate, progress self-declared → evidence uploaded → verified; totals', () => {
  const a = P.makeLog('auditor', { audit_type: 'internal', standard: 'ISO 9001:2015', role: 'lead', days: '2', findings: '3', date: '2026-10-01' }, { today: TODAY });
  const c = P.makeLog('consultant', { project: 'QMS implementation', role: 'lead', months: 6, deliverables: 'Manual, procedures', date: '2026-09-01', evidence_note: 'Client letter on file' }, { today: TODAY });
  const t = P.makeLog('trainer', { course: 'Internal auditor', hours: 16, participants: 12, date: '2026-08-01', evidence_url: 'https://example.org/att.pdf' }, { today: TODAY });
  const v = P.makeVerification({ target_kind: 'log', target_id: t.id, reviewer: 'Sara Reviewer', date: TODAY, method: 'document_review', decision: 'verified' }, TODAY);
  assert.deepEqual([P.logState(a, null, TODAY), P.logState(c, null, TODAY), P.logState(t, v, TODAY)], ['self_declared', 'evidence_uploaded', 'verified']);
  const tot = P.logTotals([a, c, t], [v], TODAY);
  assert.equal(tot.auditor.days, 2); assert.equal(tot.auditor.findings, 3); assert.equal(tot.auditor.lead, 1); assert.equal(tot.trainer.hours, 16); assert.equal(tot.trainer.verified, 1);
  const bad = P.validateLog('auditor', { audit_type: 'imaginary', role: 'boss', days: '100', findings: '1.5', date: '2027-01-01' }, TODAY).errors;
  assert.deepEqual(Object.keys(bad).sort(), ['audit_type', 'date', 'days', 'findings', 'role', 'standard']);
  assert.deepEqual(P.validateLog('pilot', {}, TODAY).errors, { kind: 'unknown' });
  const e = P.buildEntries({ logs: [a, c, t], verifications: [v], today: TODAY });
  assert.deepEqual(e.map(x => x.status).sort(), ['reviewer_verified', 'self_declared', 'self_declared']);
});

test('badges are labels, never certificates: no certificate_type, earned only by their rule', () => {
  for (const b of P.BADGES) { assert.equal(b.kind, 'badge'); assert.ok(!('certificate_type' in b)); }
  const a = P.makeLog('auditor', { audit_type: 'internal', standard: 'ISO 9001', role: 'member', days: 1, date: '2026-10-01' }, { today: TODAY });
  assert.deepEqual(P.earnedBadges({ logs: [a], today: TODAY }), []);
  const v = P.makeVerification({ target_kind: 'log', target_id: a.id, reviewer: 'Sara Reviewer', date: TODAY, method: 'work_sample', decision: 'verified' }, TODAY);
  const cpd = Array.from({ length: 10 }, (_, i) => P.makeCpd({ title: 'Activity ' + i, category: 'workshop', date: '2026-0' + (1 + (i % 9)) + '-01', hours: 10 }, { today: TODAY, now: `2026-01-0${1 + (i % 9)}T00:00:0${i}Z` }));
  const got = P.earnedBadges({ logs: [a], cpd, verifications: [v], today: TODAY });
  assert.deepEqual(got.map(b => b.id).sort(), ['cpd_100', 'verified_auditor_log']);
  assert.ok(got.every(b => b.kind === 'badge' && !('certificate_type' in b)));
});

/* ------------------------------------------------------------------ competency record and roadmap */

test('competency record: knowledge / scenario / practical from the right sources, level source, verification, reassessment date', () => {
  const role = ROLES.find(r => r.id === 'ROLE-IA');
  const scen = ASM.find(a => a.kind === 'scenario');
  const attempts = [finalAttempt, { ...finalAttempt, id: 'a2', assessment_id: scen.id, submitted_at: '2026-11-04T00:00:00Z', competency_breakdown: { 'AUD-01': { earned: 6, max: 10, percent: 60, items: 2 } } }];
  const att = makeLabAttempt(lab, perfect(lab), { attemptNo: 1, now: '2026-11-05T10:00:00Z' });
  const evidence = assessmentEvidence([...attempts, ...labEvidenceRows([att])]);
  const v = P.makeVerification({ target_kind: 'competency', target_id: 'AUD-03', reviewer: 'Sara Reviewer', date: TODAY, method: 'observation', decision: 'verified', level: 3 }, TODAY);
  const rows = P.competencyRecord({ competencies: COMPS, role, assessments: ASM, attempts, labs: LABS, labAttempts: [att], selfLevels: { 'AUD-04': 2 }, evidence, verifications: [v], today: TODAY });
  const r1 = rows.find(r => r.id === 'AUD-01');
  assert.equal(r1.knowledge.percent, 90); assert.equal(r1.scenario.percent, 60); assert.equal(r1.status, 'platform_assessed');
  assert.equal(r1.reassess, P.addMonths(r1.date, P.REASSESS_MONTHS));
  const r3 = rows.find(r => r.id === 'AUD-03');
  assert.equal(r3.status, 'reviewer_verified'); assert.equal(r3.source, 'verified'); assert.equal(r3.level, 3); assert.equal(r3.method, 'observation');
  const r4 = rows.find(r => r.id === 'AUD-04');
  if (r4 && !r4.knowledge && !r4.practical) { assert.equal(r4.status, 'self_declared'); assert.equal(r4.source, 'self'); }
  assert.equal(rows.length, Object.values(role.targets).filter(x => x > 0).length);
  const axes = P.radarAxes(rows, DOMAINS); assert.ok(axes.every(a => a.target > 0 && a.n > 0));
  assert.equal(P.addMonths('2024-02-29', 12), '2025-02-28');
  assert.deepEqual(P.verifiedLevels([v], TODAY), { 'AUD-03': 3 });
});

test('roadmap: gaps from the competency record (verified levels count), milestones with courses and labs, dates from weekly hours', () => {
  const role = ROLES.find(r => r.id === 'ROLE-IA');
  const gaps0 = calculateGaps({ role, competencies: COMPS, selfLevels: {}, assessmentByCompetency: {} });
  const gaps1 = calculateGaps({ role, competencies: COMPS, selfLevels: {}, assessmentByCompetency: {}, verifiedLevels: { [gaps0[0].competency_id]: 5 } });
  assert.equal(gaps1.filter(g => g.gap > 0).length, gaps0.filter(g => g.gap > 0).length - 1, 'a verified level closes that gap');
  const rm = P.buildRoadmap({ gaps: gaps0, courses: COURSES, labs: LABS.filter(l => !l.draft), weeklyHours: 4, start: TODAY });
  assert.ok(rm.milestones.length >= 1 && rm.milestones.length <= 4);
  assert.ok(rm.milestones.every(m => m.competencies.length <= 3 && m.actions.every(a => ['course', 'lab'].includes(a.type) && a.hours > 0)));
  const ids = rm.milestones.flatMap(m => m.actions.map(a => a.id)); assert.equal(new Set(ids).size, ids.length, 'no action twice');
  const dues = rm.milestones.map(m => m.due); assert.deepEqual([...dues].sort(), dues, 'due dates in order');
  assert.equal(rm.weeks, Math.ceil(rm.total_hours / 4));
  const slower = P.buildRoadmap({ gaps: gaps0, courses: COURSES, labs: LABS.filter(l => !l.draft), weeklyHours: 2, start: TODAY });
  assert.ok(slower.finish >= rm.finish);
  const doneFirst = P.buildRoadmap({ gaps: gaps0, courses: COURSES, labs: LABS.filter(l => !l.draft), weeklyHours: 4, start: TODAY, done: ['M1'] });
  assert.equal(doneFirst.milestones[0].done, true); assert.equal(doneFirst.milestones[0].due, null);
  assert.ok(doneFirst.total_hours < rm.total_hours || rm.milestones[0].hours === 0);
  const completed = P.buildRoadmap({ gaps: gaps0, courses: COURSES, labs: [], completed: COURSES.map(c => c.id), start: TODAY });
  assert.ok(completed.milestones.every(m => m.actions.length === 0));
  assert.deepEqual(P.buildRoadmap({ gaps: [] }).milestones, []);
});

/* ------------------------------------------------------------------ export / import */

test('passport export / import: labelled backup, validated, never overwrites, never imports verifications', () => {
  const cpd = [P.makeCpd({ title: 'Workshop A', category: 'workshop', date: '2026-02-01', hours: 3 }, { today: TODAY, now: '2026-02-01T00:00:00Z' })];
  const cred = P.saveCredential({ type: 'membership', name: 'Member', issuer: 'Some Society', issued: '2025-01-01' }, { today: TODAY });
  const log = P.makeLog('trainer', { course: 'Basics', hours: 4, participants: 10, date: '2026-01-01' }, { today: TODAY });
  const out = P.exportPassport({ cpd, credentials: [cred], logs: [log], career: { id: 'me', target_date: '2027-06-01', done: ['M1'] } }, '2026-11-12T00:00:00Z');
  assert.equal(out.schema, 'cia.passport.v1'); assert.match(out.label, /not a certification/);
  const file = JSON.parse(JSON.stringify({ ...out, data: { ...out.data, verifications: [V()], cpd: [...out.data.cpd, { id: 'bad-1', title: '', category: 'x' }, { id: 'evil"><x', title: 'x' }] } }));
  const fresh = P.importPassport(file, {}, { today: TODAY });
  assert.ok(fresh.ok);
  assert.equal(fresh.add.cpd.length, 1); assert.equal(fresh.add.credentials.length, 1); assert.equal(fresh.add.logs.length, 1);
  assert.equal(fresh.skipped.invalid, 2); assert.equal(fresh.skipped.verifications, 1);
  assert.equal(fresh.career.target_date, '2027-06-01');
  assert.ok(fresh.add.credentials[0].trail.every(t => t.event !== 'verified'));
  const again = P.importPassport(file, { cpd, credentials: [cred], logs: [log], career: { id: 'me' } }, { today: TODAY });
  assert.equal(again.add.cpd.length + again.add.credentials.length + again.add.logs.length, 0);
  assert.equal(again.skipped.duplicate, 3); assert.equal(again.career, null, 'an existing career plan is never replaced');
  assert.equal(P.importPassport('{nope', {}).err, 'json');
  assert.equal(P.importPassport({ app: 'other', schema: 'cia.passport.v1', data: {} }, {}).err, 'schema');
  assert.equal(P.importPassport({ app: 'cia-academy', schema: 'cia.efqm-lab.v1', data: {} }, {}).err, 'schema');
});

/* ------------------------------------------------------------------ integration: routes, tab, registry, strings, figures */

test('My space has a Passport tab (no new top item); passport print and reviewer routes exist; registry limits unchanged', () => {
  const main = text('src/main.js');
  assert.match(main, /path: '\/passport\/print'/);
  assert.match(main, /path: '\/passport\/cv'/);
  assert.match(main, /path: '\/review\/evidence'[^}]*roles: \['reviewer', 'admin'\]/);
  assert.match(text('src/views/myspace.js'), /MY_TABS = \[[^\]]*'passport'/);
  const nav = json('data/seed/navigation.json').items;
  assert.deepEqual(validateRegistry(nav), []);
  const ALL = ['learner', 'reviewer', 'admin'];
  assert.equal(shellEntries(nav, ['learner'], 'top').length, 5);
  assert.ok(shellEntries(nav, ['learner'], 'menu').length <= MAX_MENU);
  assert.ok(!nav.some(n => /passport/i.test(n.id) && n.placement === 'top'));
  void ALL;
});

test('Phase 12 strings: every key in both languages, no credential claims, every evidence status explained', () => {
  const en = json('data/i18n/en.json').pp12, ar = json('data/i18n/ar.json').pp12;
  assert.ok(en && ar);
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]);
  const fe = new Map(flat(en)), fa = new Map(flat(ar));
  assert.deepEqual([...fe.keys()].sort(), [...fa.keys()].sort());
  for (const [k, v] of fa) assert.ok(String(v).trim(), 'empty ar ' + k);
  for (const s of P.EVIDENCE) { assert.ok(en.status[s] && en.statusWhy[s], s); assert.ok(ar.status[s] && ar.statusWhy[s], s); }
  for (const s of P.CREDENTIAL_STATES) assert.ok(en.cred.state[s] && ar.cred.state[s], s);
  const NEG = /\b(not|no|never|nor|without|isn't|does not|doesn't)\b/i;
  for (const [k, v] of fe) {
    for (const m of String(v).matchAll(/(accredited|PDU|\bRU\b|recognised CPD|CPD provider|verified by CIA|CIA[- ]verified|certified by CIA|EFQM assessment|audit certification)/gi)) {
      const w = String(v).slice(Math.max(0, m.index - 80), m.index + m[0].length);
      assert.ok(NEG.test(w), `possible claim in pp12.${k}: “${w}”`);
    }
  }
});

test('Phase 12 figures are governed data (owner_phase 12, known templates, bilingual) and placed on the passport and roadmap', () => {
  const figs = json('data/seed/figures.json').items.filter(f => f.owner_phase === 12);
  assert.ok(figs.length >= 3);
  for (const f of figs) { assert.ok(f.caption.en && f.caption.ar && f.read.en && f.read.ar, f.id); assert.ok(['ladder', 'flow', 'cycle', 'bars', 'matrix'].includes(f.template)); assert.ok(f.governance?.content_status); }
  const map = new Map(json('data/seed/lesson-figures.json').items.map(e => [e.id, e.figures]));
  assert.ok(map.get('passport:main')?.length >= 1 && map.get('passport:roadmap')?.length >= 1);
});
