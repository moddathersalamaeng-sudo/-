/**
 * Phase 14 — administration (#/admin, account menu; administrators and reviewers). Tabs by role:
 *   content · decisions · evidence (shared review queue) · verification · users · analytics · settings · export · audit
 * Every action is checked again by the API and the database; this page only hides what would be refused.
 * Publishing still needs a named decision and the publishing script (D-115): saving a draft never publishes anything.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Button, EmptyState, dataRegion, toast, Table, Badge, Tabs, LinkButton } from '../ui/components.js';
import { CMS_COLLECTIONS, CMS_GROUPS, validateDraft, can, FEATURE_TIERS, TIERS, analyticsSections, verificationReminders, VERIFICATION_STATUSES, validateCertVerification } from '../domain/production.mjs';
import { put, download, localToday } from './company-share.js';

const TABS = [
  { key: 'content', action: 'cms.read', icon: 'doc' }, { key: 'decisions', action: 'cms.decide', icon: 'check' }, { key: 'evidence', action: 'review.queue', icon: 'clipboard' },
  { key: 'verification', action: 'verification.write', icon: 'shield' }, { key: 'users', action: 'users.manage', icon: 'users' }, { key: 'analytics', action: 'analytics.read', icon: 'chart' },
  { key: 'settings', action: 'settings.write', icon: 'cog' }, { key: 'export', action: 'cms.export', icon: 'download' }, { key: 'audit', action: 'users.manage', icon: 'eye' }
];
const errMsg = (ctx, e) => ctx.t('p14.err.' + ({ forbidden: 'forbidden', invalid: 'invalid', draft: 'draft', state: 'state', not_found: 'notFound', exists: 'exists', scores: 'scores', offline: 'offline', verification: 'invalid' }[e?.code] || 'generic'))
  + (Array.isArray(e?.detail) ? ' (' + e.detail.join(', ') + ')' : e?.detail && typeof e.detail === 'object' ? ' (' + Object.keys(e.detail).join(', ') + ')' : '');
const L = (ctx, v) => (v && typeof v === 'object' ? v[ctx.i18n.locale] || v.en || v.ar || '' : v || '');
const day = v => (v ? String(v).slice(0, 10) : '');

export function adminView(ctx, match) {
  const { t, session } = ctx;
  if (!ctx.backend || !session.signedIn) return h('div', { class: 'page', dataset: { admin: 'off' } }, h('h1', null, t('p14.admin.title')),
    EmptyState({ title: t('p14.admin.offTitle'), body: t('p14.admin.offBody'), iconName: 'lock', action: ctx.backend ? LinkButton({ label: t('p14.account.signIn'), href: '#/account' }) : null }));
  const tabs = TABS.filter(x => can(session.roles, x.action));
  const want = tabs.findIndex(x => x.key === match?.query?.tab);
  return h('div', { class: 'page admin', dataset: { admin: 'on' } },
    h('h1', null, t('p14.admin.title')),
    h('p', { class: 'lede' }, t('p14.admin.lede')),
    Tabs({ label: t('p14.admin.title'), lazy: true, initial: Math.max(0, want), onSelect: i => history.replaceState(null, '', `#/admin?tab=${tabs[i].key}`),
      tabs: tabs.map(x => ({ key: x.key, label: h('span', null, icon(x.icon), ' ', t('p14.admin.tab.' + x.key)), content: () => PANELS[x.key](ctx) })) }));
}

/* ------------------------------------------------------------------ content (drafts, preview, history, restore) */
function contentPanel(ctx) {
  const { t, i18n, session } = ctx;
  const canWrite = can(session.roles, 'cms.write');
  const sel = h('select', { class: 'select', id: 'cms-coll', dataset: { cmsCollection: '' } }, CMS_COLLECTIONS.map(c => h('option', { value: c }, `${c} · ${t('p14.cms.group.' + CMS_GROUPS[c])}`)));
  const filter = h('input', { class: 'input', id: 'cms-filter', type: 'search', placeholder: t('p14.cms.filter'), 'aria-label': t('p14.cms.filter') });
  const list = h('div', { 'aria-live': 'polite' });
  const editor = h('div', { dataset: { cmsEditor: '' } });
  const load = async () => {
    put(list, h('p', { class: 'note' }, t('states.loading')));
    try {
      const d = await ctx.api.get(`/admin/content?collection=${encodeURIComponent(sel.value)}`);
      const q = filter.value.trim().toLowerCase();
      const recs = d.records.filter(r => !q || r.id.toLowerCase().includes(q) || L(ctx, r.title).toLowerCase().includes(q));
      put(list,
        d.drafts.length ? h('div', { class: 'panel', dataset: { cmsDrafts: String(d.drafts.length) } }, h('h2', null, t('p14.cms.openDrafts', { n: i18n.number(d.drafts.length) })),
          h('ul', { class: 'plain' }, d.drafts.map(x => h('li', null, h('button', { class: 'linklike', type: 'button', dataset: { openDraft: x.id }, onclick: () => openDraft(ctx, x.id, editor, load) }, x.record_id), ' · v', i18n.number(x.version), ' · ', Badge({ label: t('p14.cms.st.' + x.status), tone: x.status === 'approved' ? 'ok' : x.status === 'submitted' ? 'info' : 'neutral' }), ' · ', x.author_name)))) : null,
        Table({ caption: t('p14.cms.records'), columns: [{ key: 'id', label: 'ID' }, { key: 'title', label: t('p14.cms.titleCol') }, { key: 'st', label: t('p14.cms.statusCol') }, { key: 'v', label: t('p14.cms.versionCol') }, { key: 'act', label: h('span', { class: 'sr-only' }, t('p14.cms.actions')) }],
          rows: recs.slice(0, 200).map(r => ({ id: h('code', null, r.id), title: L(ctx, r.title) || '—', st: r.status ? Badge({ label: t('p14.gov.' + r.status), tone: r.status === 'published' ? 'ok' : 'warn' }) : '—', v: r.version || '—',
            act: canWrite ? Button({ label: t('p14.cms.edit'), variant: 'quiet', onClick: () => newDraftFrom(ctx, sel.value, r.id, editor, load), attrs: { 'data-action': 'cms-edit', 'data-record': r.id } }) : '' })) }),
        recs.length > 200 ? h('p', { class: 'note' }, t('p14.cms.more', { n: i18n.number(recs.length - 200) })) : null);
    } catch (e) { put(list, h('p', { class: 'errsum', role: 'alert' }, errMsg(ctx, e))); }
  };
  sel.addEventListener('change', load); filter.addEventListener('input', () => { clearTimeout(filter._t); filter._t = setTimeout(load, 250); });
  load();
  return h('div', { class: 'cms' }, h('p', null, t('p14.cms.lede')), h('p', { class: 'banner banner-info', role: 'note' }, t('p14.cms.honest')),
    h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: 'cms-coll' }, t('p14.cms.collection')), sel), h('div', { class: 'field' }, h('label', { for: 'cms-filter' }, t('p14.cms.filter')), filter)),
    canWrite ? h('div', { class: 'btnrow' }, Button({ label: t('p14.cms.newRecord'), variant: 'secondary', iconName: 'doc', onClick: () => editDraft(ctx, { collection: sel.value, data: { id: '', governance: { content_status: 'draft', content_source: 'owner', version: '0.1' } } }, editor, load), attrs: { 'data-action': 'cms-new' } })) : null,
    editor, list);
}

async function newDraftFrom(ctx, collection, id, editor, reload) {
  try {
    const { record } = await ctx.api.get(`/admin/content/record?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`);
    const data = structuredClone(record);
    data.governance = { ...(data.governance || {}), content_status: 'needs_review' };
    editDraft(ctx, { collection, data }, editor, reload);
  } catch (e) { toast(errMsg(ctx, e)); }
}

function previewOf(ctx, data) {
  const pick = ['title', 'name', 'summary', 'description', 'question', 'prompt'];
  return h('dl', { class: 'kv', dataset: { cmsPreview: '' } }, pick.filter(k => data?.[k]).map(k => [h('dt', null, k), h('dd', null, typeof data[k] === 'object' ? [h('span', { lang: 'ar', dir: 'rtl' }, data[k].ar || ''), h('br'), h('span', { lang: 'en', dir: 'ltr' }, data[k].en || '')] : String(data[k]))]),
    h('dt', null, 'governance'), h('dd', null, h('code', { dir: 'ltr' }, `${data?.governance?.content_status || '—'} · v${data?.governance?.version || '—'} · ${data?.governance?.content_source || '—'}`)));
}

/** The JSON editor: validate (same rules as the server), preview, save as a new version, submit for review. */
function editDraft(ctx, { id = null, collection, data, status = 'draft' }, editor, reload) {
  const { t } = ctx;
  const ta = h('textarea', { class: 'textarea code', id: 'cms-json', rows: 18, dir: 'ltr', spellcheck: 'false', 'aria-describedby': 'cms-json-err' }, JSON.stringify(data, null, 2));
  const err = h('p', { class: 'err', id: 'cms-json-err', role: 'alert' });
  const pv = h('div', { class: 'panel' }, previewOf(ctx, data));
  const note = h('input', { class: 'input', id: 'cms-note', maxlength: 500, placeholder: t('p14.cms.notePh') });
  const parse = () => { try { return JSON.parse(ta.value); } catch { return null; } };
  const check = () => { const d = parse(); if (!d) { err.textContent = t('p14.cms.badJson'); return null; } const e = validateDraft(collection, d); err.textContent = e.length ? t('p14.err.draft') + ' (' + e.join(', ') + ')' : ''; put(pv, previewOf(ctx, d)); return e.length ? null : d; };
  ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(check, 300); });
  const save = async () => {
    const d = check(); if (!d) return;
    try {
      const r = id ? await ctx.api.put(`/admin/drafts/${id}`, { data: d, note: note.value }) : await ctx.api.post('/admin/drafts', { collection, data: d, note: note.value });
      toast(t('p14.cms.saved', { v: r.version }));
      openDraft(ctx, r.id || id, editor, reload); reload();
    } catch (e) { err.textContent = errMsg(ctx, e); }
  };
  put(editor, h('section', { class: 'panel feature', 'aria-labelledby': 'cms-ed-h', dataset: { cmsEditing: data.id || 'new' } },
    h('h2', { id: 'cms-ed-h' }, t('p14.cms.editing', { id: data.id || t('p14.cms.newRecord') }), ' · ', h('code', null, collection)),
    h('div', { class: 'grid grid-2' }, h('div', { class: 'field' }, h('label', { for: 'cms-json' }, t('p14.cms.json')), ta, err), h('div', null, h('h3', null, t('p14.cms.preview')), pv)),
    h('div', { class: 'field' }, h('label', { for: 'cms-note' }, t('p14.cms.note')), note),
    h('div', { class: 'btnrow' }, Button({ label: t('p14.cms.save'), variant: 'primary', onClick: save, attrs: { 'data-action': 'cms-save' } }), Button({ label: t('settings.data.cancel'), variant: 'quiet', onClick: () => put(editor) }))));
  editor.scrollIntoView?.({ block: 'start' });
}

async function openDraft(ctx, id, editor, reload) {
  const { t, i18n, session } = ctx;
  try {
    const d = await ctx.api.get(`/admin/drafts/${id}`);
    const dr = d.draft;
    const canWrite = can(session.roles, 'cms.write');
    const editable = canWrite && ['draft', 'changes_requested'].includes(dr.status);
    put(editor, h('section', { class: 'panel feature', dataset: { draft: dr.id, draftStatus: dr.status, draftVersion: String(dr.version) } },
      h('h2', null, h('code', null, dr.record_id), ' · ', dr.collection, ' · v', i18n.number(dr.version), ' ', Badge({ label: t('p14.cms.st.' + dr.status), tone: dr.status === 'approved' ? 'ok' : 'info' })),
      h('p', { class: 'note' }, t('p14.cms.by', { who: dr.author_name })),
      h('div', { class: 'panel' }, previewOf(ctx, dr.data)),
      h('div', { class: 'btnrow' },
        editable ? Button({ label: t('p14.cms.edit'), variant: 'secondary', onClick: () => editDraft(ctx, { id: dr.id, collection: dr.collection, data: dr.data }, editor, reload), attrs: { 'data-action': 'cms-edit-draft' } }) : null,
        editable ? Button({ label: t('p14.cms.submit'), variant: 'primary', onClick: async () => { try { await ctx.api.post(`/admin/drafts/${dr.id}/submit`, {}); toast(t('p14.cms.submitted')); openDraft(ctx, id, editor, reload); reload(); } catch (e) { toast(errMsg(ctx, e)); } }, attrs: { 'data-action': 'cms-submit' } }) : null),
      h('h3', null, t('p14.cms.history')),
      h('ol', { class: 'cms-history', dataset: { versions: String(d.versions.length) } }, d.versions.map(v => h('li', null,
        h('strong', null, 'v' + i18n.number(v.version)), ' · ', v.saved_name, ' · ', i18n.date(day(v.saved_at)), v.note ? ' · ' + v.note : '',
        v.changes.length ? h('ul', { class: 'note' }, v.changes.slice(0, 8).map(c => h('li', null, h('code', { dir: 'ltr' }, c.path)))) : null,
        editable && v.version !== dr.version ? Button({ label: t('p14.cms.restore', { v: v.version }), variant: 'quiet', onClick: async () => { try { await ctx.api.post(`/admin/drafts/${dr.id}/restore`, { version: v.version }); toast(t('p14.cms.restored')); openDraft(ctx, id, editor, reload); } catch (e) { toast(errMsg(ctx, e)); } }, attrs: { 'data-action': 'cms-restore', 'data-version': String(v.version) } }) : null))),
      d.decisions.length ? [h('h3', null, t('p14.cms.decisions')), h('ul', null, d.decisions.map(x => h('li', null, t('p14.dec.' + x.decision), ' · ', x.reviewer_name, ' · ', i18n.date(day(x.review_date)), ' · ', t('p14.basis.' + x.basis), x.comment ? ' — ' + x.comment : '')))] : null));
  } catch (e) { toast(errMsg(ctx, e)); }
}

/* ------------------------------------------------------------------ decisions on submitted drafts */
function decisionsPanel(ctx) {
  const { t, i18n, session } = ctx;
  return dataRegion({ t, load: () => ctx.api.get('/admin/drafts?status=submitted'), render: ({ drafts }) => {
    if (!drafts.length) return EmptyState({ title: t('p14.dec.none'), level: 2 });
    return h('ul', { class: 'plain', dataset: { decisionQueue: String(drafts.length) } }, drafts.map(dr => {
      const name = h('input', { class: 'input', value: session.user.display_name || '', maxlength: 80, 'aria-label': t('p14.dec.reviewer') });
      const comment = h('textarea', { class: 'textarea', rows: 2, 'aria-label': t('p14.dec.comment') });
      const owner = h('input', { type: 'checkbox', id: 'own-' + dr.id });
      const out = h('p', { 'aria-live': 'polite' });
      const decide = async decision => {
        try { await ctx.api.post(`/admin/drafts/${dr.id}/decision`, { decision, reviewer_name: name.value, comment: comment.value, basis: owner.checked ? 'owner_approval' : 'expert_review' }); toast(t('p14.dec.saved')); out.textContent = t('p14.dec.' + decision); out.dataset.decided = decision; }
        catch (e) { out.textContent = errMsg(ctx, e); out.dataset.decided = 'error'; }
      };
      return h('li', { class: 'card', dataset: { decide: dr.id, mine: String(dr.mine) } },
        h('p', null, h('code', null, dr.record_id), ' · ', dr.collection, ' · v', i18n.number(dr.version), ' · ', t('p14.cms.by', { who: dr.author_name })),
        dr.mine ? h('p', { class: 'banner banner-warn', role: 'note' }, t('p14.dec.ownDraft')) : null,
        h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('span', null, t('p14.dec.reviewer')), name), h('div', { class: 'field' }, h('span', null, t('p14.dec.comment')), comment)),
        h('label', { class: 'choice', for: 'own-' + dr.id }, owner, h('span', null, t('p14.dec.ownerBasis'))),
        h('div', { class: 'btnrow' }, Button({ label: t('p14.dec.approve'), variant: 'primary', onClick: () => decide('approve'), attrs: { 'data-action': 'approve' } }),
          Button({ label: t('p14.dec.changes'), variant: 'secondary', onClick: () => decide('changes_requested'), attrs: { 'data-action': 'request-changes' } })), out,
        h('p', { class: 'note' }, t('p14.dec.prereview')));
    }));
  } });
}

/* ------------------------------------------------------------------ shared evidence review (D-116) */
function evidencePanel(ctx) {
  const { t, i18n, session } = ctx;
  const region = dataRegion({ t, load: () => ctx.api.get('/reviews/queue'), render: ({ requests, sla_hours }) => h('div', { dataset: { evidenceQueue: String(requests.length) } },
    h('p', null, t('p14.ev.lede')),
    h('p', { class: 'note', dataset: { sla: sla_hours == null ? 'not_set' : String(sla_hours) } }, sla_hours == null ? t('p14.ev.slaNotSet') : t('p14.ev.sla', { n: i18n.number(sla_hours) })),
    requests.length ? h('ul', { class: 'plain' }, requests.map(r => h('li', { class: 'card', dataset: { request: r.id, status: r.status } },
      h('p', null, h('strong', null, h('bdi', { dir: 'ltr' }, r.reference)), ' · ', L(ctx, r.payload.lab_title) || r.lab_id, ' · ', t('p14.ev.age', { h: i18n.number(r.sla.age_hours) }), ' ',
        Badge({ label: t('p14.ev.sla_' + r.sla.state), tone: r.sla.state === 'overdue' ? 'bad' : r.sla.state === 'due_soon' ? 'warn' : 'neutral' })),
      r.mine ? scoreForm(ctx, r, region) : Button({ label: t('p14.ev.claim'), variant: 'primary', onClick: async () => { try { await ctx.api.post(`/reviews/${r.id}/claim`, { name: session.user.display_name }); toast(t('p14.ev.claimed')); region.refresh(); } catch (e) { toast(errMsg(ctx, e)); } }, attrs: { 'data-action': 'claim' } }))))
      : EmptyState({ title: t('p14.ev.none'), level: 2 })) });
  return region;
}

function scoreForm(ctx, r, region) {
  const { t, i18n } = ctx;
  const inputs = r.payload.tasks.map(task => ({ task, score: h('input', { class: 'input input-short', type: 'number', min: 0, max: task.max, step: '0.5', 'aria-label': t('p14.ev.score', { max: task.max }), dataset: { scoreFor: task.task_id } }),
    comment: h('textarea', { class: 'textarea', rows: 2, maxlength: 500, 'aria-label': t('p14.dec.comment') }) }));
  const out = h('p', { 'aria-live': 'polite' });
  return h('form', { class: 'panel', dataset: { scoreForm: r.id }, onsubmit: async e => {
    e.preventDefault();
    const scores = inputs.filter(x => x.score.value !== '').map(x => ({ task_id: x.task.task_id, score: Number(x.score.value), comment: x.comment.value }));
    if (!scores.length) { out.textContent = t('p14.ev.noScores'); return; }
    try { const res = await ctx.api.post(`/reviews/${r.id}/scores`, { scores, date: localToday() }); out.dataset.result = res.status; toast(t('p14.ev.done')); region.refresh(); }
    catch (x) { out.textContent = errMsg(ctx, x); }
  } },
  inputs.map(({ task, score, comment }) => h('fieldset', { class: 'fs' }, h('legend', null, L(ctx, task.prompt)),
    h('blockquote', { class: 'answer', dir: 'auto' }, task.answer || '—'),
    task.rubric?.length ? h('ul', { class: 'note' }, task.rubric.map(c => h('li', null, L(ctx, c.label || c.text || c.criterion || c.id)))) : null,
    h('div', { class: 'formgrid' }, h('label', null, t('p14.ev.score', { max: i18n.number(task.max) }), ' ', score), h('label', null, t('p14.dec.comment'), ' ', comment)))),
  h('p', { class: 'note' }, t('p14.ev.rule')),
  h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'submit-scores' } }, t('p14.ev.submit'))), out);
}

/* ------------------------------------------------------------------ verification center (D-117) */
function verificationPanel(ctx) {
  const { t, i18n } = ctx;
  const region = dataRegion({ t, load: () => ctx.api.get('/admin/verifications'), render: ({ verifications, reminders }) => {
    const edit = h('div', { dataset: { verifyEditor: '' } });
    const rows = verifications.map(v => ({ id: h('code', null, v.cert_id), name: L(ctx, v.name) || v.code || '', st: Badge({ label: t('p14.ver.st.' + v.status), tone: v.status === 'verified' ? 'ok' : v.status === 'changed' ? 'bad' : 'warn' }),
      last: v.last_verified ? i18n.date(v.last_verified) : '—', who: v.verifier || '—', next: v.next_review ? i18n.date(v.next_review) : '—',
      act: Button({ label: t('p14.cms.edit'), variant: 'quiet', onClick: () => verifyForm(ctx, v, edit, region), attrs: { 'data-action': 'verify-edit', 'data-cert': v.cert_id } }) }));
    return h('div', { dataset: { verifications: String(verifications.length), reminders: String(reminders.length) } },
      h('p', null, t('p14.ver.lede')), h('p', { class: 'banner banner-info', role: 'note' }, t('p14.ver.honest')),
      h('section', { class: 'panel', 'aria-labelledby': 'ver-rem-h' }, h('h2', { id: 'ver-rem-h' }, icon('clock'), ' ', t('p14.ver.reminders', { n: i18n.number(reminders.length) })),
        reminders.length ? h('ul', { class: 'plain' }, reminders.slice(0, 30).map(v => h('li', null, h('code', null, v.cert_id), ' · ', v.missing_date ? t('p14.ver.noDate') : (v.overdue ? t('p14.ver.overdue') : t('p14.ver.due')) + ' ' + i18n.date(v.next_review)))) : h('p', { class: 'note' }, t('p14.ver.noReminders'))),
      edit,
      Table({ caption: t('p14.admin.tab.verification'), columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: t('p14.cms.titleCol') }, { key: 'st', label: t('p14.cms.statusCol') }, { key: 'last', label: t('p14.ver.last') }, { key: 'who', label: t('p14.ver.who') }, { key: 'next', label: t('p14.ver.next') }, { key: 'act', label: h('span', { class: 'sr-only' }, t('p14.cms.actions')) }], rows }));
  } });
  return region;
}

function verifyForm(ctx, v, box, region) {
  const { t } = ctx;
  const f = (name, type, value, attrs = {}) => h('input', { class: 'input', name, type, value: value || '', id: 'vf-' + name, ...attrs });
  const status = h('select', { class: 'select', id: 'vf-status', name: 'status' }, VERIFICATION_STATUSES.map(s => h('option', { value: s, selected: v.status === s }, t('p14.ver.st.' + s))));
  const facts = h('textarea', { class: 'textarea code', id: 'vf-facts', rows: 5, dir: 'ltr' }, JSON.stringify(v.facts || {}, null, 2));
  const fields = { source_url: f('source_url', 'url', v.source_url, { dir: 'ltr' }), last_verified: f('last_verified', 'date', v.last_verified), verifier: f('verifier', 'text', v.verifier, { maxlength: 80 }), next_review: f('next_review', 'date', v.next_review),
    notes: h('textarea', { class: 'textarea', id: 'vf-notes', rows: 2, maxlength: 2000 }, v.notes || '') };
  const err = h('p', { class: 'err', role: 'alert' });
  put(box, h('form', { class: 'panel feature', dataset: { verifyForm: v.cert_id }, onsubmit: async e => {
    e.preventDefault();
    let fx; try { fx = JSON.parse(facts.value || '{}'); } catch { err.textContent = t('p14.cms.badJson'); return; }
    const body = { body: v.body || '', status: status.value, source_url: fields.source_url.value || null, last_verified: fields.last_verified.value || null, verifier: fields.verifier.value || null, next_review: fields.next_review.value || null, notes: fields.notes.value, facts: fx };
    const errs = validateCertVerification({ ...body, cert_id: v.cert_id }, localToday());
    if (errs.length) { err.textContent = t('p14.err.invalid') + ' (' + errs.join(', ') + ')'; return; }
    try { await ctx.api.put(`/admin/verifications/${encodeURIComponent(v.cert_id)}`, body); toast(t('p14.ver.saved')); region.refresh(); } catch (x) { err.textContent = errMsg(ctx, x); }
  } }, h('h2', null, h('code', null, v.cert_id), ' ', L(ctx, v.name) || ''),
  v.content_verified_date ? h('p', { class: 'note' }, t('p14.ver.inContent', { d: v.content_verified_date, s: v.content_facts_status || '—' })) : null,
  h('div', { class: 'formgrid' }, h('div', { class: 'field' }, h('label', { for: 'vf-status' }, t('p14.cms.statusCol')), status),
    ...Object.entries(fields).map(([k, el]) => h('div', { class: 'field' }, h('label', { for: el.id }, t('p14.ver.f.' + k)), el)),
    h('div', { class: 'field' }, h('label', { for: 'vf-facts' }, t('p14.ver.f.facts')), facts)),
  err, h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: 'verify-save' } }, t('p14.cms.save')))));
}

/* ------------------------------------------------------------------ users and roles */
function usersPanel(ctx) {
  const { t, i18n, session } = ctx;
  const region = dataRegion({ t, load: () => ctx.api.get('/admin/users'), render: ({ users }) => Table({ caption: t('p14.admin.tab.users'),
    columns: [{ key: 'name', label: t('p14.account.name') }, { key: 'email', label: t('p14.account.email') }, { key: 'since', label: t('p14.users.since') }, { key: 'roles', label: t('p14.users.roles') }],
    rows: users.map(u => ({ name: u.display_name, email: h('bdi', { dir: 'ltr' }, u.email), since: i18n.date(day(u.created_at)),
      roles: h('span', { class: 'chips', dataset: { userRoles: u.id } }, ['reviewer', 'instructor', 'admin'].map(r => {
        const box = h('input', { type: 'checkbox', checked: u.roles.includes(r), disabled: r === 'admin' && u.id === session.user.id, dataset: { role: r, user: u.id } });
        box.addEventListener('change', async () => { try { await ctx.api.post(`/admin/users/${u.id}/roles`, { role: r, grant: box.checked }); toast(t('settings.saved')); } catch (e) { box.checked = !box.checked; toast(errMsg(ctx, e)); } });
        return h('label', { class: 'choice' }, box, h('span', null, t('p14.role.' + r)));
      })) })) }) });
  /* Organisations (pilot, D-114): the administrator creates one and invites its first company administrator; the administrator
     never becomes a member and never sees the organisation's shares. */
  const oName = h('input', { class: 'input', id: 'org-name', maxlength: 120 });
  const oMail = h('input', { class: 'input', id: 'org-admin', type: 'email', autocomplete: 'off' });
  const oOut = h('div', { 'aria-live': 'polite', dataset: { orgOut: '' } });
  const orgForm = h('form', { class: 'panel formgrid', 'aria-labelledby': 'org-h', onsubmit: async e => {
    e.preventDefault();
    try {
      const r = await ctx.api.post('/orgs', { name: oName.value, first_admin_email: oMail.value });
      const link = `${location.origin}${location.pathname}#/account?invite=${r.invitation.token}`;
      put(oOut, h('p', { class: 'oksum', role: 'status' }, t('p14.org.created', { org: r.org.name })), h('p', { class: 'note' }, t('p14.live.inviteLink')),
        h('input', { class: 'input', readonly: true, value: link, dir: 'ltr', 'aria-label': t('p14.live.inviteLink'), dataset: { orgInvite: '' } }));
    } catch (x) { put(oOut, h('p', { class: 'errsum', role: 'alert' }, errMsg(ctx, x))); }
  } }, h('h2', { id: 'org-h' }, t('p14.org.title')), h('p', { class: 'note' }, t('p14.org.note')),
  h('div', { class: 'field' }, h('label', { for: 'org-name' }, t('p14.org.name')), oName), h('div', { class: 'field' }, h('label', { for: 'org-admin' }, t('p14.org.firstAdmin')), oMail),
  h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-secondary', type: 'submit', dataset: { action: 'create-org' } }, t('p14.org.create'))), oOut);
  return h('div', null, h('p', null, t('p14.users.lede')), region, orgForm);
}

/* ------------------------------------------------------------------ analytics (D-119) */
function analyticsPanel(ctx) {
  const { t, i18n } = ctx;
  const n = r => (r == null || r.count == null ? t('p14.an.fewer') : i18n.number(r.count));
  return dataRegion({ t, load: () => ctx.api.get('/admin/analytics'), render: ({ from, to, rows }) => {
    const s = analyticsSections(rows);
    const list = (items, label) => items.length ? h('ul', { class: 'plain' }, items.slice(0, 15).map(r => h('li', null, h('bdi', { dir: 'auto' }, r.dim || '—'), ' · ', n(r)))) : h('p', { class: 'note' }, t('p14.an.empty'));
    return h('div', { dataset: { analytics: String(rows.length) } },
      h('p', null, t('p14.an.lede', { from: i18n.date(from), to: i18n.date(to) })), h('p', { class: 'banner banner-info', role: 'note' }, t('p14.an.honest')),
      h('div', { class: 'grid grid-3' },
        h('div', { class: 'card stat', dataset: { stat: 'active' } }, h('h2', null, t('p14.an.active')), h('p', { class: 'big' }, n(s.active))),
        h('div', { class: 'card stat' }, h('h2', null, t('p14.an.starts')), h('p', { class: 'big' }, i18n.number(s.starts))),
        h('div', { class: 'card stat' }, h('h2', null, t('p14.an.completions')), h('p', { class: 'big' }, i18n.number(s.completions))),
        h('div', { class: 'card stat' }, h('h2', null, t('p14.an.labs')), h('p', { class: 'big' }, i18n.number(s.labs)))),
      h('h2', null, t('p14.an.outcomes')), list(s.outcomes),
      h('h2', null, t('p14.an.coach')), list(s.coach),
      h('h2', null, t('p14.an.noResult')), list(s.noResult),
      h('h2', null, t('p14.an.needsReview')), list(s.needsReview),
      h('p', { class: 'note' }, t('p14.an.small')));
  } });
}

/* ------------------------------------------------------------------ settings and tiers (ADD-16, D-120) */
function settingsPanel(ctx) {
  const { t, i18n } = ctx;
  return dataRegion({ t, load: () => ctx.api.get('/admin/settings'), render: ({ settings }) => {
    const sla = h('input', { class: 'input input-short', type: 'number', min: 1, max: 2160, id: 'st-sla', value: settings.review_sla_hours ?? '' });
    return h('div', null,
      h('section', { class: 'panel', 'aria-labelledby': 'st-tier-h', dataset: { tiersEnforced: String(settings.tiers_enforced === true) } }, h('h2', { id: 'st-tier-h' }, t('p14.tier.title')),
        h('p', null, settings.tiers_enforced ? t('p14.tier.on') : t('p14.tier.off')),
        Table({ caption: t('p14.tier.title'), columns: [{ key: 'f', label: t('p14.tier.feature') }, ...TIERS.map(x => ({ key: x, label: t('p14.tier.' + x) }))],
          rows: FEATURE_TIERS.map(r => ({ f: t('p14.tier.f.' + r.feature), ...Object.fromEntries(TIERS.map(x => [x, r.tiers.includes(x) ? '✓' : '—'])) })) })),
      h('form', { class: 'panel', onsubmit: async e => { e.preventDefault(); try { await ctx.api.put('/admin/settings/review_sla_hours', { value: sla.value === '' ? null : Number(sla.value) }); toast(t('settings.saved')); } catch (x) { toast(errMsg(ctx, x)); } } },
        h('h2', null, t('p14.set.sla')), h('p', { class: 'note' }, t('p14.set.slaNote')),
        h('div', { class: 'field' }, h('label', { for: 'st-sla' }, t('p14.set.slaHours')), sla), h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-secondary', type: 'submit' }, t('p14.cms.save')))),
      h('p', { class: 'note' }, t('p14.set.company', { v: String(settings.company_accounts) })));
  } });
}

/* ------------------------------------------------------------------ export for the publishing script (D-115) */
function exportPanel(ctx) {
  const { t, i18n } = ctx;
  return dataRegion({ t, load: () => ctx.api.get('/admin/export'), render: ({ drafts, decisions, ids }) => h('div', { dataset: { exportReady: String(ids.length) } },
    h('p', null, t('p14.ex.lede')),
    h('ol', null, ['download', 'run', 'build', 'deploy'].map(k => h('li', null, t('p14.ex.step.' + k)))),
    h('pre', { class: 'code', dir: 'ltr', tabindex: '0' }, 'python3 tools/cms_publish.py cms-drafts.json cms-decisions.json          # dry run\npython3 tools/cms_publish.py cms-drafts.json cms-decisions.json --apply'),
    ids.length ? h('div', { class: 'btnrow' }, Button({ label: t('p14.ex.download', { n: i18n.number(ids.length) }), variant: 'primary', iconName: 'download', attrs: { 'data-action': 'cms-export' }, onClick: async () => {
      download(`cms-drafts-${localToday()}.json`, JSON.stringify(drafts, null, 2), 'application/json');
      download(`cms-decisions-${localToday()}.json`, JSON.stringify(decisions, null, 2), 'application/json');
      toast(t('p14.ex.downloaded'));
    } }), Button({ label: t('p14.ex.mark'), variant: 'secondary', attrs: { 'data-action': 'cms-mark-exported' }, onClick: async () => { await ctx.api.post('/admin/export/mark', { ids }); toast(t('p14.ex.marked')); } }))
      : EmptyState({ title: t('p14.ex.none'), level: 2 })) });
}

function auditPanel(ctx) {
  const { t, i18n } = ctx;
  return dataRegion({ t, load: () => ctx.api.get('/admin/audit?limit=100'), render: ({ entries }) => Table({ caption: t('p14.admin.tab.audit'),
    columns: [{ key: 'at', label: t('p14.audit.at') }, { key: 'action', label: t('p14.audit.action') }, { key: 'target', label: t('p14.audit.target') }],
    rows: entries.map(e => ({ at: h('bdi', { dir: 'ltr' }, String(e.at).replace('T', ' ').slice(0, 19)), action: h('code', null, e.action), target: h('code', { dir: 'ltr' }, String(e.target).slice(0, 12)) })) }) });
}

const PANELS = { content: contentPanel, decisions: decisionsPanel, evidence: evidencePanel, verification: verificationPanel, users: usersPanel, analytics: analyticsPanel, settings: settingsPanel, export: exportPanel, audit: auditPanel };
