/**
 * Continual Improvement Academy — API routes (Phase 14). Every handler:
 *   1. checks the session and the role matrix (CAN, src/domain/production.mjs);
 *   2. runs its queries as cia_app with cia.uid() set, so row-level security repeats the check in the database;
 *   3. writes privileged actions to the audit trail.
 * The domain modules of the static site run here unchanged: makeLabAttempt (re-scoring), reviewLabAttempt (reviews),
 * readShare (consents), planMigration / applyMigration (move to account).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
import { HttpError } from './db.mjs';
import { Router } from './http.mjs';
import { hashPassword, verifyPassword, dummyVerify, newToken, tokenHash, passwordProblems, EMAIL, cleanEmail, cleanName, days, minutes,
  SESSION_IDLE_DAYS, SESSION_MAX_DAYS, RESET_MINUTES, INVITE_DAYS } from './auth.mjs';
import { can, ACCOUNT_ROLES, cleanEvent, validateCertVerification, verificationReminders, slaState, reviewPayload, reviewReference,
  CMS_COLLECTIONS, validateDraft, nextDraftData, decisionsFile, draftsFile, diffRecords, FEATURE_TIERS, TIERS } from '../../src/domain/production.mjs';
import { planMigration, applyMigration, mergeCollection, SAFE_COLLECTION, SERVER_GUARDED, DEVICE_ONLY, MAX_RECORDS, MAX_RECORD_BYTES } from '../../src/domain/migration.mjs';
import { makeLabAttempt } from '../../src/domain/labs.mjs';
import { reviewLabAttempt } from '../../src/domain/passport.mjs';
import { readShare, SHARE_PARTS, CONSENT_TEXT } from '../../src/domain/company.mjs';

export const API_VERSION = '2.0.0-rc.1';
export const CONSENT_TEXT_VERSION = 'co12a-2026-11-12';
const today = () => new Date().toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (code = 'invalid', detail = null) => new HttpError(400, code, detail);
const forbidden = () => new HttpError(403, 'forbidden');
const notFound = () => new HttpError(404, 'not_found');
const uuid = v => { if (!UUID.test(String(v || ''))) throw bad('id'); return String(v).toLowerCase(); };
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

async function audit(c, actor, action, target = '', detail = {}) {
  await c.query('insert into cia.audit_log (actor, action, target, detail) values ($1, $2, $3, $4)', [actor, action, String(target), detail]);
}

export function buildApi({ db, content, config = {} }) {
  const r = new Router();
  const limits = config.rateLimiter;

  /* ------------------------------------------------------------ session */
  async function sessionFrom(req) {
    const h = String(req.headers.authorization || '');
    const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(h);
    if (!m) return null;
    const th = tokenHash(m[1]);
    return db.asAuth(async c => {
      const s = (await c.query(`select s.user_id, s.created_at, s.last_used_at, u.email, u.display_name from cia.sessions s join cia.users u on u.id = s.user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and s.last_used_at > now() - make_interval(days => $2) and s.created_at > now() - make_interval(days => $3)`,
      [th, SESSION_IDLE_DAYS, SESSION_MAX_DAYS])).rows[0];
      if (!s) return null;
      await c.query('update cia.sessions set last_used_at = now() where token_hash = $1', [th]);
      const roles = (await c.query('select role from cia.user_roles where user_id = $1', [s.user_id])).rows.map(x => x.role);
      return { uid: s.user_id, email: s.email, name: s.display_name, roles, tokenHash: th };
    });
  }

  /** Roles for the role matrix: account roles + company_admin when the person administers an organisation. */
  async function rolesOf(user) {
    const orgs = await db.asUser(user.uid, async c => (await c.query("select m.org_id, m.role, o.name from cia.org_members m join cia.orgs o on o.id = m.org_id where m.user_id = $1", [user.uid])).rows);
    const roles = new Set(user.roles.length ? user.roles : ['learner']);
    if (orgs.some(o => o.role === 'company_admin')) roles.add('company_admin');
    return { roles: [...roles], orgs };
  }

  const need = (action) => async (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'sign_in');
    const { roles, orgs } = await rolesOf(ctx.user);
    ctx.roles = roles; ctx.orgs = orgs;
    if (!can(roles, action)) throw forbidden();
  };

  const route = (method, path, opts, handler) => r.add(method, path, handler, opts);

  /* ------------------------------------------------------------ health */
  route('GET', '/api/v1/health', { public: true }, async () => ({ ok: await db.ping().catch(() => false), version: API_VERSION }));

  /* ------------------------------------------------------------ authentication */
  async function issueSession(c, uid) {
    const token = newToken();
    await c.query('insert into cia.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)', [tokenHash(token), uid, days(SESSION_MAX_DAYS)]);
    await c.query('update cia.users set last_seen_at = now() where id = $1', [uid]);
    return token;
  }

  route('POST', '/api/v1/auth/signup', { public: true, limit: 'auth' }, async ({ body }) => {
    const email = cleanEmail(body?.email), name = cleanName(body?.display_name), pw = body?.password;
    if (!EMAIL.test(email)) throw bad('email');
    if (name.length < 3) throw bad('display_name');
    const pp = passwordProblems(pw); if (pp.length) throw bad('password', pp);
    const hash = await hashPassword(pw);
    return db.asAuth(async c => {
      const exists = (await c.query('select 1 from cia.users where lower(email) = $1', [email])).rowCount;
      if (exists) throw new HttpError(409, 'email_taken');
      const uid = (await c.query('insert into cia.users (email, display_name, pass_hash) values ($1, $2, $3) returning id', [email, name, hash])).rows[0].id;
      await c.query("insert into cia.user_roles (user_id, role) values ($1, 'learner')", [uid]);
      await c.query("insert into cia.audit_log (actor, action, target) values ($1::uuid, 'account.create', $1::text)", [uid]);
      const token = await issueSession(c, uid);
      return { status: 201, body: { token, user: { id: uid, email, display_name: name, roles: ['learner'] } } };
    });
  });

  route('POST', '/api/v1/auth/signin', { public: true, limit: 'auth' }, async ({ body }) => {
    const email = cleanEmail(body?.email), pw = String(body?.password ?? '');
    const row = await db.asAuth(async c => (await c.query('select id, pass_hash, display_name from cia.users where lower(email) = $1', [email])).rows[0]);
    if (!row) { await dummyVerify(pw); throw new HttpError(401, 'credentials'); }
    if (!(await verifyPassword(pw, row.pass_hash))) throw new HttpError(401, 'credentials');
    return db.asAuth(async c => {
      const token = await issueSession(c, row.id);
      const roles = (await c.query('select role from cia.user_roles where user_id = $1', [row.id])).rows.map(x => x.role);
      return { token, user: { id: row.id, email, display_name: row.display_name, roles } };
    });
  });

  route('POST', '/api/v1/auth/signout', {}, async ({ user }) => {
    if (!user) return { ok: true };
    await db.asAuth(c => c.query('update cia.sessions set revoked_at = now() where token_hash = $1', [user.tokenHash]));
    return { ok: true };
  });

  route('GET', '/api/v1/auth/me', {}, async (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'sign_in');
    const { roles, orgs } = await rolesOf(ctx.user);
    return { user: { id: ctx.user.uid, email: ctx.user.email, display_name: ctx.user.name, roles }, orgs };
  });

  route('POST', '/api/v1/auth/reset/request', { public: true, limit: 'auth' }, async ({ body, config: cfg }) => {
    const email = cleanEmail(body?.email);
    if (EMAIL.test(email)) await db.asAuth(async c => {
      const u = (await c.query('select id from cia.users where lower(email) = $1', [email])).rows[0];
      if (!u) return;
      const t = newToken();
      await c.query('insert into cia.reset_tokens (token_hash, user_id, expires_at) values ($1, $2, $3)', [tokenHash(t), u.id, minutes(RESET_MINUTES)]);
      await c.query("insert into cia.outbox (to_email, kind, body) values ($1, 'reset', $2)", [email, { link: `${cfg.siteUrl || ''}#/account?reset=${t}`, minutes: RESET_MINUTES }]);
    });
    return { status: 202, body: { ok: true } };       // the same answer whether or not the e-mail exists
  });

  route('POST', '/api/v1/auth/reset/confirm', { public: true, limit: 'auth' }, async ({ body }) => {
    const t = String(body?.token || ''), pw = body?.password;
    const pp = passwordProblems(pw); if (pp.length) throw bad('password', pp);
    const hash = await hashPassword(pw);
    return db.asAuth(async c => {
      const row = (await c.query('select user_id from cia.reset_tokens where token_hash = $1 and used_at is null and expires_at > now() for update', [tokenHash(t)])).rows[0];
      if (!row) throw bad('token');
      await c.query('update cia.reset_tokens set used_at = now() where token_hash = $1', [tokenHash(t)]);
      await c.query('update cia.users set pass_hash = $1 where id = $2', [hash, row.user_id]);
      await c.query('update cia.sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [row.user_id]);
      await c.query("insert into cia.audit_log (actor, action, target) values ($1::uuid, 'account.reset_password', $1::text)", [row.user_id]);
      return { ok: true };
    });
  });

  /* ------------------------------------------------------------ account */
  route('PATCH', '/api/v1/account', {}, async (ctx) => {
    await need('records.own')(ctx);
    const name = cleanName(ctx.body?.display_name);
    if (name.length < 3) throw bad('display_name');
    await db.asUser(ctx.user.uid, c => c.query('update cia.users set display_name = $1 where id = $2', [name, ctx.user.uid]));
    return { ok: true, display_name: name };
  });

  route('GET', '/api/v1/account/export', {}, async (ctx) => {
    await need('account.export')(ctx);
    return db.asUser(ctx.user.uid, async c => {
      const uid = ctx.user.uid;
      const rec = (await c.query('select collection, data from cia.records where user_id = $1 order by collection, record_id', [uid])).rows;
      const collections = {};
      for (const x of rec) (collections[x.collection] ||= []).push(x.data);
      const q = async (sql) => (await c.query(sql, [uid])).rows;
      return {
        app: 'cia-academy', schema: 'cia.account-export.v1', exported_at: new Date().toISOString(),
        account: { id: uid, email: ctx.user.email, display_name: ctx.user.name, roles: ctx.roles },
        collections,
        consents: await q('select id, org_id, parts, consent_text_version, granted_at, refreshed_at, withdrawn_at from cia.consents where learner_id = $1'),
        review_requests: await q('select id, record_id, lab_id, status, created_at, completed_at from cia.review_requests where learner_id = $1'),
        assignments: await q('select id, org_id, type, target_id, due, state from cia.assignments where assignee = $1'),
        memberships: await q('select org_id, role, joined_at from cia.org_members where user_id = $1')
      };
    });
  });

  route('DELETE', '/api/v1/account', { limit: 'auth' }, async (ctx) => {
    await need('account.delete')(ctx);
    const row = await db.asAuth(async c => (await c.query('select pass_hash from cia.users where id = $1', [ctx.user.uid])).rows[0]);
    if (!row || !(await verifyPassword(String(ctx.body?.password ?? ''), row.pass_hash))) throw new HttpError(401, 'credentials');
    await db.asAuth(async c => {
      const ref = newToken().slice(0, 10);
      await c.query('delete from cia.users where id = $1', [ctx.user.uid]);    // every row of the person cascades
      await c.query("insert into cia.audit_log (actor, action, target) values (null, 'account.delete', $1)", [ref]);
    });
    return { ok: true };
  });

  /* ------------------------------------------------------------ learner records (server adapter) */
  const collectionName = c => { if (!SAFE_COLLECTION.test(c) || DEVICE_ONLY.includes(c)) throw bad('collection'); return c; };

  async function versionOf(c, uid, coll) {
    return Number((await c.query('select version from cia.collection_versions where user_id = $1 and collection = $2', [uid, coll])).rows[0]?.version || 0);
  }

  /** Server-side normalisation of a write: guarded collections refused; lab attempts re-scored with the published lab and the server's own reviews. */
  async function normalise(c, uid, coll, items) {
    if (!Array.isArray(items)) throw bad('items');
    if (items.length > MAX_RECORDS) throw bad('too_many');
    const seen = new Set();
    for (const it of items) {
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !it.id || it.id.length > 200) throw bad('record_id');
      if (seen.has(it.id)) throw bad('duplicate_id'); seen.add(it.id);
      if (JSON.stringify(it).length > MAX_RECORD_BYTES) throw bad('record_too_large');
    }
    if (coll !== 'lab_attempts') return { items, dropped: [] };
    const stored = new Map((await c.query("select record_id, data from cia.records where user_id = $1 and collection = 'lab_attempts'", [uid])).rows.map(x => [x.record_id, x.data]));
    const out = [], dropped = [];
    for (const a of items) {
      const lab = await content.lab(a.lab_id);
      if (!lab) { dropped.push(a.id); continue; }
      const prev = stored.get(a.id);
      const reviews = prev?.reviews || {};
      const re = makeLabAttempt(lab, a.answers || {}, { attemptNo: Number(a.attempt_no) || 1, now: a.submitted_at || new Date().toISOString(), selfCheck: a.self_check || {}, reviews });
      if (re.id !== a.id) { dropped.push(a.id); continue; }
      out.push(prev?.reviewed_at ? { ...re, reviewed_at: prev.reviewed_at } : re);
    }
    return { items: out, dropped };
  }

  async function writeCollection(c, uid, coll, items) {
    const ids = items.map(x => x.id);
    await c.query('delete from cia.records where user_id = $1 and collection = $2 and not (record_id = any($3::text[]))', [uid, coll, ids]);
    for (const it of items) {
      await c.query(`insert into cia.records (user_id, collection, record_id, data) values ($1, $2, $3, $4)
        on conflict (user_id, collection, record_id) do update set data = excluded.data, updated_at = now() where cia.records.data is distinct from excluded.data`, [uid, coll, it.id, it]);
    }
    const v = (await c.query(`insert into cia.collection_versions (user_id, collection, version) values ($1, $2, 1)
      on conflict (user_id, collection) do update set version = cia.collection_versions.version + 1, updated_at = now() returning version`, [uid, coll])).rows[0].version;
    return Number(v);
  }

  route('GET', '/api/v1/collections', {}, async (ctx) => {
    await need('records.own')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ collections: (await c.query(`select v.collection, v.version, (select count(*) from cia.records r where r.user_id = v.user_id and r.collection = v.collection)::int as count
      from cia.collection_versions v where v.user_id = $1 order by v.collection`, [ctx.user.uid])).rows.map(x => ({ ...x, version: Number(x.version) })) }));
  });

  route('GET', '/api/v1/collections/:c', {}, async (ctx) => {
    await need('records.own')(ctx);
    const coll = collectionName(ctx.params.c);
    return db.asUser(ctx.user.uid, async c => ({
      collection: coll, version: await versionOf(c, ctx.user.uid, coll),
      items: (await c.query('select data from cia.records where user_id = $1 and collection = $2 order by updated_at, record_id', [ctx.user.uid, coll])).rows.map(x => x.data)
    }));
  });

  route('PUT', '/api/v1/collections/:c', { limit: 'write', bodyLimit: 4_000_000 }, async (ctx) => {
    await need('records.own')(ctx);
    const coll = collectionName(ctx.params.c);
    if (SERVER_GUARDED.includes(coll)) throw forbidden();
    const base = ctx.body?.base_version;
    return db.asUser(ctx.user.uid, async c => {
      await c.query('select pg_advisory_xact_lock(hashtext($1))', [ctx.user.uid + ':' + coll]);
      const current = await versionOf(c, ctx.user.uid, coll);
      if (base != null && Number(base) !== current) {
        const items = (await c.query('select data from cia.records where user_id = $1 and collection = $2 order by updated_at, record_id', [ctx.user.uid, coll])).rows.map(x => x.data);
        return { status: 409, body: { code: 'version', version: current, items } };
      }
      const { items, dropped } = await normalise(c, ctx.user.uid, coll, ctx.body?.items);
      const version = await writeCollection(c, ctx.user.uid, coll, items);
      return { version, items: coll === 'lab_attempts' ? items : undefined, dropped };
    });
  });

  route('DELETE', '/api/v1/collections/:c', { limit: 'write' }, async (ctx) => {
    await need('records.own')(ctx);
    const coll = collectionName(ctx.params.c);
    if (SERVER_GUARDED.includes(coll)) throw forbidden();
    return db.asUser(ctx.user.uid, async c => ({ version: await writeCollection(c, ctx.user.uid, coll, []) }));
  });

  /* ------------------------------------------------------------ move device records to the account (D-111) */
  async function accountCopy(c, uid, names) {
    const rows = (await c.query('select collection, data from cia.records where user_id = $1 and collection = any($2::text[])', [uid, names])).rows;
    const out = {}; for (const x of rows) (out[x.collection] ||= []).push(x.data);
    return out;
  }
  const deviceBody = b => { const d = b?.collections; if (!d || typeof d !== 'object' || Array.isArray(d)) throw bad('collections'); return d; };

  route('POST', '/api/v1/migrate/preview', { bodyLimit: 8_000_000 }, async (ctx) => {
    await need('records.own')(ctx);
    const device = deviceBody(ctx.body);
    return db.asUser(ctx.user.uid, async c => planMigration(device, await accountCopy(c, ctx.user.uid, Object.keys(device))));
  });

  route('POST', '/api/v1/migrate/apply', { limit: 'write', bodyLimit: 8_000_000 }, async (ctx) => {
    await need('records.own')(ctx);
    const device = deviceBody(ctx.body);
    return db.asUser(ctx.user.uid, async c => {
      await c.query('select pg_advisory_xact_lock(hashtext($1))', [ctx.user.uid + ':migrate']);
      const { plan, result } = applyMigration(device, await accountCopy(c, ctx.user.uid, Object.keys(device)));
      const written = {}, dropped = {};
      for (const [coll, items] of Object.entries(result)) {
        const n = await normalise(c, ctx.user.uid, coll, items);
        written[coll] = await writeCollection(c, ctx.user.uid, coll, n.items);
        if (n.dropped.length) dropped[coll] = n.dropped;
      }
      await audit(c, ctx.user.uid, 'account.move_records', ctx.user.uid, { added: plan.totals.add, kept: plan.totals.kept, reviews_not_moved: plan.reviewsNotMoved });
      return { plan, versions: written, dropped };
    });
  });

  /* ------------------------------------------------------------ shared evidence review (D-116) */
  route('POST', '/api/v1/reviews', { limit: 'write' }, async (ctx) => {
    await need('review.request')(ctx);
    const rid = str(ctx.body?.record_id, 200);
    return db.asUser(ctx.user.uid, async c => {
      const a = (await c.query("select data from cia.records where user_id = $1 and collection = 'lab_attempts' and record_id = $2", [ctx.user.uid, rid])).rows[0]?.data;
      if (!a) throw notFound();
      const lab = await content.lab(a.lab_id);
      if (!lab) throw bad('unknown_lab');
      const payload = reviewPayload(lab, a);
      const pending = payload.tasks.filter(t => !(a.reviews || {})[t.task_id]);
      if (!pending.length) throw new HttpError(409, 'nothing_to_review');
      payload.tasks = pending;
      const id = (await c.query('select gen_random_uuid() as id')).rows[0].id;
      await c.query('insert into cia.review_requests (id, learner_id, reference, record_id, lab_id, payload) values ($1, $2, $3, $4, $5, $6)',
        [id, ctx.user.uid, reviewReference(id), rid, a.lab_id, payload]);
      await audit(c, ctx.user.uid, 'review.request', id);
      return { status: 201, body: { id, reference: reviewReference(id), tasks: pending.length } };
    });
  });

  const slaHours = async c => { const v = (await c.query("select value from cia.settings where key = 'review_sla_hours'")).rows[0]?.value; return Number.isFinite(v) ? v : null; };

  route('GET', '/api/v1/reviews/mine', {}, async (ctx) => {
    await need('review.request')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ requests: (await c.query('select id, reference, record_id, lab_id, status, reviewer_name, created_at, assigned_at, completed_at from cia.review_requests where learner_id = $1 order by created_at desc', [ctx.user.uid])).rows }));
  });

  route('GET', '/api/v1/reviews/queue', {}, async (ctx) => {
    await need('review.queue')(ctx);
    return db.asUser(ctx.user.uid, async c => {
      const sla = await slaHours(c);
      const rows = (await c.query(`select id, reference, lab_id, payload, status, reviewer_id, reviewer_name, created_at, assigned_at from cia.review_requests
        where learner_id <> $1 and (status = 'open' or (status = 'assigned' and reviewer_id = $1)) order by created_at`, [ctx.user.uid])).rows;
      const now = new Date().toISOString();
      return { sla_hours: sla, requests: rows.map(x => ({ ...x, mine: x.reviewer_id === ctx.user.uid, reviewer_id: undefined, sla: slaState(new Date(x.created_at).toISOString(), sla, now) })) };
    });
  });

  route('POST', '/api/v1/reviews/:id/claim', { limit: 'write' }, async (ctx) => {
    await need('review.queue')(ctx);
    const id = uuid(ctx.params.id), name = cleanName(ctx.body?.name || ctx.user.name);
    await db.asUser(ctx.user.uid, c => c.query('select cia.claim_review($1, $2)', [id, name]));
    return { ok: true };
  });

  route('POST', '/api/v1/reviews/:id/assign', { limit: 'write' }, async (ctx) => {
    await need('review.assign')(ctx);
    const id = uuid(ctx.params.id), reviewer = uuid(ctx.body?.reviewer_id), name = cleanName(ctx.body?.name);
    if (reviewer === ctx.user.uid && !can(ctx.roles, 'review.score')) throw forbidden();
    await db.asUser(ctx.user.uid, c => c.query('select cia.assign_review($1, $2, $3)', [id, reviewer, name]));
    return { ok: true };
  });

  route('POST', '/api/v1/reviews/:id/withdraw', { limit: 'write' }, async (ctx) => {
    await need('review.request')(ctx);
    const id = uuid(ctx.params.id);
    const n = await db.asUser(ctx.user.uid, c => c.query("update cia.review_requests set status = 'withdrawn' where id = $1 and learner_id = $2 and status = 'open'", [id, ctx.user.uid]));
    if (!n.rowCount) throw new HttpError(409, 'state');
    return { ok: true };
  });

  route('POST', '/api/v1/reviews/:id/scores', { limit: 'write' }, async (ctx) => {
    await need('review.score')(ctx);
    const id = uuid(ctx.params.id);
    const date = String(ctx.body?.date || today());
    const scores = Array.isArray(ctx.body?.scores) ? ctx.body.scores.slice(0, 50) : [];
    if (!scores.length) throw bad('scores');
    return db.asUser(ctx.user.uid, async c => {
      const req = (await c.query('select id, learner_id, lab_id, reviewer_id, reviewer_name, status from cia.review_requests where id = $1', [id])).rows[0];
      if (!req) throw notFound();
      if (!can(ctx.roles, 'review.score', { actor: ctx.user.uid, subject: req.learner_id })) throw forbidden();
      if (req.reviewer_id !== ctx.user.uid || req.status !== 'assigned') throw forbidden();
      const attempt = (await c.query('select cia.review_attempt($1) as a', [id])).rows[0].a;
      if (!attempt) throw new HttpError(409, 'attempt_gone');
      const lab = await content.lab(req.lab_id);
      if (!lab) throw bad('unknown_lab');
      const reviews = Object.fromEntries(scores.map(s => [str(s.task_id, 80), { score: s.score, reviewer: req.reviewer_name, date, comment: str(s.comment, 500) }]));
      const out = reviewLabAttempt(lab, attempt, reviews, { today: today() });
      if (Object.keys(out.errors).length) throw bad('scores', out.errors);
      await c.query('select cia.complete_review($1, $2, $3)', [id, JSON.stringify(scores.map(s => ({ task_id: str(s.task_id, 80), score: Number(out.attempt.reviews[str(s.task_id, 80)].score), comment: str(s.comment, 500), date }))), out.attempt]);
      return { ok: true, status: out.attempt.status, score: out.attempt.score, pending_review: out.attempt.pending_review };
    });
  });

  /* ------------------------------------------------------------ organisations, consents, assignments (D-114) */
  route('POST', '/api/v1/orgs', { limit: 'write' }, async (ctx) => {
    await need('org.create')(ctx);
    const name = str(ctx.body?.name, 120);
    if (name.length < 2) throw bad('name');
    const firstAdmin = cleanEmail(ctx.body?.first_admin_email);
    if (!EMAIL.test(firstAdmin)) throw bad('first_admin_email');
    return db.asUser(ctx.user.uid, async c => {
      const org = (await c.query('insert into cia.orgs (name, created_by) values ($1, $2) returning id, name, created_at', [name, ctx.user.uid])).rows[0];
      // The platform administrator never becomes a member: they invite the first company administrator (pilot, D-114).
      const t = newToken();
      await c.query("insert into cia.invitations (org_id, email, role, token_hash, created_by, expires_at) values ($1, $2, 'company_admin', $3, $4, $5)", [org.id, firstAdmin, tokenHash(t), ctx.user.uid, days(INVITE_DAYS)]);
      await audit(c, ctx.user.uid, 'org.create', org.id, { pilot: true });
      return { status: 201, body: { org, invitation: { email: firstAdmin, token: t, expires_days: INVITE_DAYS } } };
    });
  });

  route('GET', '/api/v1/orgs/mine', {}, async (ctx) => {
    await need('records.own')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ orgs: (await c.query('select o.id, o.name, m.role, m.joined_at from cia.org_members m join cia.orgs o on o.id = m.org_id where m.user_id = $1 order by o.name', [ctx.user.uid])).rows }));
  });

  const orgAdmin = async (ctx) => {
    await need('org.manage')(ctx);
    const id = uuid(ctx.params.id);
    if (!ctx.orgs.some(o => o.org_id === id && o.role === 'company_admin')) throw forbidden();
    return id;
  };

  route('GET', '/api/v1/orgs/:id/people', {}, async (ctx) => {
    const org = await orgAdmin(ctx);
    return db.asUser(ctx.user.uid, async c => ({
      people: (await c.query('select * from cia.org_people($1)', [org])).rows,
      departments: (await c.query('select id, name, role_ids from cia.departments where org_id = $1 order by name', [org])).rows,
      invitations: (await c.query('select id, email, role, created_at, expires_at, accepted_at from cia.invitations where org_id = $1 order by created_at desc', [org])).rows
    }));
  });

  route('POST', '/api/v1/orgs/:id/invitations', { limit: 'write' }, async (ctx) => {
    const org = await orgAdmin(ctx);
    const email = cleanEmail(ctx.body?.email), role = ctx.body?.role === 'company_admin' ? 'company_admin' : 'employee';
    if (!EMAIL.test(email)) throw bad('email');
    const t = newToken();
    await db.asUser(ctx.user.uid, async c => {
      await c.query('insert into cia.invitations (org_id, email, role, token_hash, created_by, expires_at) values ($1, $2, $3, $4, $5, $6)', [org, email, role, tokenHash(t), ctx.user.uid, days(INVITE_DAYS)]);
      await audit(c, ctx.user.uid, 'org.invite', org, { role });
    });
    return { status: 201, body: { token: t, email, role, expires_days: INVITE_DAYS } };
  });

  route('POST', '/api/v1/invitations/accept', { limit: 'write' }, async (ctx) => {
    await need('records.own')(ctx);
    const t = String(ctx.body?.token || '');
    const org = await db.asUser(ctx.user.uid, async c => (await c.query('select cia.accept_invitation($1) as org', [tokenHash(t)])).rows[0].org);
    return { ok: true, org_id: org };
  });

  route('POST', '/api/v1/orgs/:id/departments', { limit: 'write' }, async (ctx) => {
    const org = await orgAdmin(ctx);
    const name = str(ctx.body?.name, 120);
    if (name.length < 2) throw bad('name');
    const roleIds = (Array.isArray(ctx.body?.role_ids) ? ctx.body.role_ids : []).map(x => str(x, 80)).filter(Boolean).slice(0, 40);
    return db.asUser(ctx.user.uid, async c => ({ status: 201, body: (await c.query('insert into cia.departments (org_id, name, role_ids) values ($1, $2, $3) returning id, name, role_ids', [org, name, roleIds])).rows[0] }));
  });

  route('PUT', '/api/v1/orgs/:id/people/:uid', { limit: 'write' }, async (ctx) => {
    const org = await orgAdmin(ctx);
    const who = uuid(ctx.params.uid);
    const dep = ctx.body?.department_id ? uuid(ctx.body.department_id) : null;
    const jr = ctx.body?.job_role_id ? str(ctx.body.job_role_id, 80) : null;
    const n = await db.asUser(ctx.user.uid, c => c.query('update cia.org_members set department_id = $1, job_role_id = $2 where org_id = $3 and user_id = $4', [dep, jr, org, who]));
    if (!n.rowCount) throw notFound();
    return { ok: true };
  });

  route('GET', '/api/v1/orgs/:id/shares', {}, async (ctx) => {
    const org = await orgAdmin(ctx);
    return db.asUser(ctx.user.uid, async c => ({
      shares: (await c.query(`select c.id, c.learner_id, c.parts, c.display_name, c.job_title, c.snapshot, c.granted_at, c.refreshed_at, m.department_id, m.job_role_id
        from cia.consents c left join cia.org_members m on m.org_id = c.org_id and m.user_id = c.learner_id where c.org_id = $1 order by c.display_name`, [org])).rows
    }));
  });

  route('GET', '/api/v1/orgs/:id/assignments', {}, async (ctx) => {
    const org = await orgAdmin(ctx);
    return db.asUser(ctx.user.uid, async c => ({ assignments: (await c.query('select * from cia.assignments where org_id = $1 order by due nulls last, created_at', [org])).rows }));
  });

  route('POST', '/api/v1/orgs/:id/assignments', { limit: 'write' }, async (ctx) => {
    const org = await orgAdmin(ctx);
    const b = ctx.body || {};
    const assignee = uuid(b.assignee);
    if (!['course', 'lab', 'assessment', 'route'].includes(b.type)) throw bad('type');
    const due = b.due ? String(b.due) : null;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw bad('due');
    return db.asUser(ctx.user.uid, async c => {
      const member = (await c.query('select 1 from cia.org_members where org_id = $1 and user_id = $2', [org, assignee])).rowCount;
      if (!member) throw bad('assignee');
      const row = (await c.query(`insert into cia.assignments (org_id, assignee, type, target_id, target_slug, title, due, note, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [org, assignee, b.type, str(b.target_id, 120), b.target_slug ? str(b.target_slug, 120) : null, b.title && typeof b.title === 'object' ? { ar: str(b.title.ar), en: str(b.title.en) } : {}, due, b.note ? str(b.note, 500) : null, ctx.user.uid])).rows[0];
      await audit(c, ctx.user.uid, 'org.assign', row.id, { type: b.type });
      return { status: 201, body: row };
    });
  });

  route('GET', '/api/v1/me/assignments', {}, async (ctx) => {
    await need('records.own')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ assignments: (await c.query('select a.*, o.name as org_name from cia.assignments a join cia.orgs o on o.id = a.org_id where a.assignee = $1 order by a.due nulls last', [ctx.user.uid])).rows }));
  });

  route('PATCH', '/api/v1/me/assignments/:id', { limit: 'write' }, async (ctx) => {
    await need('records.own')(ctx);
    const id = uuid(ctx.params.id), state = ctx.body?.state;
    if (!['not_started', 'in_progress', 'completed'].includes(state)) throw bad('state');
    const n = await db.asUser(ctx.user.uid, c => c.query('update cia.assignments set state = $1 where id = $2 and assignee = $3', [state, id, ctx.user.uid]));
    if (!n.rowCount) throw notFound();
    return { ok: true };
  });

  /** Validate a consent snapshot with the existing share reader; "verified" levels survive only with a server verification. */
  async function checkedSnapshot(c, uid, share, parts) {
    const ids = await content.competencyIds();
    const read = readShare(share, { competencyIds: ids, today: today() });
    if (!read.ok) throw bad('share', read.err);
    const consented = SHARE_PARTS.filter(p => parts.includes(p));
    if (read.share.includes.some(p => !consented.includes(p))) throw bad('parts_mismatch');
    const data = read.share.data;
    if (data.competencies) {
      const vrows = (await c.query("select data from cia.records where user_id = $1 and collection = 'passport_verifications'", [uid])).rows.map(x => x.data);
      const okIds = new Set(vrows.filter(v => v?.decision === 'verified').map(v => v.target_id));
      data.competencies = data.competencies.map(r => (r.source === 'verified' && !okIds.has(r.id) ? { id: r.id, level: null, source: 'none', downgraded: true } : r)).filter(r => r.source !== 'none');
    }
    return { snapshot: { includes: read.share.includes, data, notes: read.notes }, name: read.share.name, job: read.share.job_title };
  }

  route('GET', '/api/v1/me/consents', {}, async (ctx) => {
    await need('consent.grant')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ consent_text: CONSENT_TEXT, consent_text_version: CONSENT_TEXT_VERSION,
      consents: (await c.query('select c.id, c.org_id, o.name as org_name, c.parts, c.display_name, c.job_title, c.granted_at, c.refreshed_at, c.withdrawn_at from cia.consents c join cia.orgs o on o.id = c.org_id where c.learner_id = $1 order by c.granted_at desc', [ctx.user.uid])).rows }));
  });

  route('POST', '/api/v1/me/consents', { limit: 'write' }, async (ctx) => {
    await need('consent.grant')(ctx);
    const org = uuid(ctx.body?.org_id);
    const parts = (Array.isArray(ctx.body?.parts) ? ctx.body.parts : []).filter(p => SHARE_PARTS.includes(p));
    if (!parts.length) throw bad('parts');
    if (ctx.body?.accepted !== true) throw bad('consent');
    return db.asUser(ctx.user.uid, async c => {
      const s = await checkedSnapshot(c, ctx.user.uid, ctx.body?.share, parts);
      const row = (await c.query(`insert into cia.consents (learner_id, org_id, parts, consent_text_version, display_name, job_title, snapshot) values ($1,$2,$3,$4,$5,$6,$7) returning id, granted_at`,
        [ctx.user.uid, org, parts, CONSENT_TEXT_VERSION, s.name, s.job, s.snapshot])).rows[0];
      await audit(c, ctx.user.uid, 'consent.grant', row.id, { org, parts });
      return { status: 201, body: { id: row.id, granted_at: row.granted_at, notes: s.snapshot.notes } };
    });
  });

  route('PUT', '/api/v1/me/consents/:id', { limit: 'write' }, async (ctx) => {
    await need('consent.grant')(ctx);
    const id = uuid(ctx.params.id);
    return db.asUser(ctx.user.uid, async c => {
      const row = (await c.query('select parts, withdrawn_at from cia.consents where id = $1 and learner_id = $2', [id, ctx.user.uid])).rows[0];
      if (!row) throw notFound();
      if (row.withdrawn_at) throw new HttpError(409, 'withdrawn');
      const s = await checkedSnapshot(c, ctx.user.uid, ctx.body?.share, row.parts);
      await c.query('update cia.consents set snapshot = $1, display_name = $2, job_title = $3, refreshed_at = now() where id = $4', [s.snapshot, s.name, s.job, id]);
      return { ok: true };
    });
  });

  route('POST', '/api/v1/me/consents/:id/withdraw', { limit: 'write' }, async (ctx) => {
    await need('consent.grant')(ctx);
    const id = uuid(ctx.params.id);
    return db.asUser(ctx.user.uid, async c => {
      const n = await c.query('update cia.consents set withdrawn_at = now() where id = $1 and learner_id = $2 and withdrawn_at is null', [id, ctx.user.uid]);
      if (!n.rowCount) throw notFound();
      await audit(c, ctx.user.uid, 'consent.withdraw', id);
      return { ok: true };
    });
  });

  /* ------------------------------------------------------------ Admin CMS (D-115) */
  const cmsCollection = v => { const c = String(v || ''); if (!CMS_COLLECTIONS.includes(c)) throw bad('collection'); return c; };

  route('GET', '/api/v1/admin/content', {}, async (ctx) => {
    await need('cms.read')(ctx);
    const coll = cmsCollection(ctx.query.collection);
    const [published, drafts] = await Promise.all([content.list(coll), db.asUser(ctx.user.uid, async c => (await c.query("select id, record_id, version, status, author_name, updated_at from cia.content_drafts where collection = $1 and status <> 'exported' order by updated_at desc", [coll])).rows)]);
    return { collection: coll, records: published, drafts };
  });

  route('GET', '/api/v1/admin/content/record', {}, async (ctx) => {
    await need('cms.read')(ctx);
    const rec = await content.record(cmsCollection(ctx.query.collection), String(ctx.query.id || ''));
    if (!rec) throw notFound();
    return { record: rec };
  });

  route('GET', '/api/v1/admin/drafts', {}, async (ctx) => {
    await need('cms.read')(ctx);
    const st = ctx.query.status;
    return db.asUser(ctx.user.uid, async c => ({ drafts: (await c.query(`select id, collection, record_id, version, status, author_id, author_name, note, updated_at from cia.content_drafts
      where ($1::text is null or status = $1) and status <> 'exported' order by updated_at desc limit 500`, [st || null])).rows.map(d => ({ ...d, mine: d.author_id === ctx.user.uid, author_id: undefined })) }));
  });

  route('POST', '/api/v1/admin/drafts', { limit: 'write', bodyLimit: 1_000_000 }, async (ctx) => {
    await need('cms.write')(ctx);
    const coll = cmsCollection(ctx.body?.collection);
    const data = nextDraftData(ctx.body?.data || {});
    const errs = validateDraft(coll, data); if (errs.length) throw bad('draft', errs);
    return db.asUser(ctx.user.uid, async c => {
      const id = (await c.query('insert into cia.content_drafts (collection, record_id, data, author_id, author_name, note) values ($1,$2,$3,$4,$5,$6) returning id', [coll, data.id, data, ctx.user.uid, ctx.user.name, str(ctx.body?.note, 500)])).rows[0].id;
      await c.query('insert into cia.content_draft_versions (draft_id, version, data, saved_by, saved_name, note) values ($1, 1, $2, $3, $4, $5)', [id, data, ctx.user.uid, ctx.user.name, str(ctx.body?.note, 500)]);
      await audit(c, ctx.user.uid, 'cms.draft_create', id, { collection: coll, record: data.id });
      return { status: 201, body: { id, version: 1, data } };
    });
  });

  async function loadDraft(c, id) {
    const d = (await c.query('select * from cia.content_drafts where id = $1', [id])).rows[0];
    if (!d) throw notFound();
    return d;
  }

  route('GET', '/api/v1/admin/drafts/:id', {}, async (ctx) => {
    await need('cms.read')(ctx);
    const id = uuid(ctx.params.id);
    return db.asUser(ctx.user.uid, async c => {
      const d = await loadDraft(c, id);
      const versions = (await c.query('select version, saved_name, saved_at, note, data from cia.content_draft_versions where draft_id = $1 order by version', [id])).rows;
      const decisions = (await c.query('select version, decision, basis, reviewer_name, review_date, comment, created_at from cia.content_decisions where draft_id = $1 order by created_at', [id])).rows;
      const published = await content.record(d.collection, d.record_id);
      return { draft: { ...d, mine: d.author_id === ctx.user.uid, author_id: undefined }, published,
        versions: versions.map((v, i) => ({ version: v.version, saved_name: v.saved_name, saved_at: v.saved_at, note: v.note, changes: diffRecords(i ? versions[i - 1].data : (published || {}), v.data, 25) })),
        decisions };
    });
  });

  route('PUT', '/api/v1/admin/drafts/:id', { limit: 'write', bodyLimit: 1_000_000 }, async (ctx) => {
    await need('cms.write')(ctx);
    const id = uuid(ctx.params.id);
    return db.asUser(ctx.user.uid, async c => {
      const d = await loadDraft(c, id);
      if (!['draft', 'changes_requested'].includes(d.status)) throw new HttpError(409, 'state');
      const data = nextDraftData(ctx.body?.data || {}, d.data);
      if (data.id !== d.record_id) throw bad('id_changed');
      const errs = validateDraft(d.collection, data); if (errs.length) throw bad('draft', errs);
      const v = d.version + 1;
      await c.query("update cia.content_drafts set data = $1, version = $2, status = 'draft', note = $3, updated_at = now() where id = $4", [data, v, str(ctx.body?.note, 500), id]);
      await c.query('insert into cia.content_draft_versions (draft_id, version, data, saved_by, saved_name, note) values ($1,$2,$3,$4,$5,$6)', [id, v, data, ctx.user.uid, ctx.user.name, str(ctx.body?.note, 500)]);
      await audit(c, ctx.user.uid, 'cms.draft_save', id, { version: v });
      return { id, version: v, data };
    });
  });

  route('POST', '/api/v1/admin/drafts/:id/restore', { limit: 'write' }, async (ctx) => {
    await need('cms.write')(ctx);
    const id = uuid(ctx.params.id), want = Number(ctx.body?.version);
    return db.asUser(ctx.user.uid, async c => {
      const d = await loadDraft(c, id);
      if (!['draft', 'changes_requested'].includes(d.status)) throw new HttpError(409, 'state');
      const old = (await c.query('select data from cia.content_draft_versions where draft_id = $1 and version = $2', [id, want])).rows[0];
      if (!old) throw notFound();
      const v = d.version + 1;
      const data = nextDraftData(old.data, d.data);
      await c.query("update cia.content_drafts set data = $1, version = $2, status = 'draft', updated_at = now() where id = $3", [data, v, id]);
      await c.query('insert into cia.content_draft_versions (draft_id, version, data, saved_by, saved_name, note) values ($1,$2,$3,$4,$5,$6)', [id, v, data, ctx.user.uid, ctx.user.name, `restored version ${want}`]);
      await audit(c, ctx.user.uid, 'cms.draft_restore', id, { from: want, version: v });
      return { id, version: v, data };
    });
  });

  route('POST', '/api/v1/admin/drafts/:id/submit', { limit: 'write' }, async (ctx) => {
    await need('cms.write')(ctx);
    const id = uuid(ctx.params.id);
    return db.asUser(ctx.user.uid, async c => {
      const n = await c.query("update cia.content_drafts set status = 'submitted', updated_at = now() where id = $1 and status in ('draft', 'changes_requested')", [id]);
      if (!n.rowCount) throw new HttpError(409, 'state');
      await audit(c, ctx.user.uid, 'cms.draft_submit', id);
      return { ok: true };
    });
  });

  route('POST', '/api/v1/admin/drafts/:id/decision', { limit: 'write' }, async (ctx) => {
    await need('cms.decide')(ctx);
    const id = uuid(ctx.params.id);
    const decision = ctx.body?.decision, basis = ctx.body?.basis === 'owner_approval' ? 'owner_approval' : 'expert_review';
    if (!['approve', 'changes_requested'].includes(decision)) throw bad('decision');
    const name = cleanName(ctx.body?.reviewer_name || ctx.user.name);
    if (name.length < 3) throw bad('reviewer_name');
    if (decision === 'changes_requested' && str(ctx.body?.comment, 1000).length < 3) throw bad('comment');
    return db.asUser(ctx.user.uid, async c => {
      const d = await loadDraft(c, id);
      if (d.status !== 'submitted') throw new HttpError(409, 'state');
      if (!can(ctx.roles, 'cms.decide', { actor: ctx.user.uid, subject: d.author_id, ownerApproval: basis === 'owner_approval' })) throw forbidden();
      await c.query('insert into cia.content_decisions (draft_id, version, decision, basis, reviewer_id, reviewer_name, review_date, comment) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, d.version, decision, basis, ctx.user.uid, name, today(), str(ctx.body?.comment, 1000)]);
      await c.query('update cia.content_drafts set status = $1, updated_at = now() where id = $2', [decision === 'approve' ? 'approved' : 'changes_requested', id]);
      await audit(c, ctx.user.uid, 'cms.decision', id, { decision, basis, version: d.version });
      return { ok: true, status: decision === 'approve' ? 'approved' : 'changes_requested' };
    });
  });

  route('GET', '/api/v1/admin/export', {}, async (ctx) => {
    await need('cms.export')(ctx);
    return db.asUser(ctx.user.uid, async c => {
      const rows = (await c.query(`select d.id, d.collection, d.record_id, d.version, d.data, x.decision, x.basis, x.reviewer_name, x.review_date, x.comment
        from cia.content_drafts d join lateral (select * from cia.content_decisions k where k.draft_id = d.id and k.version = d.version order by k.created_at desc limit 1) x on true
        where d.status = 'approved' order by d.collection, d.record_id`)).rows;
      return { drafts: draftsFile(rows), decisions: decisionsFile(rows), ids: rows.map(x => x.id) };
    });
  });

  route('POST', '/api/v1/admin/export/mark', { limit: 'write' }, async (ctx) => {
    await need('cms.export')(ctx);
    const ids = (Array.isArray(ctx.body?.ids) ? ctx.body.ids : []).map(uuid);
    return db.asUser(ctx.user.uid, async c => {
      const n = await c.query("update cia.content_drafts set status = 'exported', updated_at = now() where id = any($1::uuid[]) and status = 'approved'", [ids]);
      await audit(c, ctx.user.uid, 'cms.export', '', { count: n.rowCount });
      return { exported: n.rowCount };
    });
  });

  /* ------------------------------------------------------------ users and roles */
  route('GET', '/api/v1/admin/users', {}, async (ctx) => {
    await need('users.manage')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ users: (await c.query(`select u.id, u.email, u.display_name, u.created_at, u.last_seen_at,
      coalesce((select array_agg(role order by role) from cia.user_roles r where r.user_id = u.id), '{}') as roles from cia.users u order by u.created_at limit 2000`)).rows }));
  });

  route('POST', '/api/v1/admin/users/:id/roles', { limit: 'write' }, async (ctx) => {
    await need('users.manage')(ctx);
    const who = uuid(ctx.params.id), role = ctx.body?.role, grant = ctx.body?.grant === true;
    if (!ACCOUNT_ROLES.includes(role) || role === 'learner') throw bad('role');
    return db.asUser(ctx.user.uid, async c => {
      if (grant) await c.query('insert into cia.user_roles (user_id, role, granted_by) values ($1, $2, $3) on conflict do nothing', [who, role, ctx.user.uid]);
      else { const n = await c.query('delete from cia.user_roles where user_id = $1 and role = $2', [who, role]); if (!n.rowCount && who === ctx.user.uid) throw forbidden(); }
      await audit(c, ctx.user.uid, grant ? 'role.grant' : 'role.revoke', who, { role });
      return { ok: true };
    });
  });

  route('GET', '/api/v1/admin/audit', {}, async (ctx) => {
    await need('users.manage')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ entries: (await c.query('select id, at, actor, action, target, detail from cia.audit_log order by id desc limit $1', [Math.min(500, Number(ctx.query.limit) || 100)])).rows }));
  });

  route('GET', '/api/v1/admin/settings', {}, async (ctx) => {
    await need('settings.write')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ settings: Object.fromEntries((await c.query('select key, value from cia.settings')).rows.map(x => [x.key, x.value])), tiers: TIERS, feature_tiers: FEATURE_TIERS }));
  });

  route('PUT', '/api/v1/admin/settings/:key', { limit: 'write' }, async (ctx) => {
    await need('settings.write')(ctx);
    const key = ctx.params.key, v = ctx.body?.value;
    const ok = (key === 'review_sla_hours' && (v === null || (Number.isInteger(v) && v >= 1 && v <= 2160)))
      || (key === 'tiers_enforced' && typeof v === 'boolean') || (key === 'company_accounts' && ['pilot', 'open', 'off'].includes(v));
    if (!ok) throw bad('setting');
    return db.asUser(ctx.user.uid, async c => {
      const n = await c.query('update cia.settings set value = $1, updated_by = $2, updated_at = now() where key = $3', [JSON.stringify(v), ctx.user.uid, key]);
      if (!n.rowCount) throw notFound();
      await audit(c, ctx.user.uid, 'settings.update', key, { value: v });
      return { ok: true };
    });
  });

  /* ------------------------------------------------------------ verification center (D-117) */
  route('GET', '/api/v1/verifications', { public: true }, async () => db.asAnon(async c => ({
    verifications: (await c.query('select cert_id, body, source_url, last_verified, verifier, status, next_review from cia.cert_verifications order by cert_id')).rows.map(x => ({ ...x, last_verified: x.last_verified && iso(x.last_verified), next_review: x.next_review && iso(x.next_review) }))
  })));

  route('GET', '/api/v1/admin/verifications', {}, async (ctx) => {
    await need('verification.write')(ctx);
    const certs = await content.certifications();
    return db.asUser(ctx.user.uid, async c => {
      const rows = new Map((await c.query('select * from cia.cert_verifications')).rows.map(x => [x.cert_id, { ...x, last_verified: x.last_verified && iso(x.last_verified), next_review: x.next_review && iso(x.next_review) }]));
      const list = certs.map(ct => rows.get(ct.id) || { cert_id: ct.id, body: ct.body || '', source_url: ct.official_url || null, facts: {}, status: 'pending', last_verified: null, verifier: null, next_review: null, notes: '', seeded: true,
        content_facts_status: ct.facts_status || null, content_verified_date: ct.verified_date || null });
      for (const ct of certs) { const x = list.find(l => l.cert_id === ct.id); x.name = ct.name || null; x.code = ct.code || null; x.content_facts_status = ct.facts_status || null; x.content_verified_date = ct.verified_date || null; }
      return { verifications: list, reminders: verificationReminders(list, today()) };
    });
  });

  route('PUT', '/api/v1/admin/verifications/:cert', { limit: 'write' }, async (ctx) => {
    await need('verification.write')(ctx);
    const v = { ...ctx.body, cert_id: ctx.params.cert };
    const errs = validateCertVerification(v, today()); if (errs.length) throw bad('verification', errs);
    if (!(await content.certifications()).some(c => c.id === v.cert_id)) throw notFound();
    return db.asUser(ctx.user.uid, async c => {
      const row = (await c.query(`insert into cia.cert_verifications (cert_id, body, source_url, facts, last_verified, verifier, status, next_review, notes, updated_by, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now()) on conflict (cert_id) do update set body = excluded.body, source_url = excluded.source_url, facts = excluded.facts, last_verified = excluded.last_verified,
        verifier = excluded.verifier, status = excluded.status, next_review = excluded.next_review, notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now() returning *`,
      [v.cert_id, str(v.body, 40), v.source_url || null, v.facts || {}, v.last_verified || null, v.verifier ? cleanName(v.verifier) : null, v.status, v.next_review || null, str(v.notes, 2000), ctx.user.uid])).rows[0];
      await c.query('insert into cia.cert_verification_history (cert_id, data, changed_by) values ($1, $2, $3)', [v.cert_id, row, ctx.user.uid]);
      await audit(c, ctx.user.uid, 'verification.update', v.cert_id, { status: v.status });
      return { ok: true };
    });
  });

  route('GET', '/api/v1/admin/verifications/:cert/history', {}, async (ctx) => {
    await need('verification.write')(ctx);
    return db.asUser(ctx.user.uid, async c => ({ history: (await c.query('select id, data, changed_at from cia.cert_verification_history where cert_id = $1 order by id desc limit 100', [ctx.params.cert])).rows }));
  });

  /* ------------------------------------------------------------ analytics (D-119) */
  route('POST', '/api/v1/events', { public: true, limit: 'events' }, async (ctx) => {
    const list = Array.isArray(ctx.body?.events) ? ctx.body.events.slice(0, 20) : [];
    const clean = list.map(e => cleanEvent(e?.name, e?.dim)).filter(Boolean);
    const run = c => Promise.all(clean.map(e => c.query('select cia.track($1, $2)', [e.event, e.dim])));
    if (ctx.user) await db.asUser(ctx.user.uid, run); else await db.asAnon(run);
    return { status: 202, body: { accepted: clean.length, refused: list.length - clean.length } };
  });

  route('GET', '/api/v1/admin/analytics', {}, async (ctx) => {
    await need('analytics.read')(ctx);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.to || '') ? ctx.query.to : today();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.from || '') ? ctx.query.from : new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    return db.asUser(ctx.user.uid, async c => ({ from, to, rows: (await c.query('select * from cia.analytics_summary($1, $2)', [from, to])).rows.map(x => ({ ...x, count: x.count == null ? null : Number(x.count) })) }));
  });

  /* ------------------------------------------------------------ development only: the outbox (until an e-mail provider is chosen, D-14-3) */
  if (config.devOutbox) {
    route('GET', '/api/v1/dev/outbox', { public: true }, async () => db.asAuth(async c => ({ messages: (await c.query('select id, to_email, kind, body, created_at from cia.outbox order by id desc limit 50')).rows })));
  }

  return { router: r, sessionFrom, limits };
}

const iso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
