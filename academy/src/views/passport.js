/**
 * Professional Passport (Phase 12) — My space → Passport tab (#/my?tab=passport&p=…), the printable summary (#/passport/print)
 * and the evidence-review screen for a named reviewer on this device (#/review/evidence, reviewer and admin roles).
 *
 * One honest record of the learner's development: every entry shows its evidence status (self-declared · course-assessed ·
 * platform-assessed · reviewer-verified · externally certified) and nothing is upgraded without the rule that allows it
 * (src/domain/passport.mjs, PASSPORT_EVIDENCE_RULES.md). CPD hours are recorded, never awarded; external credentials are
 * "verify at the issuer", never "verified by CIA". Everything is kept on this device (cia:v1:*).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Tabs, dataRegion, Button, Badge, Table, toast, openDialog, EmptyState } from '../ui/components.js';
import { loadAll } from '../data/learner-state.js';
import { L, linkBtn, pageHead, setHashQuery, isReviewer } from '../ui/academy.js';
import { Radar, LevelMeter } from '../ui/charts.js';
import { Figure } from '../ui/figures.js';
import { academyBanner } from '../ui/art.js';
import { percentMap } from '../domain/learner-model.mjs';
import { calculateGaps } from '../domain/recommendations.mjs';
import { buildRecommendationModel, GapTable } from './recommendations.js';
import { loadFullLab, loadLabsIndex } from './labs.js';
import { starterCourse } from './home.js';
import * as P from '../domain/passport.mjs';
import { cvPanel, cvPrintView } from './cv.js';

export const PASSPORT_TABS = ['overview', 'competencies', 'cpd', 'wallet', 'logs', 'career', 'cv', 'export'];
const STATUS_TONE = { self_declared: 'neutral', course_assessed: 'info', platform_assessed: 'info', reviewer_verified: 'ok', externally_certified: 'gold' };
const STATUS_ICON = { self_declared: 'user', course_assessed: 'book', platform_assessed: 'gauge', reviewer_verified: 'check', externally_certified: 'award' };
const CRED_TONE = { self_declared: 'neutral', evidence_uploaded: 'info', pending_verification: 'warn', verified: 'ok', expired: 'bad', rejected: 'bad' };
const LOG_TONE = { self_declared: 'neutral', evidence_uploaded: 'info', verified: 'ok' };
const KIND_ICON = { course: 'book', assessment: 'clipboard', lab: 'flask', document: 'doc', certificate: 'medal', credential: 'award', cpd: 'clock', log: 'briefcase' };

export const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (ctx, s) => (s ? ctx.i18n.date(String(s).slice(0, 10)) : '—');
const num = (ctx, n) => ctx.i18n.number(n);

export function statusBadge(ctx, status) {
  return h('span', { class: `badge badge-${STATUS_TONE[status] || 'neutral'} ev-badge`, dataset: { ev: status } }, icon(STATUS_ICON[status] || 'info'), ' ', ctx.t('pp12.status.' + status));
}

function download(name, body, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------------ data */

export async function loadPassport(ctx) {
  const r = ctx.repos;
  const roles = ctx.session.roles;
  const { content, learner } = await loadAll(ctx);
  const safe = p => p.catch(() => []);
  const [docs, tpls, certificates, cpd, credentials, logs, verifications, career, prefs, studyPlan, figures, lessonFigures] = await Promise.all([
    safe(r.smartDocs.list()), safe(r.smartTemplates.listVisible(roles)), safe(r.certificates.list()), safe(r.cpd.list()), safe(r.credentials.list()),
    safe(r.practiceLogs.list()), safe(r.verifications.list()), r.careerPlan.get('me').catch(() => null), r.passportPrefs.get('cpd').catch(() => null),
    r.studyPlan.get('me').catch(() => null), safe(r.figures.listVisible(roles)), safe(r.lessonFigures.list())]);
  const today = localToday();
  const entries = P.buildEntries({ courses: content.courses, assessments: content.assessments, labs: content.labs, templates: tpls, progress: learner.progress, attempts: learner.attempts,
    labAttempts: learner.labAttempts, docs, certificates, credentials, cpd, logs, verifications, today });
  const figsFor = key => (lessonFigures.find(x => x.id === key)?.figures || []).map(id => figures.find(f => f.id === id)).filter(Boolean);
  return { content, learner, docs, tpls, certificates, cpd, credentials, logs, verifications, career, dismissed: prefs?.dismissed || [], studyPlan, entries, today, figsFor };
}

/* ------------------------------------------------------------------ small form kit (labels, hints, errors, aria) */

function formKit(ctx, prefix, defs, values = {}) {
  const { t } = ctx;
  const inputs = {}; const errs = {};
  const rows = defs.map(d => {
    const id = `${prefix}-${d.id}`;
    const describedBy = [d.hint ? id + '-hint' : null, id + '-err'].filter(Boolean).join(' ');
    let el;
    const v = values[d.id] ?? d.value ?? '';
    if (d.type === 'select') el = h('select', { class: 'select', id, name: d.id, 'aria-describedby': describedBy, required: !!d.required },
      h('option', { value: '' }, t('pp12.form.choose')), d.options.map(([val, lab]) => h('option', { value: val, selected: String(v) === String(val) }, lab)));
    else if (d.type === 'textarea') el = h('textarea', { class: 'input', id, name: d.id, rows: 3, maxlength: d.max || 500, 'aria-describedby': describedBy }, String(v));
    else el = h('input', { class: ['input', d.short && 'input-short'], id, name: d.id, type: d.type || 'text', value: String(v), inputmode: d.inputmode, maxlength: d.max, max: d.type === 'date' && d.noFuture ? localToday() : undefined,
      required: !!d.required, autocomplete: d.autocomplete || 'off', 'aria-describedby': describedBy });
    inputs[d.id] = el;
    errs[d.id] = h('span', { class: 'err', id: id + '-err', 'aria-live': 'polite' });
    return h('div', { class: ['field', d.wide && 'field-wide'] }, h('label', { for: id }, d.label, d.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
      d.hint ? h('span', { class: 'hint note', id: id + '-hint' }, d.hint) : null, el, errs[d.id]);
  });
  const summary = h('div', { class: 'errsum', role: 'alert', tabindex: '-1', hidden: true });
  const node = h('div', { class: 'formgrid pp-form' }, rows);
  return {
    node, summary, inputs,
    read: () => Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()])),
    set: vals => { for (const [k, el] of Object.entries(inputs)) el.value = vals?.[k] ?? ''; },
    show: (fields = {}) => {
      const keys = Object.keys(fields).filter(k => inputs[k]);
      for (const [k, el] of Object.entries(inputs)) { const code = fields[k]; el.setAttribute('aria-invalid', code ? 'true' : 'false'); errs[k].textContent = code ? t('pp12.err.' + code) : ''; }
      if (!keys.length) { summary.hidden = true; summary.replaceChildren(); return 0; }
      summary.hidden = false;
      summary.replaceChildren(h('p', null, h('strong', null, t('pp12.err.summary', { n: num(ctx, keys.length) }))),
        h('ul', null, keys.map(k => h('li', null, h('a', { href: '#' + prefix + '-' + k, onclick: e => { e.preventDefault(); inputs[k].focus(); } }, defs.find(d => d.id === k)?.label, ': ', t('pp12.err.' + fields[k]))))));
      summary.focus();
      return keys.length;
    }
  };
}

/* ------------------------------------------------------------------ passport tab (inside My space) */

export function passportPanel(ctx, match) {
  const { t } = ctx;
  const q = match.query || {};
  const initial = Math.max(0, PASSPORT_TABS.indexOf(q.p));
  const region = dataRegion({ t, load: () => loadPassport(ctx), render: d => {
    const go = key => setHashQuery('/my', { tab: 'passport', p: key });
    const tabs = {
      overview: () => overviewPanel(ctx, d),
      competencies: () => competencyPanel(ctx, d),
      cpd: () => cpdPanel(ctx, d, region),
      wallet: () => walletPanel(ctx, d, region),
      logs: () => logsPanel(ctx, d, region),
      career: () => careerPanel(ctx, d),
      cv: () => cvPanel(ctx, d),
      export: () => exportPanel(ctx, d, region)
    };
    return h('div', { class: 'passport', dataset: { passport: 'root', entries: String(d.entries.length) } },
      passportHero(ctx, d),
      Tabs({ label: t('pp12.title'), initial: Math.max(0, PASSPORT_TABS.indexOf(region.tab || q.p)), lazy: true, tabs: PASSPORT_TABS.map(k => ({ key: 'pp-' + k, label: t('pp12.tabs.' + k), content: tabs[k] })),
        onSelect: i => { region.tab = PASSPORT_TABS[i]; go(PASSPORT_TABS[i]); } }));
  } });
  region.tab = PASSPORT_TABS[initial];
  return region;
}

function passportHero(ctx, d) {
  const { t, i18n } = ctx;
  const c = P.statusCounts(d.entries);
  const year = d.today.slice(0, 4);
  const tot = P.cpdTotals(d.cpd);
  const badges = P.earnedBadges({ logs: d.logs, cpd: d.cpd, labAttempts: d.learner.labAttempts, verifications: d.verifications, today: d.today });
  return h('section', { class: 'pp-hero', 'aria-labelledby': 'pp-h' },
    h('div', { class: 'pp-hero-art' }, academyBanner('guide', 'award', 'passport')),
    h('div', { class: 'pp-hero-text' },
      h('h2', { id: 'pp-h' }, icon('award'), ' ', t('pp12.title')),
      h('p', null, t('pp12.lede')),
      h('p', { class: 'banner banner-info pp-label', role: 'note', dataset: { passportLabel: 'true' } }, L(ctx, P.PASSPORT_LABEL)),
      h('ul', { class: 'pp-counts', 'aria-label': t('pp12.countsLabel') }, P.EVIDENCE.map(s => h('li', { dataset: { count: s } }, statusBadge(ctx, s), ' ', h('strong', null, num(ctx, c[s] || 0))))),
      h('p', { class: 'note', dataset: { cpdYear: String(tot.byYear[year]?.total || 0) } }, t('pp12.cpdYear', { y: i18n.digitize(year), n: num(ctx, tot.byYear[year]?.total || 0), all: num(ctx, tot.total) })),
      badges.length ? h('p', { class: 'pp-badges', dataset: { badges: String(badges.length) } }, h('span', { class: 'note' }, t('pp12.badges.title'), ' '),
        badges.map(b => h('span', { class: 'badge badge-gold', dataset: { badge: b.id }, title: t('pp12.badges.notCert') }, icon('star'), ' ', t('pp12.badges.' + b.id))), ' ', h('span', { class: 'note' }, t('pp12.badges.notCert'))) : null));
}

/* ---------- overview: every entry with its status */

function overviewPanel(ctx, d) {
  const { t } = ctx;
  const figs = d.figsFor('passport:main');
  const rules = h('details', { class: 'pp-rules', dataset: { rules: 'statuses' } }, h('summary', null, icon('info'), ' ', t('pp12.rulesTitle')),
    h('dl', { class: 'pp-statuses' }, P.EVIDENCE.map(s => h('div', null, h('dt', null, statusBadge(ctx, s)), h('dd', null, t('pp12.statusWhy.' + s))))),
    h('p', { class: 'note' }, t('pp12.rulesNote')), figs.map(f => Figure(ctx, f)));
  if (!d.entries.length) {
    const c = starterCourse(d.content.courses, 'iso');
    return h('div', { dataset: { empty: 'passport' } },
      h('section', { class: 'panel feature', 'aria-labelledby': 'pp-empty-h' }, h('h2', { id: 'pp-empty-h' }, t('pp12.empty.title')), h('p', null, t('pp12.empty.body')),
        h('ul', { class: 'cards pp-start' }, [
          c ? ['book', t('pp12.empty.course'), `#/academy/courses/${c.slug}`, 'start-course'] : null,
          ['flask', t('pp12.empty.lab'), '#/labs', 'open-labs'],
          ['clock', t('pp12.empty.cpd'), '#/my?tab=passport&p=cpd', 'add-cpd'],
          ['award', t('pp12.empty.credential'), '#/my?tab=passport&p=wallet', 'add-credential']
        ].filter(Boolean).map(([ic, label, href, act], i) => h('li', { class: 'card' }, h('p', null, icon(ic)), h('h3', null, label), linkBtn(href, t('pp12.empty.go'), i ? 'secondary' : 'primary', { 'data-action': act }))))),
      rules);
  }
  let fStatus = '', fKind = '';
  const list = h('ul', { class: 'plain pp-entries' });
  const paint = () => {
    const xs = d.entries.filter(e => (!fStatus || e.status === fStatus) && (!fKind || e.kind === fKind));
    list.replaceChildren(...(xs.length ? xs.map(e => entryRow(ctx, e)) : [h('li', { class: 'note' }, t('pp12.noMatch'))]));
    list.dataset.shown = String(xs.length);
  };
  const sSel = h('select', { class: 'select select-sm', id: 'pp-f-status', onchange: e => { fStatus = e.target.value; paint(); } }, h('option', { value: '' }, t('pp12.filter.all')), P.EVIDENCE.map(s => h('option', { value: s }, t('pp12.status.' + s))));
  const kinds = [...new Set(d.entries.map(e => e.kind))];
  const kSel = h('select', { class: 'select select-sm', id: 'pp-f-kind', onchange: e => { fKind = e.target.value; paint(); } }, h('option', { value: '' }, t('pp12.filter.allKinds')), kinds.map(k => h('option', { value: k }, t('pp12.kind.' + k))));
  paint();
  return h('div', null,
    h('section', { class: 'section', 'aria-labelledby': 'pp-entries-h' }, h('h2', { id: 'pp-entries-h' }, t('pp12.entriesTitle', { n: num(ctx, d.entries.length) })),
      h('div', { class: 'filters pp-filters' }, h('label', { for: 'pp-f-status' }, t('pp12.filter.status')), sSel, h('label', { for: 'pp-f-kind' }, t('pp12.filter.kind')), kSel),
      list, h('p', { class: 'note' }, t('pp12.deviceNote'))),
    rules,
    h('div', { class: 'btnrow' }, linkBtn('#/passport/print', t('pp12.print'), 'secondary', { 'data-action': 'passport-print' }), isReviewer(ctx) ? linkBtn('#/review/evidence', t('pp12.review.title'), 'secondary', { 'data-action': 'open-evidence-review' }) : null));
}

function entryDetail(ctx, e) {
  const { t } = ctx;
  const x = e.detail || {};
  switch (e.kind) {
    case 'course': return x.state !== 'completed' ? t('pp12.d.courseProgress', { done: num(ctx, x.done || 0), n: num(ctx, x.lessons || 0) })
      : t('pp12.d.course', { n: num(ctx, x.lessons || 0), h: num(ctx, x.hours || 0) }) + (x.final ? ' · ' + t('pp12.d.finalPassed') : ' · ' + t('pp12.d.noFinal'));
    case 'assessment': return [t('pp12.d.score', { n: num(ctx, x.score) }), x.passed ? t('pp12.d.passed') : null, x.awaiting ? t('pp12.d.awaiting', { n: num(ctx, x.awaiting) }) : null, x.kind ? t('p7.asmKind.' + x.kind) : null].filter(Boolean).join(' · ');
    case 'lab': return [t('pp12.d.score', { n: num(ctx, x.score) }), x.mark_met ? t('lab11.metMark') : null, x.awaiting ? t('pp12.d.awaiting', { n: num(ctx, x.awaiting) }) : null,
      x.reviewed ? t('pp12.d.reviewed', { n: num(ctx, x.reviewed), who: x.reviewers.join(', ') }) : null].filter(Boolean).join(' · ');
    case 'document': return t('pp12.d.document', { tpl: L(ctx, x.template), v: num(ctx, x.version) });
    case 'certificate': return t('pp12.d.certificate', { no: x.number });
    case 'credential': return t('pp12.d.credential', { issuer: x.issuer }) + ' · ' + t('pp12.cred.state.' + x.state);
    case 'cpd': return t('pp12.d.cpd', { h: num(ctx, x.hours), cat: t('pp12.cpd.cat.' + x.category) });
    case 'log': return t('pp12.log.kind.' + x.log) + ' · ' + t('pp12.log.state.' + x.state);
    default: return '';
  }
}

function entryRow(ctx, e) {
  const { t } = ctx;
  const title = L(ctx, e.title) || e.id;
  const v = e.verification;
  return h('li', { class: 'card pp-entry', dataset: { entry: e.key, status: e.status, kind: e.kind } },
    h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, icon(KIND_ICON[e.kind] || 'doc'), ' ', t('pp12.kind.' + e.kind)), ' ', statusBadge(ctx, e.status)),
    h('h3', { class: 'h-sm' }, e.href ? h('a', { href: e.href }, title) : title),
    h('p', { class: 'note' }, fmtDate(ctx, e.date), ' · ', entryDetail(ctx, e)),
    v && v.decision === 'verified' ? h('p', { class: 'note pp-verified', dataset: { verifiedBy: v.reviewer } }, icon('check'), ' ', t(e.kind === 'credential' ? 'pp12.v.issuerChecked' : 'pp12.v.line', { who: v.reviewer, d: fmtDate(ctx, v.date), m: t('pp12.method.' + v.method) })) : null,
    v && v.decision === 'rejected' ? h('p', { class: 'note' }, t('pp12.v.rejected', { who: v.reviewer, d: fmtDate(ctx, v.date) })) : null);
}

/* ---------- competency record + radar */

function competencyPanel(ctx, d) {
  const { t } = ctx;
  const { content, learner } = d;
  const role = learner.profile?.target_role ? content.rolesAll.find(r => r.id === learner.profile.target_role) || null : null;
  const rows = P.competencyRecord({ competencies: content.competencies, role, assessments: content.assessments, attempts: learner.attempts, labs: content.labs, labAttempts: learner.labAttempts,
    selfLevels: learner.selfLevels, evidence: learner.evidence, verifications: d.verifications, today: d.today });
  const intro = role ? h('p', null, t('pp12.comp.forRole', { role: L(ctx, role.name) })) : h('p', { class: 'banner banner-info' }, t('pp12.comp.noRole'), ' ', h('a', { href: '#/my?tab=profile' }, t('pp12.comp.setRole')));
  if (!rows.length) return h('section', { class: 'section', 'aria-labelledby': 'pp-comp-h' }, h('h2', { id: 'pp-comp-h' }, t('pp12.comp.title')), intro,
    h('div', { class: 'panel' }, h('p', null, t('pp12.comp.none')), h('div', { class: 'btnrow' }, linkBtn('#/assessments', t('nav.items.assessments'), 'primary'), linkBtn('#/labs', t('lab11.indexTitle')))));
  const axes = P.radarAxes(rows, content.domains);
  const radar = axes.length >= 3 ? Radar({ axes: axes.map(a => ({ label: L(ctx, a.domain.short || a.domain.name), target: a.target, current: a.current })), title: t('pp12.comp.radar'), targetLabel: t('p7.comp.target'), currentLabel: t('p7.comp.current') }) : h('p', { class: 'note' }, t('p7.comp.radarFew'));
  const res = r => r ? h('span', null, num(ctx, r.percent) + '%', h('br'), h('span', { class: 'note' }, fmtDate(ctx, r.at)), r.awaiting ? [h('br'), h('span', { class: 'note' }, t('pp12.d.awaiting', { n: num(ctx, r.awaiting) }))] : null) : h('span', { class: 'note' }, '—');
  const table = Table({ caption: t('pp12.comp.table'), columns: [
    { key: 'c', label: t('pf.thCompetency') }, { key: 'k', label: t('pp12.comp.knowledge') }, { key: 's', label: t('pp12.comp.scenario') }, { key: 'p', label: t('pp12.comp.practical') },
    { key: 'l', label: t('pp12.comp.level') }, { key: 'st', label: t('pp12.comp.status') }, { key: 'v', label: t('pp12.comp.method') }, { key: 'd', label: t('pp12.comp.dates') }],
  rows: rows.map(r => ({
    c: h('span', { dataset: { compRow: r.id } }, h('span', { class: 'cid' }, r.id), ' ', L(ctx, r.competency?.name), r.target ? [h('br'), h('span', { class: 'note' }, t('pp12.comp.target', { n: ctx.i18n.digitize(r.target) }))] : null),
    k: res(r.knowledge), s: res(r.scenario), p: res(r.practical),
    l: LevelMeter({ level: r.level, label: r.source === 'insufficient' ? t('pf.notAssessed') : t('p7.comp.levelFrom', { n: ctx.i18n.digitize(r.level), src: t('p7.comp.src.' + r.source) }) }),
    st: r.status ? statusBadge(ctx, r.status) : h('span', { class: 'note' }, t('pp12.comp.noEvidence')),
    v: r.method ? h('span', null, t('pp12.method.' + r.method), r.verification ? [h('br'), h('span', { class: 'note' }, r.verification.reviewer)] : null) : '—',
    d: r.date ? h('span', null, fmtDate(ctx, r.date), h('br'), h('span', { class: ['note', r.due && 'pp-due'] }, t(r.due ? 'pp12.comp.reassessDue' : 'pp12.comp.reassess', { d: fmtDate(ctx, r.reassess) }))) : '—'
  })) });
  return h('div', null,
    h('section', { class: 'section', 'aria-labelledby': 'pp-comp-h' }, h('h2', { id: 'pp-comp-h' }, t('pp12.comp.title')), intro,
      h('div', { class: 'split' }, radar, h('div', null, h('p', { class: 'note' }, t('pp12.comp.radarNote')), Table({ caption: t('p7.comp.domainTable'), columns: [{ key: 'd', label: t('pf.thDomain') }, { key: 't', label: t('p7.comp.target'), num: true }, { key: 'c', label: t('p7.comp.current'), num: true }],
        rows: axes.map(a => ({ d: L(ctx, a.domain.name), t: num(ctx, a.target), c: num(ctx, a.current) })) })))),
    h('section', { class: 'section', 'aria-labelledby': 'pp-comp-t' }, h('h2', { id: 'pp-comp-t' }, t('pp12.comp.table')), h('div', { class: 'tablewrap' }, table), h('p', { class: 'note' }, t('pp12.comp.rule'))));
}

/* ---------- CPD log */

function cpdPanel(ctx, d, region) {
  const { t, i18n } = ctx;
  const sugg = P.cpdSuggestions({ courses: d.content.courses, progress: d.learner.progress, attempts: d.learner.attempts, labs: d.content.labs, labAttempts: d.learner.labAttempts, certificates: d.certificates, cpd: d.cpd, dismissed: d.dismissed });
  const compIds = d.content.competencies.map(c => c.id);
  const defs = [
    { id: 'title', label: t('pp12.cpd.f.title'), required: true, max: 160, wide: true },
    { id: 'category', label: t('pp12.cpd.f.category'), type: 'select', required: true, options: P.CPD_CATEGORIES.map(c => [c, t('pp12.cpd.cat.' + c)]) },
    { id: 'date', label: t('pp12.cpd.f.date'), type: 'date', required: true, noFuture: true, value: d.today },
    { id: 'hours', label: t('pp12.cpd.f.hours'), required: true, inputmode: 'decimal', short: true, hint: t('pp12.cpd.f.hoursHint') },
    { id: 'provider', label: t('pp12.cpd.f.provider'), max: 120 },
    { id: 'competency', label: t('pp12.cpd.f.competency'), type: 'select', options: d.content.competencies.map(c => [c.id, `${c.id} · ${L(ctx, c.name)}`]) },
    { id: 'certification', label: t('pp12.cpd.f.certification'), max: 80, hint: t('pp12.cpd.f.certificationHint') },
    { id: 'evidence_url', label: t('pp12.cpd.f.url'), type: 'url', hint: t('pp12.cpd.f.urlHint') },
    { id: 'evidence_note', label: t('pp12.cpd.f.note'), type: 'textarea', wide: true }
  ];
  const f = formKit(ctx, 'cpd', defs);
  let editing = null;
  const heading = h('h2', { id: 'cpd-form-h' }, t('pp12.cpd.add'));
  const save = async () => {
    const { errors } = P.validateCpd(f.read(), { today: localToday(), competencyIds: compIds });
    if (f.show(errors)) return;
    const rec = P.makeCpd({ ...f.read(), source: editing?.source || null }, { today: localToday(), competencyIds: compIds, existing: editing });
    await ctx.repos.cpd.save(rec); toast(t('pp12.cpd.saved')); region.tab = 'cpd'; region.refresh();
  };
  const startEdit = x => { editing = x; f.set({ ...x, hours: String(x.hours) }); heading.textContent = t('pp12.cpd.edit'); f.inputs.title.focus(); };
  const remove = x => openDialog({ title: t('pp12.cpd.deleteTitle'), body: t('pp12.cpd.deleteBody', { name: x.title }), closeLabel: t('settings.data.cancel'), actions: [
    { label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('pp12.delete'), variant: 'danger', onClick: async () => { await ctx.repos.cpd.remove(x.id); toast(t('pp12.cpd.deleted')); region.tab = 'cpd'; region.refresh(); } }] });
  const confirm = async (s, hoursIn) => {
    const hrs = hoursIn.value.trim();
    const { errors } = P.validateCpd({ title: L(ctx, s.title), category: s.category, date: s.date || localToday(), hours: hrs }, { today: localToday() });
    if (errors.hours) { hoursIn.setAttribute('aria-invalid', 'true'); toast(t('pp12.err.' + errors.hours)); hoursIn.focus(); return; }
    await ctx.repos.cpd.save(P.confirmSuggestion(s, { hours: hrs }, { lang: i18n.locale, today: localToday() })); toast(t('pp12.cpd.confirmed')); region.tab = 'cpd'; region.refresh();
  };
  const dismiss = async s => { await ctx.repos.passportPrefs.save({ id: 'cpd', dismissed: [...new Set([...d.dismissed, s.key])] }); toast(t('pp12.cpd.dismissed')); region.tab = 'cpd'; region.refresh(); };
  const tot = P.cpdTotals(d.cpd);
  const years = Object.keys(tot.byYear).sort().reverse();
  const cats = P.CPD_CATEGORIES.filter(c => tot.byCategory[c]);
  const csv = () => { download(`cia-cpd-${localToday()}.csv`, P.cpdCsv(d.cpd, { labels: { ...Object.fromEntries(P.CPD_COLUMNS.map(c => [c, t('pp12.cpd.col.' + c)])), ...Object.fromEntries(P.CPD_CATEGORIES.map(c => ['cat.' + c, t('pp12.cpd.cat.' + c)])) },
    statusOf: x => t('pp12.status.' + (d.entries.find(e => e.key === 'cpd:' + x.id)?.status || 'self_declared')) }), 'text/csv;charset=utf-8'); toast(t('pp12.cpd.csvDone')); };
  return h('div', { class: 'pp-cpd' },
    h('p', { class: 'banner banner-info', role: 'note', dataset: { cpdNote: 'true' } }, t('pp12.cpd.honesty')),
    d.figsFor('passport:cpd').map(f => Figure(ctx, f)),
    h('section', { class: 'section', 'aria-labelledby': 'cpd-sum-h' }, h('h2', { id: 'cpd-sum-h' }, t('pp12.cpd.totals')),
      h('p', { dataset: { cpdTotal: String(tot.total) } }, t('pp12.cpd.totalLine', { n: num(ctx, tot.total), c: num(ctx, tot.count) })),
      years.length ? h('div', { class: 'tablewrap' }, Table({ caption: t('pp12.cpd.byYear'), columns: [{ key: 'y', label: t('pp12.cpd.year') }, ...cats.map(c => ({ key: c, label: t('pp12.cpd.cat.' + c), num: true })), { key: 'tot', label: t('pp12.cpd.total'), num: true }],
        rows: years.map(y => ({ y: i18n.digitize(y), ...Object.fromEntries(cats.map(c => [c, num(ctx, tot.byYear[y].byCategory[c] || 0)])), tot: h('strong', { dataset: { cpdYearTotal: y } }, num(ctx, tot.byYear[y].total)) })) })) : null,
      d.cpd.length ? h('div', { class: 'btnrow' }, Button({ label: t('pp12.cpd.csv'), variant: 'secondary', iconName: 'download', onClick: csv, attrs: { 'data-action': 'cpd-csv' } })) : null),
    sugg.length ? h('section', { class: 'section', 'aria-labelledby': 'cpd-sg-h' }, h('h2', { id: 'cpd-sg-h' }, t('pp12.cpd.suggestions', { n: num(ctx, sugg.length) })), h('p', { class: 'note' }, t('pp12.cpd.suggestionsNote')),
      h('ul', { class: 'plain pp-sugg' }, sugg.map((s, i) => {
        const hin = h('input', { class: 'input input-short', id: 'sg-h-' + i, inputmode: 'decimal', value: String(s.hours) });
        return h('li', { class: 'card', dataset: { suggestion: s.key } }, h('h3', { class: 'h-sm' }, L(ctx, s.title)),
          h('p', { class: 'note' }, t('pp12.cpd.src.' + s.source.type), ' · ', fmtDate(ctx, s.date), s.certificate_number ? ' · ' + s.certificate_number : ''),
          h('div', { class: 'btnrow' }, h('label', { for: 'sg-h-' + i }, t('pp12.cpd.f.hours')), hin,
            Button({ label: t('pp12.cpd.confirm'), variant: 'primary', onClick: () => confirm(s, hin), attrs: { 'data-action': 'confirm-suggestion' } }),
            Button({ label: t('pp12.cpd.dismiss'), variant: 'quiet', onClick: () => dismiss(s), attrs: { 'data-action': 'dismiss-suggestion' } })));
      }))) : null,
    h('section', { class: 'section', 'aria-labelledby': 'cpd-list-h' }, h('h2', { id: 'cpd-list-h' }, t('pp12.cpd.list')),
      d.cpd.length ? h('ul', { class: 'plain pp-list' }, [...d.cpd].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(x => {
        const e = d.entries.find(y => y.key === 'cpd:' + x.id);
        return h('li', { class: 'card', dataset: { cpd: x.id } }, h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, t('pp12.cpd.cat.' + x.category)), ' ', e ? statusBadge(ctx, e.status) : null),
          h('h3', { class: 'h-sm' }, x.title), h('p', { class: 'note' }, fmtDate(ctx, x.date), ' · ', t('pp12.cpd.hoursN', { n: num(ctx, x.hours) }), x.provider ? ' · ' + x.provider : '', x.competency ? ' · ' + x.competency : '', x.certification ? ' · ' + x.certification : ''),
          x.evidence_url ? h('p', { class: 'note' }, h('a', { href: x.evidence_url, target: '_blank', rel: 'noopener noreferrer' }, t('pp12.cpd.evidenceLink'))) : null,
          h('div', { class: 'btnrow' }, Button({ label: t('pp12.edit'), variant: 'secondary', onClick: () => startEdit(x), attrs: { 'data-action': 'edit-cpd', 'aria-label': t('pp12.editNamed', { name: x.title }) } }),
            Button({ label: t('pp12.delete'), variant: 'quiet', onClick: () => remove(x), attrs: { 'data-action': 'delete-cpd', 'aria-label': t('pp12.deleteNamed', { name: x.title }) } })));
      })) : h('p', { class: 'note' }, t('pp12.cpd.empty'))),
    h('section', { class: 'section panel', 'aria-labelledby': 'cpd-form-h' }, heading, f.summary, f.node,
      h('div', { class: 'btnrow' }, Button({ label: t('pp12.cpd.save'), variant: 'primary', onClick: save, attrs: { 'data-action': 'save-cpd' } }),
        Button({ label: t('pp12.form.clear'), variant: 'quiet', onClick: () => { editing = null; f.set({ date: localToday() }); f.show({}); heading.textContent = t('pp12.cpd.add'); }, attrs: { 'data-action': 'clear-cpd' } }))));
}

/* ---------- credential wallet */

function walletPanel(ctx, d, region) {
  const { t } = ctx;
  const w = P.walletEntries({ certificates: d.certificates, credentials: d.credentials, verifications: d.verifications, today: d.today });
  const defs = [
    { id: 'type', label: t('pp12.cred.f.type'), type: 'select', required: true, options: P.CREDENTIAL_TYPES.map(c => [c, t('pp12.cred.type.' + c)]) },
    { id: 'name', label: t('pp12.cred.f.name'), required: true, max: 160, wide: true },
    { id: 'issuer', label: t('pp12.cred.f.issuer'), required: true, max: 120 },
    { id: 'issued', label: t('pp12.cred.f.issued'), type: 'date', required: true, noFuture: true },
    { id: 'expires', label: t('pp12.cred.f.expires'), type: 'date' },
    { id: 'credential_id', label: t('pp12.cred.f.id'), max: 80 },
    { id: 'verify_url', label: t('pp12.cred.f.verify'), type: 'url', hint: t('pp12.cred.f.verifyHint') },
    { id: 'evidence_url', label: t('pp12.cred.f.evUrl'), type: 'url' },
    { id: 'evidence_note', label: t('pp12.cred.f.evNote'), type: 'textarea', wide: true, hint: t('pp12.cred.f.evNoteHint') }
  ];
  const f = formKit(ctx, 'cr', defs);
  let editing = null;
  const heading = h('h2', { id: 'cr-form-h' }, t('pp12.cred.add'));
  const refresh = () => { region.tab = 'wallet'; region.refresh(); };
  const save = async () => {
    const { errors } = P.validateCredential(f.read(), localToday());
    if (f.show(errors)) return;
    await ctx.repos.credentials.save(P.saveCredential(f.read(), { existing: editing, today: localToday() })); toast(t('pp12.cred.saved')); refresh();
  };
  const own = new Map(d.credentials.map(c => [c.id, c]));
  const row = x => {
    if (x.kind === 'cia_completion') return h('li', { class: 'card', dataset: { wallet: 'cia', certificate: x.id } },
      h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, icon('medal'), ' ', t('pp12.cred.ciaType')), ' ', statusBadge(ctx, d.entries.find(e => e.key === x.key)?.status || 'self_declared')),
      h('h3', { class: 'h-sm' }, L(ctx, x.name)), h('p', { class: 'note' }, t('pp12.cred.ciaLine', { no: x.number, d: fmtDate(ctx, x.issued) })), h('p', { class: 'note' }, t('pp12.cred.ciaNote')));
    const c = own.get(x.id);
    const trail = P.credentialTrail(c, P.verificationFor(d.verifications, 'credential', c.id, d.today), d.today);
    return h('li', { class: 'card', dataset: { credential: x.id, state: x.state } },
      h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, t('pp12.cred.type.' + x.type)), ' ', h('span', { class: `badge badge-${CRED_TONE[x.state]}`, dataset: { credState: x.state } }, t('pp12.cred.state.' + x.state)), ' ', statusBadge(ctx, x.evidence_status)),
      h('h3', { class: 'h-sm' }, x.name),
      h('p', { class: 'note' }, t('pp12.cred.issuedBy', { issuer: x.issuer, d: fmtDate(ctx, x.issued) }), x.expires ? ' · ' + t('pp12.cred.expiresOn', { d: fmtDate(ctx, x.expires) }) : '', x.number ? ' · ' + x.number : ''),
      x.expiring_soon ? h('p', { class: 'note pp-due' }, t('pp12.cred.expiringSoon')) : null,
      x.checked_by ? h('p', { class: 'note pp-verified' }, icon('check'), ' ', t('pp12.v.issuerChecked', { who: x.checked_by.reviewer, d: fmtDate(ctx, x.checked_by.date), m: t('pp12.method.' + x.checked_by.method) })) : null,
      h('p', { class: 'note' }, t('pp12.cred.issuerNote', { issuer: x.issuer })),
      h('details', null, h('summary', null, t('pp12.cred.trail')), h('ol', { class: 'pp-trail' }, trail.map(e => h('li', null, fmtDate(ctx, e.at), ' — ', t('pp12.cred.event.' + e.event), e.by && e.by !== 'learner' && e.by !== 'system' ? ' · ' + e.by : '')))),
      h('div', { class: 'btnrow' },
        x.verify_url ? h('a', { class: 'btn btn-secondary', href: x.verify_url, target: '_blank', rel: 'noopener noreferrer', dataset: { action: 'verify-at-issuer' } }, icon('external'), ' ', t('pp12.cred.verifyAt', { issuer: x.issuer })) : null,
        x.state === 'evidence_uploaded' ? Button({ label: t('pp12.cred.request'), variant: 'secondary', onClick: async () => { await ctx.repos.credentials.save(P.requestVerification(c)); toast(t('pp12.cred.requested')); refresh(); }, attrs: { 'data-action': 'request-verification' } }) : null,
        Button({ label: t('pp12.edit'), variant: 'secondary', onClick: () => { editing = c; f.set(c); heading.textContent = t('pp12.cred.edit'); f.inputs.name.focus(); }, attrs: { 'data-action': 'edit-credential', 'aria-label': t('pp12.editNamed', { name: x.name }) } }),
        Button({ label: t('pp12.delete'), variant: 'quiet', attrs: { 'data-action': 'delete-credential', 'aria-label': t('pp12.deleteNamed', { name: x.name }) }, onClick: () => openDialog({ title: t('pp12.cred.deleteTitle'), body: t('pp12.cred.deleteBody', { name: x.name }), closeLabel: t('settings.data.cancel'),
          actions: [{ label: t('settings.data.cancel'), variant: 'secondary' }, { label: t('pp12.delete'), variant: 'danger', onClick: async () => { await ctx.repos.credentials.remove(c.id); toast(t('pp12.cred.deleted')); refresh(); } }] }) })));
  };
  return h('div', { class: 'pp-wallet' },
    h('p', { class: 'banner banner-info', role: 'note', dataset: { walletNote: 'true' } }, t('pp12.cred.honesty')),
    h('section', { class: 'section', 'aria-labelledby': 'cr-list-h' }, h('h2', { id: 'cr-list-h' }, t('pp12.cred.title', { n: num(ctx, w.length) })),
      w.length ? h('ul', { class: 'plain pp-list' }, w.map(row)) : h('p', { class: 'note' }, t('pp12.cred.empty'), ' ', h('a', { href: '#/academy/courses' }, t('pp12.cred.emptyCourses'))),
      h('details', { class: 'pp-rules' }, h('summary', null, t('pp12.cred.statesTitle')), h('dl', { class: 'pp-statuses' }, P.CREDENTIAL_STATES.map(s => h('div', null, h('dt', null, h('span', { class: `badge badge-${CRED_TONE[s]}` }, t('pp12.cred.state.' + s))), h('dd', null, t('pp12.cred.stateWhy.' + s))))))),
    h('section', { class: 'section panel', 'aria-labelledby': 'cr-form-h' }, heading, f.summary, f.node,
      h('div', { class: 'btnrow' }, Button({ label: t('pp12.cred.save'), variant: 'primary', onClick: save, attrs: { 'data-action': 'save-credential' } }),
        Button({ label: t('pp12.form.clear'), variant: 'quiet', onClick: () => { editing = null; f.set({}); f.show({}); heading.textContent = t('pp12.cred.add'); } }))));
}

/* ---------- specialized passports (auditor · consultant · trainer) */

const LOG_DEFS = (ctx, kind) => {
  const { t } = ctx;
  const sel = (id, opts) => ({ id, type: 'select', label: t(`pp12.log.f.${id}`), options: opts.map(o => [o, t(`pp12.log.opt.${id}.${o}`)]) });
  const common = [{ id: 'date', type: 'date', label: t('pp12.log.f.date'), required: true, noFuture: true }, { id: 'evidence_url', type: 'url', label: t('pp12.log.f.evidence_url') }, { id: 'evidence_note', type: 'textarea', label: t('pp12.log.f.evidence_note'), wide: true, hint: t('pp12.log.f.evidenceHint') }];
  const txt = (id, max, extra = {}) => ({ id, label: t('pp12.log.f.' + id), max, ...extra });
  const n = (id, extra = {}) => ({ id, label: t('pp12.log.f.' + id), inputmode: 'decimal', short: true, ...extra });
  const req = x => ({ ...x, required: true });
  if (kind === 'auditor') return [req(sel('audit_type', P.AUDIT_TYPES)), req(txt('standard', 60, { hint: t('pp12.log.f.standardHint') })), txt('industry', 80), req(sel('role', P.AUDIT_ROLES)), req(n('days')), n('findings', { inputmode: 'numeric' }), txt('scope', 200, { wide: true }), ...common];
  if (kind === 'consultant') return [req(txt('project', 120, { wide: true })), txt('standard', 60), txt('industry', 80), req({ id: 'role', type: 'select', label: t('pp12.log.f.role'), options: P.CONSULT_ROLES.map(o => [o, t('pp12.log.opt.crole.' + o)]) }), req(n('months')), txt('scope', 200, { wide: true }), txt('deliverables', 300, { wide: true }), ...common];
  return [req(txt('course', 120, { wide: true })), txt('subjects', 160), req(n('hours')), req(n('participants', { inputmode: 'numeric' })), txt('organization', 120), n('rating', { hint: t('pp12.log.f.ratingHint') }), ...common];
};

function logsPanel(ctx, d, region) {
  const { t } = ctx;
  const tot = P.logTotals(d.logs, d.verifications, d.today);
  const badges = P.earnedBadges({ logs: d.logs, cpd: d.cpd, labAttempts: d.learner.labAttempts, verifications: d.verifications, today: d.today });
  const block = kind => {
    const defs = LOG_DEFS(ctx, kind);
    const f = formKit(ctx, 'lg-' + kind, defs);
    let editing = null;
    const xs = d.logs.filter(x => x.kind === kind).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const heading = h('h3', { id: `lg-${kind}-form-h` }, t('pp12.log.add.' + kind));
    const save = async () => {
      const { errors } = P.validateLog(kind, f.read(), localToday());
      if (f.show(errors)) return;
      await ctx.repos.practiceLogs.save(P.makeLog(kind, f.read(), { existing: editing, today: localToday() })); toast(t('pp12.log.saved')); region.tab = 'logs'; region.refresh();
    };
    const line = x => kind === 'auditor' ? t('pp12.log.line.auditor', { type: t('pp12.log.opt.audit_type.' + x.audit_type), role: t('pp12.log.opt.role.' + x.role), days: num(ctx, x.days), f: num(ctx, x.findings ?? 0) })
      : kind === 'consultant' ? t('pp12.log.line.consultant', { role: t('pp12.log.opt.crole.' + x.role), m: num(ctx, x.months) }) : t('pp12.log.line.trainer', { h: num(ctx, x.hours), p: num(ctx, x.participants) });
    const summary = kind === 'auditor' ? t('pp12.log.tot.auditor', { n: num(ctx, tot.auditor.entries), d: num(ctx, tot.auditor.days), f: num(ctx, tot.auditor.findings), v: num(ctx, tot.auditor.verified) })
      : kind === 'consultant' ? t('pp12.log.tot.consultant', { n: num(ctx, tot.consultant.entries), m: num(ctx, tot.consultant.months), v: num(ctx, tot.consultant.verified) })
        : t('pp12.log.tot.trainer', { n: num(ctx, tot.trainer.entries), h: num(ctx, tot.trainer.hours), p: num(ctx, tot.trainer.participants), v: num(ctx, tot.trainer.verified) });
    return h('section', { class: 'section', 'aria-labelledby': 'lg-' + kind + '-h', dataset: { logKind: kind, logCount: String(xs.length) } },
      h('h2', { id: 'lg-' + kind + '-h' }, icon(kind === 'auditor' ? 'magnify' : kind === 'consultant' ? 'briefcase' : 'users'), ' ', t('pp12.log.kind.' + kind)),
      h('p', { class: 'note' }, t('pp12.log.about.' + kind)), h('p', null, summary),
      xs.length ? h('ul', { class: 'plain pp-list' }, xs.map(x => {
        const v = P.verificationFor(d.verifications, 'log', x.id, d.today);
        const st = P.logState(x, v, d.today);
        const title = kind === 'auditor' ? x.standard : kind === 'consultant' ? x.project : x.course;
        return h('li', { class: 'card', dataset: { log: x.id, state: st } }, h('div', { class: 'pp-entry-head' }, h('span', { class: `badge badge-${LOG_TONE[st]}` }, t('pp12.log.state.' + st)), ' ', statusBadge(ctx, P.evidenceStatus('log', 'self_declared', v, d.today))),
          h('h3', { class: 'h-sm' }, title), h('p', { class: 'note' }, fmtDate(ctx, x.date), ' · ', line(x)),
          v?.decision === 'verified' ? h('p', { class: 'note pp-verified' }, icon('check'), ' ', t('pp12.v.line', { who: v.reviewer, d: fmtDate(ctx, v.date), m: t('pp12.method.' + v.method) })) : null,
          h('div', { class: 'btnrow' }, Button({ label: t('pp12.edit'), variant: 'secondary', onClick: () => { editing = x; f.set(Object.fromEntries(Object.entries(x).map(([k, val]) => [k, val ?? '']))); heading.textContent = t('pp12.log.edit'); }, attrs: { 'data-action': 'edit-log', 'aria-label': t('pp12.editNamed', { name: title }) } }),
            Button({ label: t('pp12.delete'), variant: 'quiet', attrs: { 'data-action': 'delete-log', 'aria-label': t('pp12.deleteNamed', { name: title }) }, onClick: () => openDialog({ title: t('pp12.log.deleteTitle'), body: t('pp12.log.deleteBody', { name: title }), closeLabel: t('settings.data.cancel'),
              actions: [{ label: t('settings.data.cancel'), variant: 'secondary' }, { label: t('pp12.delete'), variant: 'danger', onClick: async () => { await ctx.repos.practiceLogs.remove(x.id); toast(t('pp12.log.deleted')); region.tab = 'logs'; region.refresh(); } }] }) })));
      })) : h('p', { class: 'note' }, t('pp12.log.empty')),
      h('details', { class: 'panel pp-logform', open: !xs.length && kind === 'auditor' ? true : undefined }, h('summary', null, t('pp12.log.add.' + kind)), heading, f.summary, f.node,
        h('div', { class: 'btnrow' }, Button({ label: t('pp12.log.save'), variant: 'primary', onClick: save, attrs: { 'data-action': 'save-log-' + kind } }))));
  };
  return h('div', { class: 'pp-logs' },
    h('p', { class: 'banner banner-info', role: 'note' }, t('pp12.log.honesty')),
    badges.length ? h('p', null, badges.map(b => h('span', { class: 'badge badge-gold', dataset: { badge: b.id } }, icon('star'), ' ', t('pp12.badges.' + b.id))), ' ', h('span', { class: 'note' }, t('pp12.badges.notCert'))) : null,
    block('auditor'), block('consultant'), block('trainer'));
}

/* ---------- career roadmap */

function careerPanel(ctx, d) {
  const { t } = ctx;
  const r = dataRegion({ t, load: async () => {
    const model = await buildRecommendationModel(ctx).catch(() => null);
    const plan = await ctx.repos.careerPlan.get('me').catch(() => null);
    return { model, plan };
  }, render: ({ model, plan }) => roadmapView(ctx, d, model, plan, r) });
  return r;
}

export function roadmapModel(ctx, d, model, plan) {
  const { content, learner } = d;
  const profile = learner.profile;
  const role = profile?.target_role ? content.rolesAll.find(x => x.id === profile.target_role) || null : null;
  if (!role) return { role: null, profile };
  const vl = P.verifiedLevels(d.verifications, d.today);
  const gaps = calculateGaps({ role, competencies: content.competencies, selfLevels: learner.selfLevels, assessmentByCompetency: percentMap(learner.evidence), verifiedLevels: vl });
  const weekly = Number(d.studyPlan?.weekly_hours || profile.weekly_hours) || 4;
  const recOrder = (model?.recs || []).filter(x => x.recommendation_type === 'course').map(x => x.target_id);
  const rm = P.buildRoadmap({ gaps, courses: content.courses, labs: content.labs, completed: learner.completed, recOrder, weeklyHours: weekly, start: d.today, done: plan?.done || [] });
  return { role, profile, gaps, rm, weekly };
}

function roadmapView(ctx, d, model, plan, region) {
  const { t } = ctx;
  const m = roadmapModel(ctx, d, model, plan);
  const figs = d.figsFor('passport:roadmap');
  if (!m.role) return h('section', { class: 'section', 'aria-labelledby': 'cr-h', dataset: { roadmap: 'no-role' } }, h('h2', { id: 'cr-h' }, t('pp12.career.title')),
    h('div', { class: 'panel feature' }, h('p', null, t('pp12.career.noRole')), h('div', { class: 'btnrow' }, linkBtn(m.profile ? '#/my?tab=profile' : '#/welcome', t(m.profile ? 'pp12.career.setRole' : 'x10a.my.obCta'), 'primary', { 'data-action': 'set-target-role' }))),
    figs.map(f => Figure(ctx, f)));
  const { rm } = m;
  const target = h('input', { class: 'input input-short', id: 'career-target', type: 'date', value: plan?.target_date || '', min: d.today, 'aria-describedby': 'career-target-note' });
  const fit = h('p', { class: 'note', id: 'career-target-note', 'aria-live': 'polite' });
  const paintFit = () => { const v = target.value; fit.textContent = !v || !rm.finish ? t('pp12.career.targetHint') : v >= rm.finish ? t('pp12.career.fits', { d: ctx.i18n.date(rm.finish) }) : t('pp12.career.tight', { d: ctx.i18n.date(rm.finish), w: ctx.i18n.number(m.weekly) }); fit.dataset.fit = !v || !rm.finish ? '' : String(v >= rm.finish); };
  target.addEventListener('input', paintFit); paintFit();
  const savePlan = async (patch) => { const cur = await ctx.repos.careerPlan.get('me').catch(() => null); await ctx.repos.careerPlan.save(P.cleanCareer({ ...(cur || {}), ...patch, updated_at: new Date().toISOString() })); };
  const ms = rm.milestones.map(x => h('li', { class: ['card', 'pp-milestone', x.done && 'is-done'], dataset: { milestone: x.id, done: String(x.done) } },
    h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, t('pp12.career.milestone', { n: ctx.i18n.digitize(x.id.slice(1)) })), ' ',
      x.done ? h('span', { class: 'badge badge-ok' }, t('pp12.career.doneBadge')) : h('span', { class: 'note' }, t('pp12.career.due', { d: fmtDate(ctx, x.due), w: ctx.i18n.number(x.weeks) }))),
    h('h3', { class: 'h-sm' }, x.competencies.map(c => L(ctx, c.name)).join(' · ')),
    h('p', { class: 'note' }, x.competencies.map(c => t('pp12.career.gapLine', { id: c.id, cur: ctx.i18n.digitize(c.current), req: ctx.i18n.digitize(c.required) })).join(' · ')),
    x.actions.length ? h('ul', { class: 'plain pp-actions' }, x.actions.map(a => h('li', { dataset: { action: a.type } }, icon(a.type === 'lab' ? 'flask' : 'book'), ' ', h('a', { href: a.href }, L(ctx, a.title)), ' ', h('span', { class: 'note' }, t('pp12.career.hours', { n: num(ctx, a.hours) }))))) : h('p', { class: 'note' }, t('pp12.career.noAction')),
    x.unmatched.length ? h('p', { class: 'note' }, t('pp12.career.unmatched', { ids: x.unmatched.join(', ') })) : null,
    h('label', { class: 'choice' }, h('input', { type: 'checkbox', checked: x.done, dataset: { action: 'milestone-done' }, onchange: async e => {
      const cur = new Set(plan?.done || []); e.target.checked ? cur.add(x.id) : cur.delete(x.id); await savePlan({ done: [...cur] }); toast(t('pp12.career.saved')); region.refresh(); } }), ' ', t('pp12.career.markDone'))));
  return h('div', { class: 'pp-career', dataset: { roadmap: 'ready', milestones: String(rm.milestones.length), gaps: String(rm.gaps) } },
    h('section', { class: 'section', 'aria-labelledby': 'cr-h' }, h('h2', { id: 'cr-h' }, t('pp12.career.title')),
      h('div', { class: 'pp-route' }, h('div', { class: 'panel' }, h('p', { class: 'eyebrow' }, t('pp12.career.current')), h('p', { class: 'pp-role' }, m.profile.current_role || '—')),
        h('span', { class: 'pp-arrow', 'aria-hidden': 'true' }, icon('chevron')),
        h('div', { class: 'panel' }, h('p', { class: 'eyebrow' }, t('pp12.career.target')), h('p', { class: 'pp-role' }, L(ctx, m.role.name)), h('a', { class: 'note', href: '#/my?tab=profile' }, t('pp12.career.change')))),
      h('p', { dataset: { gapCount: String(rm.gaps) } }, rm.gaps ? t('pp12.career.summary', { g: num(ctx, rm.gaps), met: num(ctx, rm.met), h: num(ctx, rm.total_hours), w: num(ctx, rm.weeks), wh: num(ctx, m.weekly), d: rm.finish ? ctx.i18n.date(rm.finish) : '—' }) : t('pp12.career.noGaps')),
      h('p', { class: 'banner banner-info', role: 'note' }, t('pp12.career.oneRoute')),
      figs.map(f => Figure(ctx, f))),
    h('section', { class: 'section', 'aria-labelledby': 'cr-gaps-h' }, h('h2', { id: 'cr-gaps-h' }, t('pp12.career.gaps')), h('div', { class: 'tablewrap' }, GapTable(ctx, m.gaps.filter(g => g.gap > 0), { limit: 12 }))),
    h('section', { class: 'section', 'aria-labelledby': 'cr-ms-h' }, h('h2', { id: 'cr-ms-h' }, t('pp12.career.plan')),
      rm.milestones.length ? h('ol', { class: 'plain pp-milestones' }, ms) : h('p', { class: 'note' }, t('pp12.career.noGaps')),
      rm.remaining > 0 ? h('p', { class: 'note' }, t('pp12.career.more', { n: num(ctx, rm.remaining) })) : null),
    h('section', { class: 'section panel', 'aria-labelledby': 'cr-date-h' }, h('h2', { id: 'cr-date-h' }, t('pp12.career.when')),
      h('div', { class: 'field' }, h('label', { for: 'career-target' }, t('pp12.career.targetDate')), target), fit,
      h('div', { class: 'btnrow' }, Button({ label: t('pp12.career.save'), variant: 'primary', onClick: async () => { await savePlan({ target_date: target.value }); toast(t('pp12.career.saved')); }, attrs: { 'data-action': 'save-career' } }),
        linkBtn('#/my?tab=path', t('pp12.career.weekly'), 'secondary', { 'data-action': 'open-weekly-plan' })),
      h('p', { class: 'note' }, t('pp12.career.weeklyNote', { n: num(ctx, m.weekly) }))));
}

/* ---------- export / import */

function exportPanel(ctx, d, region) {
  const { t, i18n } = ctx;
  const result = h('div', { 'aria-live': 'polite', dataset: { importResult: '' } });
  const json = () => {
    const body = P.exportPassport({ cpd: d.cpd, credentials: d.credentials, logs: d.logs, career: d.career, dismissed: d.dismissed, entries: d.entries, lang: i18n.locale });
    download(`cia-passport-${localToday()}.json`, JSON.stringify(body, null, 2), 'application/json'); toast(t('pp12.exp.jsonDone'));
  };
  const file = h('input', { type: 'file', id: 'pp-import', accept: 'application/json,.json', class: 'input', 'aria-describedby': 'pp-import-hint' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    if (f.size > 2_000_000) { result.dataset.importResult = 'error'; result.replaceChildren(h('p', { class: 'errsum', role: 'alert' }, t('pp12.exp.tooBig'))); return; }
    const out = P.importPassport(await f.text(), { cpd: d.cpd, credentials: d.credentials, logs: d.logs, career: d.career }, { today: localToday(), competencyIds: d.content.competencies.map(c => c.id) });
    if (!out.ok) { result.dataset.importResult = 'error'; result.replaceChildren(h('p', { class: 'errsum', role: 'alert' }, t('pp12.exp.bad.' + out.err))); file.value = ''; return; }
    for (const x of out.add.cpd) await ctx.repos.cpd.save(x);
    for (const x of out.add.credentials) await ctx.repos.credentials.save(x);
    for (const x of out.add.logs) await ctx.repos.practiceLogs.save(x);
    if (out.career) await ctx.repos.careerPlan.save(out.career);
    const added = out.add.cpd.length + out.add.credentials.length + out.add.logs.length;
    toast(t('pp12.exp.imported', { n: num(ctx, added) }));
    region.tab = 'export'; await region.refresh();
    const box = document.querySelector('[data-import-result]');
    if (box) { box.dataset.importResult = 'ok'; box.dataset.added = String(added); box.replaceChildren(h('p', { class: 'oksum', role: 'status' }, t('pp12.exp.result', { n: num(ctx, added), dup: num(ctx, out.skipped.duplicate), bad: num(ctx, out.skipped.invalid) })),
      out.skipped.verifications ? h('p', { class: 'note' }, t('pp12.exp.noVerifications', { n: num(ctx, out.skipped.verifications) })) : null); }
  });
  return h('div', { class: 'pp-export' },
    h('section', { class: 'section', 'aria-labelledby': 'pp-exp-h' }, h('h2', { id: 'pp-exp-h' }, t('pp12.exp.title')), h('p', null, t('pp12.exp.body')),
      h('div', { class: 'btnrow' }, linkBtn('#/passport/print', t('pp12.print'), 'primary', { 'data-action': 'passport-print' }), linkBtn('#/my?tab=passport&p=cv', t('pp12.cv.title'), 'secondary', { 'data-action': 'open-cv' }),
        Button({ label: t('pp12.exp.json'), variant: 'secondary', iconName: 'download', onClick: json, attrs: { 'data-action': 'passport-json' } }),
        d.cpd.length ? Button({ label: t('pp12.cpd.csv'), variant: 'secondary', iconName: 'download', onClick: () => { download(`cia-cpd-${localToday()}.csv`, P.cpdCsv(d.cpd, { labels: { ...Object.fromEntries(P.CPD_COLUMNS.map(c => [c, t('pp12.cpd.col.' + c)])), ...Object.fromEntries(P.CPD_CATEGORIES.map(c => ['cat.' + c, t('pp12.cpd.cat.' + c)])) } }), 'text/csv;charset=utf-8'); toast(t('pp12.cpd.csvDone')); }, attrs: { 'data-action': 'cpd-csv-export' } }) : null)),
    h('section', { class: 'section panel', 'aria-labelledby': 'pp-imp-h' }, h('h2', { id: 'pp-imp-h' }, t('pp12.exp.importTitle')),
      h('div', { class: 'field' }, h('label', { for: 'pp-import' }, t('pp12.exp.importLabel')), h('span', { class: 'hint note', id: 'pp-import-hint' }, t('pp12.exp.importHint')), file), result));
}

/* ------------------------------------------------------------------ #/passport/print */

export function passportPrintView(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => { const d = await loadPassport(ctx); const model = await buildRecommendationModel(ctx).catch(() => null); return { d, model }; }, render: ({ d, model }) => {
    const c = P.statusCounts(d.entries);
    const tot = P.cpdTotals(d.cpd);
    const role = d.learner.profile?.target_role ? d.content.rolesAll.find(r => r.id === d.learner.profile.target_role) : null;
    const rows = P.competencyRecord({ competencies: d.content.competencies, role, assessments: d.content.assessments, attempts: d.learner.attempts, labs: d.content.labs, labAttempts: d.learner.labAttempts, selfLevels: d.learner.selfLevels, evidence: d.learner.evidence, verifications: d.verifications, today: d.today });
    const wallet = P.walletEntries({ certificates: d.certificates, credentials: d.credentials, verifications: d.verifications, today: d.today });
    const lt = P.logTotals(d.logs, d.verifications, d.today);
    const rm = roadmapModel(ctx, d, model, d.career);
    const sec = (id, title, ...kids) => h('section', { class: 'section', 'aria-labelledby': id }, h('h2', { id }, title), ...kids);
    return h('article', { class: 'pp-print', dataset: { passportPrint: String(d.entries.length) } },
      pageHead(ctx, { eyebrow: t('pp12.printEyebrow'), title: t('pp12.printTitle'), lede: t('pp12.printLede', { d: i18n.date(d.today), n: num(ctx, d.entries.length) }),
        actions: [Button({ label: t('lab11.print'), variant: 'primary', iconName: 'download', onClick: () => window.print(), attrs: { 'data-action': 'print-now' } }), linkBtn('#/my?tab=passport', t('pp12.back'), 'secondary')] }),
      h('p', { class: 'banner banner-info', role: 'note', dataset: { passportLabel: 'true' } }, L(ctx, P.PASSPORT_LABEL)),
      sec('pr-st', t('pp12.printStatuses'), h('ul', { class: 'pp-counts' }, P.EVIDENCE.map(s => h('li', null, statusBadge(ctx, s), ' ', h('strong', null, num(ctx, c[s] || 0))))),
        h('dl', { class: 'pp-statuses' }, P.EVIDENCE.map(s => h('div', null, h('dt', null, t('pp12.status.' + s)), h('dd', null, t('pp12.statusWhy.' + s)))))),
      sec('pr-en', t('pp12.entriesTitle', { n: num(ctx, d.entries.length) }), d.entries.length ? h('div', { class: 'tablewrap' }, Table({ caption: t('pp12.entriesTitle', { n: num(ctx, d.entries.length) }),
        columns: [{ key: 'd', label: t('pp12.col.date') }, { key: 'k', label: t('pp12.col.kind') }, { key: 'ti', label: t('pp12.col.title') }, { key: 'x', label: t('pp12.col.detail') }, { key: 's', label: t('pp12.col.status') }, { key: 'v', label: t('pp12.col.verification') }],
        rows: d.entries.map(e => ({ d: fmtDate(ctx, e.date), k: t('pp12.kind.' + e.kind), ti: L(ctx, e.title) || e.id, x: entryDetail(ctx, e), s: t('pp12.status.' + e.status),
          v: e.verification?.decision === 'verified' ? `${e.verification.reviewer} · ${fmtDate(ctx, e.verification.date)} · ${t('pp12.method.' + e.verification.method)}` : '—' })) })) : h('p', { class: 'note' }, t('pp12.empty.body'))),
      rows.length ? sec('pr-cp', t('pp12.comp.title'), h('div', { class: 'tablewrap' }, Table({ caption: t('pp12.comp.table'), columns: [{ key: 'c', label: t('pf.thCompetency') }, { key: 'k', label: t('pp12.comp.knowledge') }, { key: 's', label: t('pp12.comp.scenario') }, { key: 'p', label: t('pp12.comp.practical') }, { key: 'l', label: t('pp12.comp.level') }, { key: 'st', label: t('pp12.comp.status') }, { key: 'r', label: t('pp12.comp.reassessCol') }],
        rows: rows.map(r => ({ c: `${r.id} ${L(ctx, r.competency?.name)}`, k: r.knowledge ? num(ctx, r.knowledge.percent) + '%' : '—', s: r.scenario ? num(ctx, r.scenario.percent) + '%' : '—', p: r.practical ? num(ctx, r.practical.percent) + '%' : '—',
          l: `${i18n.digitize(r.level)} (${t('p7.comp.src.' + r.source)})`, st: r.status ? t('pp12.status.' + r.status) : '—', r: r.reassess ? fmtDate(ctx, r.reassess) : '—' })) }))) : null,
      sec('pr-cpd', t('pp12.cpd.totals'), h('p', null, t('pp12.cpd.totalLine', { n: num(ctx, tot.total), c: num(ctx, tot.count) })), Object.keys(tot.byYear).sort().reverse().map(y => h('p', { class: 'note' }, t('pp12.cpd.yearLine', { y: i18n.digitize(y), n: num(ctx, tot.byYear[y].total) }))), h('p', { class: 'note' }, t('pp12.cpd.honesty'))),
      sec('pr-w', t('pp12.cred.title', { n: num(ctx, wallet.length) }), wallet.length ? h('ul', null, wallet.map(w => h('li', null, L(ctx, w.name), ' — ', w.kind === 'cia_completion' ? t('pp12.cred.ciaLine', { no: w.number, d: fmtDate(ctx, w.issued) }) : t('pp12.cred.issuedBy', { issuer: w.issuer, d: fmtDate(ctx, w.issued) }) + ' · ' + t('pp12.cred.state.' + w.state)))) : h('p', { class: 'note' }, t('pp12.cred.empty')), h('p', { class: 'note' }, t('pp12.cred.honesty'))),
      sec('pr-l', t('pp12.tabs.logs'), h('ul', null, h('li', null, t('pp12.log.tot.auditor', { n: num(ctx, lt.auditor.entries), d: num(ctx, lt.auditor.days), f: num(ctx, lt.auditor.findings), v: num(ctx, lt.auditor.verified) })),
        h('li', null, t('pp12.log.tot.consultant', { n: num(ctx, lt.consultant.entries), m: num(ctx, lt.consultant.months), v: num(ctx, lt.consultant.verified) })), h('li', null, t('pp12.log.tot.trainer', { n: num(ctx, lt.trainer.entries), h: num(ctx, lt.trainer.hours), p: num(ctx, lt.trainer.participants), v: num(ctx, lt.trainer.verified) })))),
      sec('pr-r', t('pp12.career.title'), rm.role ? [h('p', null, `${rm.profile.current_role || '—'} → ${L(ctx, rm.role.name)}`), h('p', null, rm.rm.gaps ? t('pp12.career.summary', { g: num(ctx, rm.rm.gaps), met: num(ctx, rm.rm.met), h: num(ctx, rm.rm.total_hours), w: num(ctx, rm.rm.weeks), wh: num(ctx, rm.weekly), d: rm.rm.finish ? i18n.date(rm.rm.finish) : '—' }) : t('pp12.career.noGaps')),
        h('ol', null, rm.rm.milestones.map(x => h('li', null, x.competencies.map(c => L(ctx, c.name)).join(' · '), ' — ', x.done ? t('pp12.career.doneBadge') : t('pp12.career.due', { d: fmtDate(ctx, x.due), w: i18n.number(x.weeks) })))), h('p', { class: 'note' }, t('pp12.career.oneRoute'))] : h('p', { class: 'note' }, t('pp12.career.noRole'))));
  } });
  return h('div', { class: 'pp-print-page' }, region);
}

/** #/passport/cv — the printable CV (src/views/cv.js) from this device's passport. */
export const passportCvView = ctx => cvPrintView(ctx, loadPassport);

/* ------------------------------------------------------------------ #/review/evidence (reviewer / admin, this device only) */

export function evidenceReviewView(ctx) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.review.eyebrow'), title: t('pp12.review.title'), lede: t('pp12.review.lede') });
  const region = dataRegion({ t, load: async () => {
    const d = await loadPassport(ctx);
    const index = await loadLabsIndex(ctx);
    const pending = P.awaitingReview(d.learner.labAttempts);
    const fullLabs = new Map();
    for (const a of pending) if (!fullLabs.has(a.lab_id)) fullLabs.set(a.lab_id, await loadFullLab(ctx, index.find(l => l.id === a.lab_id)).catch(() => null));
    const session = await ctx.repos.reviewSession.get('me').catch(() => null);
    return { d, pending, fullLabs, session };
  }, render: data => reviewBoard(ctx, data, region) });
  return h('div', null, head, h('p', { class: 'banner banner-warn', role: 'note', dataset: { reviewLimit: 'true' } }, t('pp12.review.limit')), region);
}

function reviewBoard(ctx, { d, pending, fullLabs, session }, region) {
  const { t } = ctx;
  const nameIn = h('input', { class: 'input', id: 'ev-name', autocomplete: 'name', value: session?.name || '', 'aria-describedby': 'ev-name-err', required: true });
  const roleIn = h('input', { class: 'input', id: 'ev-role', value: session?.role || '' });
  const dateIn = h('input', { class: 'input input-short', id: 'ev-date', type: 'date', value: session?.date || localToday(), max: localToday(), 'aria-describedby': 'ev-name-err' });
  const who = h('span', { class: 'err', id: 'ev-name-err', 'aria-live': 'polite' });
  const remember = () => ctx.repos.reviewSession.save({ ...(session || {}), id: 'me', name: nameIn.value.trim(), role: roleIn.value.trim(), date: dateIn.value }).catch(() => {});
  [nameIn, roleIn, dateIn].forEach(el => el.addEventListener('change', remember));
  const reviewer = () => {
    const name = nameIn.value.trim(); const date = dateIn.value;
    if (name.length < 3) { who.textContent = t('pp12.err.reviewer'); nameIn.setAttribute('aria-invalid', 'true'); nameIn.focus(); return null; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localToday()) { who.textContent = t('pp12.err.date'); dateIn.setAttribute('aria-invalid', 'true'); dateIn.focus(); return null; }
    who.textContent = ''; nameIn.setAttribute('aria-invalid', 'false'); dateIn.setAttribute('aria-invalid', 'false');
    return { name, role: roleIn.value.trim(), date };
  };
  const refresh = () => region.refresh();
  /* 1. written lab tasks awaiting review */
  const labCards = pending.map(a => {
    const lab = fullLabs.get(a.lab_id);
    if (!lab) return h('li', { class: 'card' }, h('p', { class: 'note' }, t('pp12.review.labMissing', { id: a.lab_id })));
    const tasks = lab.tasks.filter(x => x.type === 'free_text' && !(a.reviews || {})[x.id]);
    const inputs = {};
    const errBox = h('p', { class: 'err', 'aria-live': 'polite' });
    return h('li', { class: 'card pp-review', dataset: { reviewAttempt: a.id } },
      h('h3', { class: 'h-sm' }, L(ctx, lab.title), ' — ', t('lab11.attemptNo', { n: ctx.i18n.digitize(a.attempt_no) })),
      h('p', { class: 'note' }, fmtDate(ctx, a.submitted_at), ' · ', t('pp12.d.awaiting', { n: num(ctx, a.pending_review) })),
      tasks.map(task => {
        const id = `rv-${a.id}-${task.id}`.replace(/[^\w-]/g, '_');
        inputs[task.id] = { score: h('input', { class: 'input input-short', id, inputmode: 'decimal', dataset: { score: task.id }, 'aria-describedby': id + '-h' }), comment: h('textarea', { class: 'input', id: id + '-c', rows: 2, maxlength: 500 }) };
        return h('div', { class: 'pp-review-task' }, h('p', null, h('strong', null, L(ctx, task.prompt))),
          h('blockquote', { class: 'pp-answer', dataset: { answer: task.id } }, a.answers?.[task.id] || h('em', null, t('pp12.review.noAnswer'))),
          h('details', null, h('summary', null, t('lab11.rubric')), h('ul', null, (task.rubric || []).map(c => h('li', null, L(ctx, c.text), ' ', h('span', { class: 'note' }, t('pp12.review.weight', { n: num(ctx, c.weight) })))))),
          h('details', null, h('summary', null, t('lab11.model')), h('p', null, L(ctx, task.model_answer))),
          h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: id }, t('pp12.review.score', { max: num(ctx, task.weight) })), h('span', { class: 'hint note', id: id + '-h' }, t('pp12.review.scoreHint')), inputs[task.id].score),
            h('div', { class: 'field field-wide' }, h('label', { for: id + '-c' }, t('pp12.review.comment')), inputs[task.id].comment)));
      }),
      errBox,
      Button({ label: t('pp12.review.record'), variant: 'primary', attrs: { 'data-action': 'record-scores' }, onClick: async () => {
        const rv = reviewer(); if (!rv) return;
        const reviews = Object.fromEntries(Object.entries(inputs).filter(([, x]) => x.score.value.trim() !== '').map(([tid, x]) => [tid, { score: x.score.value.trim(), reviewer: rv.name, date: rv.date, comment: x.comment.value }]));
        if (!Object.keys(reviews).length) { errBox.textContent = t('pp12.review.noScores'); return; }
        const out = P.reviewLabAttempt(lab, a, reviews, { today: localToday() });
        if (Object.keys(out.errors).length) { errBox.textContent = Object.entries(out.errors).map(([tid, code]) => `${tid}: ${t('pp12.err.' + code)}`).join(' · '); for (const tid of Object.keys(out.errors)) inputs[tid]?.score.setAttribute('aria-invalid', 'true'); return; }
        await ctx.repos.labAttempts.save(out.attempt); toast(t('pp12.review.scored')); refresh();
      } }));
  });
  /* 2. passport entries a reviewer may verify (CIA's own records and practice logs; credentials need the issuer's record) */
  const verifiable = d.entries.filter(e => ['document', 'cpd', 'log', 'lab', 'assessment', 'course', 'credential'].includes(e.kind));
  const verifyRow = e => {
    const methods = e.kind === 'credential' ? ['issuer_check', 'document_review'] : P.VERIFY_METHODS.filter(m => m !== 'issuer_check');
    const id = 'vf-' + e.key.replace(/[^\w-]/g, '_');
    const mSel = h('select', { class: 'select select-sm', id: id + '-m', dataset: { method: e.key } }, methods.map(m => h('option', { value: m }, t('pp12.method.' + m))));
    const dSel = h('select', { class: 'select select-sm', id: id + '-d', dataset: { decision: e.key } }, P.VERIFY_DECISIONS.map(x => h('option', { value: x }, t('pp12.review.decision.' + x))));
    const note = h('input', { class: 'input', id: id + '-n', maxlength: 500 });
    return h('li', { class: 'card', dataset: { verify: e.key, status: e.status } },
      h('div', { class: 'pp-entry-head' }, h('span', { class: 'badge badge-neutral' }, t('pp12.kind.' + e.kind)), ' ', statusBadge(ctx, e.status)),
      h('h3', { class: 'h-sm' }, L(ctx, e.title) || e.id), h('p', { class: 'note' }, fmtDate(ctx, e.date), ' · ', entryDetail(ctx, e)),
      e.verification ? h('p', { class: 'note' }, t('pp12.review.already', { who: e.verification.reviewer, d: fmtDate(ctx, e.verification.date), x: t('pp12.review.decision.' + e.verification.decision) })) : null,
      h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: id + '-m' }, t('pp12.review.method')), mSel), h('div', { class: 'field' }, h('label', { for: id + '-d' }, t('pp12.review.decisionLabel')), dSel),
        h('div', { class: 'field field-wide' }, h('label', { for: id + '-n' }, t('pp12.review.note')), note)),
      Button({ label: t('pp12.review.recordV'), variant: 'secondary', attrs: { 'data-action': 'record-verification' }, onClick: async () => {
        const rv = reviewer(); if (!rv) return;
        try { await ctx.repos.verifications.save(P.makeVerification({ target_kind: e.kind, target_id: e.id, reviewer: rv.name, reviewer_role: rv.role, date: rv.date, method: mSel.value, decision: dSel.value, note: note.value }, localToday())); toast(t('pp12.review.verified')); refresh(); }
        catch (err) { toast(t('pp12.err.' + String(err.message).replace('verification_', ''))); }
      } }));
  };
  /* 3. competencies (a level confirmed by observation / work sample / interview) */
  const role = d.learner.profile?.target_role ? d.content.rolesAll.find(r => r.id === d.learner.profile.target_role) : null;
  const comps = role ? d.content.competencies.filter(c => (role.targets?.[c.id] || 0) > 0) : [];
  const compRow = c => {
    const v = P.verificationFor(d.verifications, 'competency', c.id, d.today);
    const id = 'vc-' + c.id.replace(/[^\w-]/g, '_');
    const lv = h('select', { class: 'select select-sm', id: id + '-l', dataset: { verifyLevel: c.id }, 'aria-label': t('pp12.review.level', { name: L(ctx, c.name) }) }, [1, 2, 3, 4, 5].map(n => h('option', { value: String(n), selected: v?.level === n }, ctx.i18n.digitize(n))));
    const mSel = h('select', { class: 'select select-sm', id: id + '-m', 'aria-label': t('pp12.review.methodFor', { name: L(ctx, c.name) }) }, ['observation', 'work_sample', 'interview', 'document_review'].map(m => h('option', { value: m }, t('pp12.method.' + m))));
    return h('tr', { dataset: { verifyComp: c.id } }, h('td', null, h('span', { class: 'cid' }, c.id), ' ', L(ctx, c.name)), h('td', null, v ? t('pp12.review.compVerified', { n: ctx.i18n.digitize(v.level), who: v.reviewer }) : '—'),
      h('td', null, lv), h('td', null, mSel),
      h('td', null, Button({ label: t('pp12.review.confirmLevel'), variant: 'quiet', attrs: { 'data-action': 'verify-competency', 'aria-label': t('pp12.review.confirmNamed', { name: L(ctx, c.name) }) }, onClick: async () => {
        const rv = reviewer(); if (!rv) return;
        await ctx.repos.verifications.save(P.makeVerification({ target_kind: 'competency', target_id: c.id, reviewer: rv.name, reviewer_role: rv.role, date: rv.date, method: mSel.value, decision: 'verified', level: Number(lv.value) }, localToday())); toast(t('pp12.review.verified')); refresh();
      } })));
  };
  /* 4. credential audit trails (admin view) */
  const trails = d.credentials.map(c => h('li', { dataset: { trail: c.id } }, h('strong', null, c.name), ' — ', c.issuer,
    h('ol', null, P.credentialTrail(c, P.verificationFor(d.verifications, 'credential', c.id, d.today), d.today).map(e => h('li', null, fmtDate(ctx, e.at), ' — ', t('pp12.cred.event.' + e.event), e.by ? ' · ' + e.by : '', e.method ? ' · ' + t('pp12.method.' + e.method) : '')))));
  return h('div', { class: 'pp-reviewer', dataset: { pendingAttempts: String(pending.length) } },
    h('section', { class: 'section panel', 'aria-labelledby': 'ev-who-h' }, h('h2', { id: 'ev-who-h' }, t('pp12.review.who')),
      h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: 'ev-name' }, t('pp12.review.name'), h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), nameIn),
        h('div', { class: 'field' }, h('label', { for: 'ev-role' }, t('pp12.review.role')), roleIn), h('div', { class: 'field' }, h('label', { for: 'ev-date' }, t('pp12.review.date')), dateIn)), who,
      h('p', { class: 'note' }, t('pp12.review.whoNote'))),
    h('section', { class: 'section', 'aria-labelledby': 'ev-lab-h' }, h('h2', { id: 'ev-lab-h' }, t('pp12.review.labsTitle', { n: num(ctx, pending.length) })),
      pending.length ? h('ul', { class: 'plain pp-list' }, labCards) : h('p', { class: 'note' }, t('pp12.review.labsNone'))),
    h('section', { class: 'section', 'aria-labelledby': 'ev-v-h' }, h('h2', { id: 'ev-v-h' }, t('pp12.review.verifyTitle', { n: num(ctx, verifiable.length) })), h('p', { class: 'note' }, t('pp12.review.verifyNote')),
      verifiable.length ? h('ul', { class: 'plain pp-list' }, verifiable.map(verifyRow)) : h('p', { class: 'note' }, t('pp12.review.verifyNone'))),
    comps.length ? h('section', { class: 'section', 'aria-labelledby': 'ev-c-h' }, h('h2', { id: 'ev-c-h' }, t('pp12.review.compTitle')), h('p', { class: 'note' }, t('pp12.review.compNote')),
      h('div', { class: 'tbl-wrap', tabindex: '0', role: 'group', 'aria-label': t('pp12.review.compTitle') }, h('table', { class: 'tbl' }, h('caption', { class: 'sr-only' }, t('pp12.review.compTitle')), h('thead', null, h('tr', null, [t('pf.thCompetency'), t('pp12.review.current'), t('pp12.comp.level'), t('pp12.review.method'), t('pp12.review.action')].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, comps.map(compRow))))) : null,
    trails.length ? h('section', { class: 'section', 'aria-labelledby': 'ev-t-h' }, h('h2', { id: 'ev-t-h' }, t('pp12.review.trailTitle')), h('ul', { class: 'plain' }, trails)) : null,
    !pending.length && !verifiable.length ? EmptyState({ title: t('pp12.review.nothingTitle'), body: t('pp12.review.nothingBody'), action: linkBtn('#/my?tab=passport', t('pp12.title')) }) : null);
}
