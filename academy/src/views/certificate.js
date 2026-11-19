/**
 * #/certificate/:slug — the learner's certificate of completion (D-10A-1, Phase 11; redesigned in Phase 16, D-123).
 * Shown only for a completed course. Each course has its own design (academy colours + a seal drawn from the course id);
 * each certificate carries a stable serial, a seal code over its details and a QR code to #/verify. Signed in with an
 * Academy account, the certificate is also written to the Academy register so the verification page can confirm the issuer.
 * Clearly labelled: a certificate of completion, not a professional certification.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, toast } from '../ui/components.js';
import { L, linkBtn, notAvailable } from '../ui/academy.js';
import { loadAll, withFullCourses } from '../data/learner-state.js';
import { certificateEligibility, issueCertificate, validateCertName, CERT_DISCLAIMER } from '../domain/certificates.mjs';
import { CertificateSheet } from '../ui/certificate-art.js';

export const certificateHref = c => `#/certificate/${c.slug}`;
/** The Academy address QR codes point to (the published site; the current page's address in development). */
export const academyBase = ctx => (!(ctx.config?.devHosts || []).includes(location.hostname) && ctx.config?.publicBase) || (location.origin + location.pathname);

export function certificateView(ctx, match) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => {
    const all = await loadAll(ctx);
    const light = all.content.courses.find(c => c.slug === match.params.slug);
    const content = light ? await withFullCourses(ctx, all.content, [light.id]) : all.content;
    const course = content.courses.find(c => c.slug === match.params.slug) || null;
    const saved = course ? await ctx.repos.certificates.get(course.id).catch(() => null) : null;
    return { course, learner: all.learner, saved };
  }, render: ({ course, learner, saved }) => {
    if (!course) return notAvailable(ctx, { title: t('cert11.notFound'), body: t('p7.course.pendingBody'), action: linkBtn('#/academy/courses', t('courses.title')) });
    ctx.setTrail?.([{ label: t('courses.title'), href: '#/academy/courses' }, { label: L(ctx, course.title), href: `#/academy/courses/${course.slug}` }], t('cert11.title'));
    const el = certificateEligibility(course, learner.progress, learner.attempts);
    if (!el.eligible) return h('div', { dataset: { cert: 'not-eligible' } }, h('header', { class: 'phead' }, h('h1', null, t('cert11.title')), h('p', null, L(ctx, course.title))),
      h('p', { class: 'banner banner-info', role: 'note' }, icon('info'), ' ', t('cert11.notYet', { done: i18n.number(el.status.done), total: i18n.number(el.status.total) }),
        el.status.lessonsDone && !el.status.finalPassed ? ' ' + t('cert11.needFinal') : ''),
      linkBtn(`#/academy/courses/${course.slug}`, t('cert11.backCourse'), 'primary'));
    const err = h('p', { class: 'err', id: 'cert-name-err', 'aria-live': 'polite' });
    const nameIn = h('input', { class: 'input', id: 'cert-name', autocomplete: 'name', maxlength: 80, value: saved?.name || '', 'aria-describedby': 'cert-name-hint cert-name-err' });
    const sheet = h('div', { class: 'cert-sheet-host cx-host' });
    const status = h('p', { class: 'cx-regline no-print', 'aria-live': 'polite' });
    const tools = h('div', { class: 'btnrow no-print cx-tools' });
    const paint = rec => {
      sheet.replaceChildren(rec ? CertificateSheet(ctx, { rec, course, base: academyBase(ctx) }) : h('p', { class: 'cx-empty' }, icon('award'), ' ', t('cx16.empty')));
      status.replaceChildren(...(rec ? [icon(rec.registered ? 'shield' : 'info'), ' ', rec.registered ? t('cx16.registered', { date: i18n.date(String(rec.registered.at).slice(0, 10)) }) : ctx.backend ? t('cx16.signInToRegister') : t('cx16.deviceOnly')] : []));
      status.dataset.registered = rec?.registered ? 'true' : 'false';
      tools.replaceChildren(...(rec ? [
        Button({ label: t('cx16.copyLink'), variant: 'secondary', iconName: 'link', attrs: { 'data-action': 'copy-verify-link' }, onClick: async () => {
          const href = sheet.querySelector('.cx-sheet')?.dataset.verifyHref || '';
          try { await navigator.clipboard.writeText(href); toast(t('cx16.copied')); } catch { prompt(t('cx16.copyLink'), href); } } }),
        linkBtn(sheet.querySelector('.cx-sheet')?.dataset.verifyHref?.replace(/^.*?#/, '#') || '#/verify', t('cx16.openVerify'), 'ghost', { 'data-action': 'open-verify' })] : []));
    };
    paint(saved);
    /* Signed in: the register issues (or returns) the serial; the device copy then carries the register's serial and date. */
    const register = async name => {
      if (!ctx.api || !ctx.session?.signedIn) return null;
      try { const r = await ctx.api.post('/certificates', { course_id: course.id, name }); return r?.certificate || null; } catch { return null; }
    };
    const issue = async () => {
      const code = validateCertName(nameIn.value);
      nameIn.setAttribute('aria-invalid', code ? 'true' : 'false'); err.textContent = code ? t('cert11.err.' + code) : '';
      if (code) { nameIn.focus(); return null; }
      const reg = await register(nameIn.value.trim().replace(/\s+/g, ' '));
      let rec = issueCertificate({ course, progress: learner.progress, attempts: learner.attempts, name: nameIn.value, userId: ctx.session.user.id,
        existing: reg ? { ...(saved || {}), number: reg.serial, issued_at: reg.issued_at, registered: { at: reg.registered_at, by: 'academy' }, name: reg.name } : saved });
      if (reg && reg.seal && reg.seal !== rec.seal) rec = { ...rec, registered: null };   // the register and this device disagree: never claim registration
      await ctx.repos.certificates.save(rec); saved = rec; paint(rec); toast(t('cert11.saved'));
      return rec;
    };
    return h('div', { class: 'cert-page', dataset: { cert: 'eligible' } },
      h('header', { class: 'phead no-print' }, h('p', { class: 'eyebrow' }, icon('award'), ' ', t('cert11.eyebrow')), h('h1', null, t('cert11.title')), h('p', null, t('cx16.lede'))),
      h('p', { class: 'banner banner-warn no-print', role: 'note' }, icon('shield'), ' ', L(ctx, CERT_DISCLAIMER)),
      h('div', { class: 'formgrid no-print' }, h('div', { class: 'field' }, h('label', { for: 'cert-name' }, t('cert11.nameLabel')), h('span', { class: 'hint', id: 'cert-name-hint' }, t('cert11.nameHint')), nameIn, err)),
      h('div', { class: 'btnrow no-print' }, Button({ label: saved ? t('cx16.update') : t('cert11.make'), variant: 'primary', iconName: 'award', attrs: { 'data-action': 'make-certificate' }, onClick: issue }),
        Button({ label: t('cert11.print'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'print-certificate' }, onClick: async () => { if (await issue()) window.print(); } })),
      status, sheet, tools,
      h('p', { class: 'note no-print' }, icon('info'), ' ', t('cx16.howVerify')));
  } });
  return h('div', null, region);
}
