/**
 * Phase 12B (L-B5): the readiness band — "is your knowledge ready?" with three counters and one button, on the home
 * page (all academies) and on each academy landing (that academy). Counts come from published records only:
 * starting-point checks (diagnostics and readiness checks), the questions in them, and the competencies the courses
 * develop (all courses on the home page, the academy's courses on a landing). The home page fetches the assessment list
 * for this band only (≈ 32 KB compressed).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { linkBtn } from './academy.js';
import { counterStrip } from './guided.js';
import { academyOfAssessment, academyOfCourse, ASSESSMENT_TYPE } from '../domain/academies.mjs';

export const READINESS_SLUG = { iso: 'iso-readiness', pmi: 'pm-readiness', quality: 'quality-readiness', excellence: 'excellence-readiness' };

/** Pure: the numbers and the target of the band. `key` null = all academies. */
export function readinessFacts({ assessments = [], courses = [] }, key = null, preferSlug = null) {
  const byId = id => courses.find(c => c.id === id) || null;
  const checks = assessments.filter(a => ASSESSMENT_TYPE(a) === 'diagnostic' && (!key || academyOfAssessment(a, byId) === key));
  const questions = checks.reduce((n, a) => n + (a.question_ids || []).length, 0);
  const comps = new Set(courses.filter(c => !key || academyOfCourse(c) === key).flatMap(c => (c.competency_mappings || []).map(m => m.competency))).size;
  const slug = preferSlug || (key ? READINESS_SLUG[key] : 'professional-diagnostic');
  const target = checks.find(a => a.slug === slug) || checks.find(a => a.kind === 'readiness') || checks[0] || null;
  return { checks: checks.length, questions, competencies: comps, target };
}

export function readinessBand(ctx, content, key = null, { preferSlug = null } = {}) {
  const { t } = ctx;
  const f = readinessFacts(content, key, preferSlug);
  if (!f.target) return null;
  /* Home (all academies): the button opens the assessments list, where readiness checks come first in each academy tab —
     unless a preferred published check was named. An academy landing opens that academy's readiness check. */
  const href = key || (preferSlug && f.target.slug === preferSlug) ? '#/assessments/' + f.target.slug : '#/assessments';
  return h('section', { class: 'gx-band', 'aria-labelledby': 'gx-band-h' + (key || ''), dataset: { readiness: key || 'all' } },
    h('div', null,
      h('p', { class: 'eyebrow' }, icon('gauge'), ' ', t('g12b.band.eyebrow')),
      h('h2', { id: 'gx-band-h' + (key || '') }, t('g12b.band.title')),
      h('p', null, t(key ? 'g12b.band.ledeAcademy' : 'g12b.band.lede')),
      h('div', { class: 'btnrow', style: { marginBlockStart: 'var(--s-4)' } }, linkBtn(href, t(key || href !== '#/assessments' ? 'g12b.band.cta' : 'g12b.band.ctaChoose'), 'primary', { 'data-action': 'band-start' }))),
    counterStrip(ctx, [
      [f.checks, t('g12b.band.cChecks'), 'clipboard'],
      [f.questions, t('g12b.band.cQuestions'), 'question'],
      [f.competencies, t('g12b.band.cComp'), 'target']
    ], { label: t('g12b.band.title') }));
}
