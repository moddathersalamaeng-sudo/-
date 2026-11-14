/**
 * Company Portal, employee side (Phase 12A) — My space → Passport → "My company" (#/my?tab=passport&p=company) and the
 * "Assigned by my company" block of My space → Progress.
 *
 * The employee decides: they tick the parts to share, read exactly what the file will contain, tick the consent and download
 * the file themselves. Nothing is sent anywhere by the Academy. Company assignments arrive as a file the employee imports;
 * their state goes back only inside the next share the employee chooses to make.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, toast, openDialog, ProgressBar } from '../ui/components.js';
import { L, linkBtn } from '../ui/academy.js';
import { Figure } from '../ui/figures.js';
import { isVisible } from '../data/governance.js';
import { buildRecommendationModel } from './recommendations.js';
import * as P from '../domain/passport.mjs';
import * as C from '../domain/company.mjs';

export const DUE_TONE = { completed: 'ok', overdue: 'bad', due_soon: 'warn', open: 'neutral', cancelled: 'neutral' };
export const DUE_ICON = { completed: 'check', overdue: 'alert', due_soon: 'clock', open: 'calendar', cancelled: 'close' };
export const TYPE_ICON = { course: 'book', lab: 'flask', assessment: 'clipboard', route: 'route' };
const PART_ICON = { competencies: 'gauge', verified: 'check', cpd: 'clock', credentials: 'award', roadmap: 'map', assignments: 'clipboard' };

/** replaceChildren that ignores null / false and flattens arrays. */
export const put = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false)); return el; };
export const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const newId = prefix => { const a = new Uint32Array(2); (globalThis.crypto || { getRandomValues: x => x.forEach((_, i) => { x[i] = Math.floor(Math.random() * 2 ** 32); }) }).getRandomValues(a); return `${prefix}-${Date.now().toString(36)}${a[0].toString(36)}${a[1].toString(36)}`.slice(0, 40).toUpperCase(); };
export function download(name, body, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const dueBadge = (ctx, state, due, today) => {
  const n = C.daysLeft(due, today);
  const extra = state === 'overdue' ? ctx.t('co12a.asg.daysLate', { n: ctx.i18n.number(-n) }) : state === 'due_soon' || state === 'open' ? ctx.t('co12a.asg.daysLeft', { n: ctx.i18n.number(n) }) : '';
  return h('span', { class: `badge badge-${DUE_TONE[state] || 'neutral'}`, dataset: { due: state } }, icon(DUE_ICON[state] || 'calendar'), ' ', ctx.t('co12a.asg.due.' + state), extra ? ' · ' + extra : '');
};

/* ------------------------------------------------------------------ assignments held by the employee */

/** The employee's company assignments with their current state on this device. */
export async function loadMyAssignments(ctx, facts = null) {
  const r = ctx.repos;
  const items = await r.assignmentsInbox.list().catch(() => []);
  if (!items.length) return { items: [], rows: [], routes: [], facts: null };
  const roles = ctx.session.roles;
  const [courses, labs, progress, attempts, labAttempts, pathsRaw] = facts ? [facts.courses, facts.labs, facts.progress, facts.attempts, facts.labAttempts, null] : await Promise.all([
    (r.coursesIndex || r.courses).listVisible(roles), r.labsIndex.listVisible(roles).catch(() => []), r.courseProgress.list(), r.assessmentAttempts.list(), r.labAttempts.list().catch(() => []), null]);
  const routes = (await r.learningPaths.list().catch(() => [])).filter(p => !p.governance || isVisible(p, roles));
  const completedIds = [...new Set([...courses.filter(c => progress.some(p => p.id === c.id) && C.assignmentProgress({ type: 'course', target_id: c.id }, { courses, progress, attempts }).state === 'completed').map(c => c.id), ...attempts.filter(a => a.passed).map(a => a.assessment_id)])];
  const f = { courses, labs, progress, attempts, labAttempts, routes, completedIds };
  const today = localToday();
  const rows = items.map(it => { const p = C.assignmentProgress(it, f); return { item: it, ...p, due_state: C.dueState(it.due, p.state, today), href: hrefOf(it, f) }; })
    .sort((a, b) => (a.due_state === 'completed') - (b.due_state === 'completed') || a.item.due.localeCompare(b.item.due) || a.item.id.localeCompare(b.item.id));
  return { items, rows, routes, facts: f, today };
}
const hrefOf = (it, f) => {
  const t = it.type === 'course' ? f.courses.find(x => x.id === it.target_id) : it.type === 'lab' ? f.labs.find(x => x.id === it.target_id) : null;
  if (it.type === 'course' || it.type === 'lab') return t ? C.targetHref(it.type, t) : null;
  if (it.type === 'assessment') return '#/assessments';
  return `#/my?tab=path&route=${encodeURIComponent(it.target_id)}`;
};

/** One assignment line (used in Progress and in the passport's company tab). */
function assignmentCard(ctx, row, { onRemove = null } = {}) {
  const { t, i18n } = ctx;
  const it = row.item;
  return h('li', { class: ['card', 'co-asg', row.due_state === 'overdue' && 'is-overdue'], dataset: { assignment: it.id, state: row.state, due: row.due_state } },
    h('p', { class: 'co-asg-head' }, h('span', { class: 'badge badge-neutral' }, icon(TYPE_ICON[it.type]), ' ', t('co12a.asg.type.' + it.type)), ' ', dueBadge(ctx, row.due_state, it.due, row.today || localToday())),
    h('h3', null, row.href ? h('a', { href: row.href }, L(ctx, it.title)) : L(ctx, it.title)),
    h('p', { class: 'note' }, t('co12a.my.asgLine', { company: it.company || t('co12a.my.yourCompany'), due: i18n.date(it.due) }), it.hours ? ' · ' + t('p7.hours', { n: i18n.number(it.hours) }) : ''),
    it.note ? h('p', { class: 'co-note' }, it.note) : null,
    ProgressBar({ value: row.percent || 0, max: 100, label: t('co12a.asg.state.' + row.state), valueText: i18n.number(row.percent || 0) + '%' }),
    h('div', { class: 'btnrow' }, row.href && row.state !== 'completed' ? linkBtn(row.href, t(row.state === 'in_progress' ? 'co12a.my.continue' : 'co12a.my.start'), 'primary', { 'data-action': 'open-assignment' }) : null,
      onRemove ? Button({ label: t('co12a.my.remove'), variant: 'quiet', onClick: () => onRemove(it), attrs: { 'data-action': 'remove-assignment', 'aria-label': t('co12a.my.removeNamed', { name: L(ctx, it.title) }) } }) : null));
}

/** My space → Progress: "Assigned by my company". Renders nothing when the employee holds no assignment. */
export function myAssignmentsBlock(ctx) {
  const { t, i18n } = ctx;
  return dataRegion({ t, load: () => loadMyAssignments(ctx), render: ({ rows, today }) => {
    if (!rows.length) return h('span', { hidden: true, dataset: { myAssignments: '0' } });
    const open = rows.filter(r => r.due_state !== 'completed');
    return h('section', { class: 'section co-my-asg', 'aria-labelledby': 'co-ma-h', dataset: { myAssignments: String(rows.length), open: String(open.length), overdue: String(rows.filter(r => r.due_state === 'overdue').length) } },
      h('h2', { id: 'co-ma-h' }, icon('briefcase'), ' ', t('co12a.my.asgTitle')),
      h('p', { class: 'note' }, t('co12a.my.asgSummary', { n: i18n.number(rows.length), open: i18n.number(open.length), done: i18n.number(rows.length - open.length) })),
      h('ul', { class: 'co-asg-list plain' }, rows.map(r => assignmentCard(ctx, { ...r, today }))),
      h('p', { class: 'note' }, t('co12a.my.asgBack'), ' ', h('a', { href: '#/my?tab=passport&p=company', dataset: { action: 'open-company-share' } }, t('co12a.my.shareLink'))));
  } });
}

/** Courses the company assigned and the employee has not finished, soonest due first — they lead the weekly plan (D-54). */
export async function assignedCoursesFirst(ctx, courses) {
  const items = await ctx.repos.assignmentsInbox.list().catch(() => []);
  const due = new Map(items.filter(i => i.type === 'course').map(i => [i.target_id, i.due]));
  return { assigned: courses.filter(c => due.has(c.id)).sort((a, b) => due.get(a.id).localeCompare(due.get(b.id))), due };
}

/* ------------------------------------------------------------------ the passport's "My company" tab */

export function companySharePanel(ctx, d) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: async () => {
    const r = ctx.repos;
    const [log, prefs, cv, mine, model] = await Promise.all([r.passportShares.list().catch(() => []), r.passportPrefs.get('company').catch(() => null), r.cv.get('me').catch(() => null),
      loadMyAssignments(ctx), buildRecommendationModel(ctx).catch(() => null)]);
    return { log, prefs, cv, mine, model };
  }, render: x => render(x) });

  function render({ log, prefs, cv, mine, model }) {
    const { content, learner } = d;
    const today = d.today;
    /* ---- what each part would contain, right now */
    const all = C.shareCompetencies({ competencies: content.competencies, selfLevels: learner.selfLevels, evidence: learner.evidence, verifications: d.verifications, withLevels: true, withVerified: true, today });
    const base = C.shareCompetencies({ competencies: content.competencies, selfLevels: learner.selfLevels, evidence: learner.evidence, verifications: d.verifications, withLevels: true, withVerified: false, today });
    const verified = all.filter(r => r.source === 'verified');
    const tot = P.cpdTotals(d.cpd);
    const wallet = P.walletEntries({ certificates: d.certificates, credentials: d.credentials, verifications: d.verifications, today });
    const role = learner.profile?.target_role ? content.rolesAll.find(r => r.id === learner.profile.target_role) || null : null;
    let roadmap = null;
    if (role) {
      const gaps = model?.gaps?.length ? model.gaps : [];
      const rm = P.buildRoadmap({ gaps, courses: content.courses, labs: content.labs, completed: learner.completed, weeklyHours: Number(d.studyPlan?.weekly_hours || learner.profile.weekly_hours) || 4, start: today, done: d.career?.done || [] });
      roadmap = C.shareRoadmap(rm, role);
    }
    const asg = mine.items.length ? C.shareAssignments(mine.items, mine.facts) : [];
    const count = { competencies: base.length, verified: verified.length, cpd: tot.count, credentials: wallet.filter(w => w.state !== 'rejected').length, roadmap: roadmap ? 1 : 0, assignments: asg.length };
    const available = C.SHARE_PARTS.filter(p => count[p] > 0);
    const desc = {
      competencies: t('co12a.share.part.competenciesD', { n: i18n.number(base.length), a: i18n.number(base.filter(r => r.source === 'assessment').length), s: i18n.number(base.filter(r => r.source === 'self').length) }),
      verified: t('co12a.share.part.verifiedD', { n: i18n.number(verified.length) }),
      cpd: t('co12a.share.part.cpdD', { h: i18n.number(tot.total), n: i18n.number(tot.count) }),
      credentials: t('co12a.share.part.credentialsD', { n: i18n.number(count.credentials) }),
      roadmap: role ? t('co12a.share.part.roadmapD', { role: L(ctx, role.name) }) : t('co12a.share.part.roadmapNone'),
      assignments: t('co12a.share.part.assignmentsD', { n: i18n.number(asg.length) })
    };

    /* ---- form */
    const nameIn = h('input', { class: 'input', id: 'cs-name', name: 'name', type: 'text', maxlength: 80, autocomplete: 'name', value: prefs?.name || cv?.name || '', 'aria-describedby': 'cs-name-hint cs-name-err', required: true });
    const jobIn = h('input', { class: 'input', id: 'cs-job', name: 'job_title', type: 'text', maxlength: 120, autocomplete: 'organization-title', value: prefs?.job_title ?? learner.profile?.current_role ?? '' });
    const noIn = h('input', { class: 'input input-short', id: 'cs-no', name: 'employee_no', type: 'text', maxlength: 40, autocomplete: 'off', value: prefs?.employee_no || '' });
    const errs = { name: h('span', { class: 'err', id: 'cs-name-err', 'aria-live': 'polite' }), parts: h('span', { class: 'err', id: 'cs-parts-err', 'aria-live': 'polite' }), consent: h('span', { class: 'err', id: 'cs-consent-err', 'aria-live': 'polite' }) };
    const remembered = Array.isArray(prefs?.parts) ? prefs.parts : ['competencies', 'verified', 'assignments'];
    const boxes = C.SHARE_PARTS.map(p => {
      const off = !available.includes(p);
      const box = h('input', { type: 'checkbox', name: 'cs-part', value: p, id: 'cs-part-' + p, checked: !off && remembered.includes(p), disabled: off, 'aria-describedby': `cs-part-${p}-d` });
      return h('li', { class: ['co-part', off && 'is-off'], dataset: { part: p, available: String(!off), count: String(count[p]) } },
        h('label', { class: 'choice', for: 'cs-part-' + p }, box, h('span', null, icon(PART_ICON[p]), ' ', h('strong', null, t('co12a.share.part.' + p)))),
        h('p', { class: 'note', id: `cs-part-${p}-d` }, off ? t('co12a.share.part.nothing') : desc[p]));
    });
    const consentBox = h('input', { type: 'checkbox', id: 'cs-consent', name: 'consent', 'aria-describedby': 'cs-consent-text cs-consent-err' });
    const preview = h('div', { class: 'co-preview', 'aria-live': 'polite', dataset: { sharePreview: '' } });
    const result = h('div', { 'aria-live': 'polite', dataset: { shareResult: '' } });
    const picked = () => boxes.map(li => li.querySelector('input')).filter(i => i.checked && !i.disabled).map(i => i.value);
    const fileFor = (parts, key, shareId, now) => C.buildShare({ employee: { key, name: nameIn.value, job_title: jobIn.value, employee_no: noIn.value }, parts, shareId, now,
      data: { competencies: C.shareCompetencies({ competencies: content.competencies, selfLevels: learner.selfLevels, evidence: learner.evidence, verifications: d.verifications, withLevels: parts.includes('competencies'), withVerified: parts.includes('verified'), today }),
        cpd: C.shareCpd(tot), credentials: C.shareCredentials(wallet, v => L(ctx, v)), roadmap, assignments: asg } });
    const paint = () => {
      const parts = picked();
      preview.dataset.sharePreview = parts.join(',');
      if (!parts.length) { put(preview, h('p', { class: 'note' }, t('co12a.share.previewNone'))); return; }
      const f = fileFor(parts, prefs?.employee_key || 'EMP-PREVIEW', 'SHR-PREVIEW', new Date().toISOString());
      const compName = id => L(ctx, content.competencies.find(c => c.id === id)?.name) || id;
      const lines = [];
      if (f.data.competencies) lines.push(h('li', null, h('strong', null, t('co12a.share.pv.competencies', { n: i18n.number(f.data.competencies.length) })),
        f.data.competencies.length ? h('ul', { class: 'co-pv-list', tabindex: '0' }, f.data.competencies.map(r => h('li', null, h('span', { class: 'cid' }, r.id), ' ', compName(r.id), ' — ', t('co12a.share.pv.level', { n: i18n.digitize(r.level), src: t('co12a.src.' + r.source) }),
          r.verification ? ' · ' + t('co12a.share.pv.reviewer', { who: r.verification.reviewer, d: i18n.date(r.verification.date) }) : r.percent != null ? ' · ' + i18n.number(r.percent) + '%' : ''))) : null));
      if (f.data.cpd) lines.push(h('li', null, h('strong', null, t('co12a.share.pv.cpd', { h: i18n.number(f.data.cpd.total), n: i18n.number(f.data.cpd.count) })), ' ', h('span', { class: 'note' }, t('co12a.share.pv.cpdOnly'))));
      if (f.data.credentials) lines.push(h('li', null, h('strong', null, t('co12a.share.pv.credentials', { n: i18n.number(f.data.credentials.length) })),
        f.data.credentials.length ? h('ul', { class: 'co-pv-list', tabindex: '0' }, f.data.credentials.map(c => h('li', null, c.name, c.issuer ? ' — ' + c.issuer : '', ' · ', t(c.kind === 'cia_completion' ? 'co12a.share.pv.ciaCompletion' : 'pp12.cred.state.' + c.state)))) : null));
      if ('roadmap' in f.data) lines.push(h('li', null, h('strong', null, f.data.roadmap ? t('co12a.share.pv.roadmap', { role: L(ctx, f.data.roadmap.target_role_name), g: i18n.number(f.data.roadmap.gaps), m: i18n.number(f.data.roadmap.milestones.length) }) : t('co12a.share.part.roadmapNone'))));
      if (f.data.assignments) lines.push(h('li', null, h('strong', null, t('co12a.share.pv.assignments', { n: i18n.number(f.data.assignments.length), d: i18n.number(f.data.assignments.filter(a => a.state === 'completed').length) }))));
      put(preview, 
        h('p', null, h('strong', null, t('co12a.share.pv.identity')), ' ', (nameIn.value.trim() || '—') + (jobIn.value.trim() ? ' · ' + jobIn.value.trim() : '') + (noIn.value.trim() ? ' · ' + noIn.value.trim() : '') + ' · ' + i18n.date(today)),
        h('ul', { class: 'co-pv' }, lines),
        h('p', { class: 'note' }, icon('lock'), ' ', t('co12a.share.pv.nothingElse')),
        h('details', { class: 'co-raw' }, h('summary', null, t('co12a.share.pv.raw')), h('pre', { tabindex: '0', dir: 'ltr', dataset: { shareRaw: '' } }, JSON.stringify({ ...f, share_id: '…', employee: { ...f.employee, key: prefs?.employee_key || '…' }, digest: '…' }, null, 2))));
    };
    [nameIn, jobIn, noIn].forEach(el => el.addEventListener('input', paint));
    boxes.forEach(li => li.querySelector('input').addEventListener('change', paint));
    paint();

    const submit = async () => {
      const parts = picked();
      const v = C.validateShareInput({ name: nameIn.value, job_title: jobIn.value, employee_no: noIn.value, parts, consent: consentBox.checked }, available);
      errs.name.textContent = v.errors.name ? t('co12a.err.name_' + v.errors.name) : ''; nameIn.setAttribute('aria-invalid', v.errors.name ? 'true' : 'false');
      errs.parts.textContent = v.errors.parts ? t('co12a.err.parts') : '';
      errs.consent.textContent = v.errors.consent ? t('co12a.err.consent') : ''; consentBox.setAttribute('aria-invalid', v.errors.consent ? 'true' : 'false');
      if (!v.value) { (v.errors.name ? nameIn : v.errors.parts ? boxes.find(li => !li.querySelector('input').disabled)?.querySelector('input') || nameIn : consentBox).focus(); return; }
      const key = prefs?.employee_key || newId('EMP');
      const now = new Date().toISOString();
      const file = fileFor(v.value.parts, key, newId('SHR'), now);
      await ctx.repos.passportPrefs.save({ id: 'company', employee_key: key, name: v.value.name, job_title: v.value.job_title, employee_no: v.value.employee_no, parts: v.value.parts, updated_at: now });
      await ctx.repos.passportShares.save({ id: file.share_id, shared_at: now, includes: file.includes, name: v.value.name, digest: file.digest, counts: { competencies: (file.data.competencies || []).length, credentials: (file.data.credentials || []).length, assignments: (file.data.assignments || []).length }, withdrawn_at: null });
      download(`cia-passport-share-${localToday()}.json`, JSON.stringify(file, null, 2), 'application/json');
      toast(t('co12a.share.done'));
      await region.refresh();
      const box = document.querySelector('[data-share-result]');
      if (box) { box.dataset.shareResult = 'ok'; box.dataset.parts = file.includes.join(','); put(box, h('p', { class: 'oksum', role: 'status' }, t('co12a.share.doneBody', { parts: i18n.list(file.includes.map(p => t('co12a.share.part.' + p))) }))); }
    };

    /* ---- log and withdrawal */
    const withdraw = s => openDialog({ title: t('co12a.share.withdrawTitle'), body: h('div', null, h('p', null, t('co12a.share.withdrawBody')), h('p', { class: 'note' }, t('co12a.share.withdrawHonest'))), actions: [
      { label: t('settings.data.cancel'), variant: 'secondary' },
      { label: t('co12a.share.withdrawMark'), variant: 'primary', onClick: async () => { await ctx.repos.passportShares.save({ ...s, withdrawn_at: new Date().toISOString() }); toast(t('co12a.share.withdrawMarked')); region.refresh(); } }] });
    const sorted = [...log].sort((a, b) => String(b.shared_at).localeCompare(String(a.shared_at)));
    const logSec = h('section', { class: 'section', 'aria-labelledby': 'cs-log-h', dataset: { shareLog: String(log.length) } }, h('h2', { id: 'cs-log-h' }, icon('clipboard'), ' ', t('co12a.share.logTitle', { n: i18n.number(log.length) })),
      sorted.length ? h('ul', { class: 'co-log plain' }, sorted.map(s => h('li', { class: 'card', dataset: { share: s.id, withdrawn: String(!!s.withdrawn_at) } },
        h('p', null, h('strong', null, i18n.date(String(s.shared_at).slice(0, 10))), ' · ', h('span', { class: 'note' }, s.name), ' ', s.withdrawn_at ? h('span', { class: 'badge badge-warn' }, t('co12a.share.withdrawnBadge', { d: i18n.date(String(s.withdrawn_at).slice(0, 10)) })) : null),
        h('ul', { class: 'chips' }, s.includes.map(p => h('li', null, t('co12a.share.part.' + p)))),
        h('p', { class: 'note' }, t('co12a.share.logRef'), ' ', h('bdi', { dir: 'ltr' }, s.id)),
        s.withdrawn_at ? null : h('div', { class: 'btnrow' }, Button({ label: t('co12a.share.withdraw'), variant: 'quiet', onClick: () => withdraw(s), attrs: { 'data-action': 'withdraw-share' } })))))
        : h('p', { class: 'note' }, t('co12a.share.logEmpty')),
      h('p', { class: 'note' }, t('co12a.share.logNote')));

    /* ---- assignments from the company */
    const asgResult = h('div', { 'aria-live': 'polite', dataset: { assignmentImport: '' } });
    const file = h('input', { type: 'file', id: 'cs-asg-file', accept: 'application/json,.json', class: 'input', 'aria-describedby': 'cs-asg-hint' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      const fail = code => { asgResult.dataset.assignmentImport = 'error'; asgResult.dataset.code = code; put(asgResult, h('p', { class: 'errsum', role: 'alert' }, t('co12a.my.bad.' + code))); file.value = ''; };
      if (f.size > C.MAX_FILE_BYTES) return fail('size');
      const roles = ctx.session.roles; const r = ctx.repos;
      const [assessments, paths] = await Promise.all([r.assessments.listVisible(roles).catch(() => []), r.learningPaths.list().catch(() => [])]);
      const out = C.readAssignmentFile(await f.text(), { myKey: prefs?.employee_key || null, existing: mine.items, today: localToday(),
        known: { course: content.courses.map(c => c.id), lab: content.labs.map(l => l.id), assessment: assessments.map(a => a.id), route: paths.filter(p => !p.governance || isVisible(p, roles)).map(p => p.id) } });
      if (!out.ok) return fail(out.err);
      for (const x of out.add) await r.assignmentsInbox.save(x);
      toast(t('co12a.my.imported', { n: i18n.number(out.add.length) }));
      await region.refresh();
      const box = document.querySelector('[data-assignment-import]');
      if (box) { box.dataset.assignmentImport = 'ok'; box.dataset.added = String(out.add.length); put(box, h('p', { class: 'oksum', role: 'status' }, t('co12a.my.importResult', { n: i18n.number(out.add.length), dup: i18n.number(out.skipped.duplicate), unk: i18n.number(out.skipped.unknown + out.skipped.invalid) }))); }
    });
    const removeAsg = it => openDialog({ title: t('co12a.my.removeTitle'), body: t('co12a.my.removeBody'), actions: [{ label: t('settings.data.cancel'), variant: 'secondary' },
      { label: t('co12a.my.remove'), variant: 'danger', onClick: async () => { await ctx.repos.assignmentsInbox.remove(it.id); toast(t('co12a.my.removed')); region.refresh(); } }] });
    const asgSec = h('section', { class: 'section', 'aria-labelledby': 'cs-asg-h', dataset: { myAssignments: String(mine.rows.length) } }, h('h2', { id: 'cs-asg-h' }, icon('briefcase'), ' ', t('co12a.my.asgTitle')),
      h('p', null, t('co12a.my.asgIntro')),
      h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', { for: 'cs-asg-file' }, t('co12a.my.importLabel')), h('span', { class: 'hint note', id: 'cs-asg-hint' }, t('co12a.my.importHint')), file), asgResult),
      mine.rows.length ? h('ul', { class: 'co-asg-list plain' }, mine.rows.map(r => assignmentCard(ctx, { ...r, today: mine.today }, { onRemove: removeAsg }))) : h('p', { class: 'note' }, t('co12a.my.asgEmpty')));

    const figs = d.figsFor('company:share');
    return h('div', { class: 'co-share', dataset: { companyShare: 'root' } },
      h('section', { class: 'section', 'aria-labelledby': 'cs-h' }, h('h2', { id: 'cs-h' }, icon('handshake'), ' ', t('co12a.share.title')),
        h('p', null, t('co12a.share.lede')),
        h('ul', { class: 'co-promises' }, ['you', 'only', 'never', 'withdraw'].map(k => h('li', null, icon(k === 'never' ? 'lock' : 'check'), ' ', t('co12a.share.promise.' + k)))),
        figs.map(f => Figure(ctx, f)),
        available.length ? null : h('p', { class: 'banner banner-info', role: 'note', dataset: { shareEmpty: 'true' } }, t('co12a.share.empty'), ' ', h('a', { href: '#/my?tab=competencies' }, t('co12a.share.emptyRate')), ' · ', h('a', { href: '#/assessments' }, t('nav.items.assessments')), ' · ', h('a', { href: '#/labs' }, t('lab11.indexTitle'))),
        h('form', { class: 'panel feature co-share-form', novalidate: true, onsubmit: e => { e.preventDefault(); submit(); } },
          h('h3', null, t('co12a.share.step1')),
          h('div', { class: 'formgrid' },
            h('div', { class: 'field' }, h('label', { for: 'cs-name' }, t('co12a.share.name'), h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), h('span', { class: 'hint note', id: 'cs-name-hint' }, t('co12a.share.nameHint')), nameIn, errs.name),
            h('div', { class: 'field' }, h('label', { for: 'cs-job' }, t('co12a.share.job')), jobIn),
            h('div', { class: 'field' }, h('label', { for: 'cs-no' }, t('co12a.share.empNo')), noIn)),
          h('fieldset', { class: 'fs', 'aria-describedby': 'cs-parts-err' }, h('legend', null, h('span', { class: 'co-step' }, t('co12a.share.step2'))), h('ul', { class: 'co-parts plain' }, boxes), errs.parts),
          h('h3', null, t('co12a.share.step3')), preview,
          h('h3', null, t('co12a.share.step4')),
          h('div', { class: 'co-consent' }, h('label', { class: 'choice', for: 'cs-consent' }, consentBox, h('span', { id: 'cs-consent-text' }, L(ctx, C.CONSENT_TEXT))), errs.consent),
          h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'download-share' } }, icon('download'), t('co12a.share.download'))),
          h('p', { class: 'note' }, t('co12a.share.afterNote'))),
        result),
      logSec, asgSec);
  }
  return region;
}
