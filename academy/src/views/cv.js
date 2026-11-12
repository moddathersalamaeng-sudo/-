/**
 * CV Builder (Phase 12, ADD-12) — Passport → CV tab (#/my?tab=passport&p=cv) and the printable CV (#/passport/cv).
 * Built from the learner's own CV details, profile and passport; exported as print / PDF, Word (.doc) and plain text.
 * Kept on this device (cia:v1:<user>:cv). No public link, no QR code. © 2026 Modather Salama.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, toast } from '../ui/components.js';
import { L, linkBtn, pageHead } from '../ui/academy.js';
import { competencyRecord } from '../domain/passport.mjs';
import { validateCv, buildCv, cvText, cvWordHtml, CV_SECTIONS } from '../domain/cv.mjs';

const download = (name, body, type) => {
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function cvModel(ctx, d, cv) {
  const { content, learner } = d;
  const role = learner.profile?.target_role ? content.rolesAll.find(r => r.id === learner.profile.target_role) || null : null;
  const rows = competencyRecord({ competencies: content.competencies, role, assessments: content.assessments, attempts: learner.attempts, labs: content.labs, labAttempts: learner.labAttempts,
    selfLevels: learner.selfLevels, evidence: learner.evidence, verifications: d.verifications, today: d.today });
  return buildCv({ cv, profile: learner.profile, role, credentials: d.credentials, certificates: d.certificates, logs: d.logs, cpd: d.cpd, verifications: d.verifications, rows, today: d.today,
    labels: (k, p) => ctx.t('pp12.' + k, p ? Object.fromEntries(Object.entries(p).map(([a, v]) => [a, typeof v === 'number' ? ctx.i18n.number(v) : v])) : p), L: v => L(ctx, v) });
}

export function cvSheet(ctx, model, { level = 3 } = {}) {
  const hd = model.header;
  return h('article', { class: 'cv-sheet', dataset: { cvSections: String(model.sections.length) } },
    h('header', { class: 'cv-head' }, h('p', { class: 'cv-name' }, hd.name || ctx.t('pp12.cv.noName')), hd.headline ? h('p', { class: 'cv-headline' }, hd.headline) : null,
      h('p', { class: 'cv-contact' }, [hd.location, hd.email, hd.phone].filter(Boolean).map((x, i) => [i ? ' | ' : '', h('bdi', null, x)]))),
    model.sections.map(s => h('section', { class: 'cv-sec', dataset: { cvSection: s.id } }, h('h' + level, { class: 'cv-h' }, s.title),
      h('ul', null, s.items.map(it => h('li', null, h('span', { class: 'cv-item' }, it.title), it.sub ? h('span', { class: 'cv-sub' }, it.sub) : null, it.note ? h('span', { class: 'cv-sub' }, h('bdi', null, it.note)) : null))),
      s.note ? h('p', { class: 'note' }, s.note) : null)));
}

export function cvPanel(ctx, d) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: () => ctx.repos.cv.get('me').catch(() => null), render: saved => {
    const cv = saved || { name: '', headline: d.learner.profile?.current_role || '', location: d.learner.profile?.country || '', email: '', phone: '', summary: '', include: {} };
    const fields = [['name', 'text', 80, true], ['headline', 'text', 120], ['location', 'text', 80], ['email', 'email', 120], ['phone', 'tel', 24], ['summary', 'textarea', 1200]];
    const inputs = {}; const errs = {};
    const rows = fields.map(([id, type, max, req]) => {
      const fid = 'cv-' + id;
      inputs[id] = type === 'textarea' ? h('textarea', { class: 'input', id: fid, rows: 4, maxlength: max, 'aria-describedby': fid + '-err' }, cv[id] || '')
        : h('input', { class: 'input', id: fid, type, maxlength: max, value: cv[id] || '', autocomplete: { name: 'name', email: 'email', phone: 'tel', location: 'address-level2' }[id] || 'off', required: !!req, 'aria-describedby': fid + '-err' });
      errs[id] = h('span', { class: 'err', id: fid + '-err', 'aria-live': 'polite' });
      return h('div', { class: ['field', type === 'textarea' && 'field-wide'] }, h('label', { for: fid }, t('pp12.cv.f.' + id), req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), inputs[id], errs[id]);
    });
    const checks = h('fieldset', { class: 'fs' }, h('legend', null, t('pp12.cv.include')), CV_SECTIONS.map(s => h('label', { class: 'choice' },
      h('input', { type: 'checkbox', name: 'cv-inc', value: s, checked: (cv.include || {})[s] !== false }), ' ', t('pp12.cv.s.' + s))));
    const read = () => ({ ...Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])), include: Object.fromEntries([...checks.querySelectorAll('input')].map(x => [x.value, x.checked])) });
    const preview = h('div', { class: 'cv-preview', 'aria-live': 'polite' });
    const paint = () => { const v = validateCv(read()); preview.replaceChildren(cvSheet(ctx, cvModel(ctx, d, v.value || { ...read(), include: read().include }))); };
    const check = () => {
      const { errors, value } = validateCv(read());
      for (const k of Object.keys(inputs)) { inputs[k].setAttribute('aria-invalid', errors[k] ? 'true' : 'false'); errs[k].textContent = errors[k] ? t('pp12.cv.err.' + errors[k]) : ''; }
      const first = Object.keys(errors)[0]; if (first) inputs[first].focus();
      return value;
    };
    const save = async () => { const v = check(); if (!v) return null; await ctx.repos.cv.save({ ...v, updated_at: new Date().toISOString() }); toast(t('pp12.cv.saved')); return v; };
    const model = async () => { const v = await save(); return v ? cvModel(ctx, d, v) : null; };
    Object.values(inputs).forEach(el => el.addEventListener('input', paint)); checks.addEventListener('change', paint);
    paint();
    return h('div', { class: 'pp-cv' },
      h('section', { class: 'section', 'aria-labelledby': 'cv-h' }, h('h2', { id: 'cv-h' }, icon('doc'), ' ', t('pp12.cv.title')), h('p', null, t('pp12.cv.lede')),
        h('p', { class: 'banner banner-info', role: 'note', dataset: { cvNote: 'true' } }, t('pp12.cv.honesty'))),
      h('div', { class: 'cv-grid' },
        h('section', { class: 'section panel', 'aria-labelledby': 'cv-f-h' }, h('h2', { id: 'cv-f-h' }, t('pp12.cv.details')), h('div', { class: 'formgrid pp-form' }, rows), checks,
          h('div', { class: 'btnrow' },
            Button({ label: t('pp12.cv.save'), variant: 'primary', onClick: save, attrs: { 'data-action': 'save-cv' } }),
            Button({ label: t('pp12.cv.word'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'cv-word' }, onClick: async () => { const m = await model(); if (m) { download('cia-cv.doc', cvWordHtml(m, { lang: i18n.locale }), 'application/msword'); toast(t('pp12.cv.downloaded')); } } }),
            Button({ label: t('pp12.cv.text'), variant: 'secondary', iconName: 'download', attrs: { 'data-action': 'cv-text' }, onClick: async () => { const m = await model(); if (m) { download('cia-cv.txt', '﻿' + cvText(m), 'text/plain;charset=utf-8'); toast(t('pp12.cv.downloaded')); } } }),
            linkBtn('#/passport/cv', t('pp12.cv.print'), 'secondary', { 'data-action': 'cv-print' })),
          h('p', { class: 'note' }, t('pp12.cv.noPublic')), h('p', { class: 'note' }, t('pp12.cv.interviewLater'))),
        h('section', { class: 'section', 'aria-labelledby': 'cv-p-h' }, h('h2', { id: 'cv-p-h' }, t('pp12.cv.preview')), preview)));
  } });
  return region;
}

export function cvPrintView(ctx, loadPassport) {
  const { t } = ctx;
  return h('div', { class: 'cv-print' }, dataRegion({ t, load: async () => ({ d: await loadPassport(ctx), cv: await ctx.repos.cv.get('me').catch(() => null) }), render: ({ d, cv }) => {
    const m = cvModel(ctx, d, cv || { include: {} });
    return h('div', null, pageHead(ctx, { eyebrow: t('pp12.cv.title'), title: cv?.name || t('pp12.cv.noName'), lede: t('pp12.cv.printLede'),
      actions: [Button({ label: t('lab11.print'), variant: 'primary', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print-now' } }), linkBtn('#/my?tab=passport&p=cv', t('pp12.back'), 'secondary')] }),
      !cv ? h('p', { class: 'banner banner-info', role: 'note' }, t('pp12.cv.notSaved'), ' ', h('a', { href: '#/my?tab=passport&p=cv' }, t('pp12.cv.title'))) : null,
      cvSheet(ctx, m, { level: 2 }));
  } }));
}
