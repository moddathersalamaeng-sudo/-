/**
 * #/verify/:serial?p=… — what a certificate's QR code opens (Phase 16, D-123). Public: no sign-in, nothing stored.
 * Two independent checks, each reported for what it is:
 *  1. Seal check (always): the details carried by the QR code are recomputed against their seal and the serial —
 *     "not edited since it was made". It cannot say who made it.
 *  2. Academy register (only when the site runs with Academy accounts): the serial is looked up; the register says
 *     whether the Academy issued it, to whom, and whether it is still valid.
 * #/verify without a serial shows a form that checks the serial's check character before any lookup.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion } from '../ui/components.js';
import { L, linkBtn } from '../ui/academy.js';
import { verifyLink, serialState, designFor, THEMES } from '../domain/credential.mjs';
import { CERT_DISCLAIMER } from '../domain/certificates.mjs';

const TONE = { registered: 'ok', intact: 'ok', revoked: 'bad', altered: 'bad', mismatch: 'bad', differs: 'bad', typo: 'warn', malformed: 'warn', missing: 'warn', unknown: 'warn', legacy: 'warn' };
const ICON = { ok: 'shield', bad: 'close', warn: 'info' };

function serialForm(ctx, value = '') {
  const { t } = ctx;
  const inp = h('input', { class: 'input', id: 'vf-serial', value, dir: 'ltr', autocomplete: 'off', spellcheck: 'false', maxlength: 40, placeholder: 'CIA-C-…', 'aria-describedby': 'vf-msg' });
  const msg = h('p', { class: 'hint', id: 'vf-msg', 'aria-live': 'polite' });
  return h('form', { class: 'vf-form formgrid', dataset: { verifyForm: '' }, onsubmit: e => {
    e.preventDefault();
    const s = inp.value.trim().toUpperCase().replace(/\s+/g, '');
    const st = serialState(s);
    if (st === 'malformed' || st === 'typo') { msg.textContent = t('cx16.v.form.' + st); inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    location.hash = `#/verify/${encodeURIComponent(s)}`;
  } }, h('div', { class: 'field' }, h('label', { for: 'vf-serial' }, t('cx16.v.form.label')), inp, msg),
  h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', 'data-action': 'verify-serial' }, icon('search'), ' ', t('cx16.v.form.go'))));
}

export function verifyView(ctx, match) {
  const { t, i18n } = ctx;
  const serial = String(match.params.serial || '').trim().toUpperCase();
  if (!serial) return h('div', { class: 'vf-page' }, h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('shield'), ' ', t('cx16.v.eyebrow')), h('h1', null, t('cx16.v.title')), h('p', null, t('cx16.v.lede'))),
    serialForm(ctx), h('p', { class: 'note' }, icon('info'), ' ', t('cx16.v.formNote')));
  const region = dataRegion({ t, load: async () => {
    const link = verifyLink(serial, match.query?.p);
    let reg = null, regError = false;
    if (ctx.api && ['ok', 'legacy'].includes(serialState(serial))) {
      try { reg = (await ctx.api.get(`/certificates/verify/${encodeURIComponent(serial)}`))?.certificate || null; } catch (e) { if (e?.status !== 404) regError = true; }
    }
    const courseId = link.data?.course_id || reg?.course_id;
    const idx = courseId ? await (ctx.repos.coursesIndex || ctx.repos.courses).listVisible(ctx.session.roles).catch(() => []) : [];
    const course = courseId ? (idx.find(c => c.id === courseId) || null) : null;
    const local = await ctx.repos.certificates?.list().catch(() => []) || [];
    return { link, reg, regError, course, onDevice: local.some(c => c.number === serial) };
  }, render: ({ link, reg, regError, course, onDevice }) => {
    /* One verdict: the register wins when it answered; the seal check otherwise. */
    let verdict = link.state === 'intact' ? 'intact' : link.state;
    if (reg) {
      const same = !link.data || (link.data.name === reg.name && link.data.date === reg.date && link.data.course_id === reg.course_id);
      verdict = reg.status === 'revoked' ? 'revoked' : !same ? 'differs' : 'registered';
    } else if (link.state === 'missing' && ctx.api && !regError) verdict = 'unknown';
    const tone = TONE[verdict] || 'warn';
    const data = reg ? { name: reg.name, date: reg.date, hours: reg.hours, score: reg.score, course_id: reg.course_id } : link.data;
    const theme = course ? designFor(course).theme : THEMES.iso;
    const row = (k, v) => v == null || v === '' ? null : h('div', null, h('dt', null, k), h('dd', null, v));
    const checks = [
      h('li', { dataset: { check: 'seal', state: link.state } }, icon(link.state === 'intact' ? 'check' : link.state === 'missing' ? 'info' : 'close'), ' ', t('cx16.v.check.seal.' + (['intact', 'altered', 'mismatch', 'missing', 'typo'].includes(link.state) ? link.state : 'malformed'))),
      h('li', { dataset: { check: 'register', state: reg ? reg.status : ctx.api ? (regError ? 'error' : 'none') : 'off' } }, icon(reg ? (reg.status === 'valid' ? 'check' : 'close') : 'info'), ' ',
        reg ? t('cx16.v.check.reg.' + (reg.status === 'valid' ? 'valid' : 'revoked'), { date: i18n.date(String(reg.registered_at || reg.date).slice(0, 10)) }) : t('cx16.v.check.reg.' + (ctx.api ? (regError ? 'error' : 'none') : 'off'))),
      onDevice ? h('li', { dataset: { check: 'device' } }, icon('check'), ' ', t('cx16.v.check.device')) : null];
    return h('div', { class: 'vf-page', dataset: { verdict } },
      h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('shield'), ' ', t('cx16.v.eyebrow')), h('h1', null, t('cx16.v.title'))),
      h('section', { class: `vf-verdict vf-${tone}`, role: 'status', 'aria-live': 'polite', style: `--cx-accent:${theme.accent};--cx-ink:${theme.ink}` },
        h('span', { class: 'vf-badge', 'aria-hidden': 'true' }, icon(ICON[tone])),
        h('div', null, h('p', { class: 'vf-vtitle' }, t('cx16.v.verdict.' + verdict)), h('p', { class: 'vf-vbody' }, t('cx16.v.body.' + verdict)))),
      data ? h('section', { class: 'vf-card', 'aria-labelledby': 'vf-details', style: `--cx-accent:${theme.accent};--cx-ink:${theme.ink}` },
        h('h2', { id: 'vf-details' }, t('cx16.v.details')),
        h('dl', { class: 'vf-dl' },
          row(t('cx16.v.name'), h('bdi', null, data.name)),
          row(t('cx16.v.course'), course ? h('a', { href: `#/academy/courses/${course.slug}` }, L(ctx, course.title)) : h('bdi', { dir: 'ltr' }, data.course_id)),
          course ? row(t('cx16.v.academy'), L(ctx, designFor(course).theme.label)) : null,
          row(t('cert11.date'), data.date ? i18n.date(data.date) : null),
          row(t('cert11.hours'), data.hours ? i18n.number(data.hours) : null),
          row(t('cx16.score'), data.score != null ? i18n.number(data.score) + '%' : null),
          row(t('cert11.number'), h('bdi', { dir: 'ltr', class: 'cx-serial' }, serial)),
          link.seal ? row(t('cx16.sealCode'), h('bdi', { dir: 'ltr' }, link.seal)) : null)) : null,
      h('section', { class: 'vf-checks', 'aria-labelledby': 'vf-checks-h' }, h('h2', { id: 'vf-checks-h' }, t('cx16.v.checks')), h('ul', { class: 'vf-list' }, ...checks)),
      h('p', { class: 'banner banner-info', role: 'note' }, icon('info'), ' ', L(ctx, CERT_DISCLAIMER)),
      h('details', { class: 'vf-more' }, h('summary', null, t('cx16.v.otherSerial')), serialForm(ctx)),
      h('p', null, linkBtn('#/academy/courses', t('courses.title'), 'ghost')));
  } });
  return h('div', null, region);
}
