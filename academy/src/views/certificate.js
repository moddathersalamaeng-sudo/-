/**
 * #/certificate/:slug — printable CIA certificate of completion (D-10A-1, Phase 11). Shown only for a completed course
 * (every lesson done and the final assessment passed). The learner types the name to print; the record is kept on this
 * device only (cia:v1:<user>:certificates). Clearly labelled: not a professional certification.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, toast } from '../ui/components.js';
import { L, linkBtn, notAvailable } from '../ui/academy.js';
import { loadAll, withFullCourses } from '../data/learner-state.js';
import { certificateEligibility, issueCertificate, validateCertName, CERT_DISCLAIMER } from '../domain/certificates.mjs';

export const certificateHref = c => `#/certificate/${c.slug}`;

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
    const sheet = h('div', { class: 'cert-sheet-host' });
    const paint = rec => sheet.replaceChildren(rec ? h('article', { class: 'cert-sheet', dataset: { certNumber: rec.number }, lang: i18n.locale, dir: i18n.dir },
      h('p', { class: 'cert-org' }, t('app.name')),
      h('h2', { class: 'cert-kind' }, t('cert11.kind')),
      h('p', { class: 'cert-pre' }, t('cert11.presented')),
      h('p', { class: 'cert-name' }, rec.name),
      h('p', { class: 'cert-pre' }, t('cert11.completed')),
      h('p', { class: 'cert-course' }, L(ctx, rec.course_title)),
      h('dl', { class: 'cert-facts' },
        h('div', null, h('dt', null, t('cert11.date')), h('dd', null, i18n.date(rec.issued_at.slice(0, 10)))),
        rec.hours ? h('div', null, h('dt', null, t('cert11.hours')), h('dd', null, i18n.number(rec.hours))) : null,
        h('div', null, h('dt', null, t('cert11.number')), h('dd', null, h('bdi', { dir: 'ltr' }, rec.number)))),
      h('p', { class: 'cert-disclaimer', dataset: { certDisclaimer: 'true' } }, L(ctx, CERT_DISCLAIMER))) : null);
    paint(saved);
    const issue = async () => {
      const code = validateCertName(nameIn.value);
      nameIn.setAttribute('aria-invalid', code ? 'true' : 'false'); err.textContent = code ? t('cert11.err.' + code) : '';
      if (code) { nameIn.focus(); return null; }
      const rec = issueCertificate({ course, progress: learner.progress, attempts: learner.attempts, name: nameIn.value, userId: ctx.session.user.id, existing: saved });
      await ctx.repos.certificates.save(rec); saved = rec; paint(rec); toast(t('cert11.saved'));
      return rec;
    };
    return h('div', { class: 'cert-page', dataset: { cert: 'eligible' } },
      h('header', { class: 'phead no-print' }, h('p', { class: 'eyebrow' }, icon('award'), ' ', t('cert11.eyebrow')), h('h1', null, t('cert11.title')), h('p', null, t('cert11.lede'))),
      h('p', { class: 'banner banner-warn no-print', role: 'note' }, icon('shield'), ' ', L(ctx, CERT_DISCLAIMER)),
      h('div', { class: 'formgrid no-print' }, h('div', { class: 'field' }, h('label', { for: 'cert-name' }, t('cert11.nameLabel')), h('span', { class: 'hint', id: 'cert-name-hint' }, t('cert11.nameHint')), nameIn, err)),
      h('div', { class: 'btnrow no-print' }, Button({ label: t('cert11.make'), variant: 'primary', iconName: 'award', attrs: { 'data-action': 'make-certificate' }, onClick: issue }),
        Button({ label: t('cert11.print'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'print-certificate' }, onClick: async () => { if (await issue()) window.print(); } })),
      sheet);
  } });
  return h('div', null, region);
}
