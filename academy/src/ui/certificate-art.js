/**
 * Phase 16 — the certificate sheet. One layout, drawn differently for every course:
 *  - academy colours (ISO gold, Project blue, Quality teal, Excellence green);
 *  - a guilloche frame and a seal rosette whose shape comes from the course id (designFor);
 *  - security microtext of the learner's serial along the inner frame;
 *  - the course's own module titles, hours, final score, date, serial, seal code and a QR code to the verification page.
 * Bilingual: the page language leads, the other language follows. The learner's name only ever enters text nodes.
 */
import { h, iconPath } from '../core/dom.js';
import { designFor, rosettePaths, framePaths, verifyHref } from '../domain/credential.mjs';
import { CERT_DISCLAIMER } from '../domain/certificates.mjs';
import { qrSvg } from './qr.js';
import { lookup } from '../core/i18n.js';

const NS = 'http://www.w3.org/2000/svg';
function s(name, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const ACADEMY_ICON = { iso: 'shield', pmi: 'briefcase', quality: 'award', excellence: 'star' };

/** Background: soft field, guilloche frame (two or three strands), hairlines, corner marks, microtext, faint rosette watermark. */
function backdrop(d, serial, uid, names) {
  const W = 297, H = 210, th = d.theme;
  const micro = `${serial} · ${names[0].toUpperCase()} · ${serial} · ${names[1]} · `.repeat(14);
  const pid = 'cxm-' + uid;
  return s('svg', { class: 'cx-bg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    s('defs', {}, s('radialGradient', { id: 'cxg-' + uid, cx: '50%', cy: '42%', r: '75%' }, s('stop', { offset: '0', 'stop-color': '#FFFFFF' }), s('stop', { offset: '1', 'stop-color': th.soft })),
      s('path', { id: pid, d: `M17 17H${W - 17}V${H - 17}H17Z` })),
    s('rect', { width: W, height: H, fill: `url(#cxg-${uid})` }),
    s('rect', { x: 4, y: 4, width: W - 8, height: H - 8, fill: 'none', stroke: th.ink, 'stroke-width': 1.6 }),
    ...framePaths(d.frame, W, H, 10).map(p => s('path', { d: p, fill: 'none', stroke: th.accent, 'stroke-width': 0.35, opacity: 0.9 })),
    s('rect', { x: 15, y: 15, width: W - 30, height: H - 30, fill: 'none', stroke: th.accent, 'stroke-width': 0.4 }),
    s('text', { class: 'cx-micro', direction: 'ltr', 'unicode-bidi': 'plaintext', 'font-size': 1.55, fill: th.ink, opacity: 0.55, 'letter-spacing': 0.15 }, s('textPath', { href: '#' + pid }, micro)),
    s('rect', { x: 19, y: 19, width: W - 38, height: H - 38, fill: 'none', stroke: th.ink, 'stroke-width': 0.2, opacity: 0.5 }),
    ...[[19, 19, 1, 1], [W - 19, 19, -1, 1], [19, H - 19, 1, -1], [W - 19, H - 19, -1, -1]].map(([x, y, a, b]) =>
      s('path', { d: `M${x} ${y + b * 12}V${y}H${x + a * 12}M${x + a * 3} ${y + b * 7}V${y + b * 3}H${x + a * 7}`, fill: 'none', stroke: th.accent, 'stroke-width': 0.9 })),
    s('g', { transform: `translate(${W / 2} ${H / 2 - 4}) scale(1.35)`, opacity: 0.07 }, ...rosettePaths(d.seal, 46).map(p => s('path', { d: p, fill: 'none', stroke: th.ink, 'stroke-width': 0.5 }))));
}

/** The seal medallion: rosette rings, beaded ring, the course code and year on a circular path, academy icon at the centre. */
export function sealSvg(d, { year, uid, label }) {
  const th = d.theme, cid = 'cxs-' + uid;
  const dots = Array.from({ length: d.seal.dots }, (_, i) => { const a = i / d.seal.dots * 2 * Math.PI; return s('circle', { cx: (52 * Math.cos(a)).toFixed(2), cy: (52 * Math.sin(a)).toFixed(2), r: 0.9, fill: th.accent }); });
  return s('svg', { class: 'cx-seal', viewBox: '-60 -60 120 120', role: 'img', 'aria-label': label },
    s('defs', {}, s('path', { id: cid, d: 'M-40 0A40 40 0 1 1 40 0A40 40 0 1 1 -40 0' })),
    s('circle', { r: 58, fill: th.ink }), s('circle', { r: 55, fill: 'none', stroke: th.accent, 'stroke-width': 1.2 }), ...dots,
    s('circle', { r: 47.5, fill: 'none', stroke: th.accent, 'stroke-width': 0.5 }),
    s('text', { class: 'cx-seal-ring', fill: th.accent, 'font-size': 7.2, 'letter-spacing': 1.1 },
      s('textPath', { href: '#' + cid, startOffset: '50%', 'text-anchor': 'middle' }, `CIA · ${d.code} · ${year} · CIA`)),
    s('g', { transform: 'scale(0.62)' }, ...rosettePaths(d.seal, 46).map(p => s('path', { d: p, fill: 'none', stroke: th.accent, 'stroke-width': 0.8, opacity: 0.85 }))),
    s('circle', { r: 15, fill: th.ink, stroke: th.accent, 'stroke-width': 1 }),
    s('path', { d: iconPath(ACADEMY_ICON[d.academy] || 'award'), transform: 'translate(-9.6 -9.6) scale(0.8)', fill: 'none', stroke: th.accent, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/**
 * CertificateSheet(ctx, { rec, course }) → article.cx-sheet. `base` is the Academy address the QR code points to.
 */
export function CertificateSheet(ctx, { rec, course, base }) {
  const { t, i18n } = ctx;
  const lang = i18n.locale === 'ar' ? 'ar' : 'en', other = lang === 'ar' ? 'en' : 'ar';
  const d = designFor(course || { id: rec.course_id, category: '', ecosystem: rec.academy });
  const T = o => (o && (o[lang] || o[other])) || '', O = o => (o && o[other] && o[other] !== o[lang] ? o[other] : '');
  const tO = key => { const v = lookup(i18n.dicts?.[other] || {}, key); return typeof v === 'string' ? v : t(key); };
  const uid = Math.random().toString(36).slice(2, 8);
  const href = verifyHref(base, rec);
  const both = key => [h('span', { class: 'cx-l1' }, t(key)), h('span', { class: 'cx-l2', lang: other, dir: other === 'ar' ? 'rtl' : 'ltr' }, tO(key))];
  const fact = (label, value, cls = '') => h('div', { class: 'cx-fact ' + cls }, h('dt', null, label), h('dd', null, value));
  const year = String(rec.issued_at).slice(0, 4);
  const sheet = h('article', { class: 'cert-sheet cx-sheet', lang, dir: i18n.dir, dataset: { certNumber: rec.number, academy: d.academy, seal: rec.seal || '' },
    style: `--cx-ink:${d.theme.ink};--cx-accent:${d.theme.accent};--cx-soft:${d.theme.soft}`, 'aria-label': t('cx16.sheetLabel') },
    backdrop(d, rec.number, uid, lang === 'en' ? [t('app.name'), tO('app.name')] : [tO('app.name'), t('app.name')]),
    h('div', { class: 'cx-body' },
      h('header', { class: 'cx-top' },
        h('div', { class: 'cx-org' }, h('img', { src: '../assets/icon-192.png', alt: '', class: 'cx-logo', width: 44, height: 44 }),
          h('div', null, h('p', { class: 'cx-orgname' }, t('app.name')), h('p', { class: 'cx-orgname2', lang: other }, tO('app.name')))),
        h('p', { class: 'cx-academy' }, T(d.theme.label))),
      h('div', { class: 'cx-title' }, h('p', { class: 'cx-kind' }, ...both('cx16.kind'))),
      h('p', { class: 'cx-pre' }, t('cx16.presented')),
      h('p', { class: 'cx-name', dataset: { certName: '' } }, h('bdi', null, rec.name)),
      h('p', { class: 'cx-pre' }, t(rec.score != null || course?.assessments?.final ? 'cx16.completed' : 'cx16.completedLessons')),
      h('p', { class: 'cx-course' }, T(rec.course_title)), O(rec.course_title) ? h('p', { class: 'cx-course2', lang: other }, O(rec.course_title)) : null,
      rec.highlights?.length ? h('ul', { class: 'cx-hl', 'aria-label': t('cx16.covered') }, ...rec.highlights.map(x => h('li', null, T(x)))) : null,
      h('dl', { class: 'cx-facts' },
        fact(t('cert11.date'), i18n.date(String(rec.issued_at).slice(0, 10))),
        rec.hours ? fact(t('cert11.hours'), i18n.number(rec.hours)) : null,
        rec.score != null ? fact(t('cx16.score'), i18n.number(rec.score) + '%') : null,
        fact(t('cert11.number'), h('bdi', { dir: 'ltr', class: 'cx-serial' }, rec.number), 'cx-fact-serial')),
      h('footer', { class: 'cx-foot' },
        h('div', { class: 'cx-sign' }, h('p', { class: 'cx-signname' }, t('cx16.signatory')), h('span', { class: 'cx-signline' }), h('p', { class: 'cx-signrole' }, t('cx16.signRole'))),
        h('div', { class: 'cx-sealbox' }, sealSvg(d, { year, uid, label: t('cx16.sealLabel', { code: d.code }) })),
        h('div', { class: 'cx-qrbox' },
          h('a', { href, class: 'cx-qrlink', 'aria-label': t('cx16.qrLabel') }, qrSvg(href, { label: t('cx16.qrLabel'), fg: d.theme.ink })),
          h('p', { class: 'cx-qrcap' }, t('cx16.scan')),
          h('p', { class: 'cx-sealcode' }, t('cx16.sealCode'), ' ', h('bdi', { dir: 'ltr' }, rec.seal || '—')))),
      h('p', { class: 'cert-disclaimer cx-disc', dataset: { certDisclaimer: 'true' } }, T(CERT_DISCLAIMER))));
  sheet.dataset.verifyHref = href;
  return sheet;
}
