/**
 * Expert review queue (Phase 7) — #/review, reviewer and admin roles only.
 *
 * Nothing on this page publishes content. A named reviewer records a decision per record (with a checklist), the
 * decisions are saved on this device, and the reviewer exports them as `cia.review-decisions.v1`. The content owner
 * then applies that file to the seed data with `tools/apply_review_decisions.py`, which is the only step that changes
 * a record's governance status. The reviewer name is never pre-filled.
 */
import { h } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, toast, openDialog } from '../ui/components.js';
import { courseCompleteness } from '../domain/courses.mjs';
import { validateGovernance } from '../data/governance.js';
import { L, pageHead, facts, section } from '../ui/academy.js';

export const DECISION_SCHEMA = 'cia.review-decisions.v1';
const CHECKS = ['facts', 'noCopy', 'noClaims', 'bilingual', 'answers'];
/** Seed file (relative to data/seed) for each reviewable collection — the apply script uses the same keys. */
const COLLECTIONS = [
  ['courses', 'courses'], ['assessments', 'assessments'], ['questions', 'questions'], ['iso-standards', 'isoStandards'],
  ['learning-paths', 'learningPaths'], ['competency/competencies', 'competencies'], ['competency/target-roles', 'targetRoles'],
  ['competency/domains', 'domains'], ['ecosystems', 'ecosystems'], ['programs', 'programs'], ['sources', 'sources'],
  /* Phase 11: full lab definitions (all academy shards) and the smart templates. */
  ['labs', 'labs'], ['smart-templates', 'smartTemplates']
];
const today = () => new Date().toISOString().slice(0, 10);
const title = (ctx, r) => L(ctx, r.title || r.name || r.prompt) || r.title || r.id;

async function loadQueue(ctx) {
  const lists = await Promise.all(COLLECTIONS.map(async ([file, repo]) => {
    const rp = ctx.repos[repo];
    const items = rp.listAll ? await rp.listAll() : await rp.list();
    return items.filter(r => r.governance && validateGovernance(r).length === 0).map(r => ({ file, rec: r }));
  }));
  const [decisions, session] = await Promise.all([ctx.repos.reviewDecisions.list(), ctx.repos.reviewSession.get('me')]);
  return { items: lists.flat(), decisions, session };
}

export function reviewView(ctx, match) {
  const { t } = ctx;
  const head = pageHead(ctx, { eyebrow: t('p7.review.eyebrow'), title: t('p7.review.title'), lede: t('p7.review.lede') });
  const filter = { collection: match.query?.collection || 'courses', state: match.query?.state || 'pending', q: '' };
  const region = dataRegion({ t, load: () => loadQueue(ctx), render: data => queue(ctx, data, filter, region) });
  return h('div', null, head, h('div', { class: 'banner banner-info', role: 'note' }, t('p7.review.howItWorks')),
    /* Phase 12: learner evidence (written lab tasks, passport entries) is reviewed on its own screen. */
    h('p', null, h('a', { class: 'btn btn-secondary', href: '#/review/evidence', dataset: { action: 'open-evidence-review' } }, t('pp12.review.title'))), region);
}

function queue(ctx, { items, decisions, session }, filter, region) {
  const { t, i18n } = ctx;
  const decided = new Map(decisions.map(d => [d.id, d]));
  const keyOf = it => `${it.file}:${it.rec.id}`;
  const pending = items.filter(it => it.rec.governance.content_status !== 'published');

  // --- reviewer identity (required, never pre-filled by the platform)
  const nameIn = h('input', { class: 'input', id: 'rv-name', name: 'reviewer', autocomplete: 'name', required: true, value: session?.name || '', 'aria-describedby': 'rv-name-hint rv-name-err' });
  const roleIn = h('input', { class: 'input', id: 'rv-role', name: 'reviewer_role', value: session?.role || '', 'aria-describedby': 'rv-role-hint' });
  const dateIn = h('input', { class: 'input', id: 'rv-date', name: 'review_date', type: 'date', value: session?.date || today() });
  const nameErr = h('span', { class: 'err', id: 'rv-name-err', 'aria-live': 'polite' });
  const remember = async () => ctx.repos.reviewSession.save({ id: 'me', name: nameIn.value.trim(), role: roleIn.value.trim(), date: dateIn.value });
  [nameIn, roleIn, dateIn].forEach(el => el.addEventListener('change', remember));
  const reviewerOk = () => {
    const ok = nameIn.value.trim().length >= 3;
    nameErr.textContent = ok ? '' : t('p7.review.needName');
    nameIn.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok) nameIn.focus();
    return ok;
  };
  const who = h('section', { class: 'panel', 'aria-labelledby': 'rv-who' }, h('h2', { id: 'rv-who' }, t('p7.review.reviewer')),
    h('div', { class: 'formgrid' },
      h('div', { class: 'field' }, h('label', { for: 'rv-name' }, t('p7.review.name') + ' *'), h('span', { class: 'hint', id: 'rv-name-hint' }, t('p7.review.nameHint')), nameIn, nameErr),
      h('div', { class: 'field' }, h('label', { for: 'rv-role' }, t('p7.review.role')), h('span', { class: 'hint', id: 'rv-role-hint' }, t('p7.review.roleHint')), roleIn),
      h('div', { class: 'field' }, h('label', { for: 'rv-date' }, t('p7.review.date')), dateIn)));

  // --- progress + export
  const counts = { total: pending.length, approve: decisions.filter(d => d.decision === 'approve').length, changes: decisions.filter(d => d.decision === 'changes_requested').length };
  const exportFile = () => {
    if (!reviewerOk()) return;
    if (!decisions.length) { toast(t('p7.review.nothingToExport')); return; }
    const payload = { schema: DECISION_SCHEMA, app: 'cia-academy', exported_at: new Date().toISOString(), reviewer: { name: nameIn.value.trim(), role: roleIn.value.trim() || null }, decisions: decisions.map(({ id, ...d }) => d) };
    const textOut = JSON.stringify(payload, null, 2);
    const fileName = `cia-review-decisions-${today()}.json`;
    try {
      const blob = new Blob([textOut], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* some embedded viewers block downloads — the copy panel below still works */ }
    toast(t('p7.review.exported', { n: i18n.number(decisions.length) }));
    // Always offer the same content as text: where downloads are blocked, the reviewer copies it into a .json file.
    const area = h('textarea', { class: 'textarea mono', id: 'rv-export-text', rows: '10', readonly: true, 'aria-label': fileName }, textOut);
    const status = h('p', { class: 'note', 'aria-live': 'polite' });
    const copy = Button({ label: t('p7.review.copy'), variant: 'secondary', attrs: { 'data-action': 'copy-decisions' }, onClick: async () => {
      try { await navigator.clipboard.writeText(textOut); status.textContent = t('p7.review.copied'); }
      catch { area.focus(); area.select(); status.textContent = t('p7.review.copyManual'); }
    } });
    openDialog({ title: t('p7.review.exportTitle'), body: h('div', { class: 'stack' }, h('p', null, t('p7.review.exportBody', { file: fileName })), area, copy, status),
      actions: [{ label: t('a11y.close'), variant: 'primary' }] });
  };
  const clearAll = () => openDialog({ title: t('p7.review.clearTitle'), body: t('p7.review.clearBody'), actions: [
    { label: t('settings.data.cancel'), variant: 'secondary' },
    { label: t('p7.review.clear'), variant: 'danger', onClick: async () => { for (const d of decisions) await ctx.repos.reviewDecisions.remove(d.id); toast(t('p7.review.cleared')); region.refresh(); } }] });
  const progress = h('section', { class: 'panel feature', 'aria-labelledby': 'rv-prog' }, h('h2', { id: 'rv-prog' }, t('p7.review.progress')),
    h('ul', { class: 'stats' }, [['pending', counts.total], ['approve', counts.approve], ['changes', counts.changes], ['open', Math.max(0, counts.total - decided.size)]].map(([k, v]) =>
      h('li', null, h('span', { class: 'bigpct' }, i18n.number(v)), h('span', null, t('p7.review.count.' + k))))),
    h('div', { class: 'btnrow' }, Button({ label: t('p7.review.export'), iconName: 'download', onClick: exportFile, attrs: { 'data-action': 'export-decisions' } }),
      decisions.length ? Button({ label: t('p7.review.clear'), variant: 'quiet', onClick: clearAll }) : null),
    h('p', { class: 'note' }, t('p7.review.applyNote')));

  // --- filters
  const list = h('div', { class: 'rv-list' });
  const countEl = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
  const byFile = new Map(); for (const it of items) { if (!byFile.has(it.file)) byFile.set(it.file, []); byFile.get(it.file).push(it); }
  const questionIds = items.filter(it => it.file === 'questions').map(it => it.rec.id);
  const assessmentIds = items.filter(it => it.file === 'assessments').map(it => it.rec.id);
  const relatedOf = course => items.filter(it => (it.file === 'assessments' && it.rec.course_id === course.id) || (it.file === 'questions' && it.rec.course_id === course.id));

  const paint = () => {
    const q = filter.q.trim().toLowerCase();
    const xs = (filter.collection === 'all' ? items : byFile.get(filter.collection) || [])
      .filter(it => filter.state === 'all' ? true : filter.state === 'pending' ? it.rec.governance.content_status !== 'published' && !decided.has(keyOf(it)) : decided.has(keyOf(it)))
      .filter(it => !q || `${it.rec.id} ${title(ctx, it.rec)}`.toLowerCase().includes(q));
    countEl.textContent = t('p7.review.showing', { n: i18n.number(xs.length) });
    list.replaceChildren(...(xs.length ? xs.slice(0, 200).map(it => recordCard(ctx, it, decided.get(keyOf(it)), { reviewerOk, nameIn, roleIn, dateIn, region, questionIds, assessmentIds, related: it.file === 'courses' ? relatedOf(it.rec) : [] }))
      : [EmptyState({ title: t('p7.review.emptyTitle'), body: t('p7.review.emptyBody') })]));
  };
  const sel = (id, label, value, options, onChange) => h('div', { class: 'field' }, h('label', { for: id }, label),
    h('select', { class: 'select', id, onchange: e => { onChange(e.target.value); paint(); } }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l))));
  const filters = h('div', { class: 'filters' },
    sel('rv-col', t('p7.review.collection'), filter.collection, [['all', t('p7.review.all')], ...COLLECTIONS.filter(([f]) => byFile.has(f)).map(([f]) => [f, t('p7.review.col.' + f.replace('competency/', '').replace('-', '_')) + ` (${i18n.number(byFile.get(f).length)})`])], v => { filter.collection = v; }),
    sel('rv-state', t('p7.review.state'), filter.state, [['pending', t('p7.review.statePending')], ['decided', t('p7.review.stateDecided')], ['all', t('p7.review.all')]], v => { filter.state = v; }),
    h('div', { class: 'field' }, h('label', { for: 'rv-q' }, t('p7.course.search')), h('input', { class: 'input', id: 'rv-q', type: 'search', oninput: e => { filter.q = e.target.value; paint(); } })));
  paint();
  return h('div', null, who, progress, section('rv-queue', t('p7.review.queue'), filters, countEl, list));
}

function recordCard(ctx, it, decision, env) {
  const { t, i18n } = ctx;
  const r = it.rec, g = r.governance;
  const missing = it.file === 'courses' ? courseCompleteness(r, { questionIds: env.questionIds, assessmentIds: env.assessmentIds }) : [];
  const uid = `${it.file}:${r.id}`.replace(/[^a-z0-9]/gi, '-');
  const checks = CHECKS.map(c => h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'chk-' + uid, value: c, checked: decision?.checklist?.includes(c) }), t('p7.review.check.' + c)));
  const radios = [['approve', t('p7.review.approve')], ['changes_requested', t('p7.review.changes')]].map(([v, l]) =>
    h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'dec-' + uid, value: v, checked: decision?.decision === v }), l));
  const comment = h('textarea', { class: 'textarea', id: 'cm-' + uid, rows: '3' }, decision?.comment || '');
  const err = h('p', { class: 'err', 'aria-live': 'polite' });
  const bundle = env.related.length ? h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'bundle-' + uid }), t('p7.review.bundle', { n: i18n.number(env.related.length) })) : null;

  const save = async () => {
    err.textContent = '';
    if (!env.reviewerOk()) return;
    const decisionVal = radios.map(l => l.querySelector('input')).find(i => i.checked)?.value;
    const picked = checks.map(l => l.querySelector('input')).filter(i => i.checked).map(i => i.value);
    if (!decisionVal) { err.textContent = t('p7.review.pickDecision'); return; }
    if (decisionVal === 'approve' && picked.length < CHECKS.length) { err.textContent = t('p7.review.needChecks'); return; }
    if (decisionVal === 'approve' && missing.length) { err.textContent = t('p7.review.incomplete'); return; }
    if (decisionVal === 'changes_requested' && comment.value.trim().length < 5) { err.textContent = t('p7.review.needComment'); comment.focus(); return; }
    const base = { decision: decisionVal, comment: comment.value.trim(), checklist: picked, reviewer: env.nameIn.value.trim(), reviewer_role: env.roleIn.value.trim() || null, review_date: env.dateIn.value || today(), decided_at: new Date().toISOString() };
    const targets = [it, ...(bundle?.querySelector('input').checked ? env.related : [])];
    for (const x of targets) await ctx.repos.reviewDecisions.save({ id: `${x.file}:${x.rec.id}`, collection: x.file, record_id: x.rec.id, version: x.rec.governance.version, ...base, bundled_with: x === it ? null : r.id });
    toast(t('p7.review.saved', { n: i18n.number(targets.length) }));
    env.region.refresh();
  };
  const undo = async () => { await ctx.repos.reviewDecisions.remove(`${it.file}:${r.id}`); toast(t('p7.review.undone')); env.region.refresh(); };

  return h('details', { class: 'card rv', dataset: { review: `${it.file}:${r.id}` } },
    h('summary', null, h('span', { class: 'cid' }, r.id), ' ', h('span', null, title(ctx, r)), ' ',
      Badge({ label: t('labels.governance.' + g.content_status), tone: g.content_status === 'published' ? 'ok' : 'warn' }),
      decision ? Badge({ label: t('p7.review.dec.' + decision.decision), tone: decision.decision === 'approve' ? 'ok' : 'bad' }) : null),
    facts([[t('p7.gov.source'), t('p7.gov.src.' + g.content_source)], [t('p7.gov.version'), g.version], [t('p7.gov.reviewer'), g.reviewer || t('p7.gov.noReviewer')], [t('p7.gov.note'), g.change_note || '—']]),
    preview(ctx, it),
    missing.length ? h('div', { class: 'banner banner-warn' }, h('strong', null, t('p7.review.missing')), ' ', missing.join(', ')) : null,
    h('fieldset', { class: 'fs' }, h('legend', null, t('p7.review.checklist')), checks),
    h('fieldset', { class: 'fs' }, h('legend', null, t('p7.review.decision')), radios),
    h('div', { class: 'field' }, h('label', { for: 'cm-' + uid }, t('p7.review.comment')), comment),
    bundle, err,
    h('div', { class: 'btnrow' }, Button({ label: t('p7.review.saveDecision'), onClick: save, attrs: { 'data-action': 'save-decision' } }),
      decision ? Button({ label: t('p7.review.undo'), variant: 'quiet', onClick: undo }) : null));
}

/** A compact, read-only look at the record so the reviewer can judge it without leaving the queue. */
function preview(ctx, { file, rec: r }) {
  const { t, i18n } = ctx;
  if (file === 'courses') return h('div', { class: 'rv-prev' }, h('p', null, L(ctx, r.overview)),
    h('p', { class: 'note' }, t('p7.review.courseShape', { m: i18n.number((r.modules || []).length), l: i18n.number((r.modules || []).flatMap(m => m.lessons || []).length), h: i18n.number(r.training_hours || 0) })),
    h('a', { class: 'btn btn-secondary', href: `#/academy/courses/${r.slug}` }, t('p7.review.openCourse')));
  if (file === 'questions') return h('div', { class: 'rv-prev' }, r.scenario ? h('p', { class: 'scenario' }, L(ctx, r.scenario)) : null, h('p', null, h('strong', null, L(ctx, r.prompt))),
    r.options ? h('ul', { class: 'plain' }, r.options.map(o => h('li', null, String(o.id) === String(r.correct_answer) || (Array.isArray(r.correct_answer) && r.correct_answer.includes(o.id)) ? Badge({ label: t('p7.review.key'), tone: 'ok' }) : null, ' ', L(ctx, o.text), o.why ? h('span', { class: 'note' }, ' — ', L(ctx, o.why)) : null))) : null,
    r.explanation ? h('p', { class: 'note' }, L(ctx, r.explanation)) : null);
  if (file === 'assessments') return h('div', { class: 'rv-prev' }, h('p', { class: 'note' }, t('p7.asm.meta', { n: i18n.number((r.question_ids || []).length), pass: i18n.number(r.scoring?.passing_score ?? 0) })),
    h('a', { class: 'btn btn-secondary', href: `#/assessments/${r.slug}` }, t('p7.review.openAssessment')));
  if (file === 'iso-standards') return h('div', { class: 'rv-prev' }, h('p', null, L(ctx, r.purpose)), r.edition ? h('p', { class: 'note' }, r.edition.label, ' — ', L(ctx, r.edition.status)) : null,
    h('a', { class: 'btn btn-secondary', href: `#/academy/iso/${r.slug}` }, t('p7.review.openStandard')));
  if (file === 'sources') return h('div', { class: 'rv-prev' }, h('p', null, r.organization, ' — ', r.title), r.official_url ? h('p', null, h('a', { href: r.official_url, target: '_blank', rel: 'noopener' }, r.official_url)) : null, r.verification_note ? h('p', { class: 'note' }, r.verification_note) : null);
  const desc = r.definition || r.description || r.goal || r.purpose;
  return desc ? h('div', { class: 'rv-prev' }, h('p', null, L(ctx, desc))) : null;
}
