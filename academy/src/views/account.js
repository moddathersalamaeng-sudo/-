/**
 * Phase 14 — account pages (account menu; no new top-level item).
 *  #/account            sign in · create account · forgot password · reset (?reset=) · invitation (?invite=) · signed in:
 *                       name, sync, organisations, review requests, export, sign out, delete account
 *  #/account/move       previewed "move my device records to my account" (D-111)
 *  #/company/live       the company workspace on accounts: people, invitations, live consented shares, assignments (D-114)
 * Without a configured backend these pages say so and change nothing: the Academy stays a single-device site.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { h, icon } from '../core/dom.js';
import { Button, LinkButton, EmptyState, dataRegion, toast, openDialog, Table, Badge } from '../ui/components.js';
import { planMigration } from '../domain/migration.mjs';
import { put, download, localToday } from './company-share.js';

const PENDING_INVITE = 'cia:v1:pending_invite';
let lastJoin = null;   // the result of the last invitation, kept for the re-render that follows the session refresh
const errText = (ctx, e) => ctx.t('p14.err.' + ({ credentials: 'credentials', email_taken: 'emailTaken', password: 'password', email: 'email', display_name: 'name', offline: 'offline',
  rate_limited: 'rateLimited', token: 'token', forbidden: 'forbidden', invalid: 'invalid', exists: 'exists', state: 'state', not_found: 'notFound' }[e?.code] || 'generic'));

function notConfigured(ctx) {
  const { t } = ctx;
  return h('div', { class: 'page', dataset: { account: 'off' } }, h('h1', null, t('p14.account.title')),
    EmptyState({ title: t('p14.account.offTitle'), body: t('p14.account.offBody'), iconName: 'lock', action: LinkButton({ label: t('p14.account.offExport'), href: '#/settings', iconName: 'download' }) }));
}

function field(id, label, input, hint = null) {
  return h('div', { class: 'field' }, h('label', { for: id }, label), hint ? h('span', { class: 'hint note', id: id + '-hint' }, hint) : null, input);
}
const input = (id, type, attrs = {}) => h('input', { class: 'input', id, name: id, type, ...attrs });

function formPanel(ctx, { id, title, fields, submitLabel, onSubmit, note = null }) {
  const err = h('p', { class: 'err', id: id + '-err', role: 'alert', 'aria-live': 'assertive' });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit', dataset: { action: id } }, submitLabel);
  const form = h('form', { class: 'panel acct-form', id, novalidate: true, 'aria-describedby': id + '-err', onsubmit: async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    try { await onSubmit(new FormData(form)); } catch (x) { err.textContent = errText(ctx, x); } finally { btn.disabled = false; }
  } }, h('h2', null, title), fields, err, h('div', { class: 'btnrow' }, btn), note ? h('p', { class: 'note' }, note) : null);
  return form;
}

export function accountView(ctx, match) {
  if (!ctx.backend) return notConfigured(ctx);
  const { t, session } = ctx;
  const q = match?.query || {};
  /* Take the invitation token once and remove it from the address, so a re-render (or a reload) never uses it a second time. */
  if (q.invite) {
    try { sessionStorage.setItem(PENDING_INVITE, q.invite); } catch { /* ignore */ }
    try { history.replaceState(null, '', location.pathname + location.search + '#/account'); } catch { /* ignore */ }
  }
  if (q.reset) return resetView(ctx, q.reset);
  if (!session.signedIn) return signedOutView(ctx, q);
  return signedInView(ctx);
}

const afterSignIn = async ctx => {
  ctx.track?.('sign_in');
  const device = ctx.deviceAdapter ? (await ctx.deviceAdapter.collections()).filter(c => c !== 'prefs') : [];
  location.hash = device.length ? '#/account/move' : '#/account';
  location.reload();
};

function signedOutView(ctx, q) {
  const { t, session } = ctx;
  const signIn = formPanel(ctx, { id: 'acct-signin', title: t('p14.account.signIn'), submitLabel: t('p14.account.signInGo'),
    fields: [field('si-email', t('p14.account.email'), input('si-email', 'email', { autocomplete: 'username', required: true, name: 'email' })),
      field('si-pw', t('p14.account.password'), input('si-pw', 'password', { autocomplete: 'current-password', required: true, name: 'password' }))],
    onSubmit: async f => { await session.signIn({ email: f.get('email'), password: f.get('password') }); await afterSignIn(ctx); } });
  const signUp = formPanel(ctx, { id: 'acct-signup', title: t('p14.account.signUp'), submitLabel: t('p14.account.signUpGo'), note: t('p14.account.signUpNote'),
    fields: [field('su-name', t('p14.account.name'), input('su-name', 'text', { autocomplete: 'name', required: true, maxlength: 80, name: 'display_name' })),
      field('su-email', t('p14.account.email'), input('su-email', 'email', { autocomplete: 'email', required: true, name: 'email' })),
      field('su-pw', t('p14.account.password'), input('su-pw', 'password', { autocomplete: 'new-password', required: true, minlength: 10, name: 'password', 'aria-describedby': 'su-pw-hint' }), t('p14.account.passwordHint'))],
    onSubmit: async f => { await session.signUp({ email: f.get('email'), password: f.get('password'), display_name: f.get('display_name') }); ctx.track?.('sign_up'); await afterSignIn(ctx); } });
  const forgot = formPanel(ctx, { id: 'acct-forgot', title: t('p14.account.forgot'), submitLabel: t('p14.account.forgotGo'), note: t('p14.account.forgotNote'),
    fields: [field('fg-email', t('p14.account.email'), input('fg-email', 'email', { autocomplete: 'email', required: true, name: 'email' }))],
    onSubmit: async f => { await session.requestReset(f.get('email')); toast(t('p14.account.forgotSent')); } });
  return h('div', { class: 'page acct', dataset: { account: 'signed-out' } },
    h('h1', null, t('p14.account.title')),
    h('p', { class: 'lede' }, t('p14.account.lede')),
    h('ul', { class: 'co-promises' }, ['device', 'move', 'nothing'].map(k => h('li', null, icon(k === 'nothing' ? 'lock' : 'check'), ' ', t('p14.account.promise.' + k)))),
    h('div', { class: 'grid grid-2 acct-grid' }, signIn, signUp),
    h('details', { class: 'panel' }, h('summary', null, t('p14.account.forgot')), forgot),
    q.invite ? h('p', { class: 'banner banner-info', role: 'note', dataset: { inviteWaiting: 'true' } }, t('p14.account.inviteWaiting')) : null);
}

function resetView(ctx, token) {
  const { t, session } = ctx;
  return h('div', { class: 'page acct', dataset: { account: 'reset' } }, h('h1', null, t('p14.account.resetTitle')),
    formPanel(ctx, { id: 'acct-reset', title: t('p14.account.resetTitle'), submitLabel: t('p14.account.resetGo'),
      fields: [field('rs-pw', t('p14.account.newPassword'), input('rs-pw', 'password', { autocomplete: 'new-password', required: true, minlength: 10, name: 'password' }), t('p14.account.passwordHint'))],
      onSubmit: async f => { await session.confirmReset(token, f.get('password')); toast(t('p14.account.resetDone')); location.hash = '#/account'; } }));
}

function signedInView(ctx) {
  const { t, i18n, session } = ctx;
  const region = dataRegion({ t, load: async () => {
    const pendingInvite = (() => { try { return sessionStorage.getItem(PENDING_INVITE); } catch { return null; } })();
    if (pendingInvite) {
      /* Clear the token first: refreshing the session re-renders this page, and an invitation works only once. */
      try { sessionStorage.removeItem(PENDING_INVITE); } catch { /* ignore */ }
      try { lastJoin = await ctx.api.post('/invitations/accept', { token: pendingInvite }); } catch (e) { lastJoin = { error: e?.code || 'error' }; }
      if (!lastJoin.error) await session.refresh();
    }
    const joined = lastJoin;
    const [reviews, assignments, device, pending] = await Promise.all([ctx.api.get('/reviews/mine').catch(() => ({ requests: [] })), ctx.api.get('/me/assignments').catch(() => ({ assignments: [] })),
      ctx.deviceAdapter ? ctx.deviceAdapter.collections() : [], ctx.synced ? ctx.synced.pending() : []]);
    return { reviews: reviews.requests, assignments: assignments.assignments, device: device.filter(c => c !== 'prefs'), pending, joined };
  }, render: d => render(d) });

  function render({ reviews, assignments, device, pending, joined }) {
    const u = session.user;
    const syncState = document.documentElement.dataset.sync || (pending.length ? 'syncing' : 'synced');
    const doExport = async () => { download(`cia-account-export-${localToday()}.json`, JSON.stringify(await ctx.api.get('/account/export'), null, 2), 'application/json'); toast(t('p14.account.exported')); };
    const doDelete = () => {
      const pw = input('del-pw', 'password', { autocomplete: 'current-password', required: true });
      const err = h('p', { class: 'err', role: 'alert' });
      openDialog({ title: t('p14.account.deleteTitle'), body: h('div', null, h('p', null, t('p14.account.deleteBody')), field('del-pw', t('p14.account.password'), pw), err), actions: [
        { label: t('settings.data.cancel'), variant: 'secondary' },
        { label: t('p14.account.deleteGo'), variant: 'danger', keepOpen: true, onClick: async () => {
          try { await session.deleteAccount(pw.value); toast(t('p14.account.deleted')); location.hash = '#/'; location.reload(); } catch (e) { err.textContent = errText(ctx, e); return false; }
        } }] });
    };
    const nameIn = input('ac-name', 'text', { value: u.display_name, maxlength: 80, autocomplete: 'name' });
    const assignmentRows = assignments.map(a => ({
      what: h('span', null, h('a', { href: a.type === 'course' && a.target_slug ? `#/academy/courses/${a.target_slug}` : a.type === 'lab' && a.target_slug ? `#/labs/${a.target_slug}` : a.type === 'assessment' && a.target_slug ? `#/assessments/${a.target_slug}` : '#/my' }, a.title?.[i18n.locale] || a.title?.en || a.target_id)),
      org: a.org_name, due: a.due ? i18n.date(String(a.due).slice(0, 10)) : '—',
      state: h('select', { class: 'select', 'aria-label': t('p14.asg.state'), dataset: { assignment: a.id }, onchange: async e => { await ctx.api.patch(`/me/assignments/${a.id}`, { state: e.target.value }); toast(t('settings.saved')); } },
        ['not_started', 'in_progress', 'completed'].map(s => h('option', { value: s, selected: a.state === s }, t('p14.asg.' + s))))
    }));
    return h('div', { class: 'acct-in' },
      joined ? h('p', { class: joined.error ? 'errsum' : 'oksum', role: 'status', dataset: { inviteResult: joined.error ? 'error' : 'ok' } }, joined.error ? t('p14.account.inviteFailed') : t('p14.account.inviteJoined')) : null,
      h('section', { class: 'panel feature', 'aria-labelledby': 'ac-me-h', dataset: { signedIn: u.id } },
        h('h2', { id: 'ac-me-h' }, icon('user'), ' ', u.display_name || u.email),
        h('p', null, h('bdi', { dir: 'ltr' }, u.email), ' · ', u.roles.map(r => Badge({ label: t('p14.role.' + r), tone: r === 'admin' ? 'gold' : 'info' }))),
        h('p', { class: 'note', dataset: { syncState } }, icon(syncState === 'synced' ? 'check' : 'refresh'), ' ', t('p14.sync.' + syncState)),
        h('form', { class: 'formgrid', onsubmit: async e => { e.preventDefault(); try { await ctx.api.patch('/account', { display_name: nameIn.value }); await session.refresh(); toast(t('settings.saved')); } catch (x) { toast(errText(ctx, x)); } } },
          field('ac-name', t('p14.account.name'), nameIn), h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-secondary', type: 'submit' }, t('p14.account.saveName')))),
        h('div', { class: 'btnrow' },
          Button({ label: t('p14.account.export'), variant: 'secondary', iconName: 'download', onClick: doExport, attrs: { 'data-action': 'account-export' } }),
          Button({ label: t('p14.account.signOut'), variant: 'secondary', onClick: async () => { await session.signOut(); location.hash = '#/'; location.reload(); }, attrs: { 'data-action': 'sign-out' } }),
          Button({ label: t('p14.account.delete'), variant: 'quiet', onClick: doDelete, attrs: { 'data-action': 'delete-account' } }))),
      device.length ? h('section', { class: 'panel', 'aria-labelledby': 'ac-dev-h', dataset: { deviceRecords: String(device.length) } }, h('h2', { id: 'ac-dev-h' }, icon('upload'), ' ', t('p14.move.title')),
        h('p', null, t('p14.move.offer', { n: i18n.number(device.length) })), LinkButton({ label: t('p14.move.open'), href: '#/account/move', variant: 'primary', attrs: { 'data-action': 'open-move' } })) : null,
      h('section', { class: 'section', 'aria-labelledby': 'ac-org-h' }, h('h2', { id: 'ac-org-h' }, icon('briefcase'), ' ', t('p14.account.orgs')),
        (session.orgs || []).length ? h('ul', { class: 'plain' }, session.orgs.map(o => h('li', null, h('strong', null, o.name), ' · ', t('p14.role.' + o.role),
          o.role === 'company_admin' ? [' · ', h('a', { href: '#/company/live', dataset: { action: 'open-live' } }, t('p14.live.title'))] : null)))
          : h('p', { class: 'note' }, t('p14.account.noOrgs')),
        h('p', { class: 'note' }, t('p14.account.shareWhere'), ' ', h('a', { href: '#/my?tab=passport&p=company' }, t('p14.account.shareLink')))),
      h('section', { class: 'section', 'aria-labelledby': 'ac-asg-h', dataset: { accountAssignments: String(assignments.length) } }, h('h2', { id: 'ac-asg-h' }, icon('calendar'), ' ', t('p14.asg.title')),
        assignments.length ? Table({ caption: t('p14.asg.title'), columns: [{ key: 'what', label: t('p14.asg.what') }, { key: 'org', label: t('p14.asg.org') }, { key: 'due', label: t('p14.asg.due') }, { key: 'state', label: t('p14.asg.state') }], rows: assignmentRows })
          : h('p', { class: 'note' }, t('p14.asg.none'))),
      h('section', { class: 'section', 'aria-labelledby': 'ac-rv-h', dataset: { myReviews: String(reviews.length) } }, h('h2', { id: 'ac-rv-h' }, icon('check'), ' ', t('p14.rev.mine')),
        h('p', null, t('p14.rev.mineLede')),
        reviews.length ? h('ul', { class: 'plain' }, reviews.map(r => h('li', { dataset: { reviewRequest: r.id, status: r.status } }, h('bdi', { dir: 'ltr' }, r.reference), ' · ', r.lab_id, ' · ', Badge({ label: t('p14.rev.st.' + r.status), tone: r.status === 'completed' ? 'ok' : 'info' }),
          r.reviewer_name ? ' · ' + t('p14.rev.by', { who: r.reviewer_name }) : null)))
          : h('p', { class: 'note' }, t('p14.rev.none')),
        reviewRequestBlock(ctx, region)));
  }
  return h('div', { class: 'page acct', dataset: { account: 'signed-in' } }, h('h1', null, t('p14.account.title')), region);
}

/** Lab attempts with written tasks awaiting a person's review → send to the shared queue. */
function reviewRequestBlock(ctx, region) {
  const { t, i18n } = ctx;
  const box = h('div', { dataset: { reviewSend: '' } });
  ctx.repos.labAttempts.list().then(list => {
    const waiting = list.filter(a => a.pending_review > 0);
    if (!waiting.length) { put(box, h('p', { class: 'note' }, t('p14.rev.nothingWaiting'))); return; }
    put(box, h('ul', { class: 'plain' }, waiting.map(a => h('li', null, h('span', null, a.lab_id, ' #', i18n.number(a.attempt_no), ' · ', t('p14.rev.tasksWaiting', { n: i18n.number(a.pending_review) })), ' ',
      Button({ label: t('p14.rev.send'), variant: 'secondary', onClick: async () => {
        try { if (ctx.synced) await ctx.synced.flush(); await ctx.api.post('/reviews', { record_id: a.id }); ctx.track?.('review_request'); toast(t('p14.rev.sent')); region.refresh(); }
        catch (e) { toast(errText(ctx, e)); }
      }, attrs: { 'data-action': 'send-review', 'data-attempt': a.id } })))));
  }).catch(() => put(box, h('p', { class: 'note' }, t('p14.rev.nothingWaiting'))));
  return box;
}

/* ------------------------------------------------------------------ move device records (D-111) */
async function deviceCopy(ctx) {
  const out = {};
  for (const c of await ctx.deviceAdapter.collections()) out[c] = await ctx.deviceAdapter.read(c).catch(() => []);
  return out;
}

export function moveRecordsView(ctx) {
  if (!ctx.backend) return notConfigured(ctx);
  const { t, i18n, session } = ctx;
  if (!session.signedIn) return h('div', { class: 'page' }, h('h1', null, t('p14.move.title')), EmptyState({ title: t('p14.move.signInFirst'), action: LinkButton({ label: t('p14.account.signIn'), href: '#/account' }) }));
  if (!ctx.deviceAdapter) return h('div', { class: 'page' }, h('h1', null, t('p14.move.title')), EmptyState({ title: t('p14.move.nothing') }));
  const region = dataRegion({ t, load: async () => {
    const device = await deviceCopy(ctx);
    const plan = await ctx.api.post('/migrate/preview', { collections: device });
    const local = planMigration(device, {});
    return { device, plan, local };
  }, render: d => render(d) });
  function render({ device, plan }) {
    if (!plan.totals.add) return EmptyState({ title: t('p14.move.nothing'), body: plan.totals.kept ? t('p14.move.allThere', { k: i18n.number(plan.totals.kept) }) : t('p14.move.nothingBody'), action: LinkButton({ label: t('p14.account.title'), href: '#/account' }) });
    const result = h('div', { 'aria-live': 'polite', dataset: { moveResult: '' } });
    const rows = plan.collections.map(c => ({ c: h('code', null, c.collection), add: i18n.number(c.add.length), kept: i18n.number(c.kept.length), invalid: i18n.number(c.invalid) }));
    const apply = async btn => {
      btn.disabled = true;
      try {
        const out = await ctx.api.post('/migrate/apply', { collections: device });
        ctx.track?.('move_to_account');
        result.dataset.moveResult = 'ok'; result.dataset.added = String(out.plan.totals.add);
        put(result, h('p', { class: 'oksum', role: 'status' }, t('p14.move.done', { n: i18n.number(out.plan.totals.add), k: i18n.number(out.plan.totals.kept) })),
          h('p', { class: 'note' }, t('p14.move.deviceKept')), LinkButton({ label: t('p14.move.continue'), href: '#/my', variant: 'primary' }));
        if (ctx.synced) await ctx.synced.pull();
      } catch (e) { put(result, h('p', { class: 'errsum', role: 'alert' }, errText(ctx, e))); btn.disabled = false; }
    };
    const applyBtn = Button({ label: t('p14.move.apply', { n: i18n.number(plan.totals.add) }), variant: 'primary', iconName: 'upload', onClick: e => apply(e.currentTarget), attrs: { 'data-action': 'apply-move' } });
    return h('div', { dataset: { movePlan: String(plan.totals.add), kept: String(plan.totals.kept) } },
      h('p', { class: 'lede' }, t('p14.move.lede')),
      h('ul', { class: 'co-promises' }, ['overwrite', 'upgrade', 'twice', 'device'].map(k => h('li', null, icon('check'), ' ', t('p14.move.rule.' + k)))),
      Table({ caption: t('p14.move.preview'), columns: [{ key: 'c', label: t('p14.move.col.collection') }, { key: 'add', label: t('p14.move.col.add'), num: true }, { key: 'kept', label: t('p14.move.col.kept'), num: true }, { key: 'invalid', label: t('p14.move.col.invalid'), num: true }], rows }),
      plan.skipped.length ? h('p', { class: 'note', dataset: { moveSkipped: plan.skipped.map(s => s.collection).join(',') } }, t('p14.move.skipped', { list: i18n.list(plan.skipped.map(s => s.collection)) })) : null,
      plan.reviewsNotMoved ? h('p', { class: 'banner banner-info', role: 'note', dataset: { reviewsNotMoved: String(plan.reviewsNotMoved) } }, t('p14.move.reviewsNotMoved', { n: i18n.number(plan.reviewsNotMoved) })) : null,
      h('div', { class: 'btnrow' }, applyBtn), result);
  }
  return h('div', { class: 'page acct', dataset: { page: 'move' } }, h('h1', null, t('p14.move.title')), region);
}

/* ------------------------------------------------------------------ company workspace on accounts (D-114) */
export function companyLiveView(ctx) {
  if (!ctx.backend || !ctx.session.signedIn) return notConfigured(ctx);
  const { t, i18n, session } = ctx;
  const orgs = (session.orgs || []).filter(o => o.role === 'company_admin');
  if (!orgs.length) return h('div', { class: 'page' }, h('h1', null, t('p14.live.title')), EmptyState({ title: t('p14.live.noOrg') }));
  const org = orgs[0];
  const region = dataRegion({ t, load: async () => {
    const [people, shares, assignments] = await Promise.all([ctx.api.get(`/orgs/${org.org_id}/people`), ctx.api.get(`/orgs/${org.org_id}/shares`), ctx.api.get(`/orgs/${org.org_id}/assignments`)]);
    return { ...people, shares: shares.shares, assignments: assignments.assignments };
  }, render: d => render(d) });
  function render({ people, departments, invitations, shares, assignments }) {
    const inviteOut = h('div', { 'aria-live': 'polite', dataset: { inviteOut: '' } });
    const email = input('lv-email', 'email', { autocomplete: 'off', name: 'email' });
    const role = h('select', { class: 'select', id: 'lv-role' }, ['employee', 'company_admin'].map(r => h('option', { value: r }, t('p14.role.' + r))));
    const invite = h('form', { class: 'panel formgrid', onsubmit: async e => {
      e.preventDefault();
      try {
        const r = await ctx.api.post(`/orgs/${org.org_id}/invitations`, { email: email.value, role: role.value });
        const link = `${location.origin}${location.pathname}#/account?invite=${r.token}`;
        put(inviteOut, h('p', { class: 'oksum', role: 'status' }, t('p14.live.invited', { email: r.email })), h('p', { class: 'note' }, t('p14.live.inviteLink')), h('input', { class: 'input', readonly: true, value: link, dir: 'ltr', 'aria-label': t('p14.live.inviteLink'), dataset: { inviteLink: '' } }));
      } catch (x) { put(inviteOut, h('p', { class: 'errsum', role: 'alert' }, errText(ctx, x))); }
    } }, field('lv-email', t('p14.account.email'), email), field('lv-role', t('p14.live.role'), role), h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-secondary', type: 'submit', dataset: { action: 'invite' } }, t('p14.live.invite'))), inviteOut);
    const comp = s => (s.snapshot?.data?.competencies || []);
    const shareRows = shares.map(s => ({ who: h('span', { dataset: { liveShare: s.learner_id } }, s.display_name), job: s.job_title || '—', parts: i18n.list(s.parts.map(p => t('co12a.share.part.' + p))),
      comp: i18n.number(comp(s).length), cpd: s.snapshot?.data?.cpd ? i18n.number(s.snapshot.data.cpd.total) : '—', last: i18n.date(String(s.refreshed_at).slice(0, 10)) }));
    const asgForm = (() => {
      const who = h('select', { class: 'select', id: 'lv-asg-who' }, people.filter(p => p.role === 'employee' || p.user_id !== session.user.id).map(p => h('option', { value: p.user_id }, p.display_name)));
      const type = h('select', { class: 'select', id: 'lv-asg-type' }, ['course', 'lab', 'assessment'].map(x => h('option', { value: x }, t('co12a.asg.type.' + x))));
      const target = input('lv-asg-target', 'text', { placeholder: 'iso-9001-foundations', dir: 'ltr' });
      const due = input('lv-asg-due', 'date');
      const out = h('p', { 'aria-live': 'polite' });
      return h('form', { class: 'panel formgrid', onsubmit: async e => {
        e.preventDefault();
        try { await ctx.api.post(`/orgs/${org.org_id}/assignments`, { assignee: who.value, type: type.value, target_id: target.value, target_slug: target.value, title: { ar: target.value, en: target.value }, due: due.value || null }); toast(t('p14.live.assigned')); region.refresh(); }
        catch (x) { out.textContent = errText(ctx, x); }
      } }, field('lv-asg-who', t('p14.live.person'), who), field('lv-asg-type', t('p14.live.type'), type), field('lv-asg-target', t('p14.live.target'), target, t('p14.live.targetHint')), field('lv-asg-due', t('p14.asg.due'), due),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn btn-secondary', type: 'submit', dataset: { action: 'assign' } }, t('p14.live.assign'))), out);
    })();
    return h('div', { dataset: { liveOrg: org.org_id } },
      h('p', { class: 'lede' }, t('p14.live.lede', { org: org.name })),
      h('p', { class: 'banner banner-info', role: 'note' }, t('p14.consent.pilot')),
      h('section', { class: 'section', 'aria-labelledby': 'lv-sh-h', dataset: { liveShares: String(shares.length) } }, h('h2', { id: 'lv-sh-h' }, icon('handshake'), ' ', t('p14.live.shares', { n: i18n.number(shares.length) })),
        h('p', { class: 'note' }, t('p14.live.sharesNote')),
        shares.length ? Table({ caption: t('p14.live.shares', { n: shares.length }), columns: [{ key: 'who', label: t('p14.live.person') }, { key: 'job', label: t('co12a.share.job') }, { key: 'parts', label: t('p14.live.parts') }, { key: 'comp', label: t('p14.live.comp'), num: true }, { key: 'cpd', label: t('p14.live.cpd'), num: true }, { key: 'last', label: t('p14.live.last') }], rows: shareRows })
          : h('p', { class: 'note' }, t('p14.live.noShares'))),
      h('section', { class: 'section', 'aria-labelledby': 'lv-pp-h' }, h('h2', { id: 'lv-pp-h' }, icon('users'), ' ', t('p14.live.people', { n: i18n.number(people.length) })),
        h('ul', { class: 'plain' }, people.map(p => h('li', null, p.display_name, ' · ', t('p14.role.' + p.role)))), invite,
        invitations.length ? h('p', { class: 'note' }, t('p14.live.invitations', { n: i18n.number(invitations.filter(i => !i.accepted_at).length) })) : null),
      h('section', { class: 'section', 'aria-labelledby': 'lv-as-h', dataset: { liveAssignments: String(assignments.length) } }, h('h2', { id: 'lv-as-h' }, icon('calendar'), ' ', t('p14.live.assignments', { n: i18n.number(assignments.length) })),
        asgForm,
        assignments.length ? h('ul', { class: 'plain' }, assignments.map(a => h('li', { dataset: { liveAssignment: a.id, state: a.state } }, people.find(p => p.user_id === a.assignee)?.display_name || '—', ' · ', a.type, ' · ', h('bdi', { dir: 'ltr' }, a.target_id), ' · ', t('p14.asg.' + a.state)))) : null),
      h('p', { class: 'note' }, t('p14.live.filesStill'), ' ', h('a', { href: '#/company' }, t('co12a.title'))));
  }
  return h('div', { class: 'page', dataset: { page: 'company-live' } }, h('h1', null, t('p14.live.title')), region);
}
