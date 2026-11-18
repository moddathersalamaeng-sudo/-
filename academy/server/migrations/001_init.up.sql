-- Continual Improvement Academy — Phase 14 server schema (PostgreSQL 15+). © 2026 Modather Salama.
-- Row-level security is the enforcement layer: the API runs every request as the restricted role cia_app with
-- cia.uid() set for the caller (PRODUCTION_ARCHITECTURE.md §3–§4). Authentication tables are reachable only by cia_auth.
-- Privileged steps that cross a person's boundary (claiming a review, writing a reviewed attempt, accepting an invitation,
-- analytics) are SECURITY DEFINER functions that check the caller themselves.

begin;

create schema if not exists cia;

do $$ begin
  if not exists (select from pg_roles where rolname = 'cia_app')  then create role cia_app nologin; end if;
  if not exists (select from pg_roles where rolname = 'cia_auth') then create role cia_auth nologin; end if;
end $$;

grant usage on schema cia to cia_app, cia_auth;

create or replace function cia.uid() returns uuid language sql stable as
$$ select nullif(current_setting('cia.uid', true), '')::uuid $$;

-- ---------------------------------------------------------------- people, sessions, roles
create table cia.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (length(email) between 3 and 254 and email like '%_@_%'),
  display_name  text not null default '' check (length(display_name) <= 80),
  pass_hash     text not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);
create unique index users_email_lower on cia.users (lower(email));

create table cia.sessions (
  token_hash    text primary key,
  user_id       uuid not null references cia.users on delete cascade,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);
create index sessions_user on cia.sessions (user_id);

create table cia.reset_tokens (
  token_hash  text primary key,
  user_id     uuid not null references cia.users on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Outgoing messages (reset links, invitations). Until the owner chooses an e-mail provider (D-14-3) they stay here.
create table cia.outbox (
  id          bigserial primary key,
  to_email    text not null,
  kind        text not null check (kind in ('reset', 'invitation')),
  body        jsonb not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create table cia.user_roles (
  user_id     uuid not null references cia.users on delete cascade,
  role        text not null check (role in ('learner', 'instructor', 'reviewer', 'admin')),
  granted_by  uuid references cia.users on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function cia.has_role(r text) returns boolean language sql stable security definer set search_path = cia, pg_temp as
$$ select exists (select 1 from cia.user_roles where user_id = cia.uid() and role = r) $$;

-- ---------------------------------------------------------------- learner records (one row per record, D-109)
create table cia.records (
  user_id     uuid not null references cia.users on delete cascade,
  collection  text not null check (collection ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  record_id   text not null check (length(record_id) between 1 and 200),
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, collection, record_id)
);

create table cia.collection_versions (
  user_id     uuid not null references cia.users on delete cascade,
  collection  text not null check (collection ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  version     bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, collection)
);

-- Collections a learner may read but never write on the server (D-110).
create or replace function cia.guarded(c text) returns boolean language sql immutable as
$$ select c in ('passport_verifications') $$;

-- ---------------------------------------------------------------- organisations (company portal on accounts)
create table cia.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 2 and 120),
  created_by  uuid references cia.users on delete set null,
  created_at  timestamptz not null default now()
);

create table cia.departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references cia.orgs on delete cascade,
  name        text not null check (length(name) between 2 and 120),
  role_ids    text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table cia.org_members (
  org_id         uuid not null references cia.orgs on delete cascade,
  user_id        uuid not null references cia.users on delete cascade,
  role           text not null check (role in ('company_admin', 'employee')),
  department_id  uuid references cia.departments on delete set null,
  job_role_id    text check (job_role_id is null or length(job_role_id) <= 80),
  joined_at      timestamptz not null default now(),
  primary key (org_id, user_id)
);

create or replace function cia.is_org_admin(o uuid) returns boolean language sql stable security definer set search_path = cia, pg_temp as
$$ select exists (select 1 from cia.org_members where org_id = o and user_id = cia.uid() and role = 'company_admin') $$;
create or replace function cia.is_org_member(o uuid) returns boolean language sql stable security definer set search_path = cia, pg_temp as
$$ select exists (select 1 from cia.org_members where org_id = o and user_id = cia.uid()) $$;

create table cia.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references cia.orgs on delete cascade,
  email        text not null check (length(email) between 3 and 254),
  role         text not null default 'employee' check (role in ('company_admin', 'employee')),
  token_hash   text not null unique,
  created_by   uuid references cia.users on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references cia.users on delete set null
);

create table cia.assignments (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references cia.orgs on delete cascade,
  assignee          uuid not null references cia.users on delete cascade,
  type              text not null check (type in ('course', 'lab', 'assessment', 'route')),
  target_id         text not null check (length(target_id) between 1 and 120),
  target_slug       text check (target_slug is null or target_slug ~ '^[a-z0-9-]{1,120}$'),
  title             jsonb not null default '{}',
  due               date,
  note              text check (note is null or length(note) <= 500),
  created_by        uuid references cia.users on delete set null,
  created_at        timestamptz not null default now(),
  state             text not null default 'not_started' check (state in ('not_started', 'in_progress', 'completed')),
  state_updated_at  timestamptz
);

-- Consent records replacing share files (D-114). One active consent per learner and organisation.
create table cia.consents (
  id                    uuid primary key default gen_random_uuid(),
  learner_id            uuid not null references cia.users on delete cascade,
  org_id                uuid not null references cia.orgs on delete cascade,
  parts                 text[] not null check (array_length(parts, 1) >= 1 and parts <@ array['competencies','verified','cpd','credentials','roadmap','assignments']),
  consent_text_version  text not null,
  display_name          text not null check (length(display_name) between 3 and 80),
  job_title             text not null default '' check (length(job_title) <= 120),
  snapshot              jsonb not null,
  granted_at            timestamptz not null default now(),
  refreshed_at          timestamptz not null default now(),
  withdrawn_at          timestamptz
);
create unique index consents_active on cia.consents (learner_id, org_id) where withdrawn_at is null;

-- ---------------------------------------------------------------- shared evidence review (closes L-11, D-116)
create table cia.review_requests (
  id             uuid primary key default gen_random_uuid(),
  learner_id     uuid not null references cia.users on delete cascade,
  reference      text not null,                       -- "Learner A-1F3C": the reviewer never sees a name or e-mail
  record_id      text not null check (length(record_id) between 1 and 200),
  lab_id         text not null check (length(lab_id) between 1 and 120),
  payload        jsonb not null,                      -- written tasks, rubric and answers only (exportAttempt parts)
  status         text not null default 'open' check (status in ('open', 'assigned', 'completed', 'withdrawn')),
  reviewer_id    uuid references cia.users on delete set null,
  reviewer_name  text,
  created_at     timestamptz not null default now(),
  assigned_at    timestamptz,
  completed_at   timestamptz,
  constraint no_self_review check (reviewer_id is null or reviewer_id <> learner_id)
);
create unique index review_requests_open on cia.review_requests (learner_id, record_id) where status in ('open', 'assigned');

create table cia.review_scores (
  request_id     uuid not null references cia.review_requests on delete cascade,
  task_id        text not null,
  score          numeric not null check (score >= 0),
  comment        text not null default '' check (length(comment) <= 500),
  reviewer_id    uuid references cia.users on delete set null,
  reviewer_name  text not null,
  review_date    date not null,
  created_at     timestamptz not null default now(),
  primary key (request_id, task_id)
);

-- ---------------------------------------------------------------- Admin CMS (files in Git stay the source, D-115)
create table cia.content_drafts (
  id           uuid primary key default gen_random_uuid(),
  collection   text not null check (collection ~ '^[a-z0-9/-]{1,64}$'),
  record_id    text not null check (record_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  version      int not null default 1,
  data         jsonb not null,
  status       text not null default 'draft' check (status in ('draft', 'submitted', 'changes_requested', 'approved', 'exported')),
  author_id    uuid references cia.users on delete set null,
  author_name  text not null,
  note         text not null default '' check (length(note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index content_drafts_open on cia.content_drafts (collection, record_id) where status <> 'exported';

create table cia.content_draft_versions (
  draft_id    uuid not null references cia.content_drafts on delete cascade,
  version     int not null,
  data        jsonb not null,
  saved_by    uuid references cia.users on delete set null,
  saved_name  text not null,
  saved_at    timestamptz not null default now(),
  note        text not null default '',
  primary key (draft_id, version)
);

create table cia.content_decisions (
  id             uuid primary key default gen_random_uuid(),
  draft_id       uuid not null references cia.content_drafts on delete cascade,
  version        int not null,
  decision       text not null check (decision in ('approve', 'changes_requested')),
  basis          text not null default 'expert_review' check (basis in ('expert_review', 'owner_approval')),
  reviewer_id    uuid references cia.users on delete set null,
  reviewer_name  text not null check (length(reviewer_name) >= 3),
  review_date    date not null,
  comment        text not null default '' check (length(comment) <= 1000),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- Certification Verification Center (D-117)
create table cia.cert_verifications (
  cert_id        text primary key check (cert_id ~ '^[A-Za-z0-9._-]{1,80}$'),
  body           text not null default '' check (length(body) <= 40),
  source_url     text check (source_url is null or source_url ~ '^https://'),
  facts          jsonb not null default '{}',
  last_verified  date,
  verifier       text check (verifier is null or length(verifier) between 3 and 80),
  status         text not null default 'pending' check (status in ('verified', 'pending', 'changed')),
  next_review    date,
  notes          text not null default '' check (length(notes) <= 2000),
  updated_by     uuid references cia.users on delete set null,
  updated_at     timestamptz not null default now(),
  constraint verified_needs_who_when check (status <> 'verified' or (verifier is not null and last_verified is not null and source_url is not null))
);

create table cia.cert_verification_history (
  id          bigserial primary key,
  cert_id     text not null,
  data        jsonb not null,
  changed_by  uuid references cia.users on delete set null,
  changed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- analytics (D-119): counts only, no user id
create table cia.analytics_daily (
  day    date not null,
  event  text not null check (event ~ '^[a-z_]{2,40}$'),
  dim    text not null default '' check (length(dim) <= 80),
  count  int not null default 0,
  primary key (day, event, dim)
);
create table cia.analytics_active (
  day   date not null,
  hash  text not null,
  primary key (day, hash)
);
-- One key per day; older keys are deleted, so past hashes can never be recomputed or linked across days.
create table cia.analytics_keys (
  day  date primary key,
  key  text not null
);

-- ---------------------------------------------------------------- settings and audit
create table cia.settings (
  key         text primary key check (key ~ '^[a-z_]{2,40}$'),
  value       jsonb not null,
  updated_by  uuid references cia.users on delete set null,
  updated_at  timestamptz not null default now()
);
insert into cia.settings (key, value) values
  ('tiers_enforced', 'false'), ('review_sla_hours', 'null'), ('company_accounts', '"pilot"'), ('owner_user_id', 'null');

create table cia.audit_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   uuid,
  action  text not null check (action ~ '^[a-z_.]{2,60}$'),
  target  text not null default '',
  detail  jsonb not null default '{}'
);

-- ================================================================ row-level security
alter table cia.users enable row level security;
alter table cia.user_roles enable row level security;
alter table cia.records enable row level security;
alter table cia.collection_versions enable row level security;
alter table cia.orgs enable row level security;
alter table cia.departments enable row level security;
alter table cia.org_members enable row level security;
alter table cia.invitations enable row level security;
alter table cia.assignments enable row level security;
alter table cia.consents enable row level security;
alter table cia.review_requests enable row level security;
alter table cia.review_scores enable row level security;
alter table cia.content_drafts enable row level security;
alter table cia.content_draft_versions enable row level security;
alter table cia.content_decisions enable row level security;
alter table cia.cert_verifications enable row level security;
alter table cia.cert_verification_history enable row level security;
alter table cia.settings enable row level security;
alter table cia.audit_log enable row level security;

-- users: a person sees themselves; administrators see id / e-mail / name (the hash is never granted to cia_app)
create policy users_auth on cia.users to cia_auth using (true) with check (true);
create policy users_self on cia.users for select to cia_app using (id = cia.uid() or cia.has_role('admin'));
create policy users_self_update on cia.users for update to cia_app using (id = cia.uid()) with check (id = cia.uid());

create policy roles_auth on cia.user_roles to cia_auth using (true) with check (true);
create policy roles_read on cia.user_roles for select to cia_app using (user_id = cia.uid() or cia.has_role('admin'));
create policy roles_grant on cia.user_roles for insert to cia_app with check (cia.has_role('admin'));
create policy roles_revoke on cia.user_roles for delete to cia_app using (cia.has_role('admin') and not (user_id = cia.uid() and role = 'admin'));

-- records: the owner only; guarded collections are read-only to the owner
create policy rec_select on cia.records for select to cia_app using (user_id = cia.uid());
create policy rec_insert on cia.records for insert to cia_app with check (user_id = cia.uid() and not cia.guarded(collection));
create policy rec_update on cia.records for update to cia_app using (user_id = cia.uid() and not cia.guarded(collection)) with check (user_id = cia.uid() and not cia.guarded(collection));
create policy rec_delete on cia.records for delete to cia_app using (user_id = cia.uid() and not cia.guarded(collection));
create policy rec_auth on cia.records for delete to cia_auth using (true);

create policy ver_all on cia.collection_versions to cia_app using (user_id = cia.uid()) with check (user_id = cia.uid());

-- organisations
create policy org_read on cia.orgs for select to cia_app using (cia.is_org_member(id) or cia.has_role('admin'));
create policy org_create on cia.orgs for insert to cia_app with check (cia.has_role('admin') and created_by = cia.uid());
create policy org_update on cia.orgs for update to cia_app using (cia.is_org_admin(id)) with check (cia.is_org_admin(id));
create policy org_delete on cia.orgs for delete to cia_app using (cia.is_org_admin(id));

create policy dep_read on cia.departments for select to cia_app using (cia.is_org_member(org_id));
create policy dep_write on cia.departments for all to cia_app using (cia.is_org_admin(org_id)) with check (cia.is_org_admin(org_id));

create policy mem_read on cia.org_members for select to cia_app using (user_id = cia.uid() or cia.is_org_admin(org_id));
-- Members join only by invitation (cia.accept_invitation) or are added by a company administrator of that organisation.
-- A platform administrator can never make themselves a member, so they can never read an organisation's consents (D-113).
create policy mem_add on cia.org_members for insert to cia_app with check (cia.is_org_admin(org_id));
create policy mem_update on cia.org_members for update to cia_app using (cia.is_org_admin(org_id)) with check (cia.is_org_admin(org_id));
create policy mem_leave on cia.org_members for delete to cia_app using (user_id = cia.uid() or cia.is_org_admin(org_id));

create policy inv_all on cia.invitations for all to cia_app using (cia.is_org_admin(org_id)) with check (cia.is_org_admin(org_id) and created_by = cia.uid());
-- A platform administrator creating an organisation invites its first company administrator (pilot, D-114).
create policy inv_first on cia.invitations for insert to cia_app with check (cia.has_role('admin') and created_by = cia.uid() and role = 'company_admin');

create policy asg_read on cia.assignments for select to cia_app using (assignee = cia.uid() or cia.is_org_admin(org_id));
create policy asg_create on cia.assignments for insert to cia_app with check (cia.is_org_admin(org_id) and created_by = cia.uid());
create policy asg_update on cia.assignments for update to cia_app using (assignee = cia.uid() or cia.is_org_admin(org_id)) with check (assignee = cia.uid() or cia.is_org_admin(org_id));
create policy asg_delete on cia.assignments for delete to cia_app using (cia.is_org_admin(org_id));

-- consents: the learner manages their own; a company administrator reads only what is not withdrawn
create policy con_read on cia.consents for select to cia_app using (learner_id = cia.uid() or (withdrawn_at is null and cia.is_org_admin(org_id)));
create policy con_grant on cia.consents for insert to cia_app with check (learner_id = cia.uid() and withdrawn_at is null and cia.is_org_member(org_id));
create policy con_update on cia.consents for update to cia_app using (learner_id = cia.uid()) with check (learner_id = cia.uid());
create policy con_delete on cia.consents for delete to cia_app using (learner_id = cia.uid());

-- shared review queue: a reviewer sees open requests and their own, never their own submissions
create policy rr_read on cia.review_requests for select to cia_app using (
  learner_id = cia.uid()
  or ((cia.has_role('reviewer') or cia.has_role('admin')) and learner_id <> cia.uid() and (status = 'open' or reviewer_id = cia.uid())));
create policy rr_create on cia.review_requests for insert to cia_app with check (learner_id = cia.uid() and status = 'open' and reviewer_id is null);
create policy rr_withdraw on cia.review_requests for update to cia_app using (learner_id = cia.uid() and status = 'open') with check (learner_id = cia.uid() and status in ('open', 'withdrawn') and reviewer_id is null);
create policy rs_read on cia.review_scores for select to cia_app using (
  exists (select 1 from cia.review_requests r where r.id = request_id and (r.learner_id = cia.uid() or r.reviewer_id = cia.uid())));

-- Admin CMS
create policy cd_read on cia.content_drafts for select to cia_app using (cia.has_role('admin') or cia.has_role('reviewer'));
create policy cd_write on cia.content_drafts for insert to cia_app with check (cia.has_role('admin') and author_id = cia.uid());
create policy cd_update on cia.content_drafts for update to cia_app using (cia.has_role('admin') or cia.has_role('reviewer')) with check (cia.has_role('admin') or cia.has_role('reviewer'));
create policy cdv_read on cia.content_draft_versions for select to cia_app using (cia.has_role('admin') or cia.has_role('reviewer'));
create policy cdv_write on cia.content_draft_versions for insert to cia_app with check (cia.has_role('admin') and saved_by = cia.uid());
create policy cdd_read on cia.content_decisions for select to cia_app using (cia.has_role('admin') or cia.has_role('reviewer'));
create policy cdd_write on cia.content_decisions for insert to cia_app with check ((cia.has_role('admin') or cia.has_role('reviewer')) and reviewer_id = cia.uid());

-- Verification center: the status line is public; edits by administrators
create policy cv_read on cia.cert_verifications for select to cia_app using (true);
create policy cv_write on cia.cert_verifications for all to cia_app using (cia.has_role('admin')) with check (cia.has_role('admin') and updated_by = cia.uid());
create policy cvh_read on cia.cert_verification_history for select to cia_app using (cia.has_role('admin'));
create policy cvh_write on cia.cert_verification_history for insert to cia_app with check (cia.has_role('admin') and changed_by = cia.uid());

create policy set_read on cia.settings for select to cia_app using (true);
create policy set_write on cia.settings for update to cia_app using (cia.has_role('admin')) with check (cia.has_role('admin') and updated_by = cia.uid());

create policy aud_insert on cia.audit_log for insert to cia_app with check (actor is null or actor = cia.uid());
create policy aud_read on cia.audit_log for select to cia_app using (cia.has_role('admin'));
create policy aud_auth on cia.audit_log for insert to cia_auth with check (true);

-- ================================================================ grants (least privilege)
grant select (id, email, display_name, created_at, last_seen_at), update (display_name) on cia.users to cia_app;
grant select, insert, update, delete on cia.users, cia.sessions, cia.reset_tokens, cia.user_roles to cia_auth;
grant select, insert on cia.outbox to cia_auth;
grant usage on sequence cia.outbox_id_seq to cia_auth;
grant delete on cia.records to cia_auth;
grant insert on cia.audit_log to cia_auth;
grant usage on sequence cia.audit_log_id_seq to cia_auth, cia_app;
grant select, insert, delete on cia.user_roles to cia_app;
grant select, insert, update, delete on cia.records, cia.collection_versions to cia_app;
grant select, insert, update, delete on cia.orgs, cia.departments, cia.org_members, cia.invitations, cia.assignments, cia.consents to cia_app;
grant select, insert, update on cia.review_requests to cia_app;
grant select on cia.review_scores to cia_app;
grant select, insert, update on cia.content_drafts, cia.content_draft_versions to cia_app;
grant select, insert on cia.content_decisions to cia_app;
grant select, insert, update on cia.cert_verifications to cia_app;
grant select, insert on cia.cert_verification_history to cia_app;
grant usage on sequence cia.cert_verification_history_id_seq to cia_app;
grant select, update on cia.settings to cia_app;
grant select, insert on cia.audit_log to cia_app;
-- analytics_daily / analytics_active / analytics_keys: no direct grant; only the functions below.

-- ================================================================ triggers (rules a policy cannot express)

-- An employee may change only the state of their own assignment.
create or replace function cia.assignment_guard() returns trigger language plpgsql as $$
begin
  if not cia.is_org_admin(old.org_id) then
    if (new.org_id, new.assignee, new.type, new.target_id, new.target_slug, new.title, new.due, new.note, new.created_by, new.created_at)
       is distinct from (old.org_id, old.assignee, old.type, old.target_id, old.target_slug, old.title, old.due, old.note, old.created_by, old.created_at) then
      raise exception 'only the assignment state may change' using errcode = '42501';
    end if;
    new.state_updated_at := now();
  end if;
  return new;
end $$;
create trigger assignment_guard before update on cia.assignments for each row execute function cia.assignment_guard();

-- A consent cannot move to another organisation or learner, and a withdrawal cannot be undone.
create or replace function cia.consent_guard() returns trigger language plpgsql as $$
begin
  if new.learner_id <> old.learner_id or new.org_id <> old.org_id or new.granted_at <> old.granted_at then
    raise exception 'consent identity is fixed' using errcode = '42501';
  end if;
  if old.withdrawn_at is not null and (new.withdrawn_at is null or new.withdrawn_at <> old.withdrawn_at or new.snapshot <> old.snapshot) then
    raise exception 'a withdrawn consent cannot change' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger consent_guard before update on cia.consents for each row execute function cia.consent_guard();

-- A decision by the draft's author is refused, unless it is the owner's recorded approval (D-21).
create or replace function cia.decision_guard() returns trigger language plpgsql security definer set search_path = cia, pg_temp as $$
declare a uuid; owner uuid;
begin
  select author_id into a from cia.content_drafts where id = new.draft_id;
  select nullif(value #>> '{}', '')::uuid into owner from cia.settings where key = 'owner_user_id';
  if new.basis = 'owner_approval' and (owner is null or new.reviewer_id is distinct from owner) then
    raise exception 'owner approval needs the recorded owner' using errcode = '42501';
  end if;
  if a is not null and a = new.reviewer_id and new.basis <> 'owner_approval' then
    raise exception 'an author cannot review their own draft' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger decision_guard before insert on cia.content_decisions for each row execute function cia.decision_guard();

-- ================================================================ privileged functions (check the caller themselves)

-- A reviewer takes an open request (never their own).
create or replace function cia.claim_review(req uuid, name text) returns void language plpgsql security definer set search_path = cia, pg_temp as $$
declare r cia.review_requests;
begin
  if not (cia.has_role('reviewer') or cia.has_role('admin')) then raise exception 'not a reviewer' using errcode = '42501'; end if;
  if length(coalesce(name, '')) < 3 then raise exception 'reviewer name needed' using errcode = '22023'; end if;
  select * into r from cia.review_requests where id = req for update;
  if not found then raise exception 'no such request' using errcode = 'P0002'; end if;
  if r.learner_id = cia.uid() then raise exception 'self-review is not allowed' using errcode = '42501'; end if;
  if r.status <> 'open' then raise exception 'request is not open' using errcode = '55000'; end if;
  update cia.review_requests set status = 'assigned', reviewer_id = cia.uid(), reviewer_name = name, assigned_at = now() where id = req;
  insert into cia.audit_log (actor, action, target) values (cia.uid(), 'review.claim', req::text);
end $$;

-- An administrator assigns a request to a named reviewer (never the learner).
create or replace function cia.assign_review(req uuid, reviewer uuid, name text) returns void language plpgsql security definer set search_path = cia, pg_temp as $$
declare r cia.review_requests;
begin
  if not cia.has_role('admin') then raise exception 'not an administrator' using errcode = '42501'; end if;
  if not exists (select 1 from cia.user_roles where user_id = reviewer and role in ('reviewer', 'admin')) then raise exception 'not a reviewer' using errcode = '22023'; end if;
  select * into r from cia.review_requests where id = req for update;
  if not found then raise exception 'no such request' using errcode = 'P0002'; end if;
  if r.learner_id = reviewer then raise exception 'self-review is not allowed' using errcode = '42501'; end if;
  if r.status not in ('open', 'assigned') then raise exception 'request is closed' using errcode = '55000'; end if;
  update cia.review_requests set status = 'assigned', reviewer_id = reviewer, reviewer_name = name, assigned_at = now() where id = req;
  insert into cia.audit_log (actor, action, target, detail) values (cia.uid(), 'review.assign', req::text, jsonb_build_object('reviewer', reviewer));
end $$;

-- The assigned reviewer completes a request: scores are stored and the learner's attempt (re-scored by the API with the
-- unchanged lab engine) replaces the stored one. Only the assigned reviewer can do this.
create or replace function cia.complete_review(req uuid, scores jsonb, attempt jsonb) returns void language plpgsql security definer set search_path = cia, pg_temp as $$
declare r cia.review_requests; s jsonb;
begin
  select * into r from cia.review_requests where id = req for update;
  if not found then raise exception 'no such request' using errcode = 'P0002'; end if;
  if r.reviewer_id is distinct from cia.uid() or r.status <> 'assigned' then raise exception 'not your review' using errcode = '42501'; end if;
  if r.learner_id = cia.uid() then raise exception 'self-review is not allowed' using errcode = '42501'; end if;
  if attempt ->> 'id' is distinct from r.record_id then raise exception 'attempt does not match the request' using errcode = '22023'; end if;
  for s in select * from jsonb_array_elements(scores) loop
    insert into cia.review_scores (request_id, task_id, score, comment, reviewer_id, reviewer_name, review_date)
    values (req, s ->> 'task_id', (s ->> 'score')::numeric, coalesce(s ->> 'comment', ''), cia.uid(), r.reviewer_name, (s ->> 'date')::date)
    on conflict (request_id, task_id) do update set score = excluded.score, comment = excluded.comment, review_date = excluded.review_date;
  end loop;
  update cia.records set data = attempt, updated_at = now() where user_id = r.learner_id and collection = 'lab_attempts' and record_id = r.record_id;
  if not found then raise exception 'the attempt is no longer in the account' using errcode = 'P0002'; end if;
  insert into cia.collection_versions (user_id, collection, version) values (r.learner_id, 'lab_attempts', 1)
    on conflict (user_id, collection) do update set version = cia.collection_versions.version + 1, updated_at = now();
  update cia.review_requests set status = 'completed', completed_at = now() where id = req;
  insert into cia.audit_log (actor, action, target, detail) values (cia.uid(), 'review.complete', req::text, jsonb_build_object('tasks', jsonb_array_length(scores)));
end $$;

-- The stored attempt of a request, for the assigned reviewer only (the API re-scores it).
create or replace function cia.review_attempt(req uuid) returns jsonb language plpgsql stable security definer set search_path = cia, pg_temp as $$
declare r cia.review_requests; a jsonb;
begin
  select * into r from cia.review_requests where id = req;
  if not found or r.reviewer_id is distinct from cia.uid() or r.learner_id = cia.uid() then raise exception 'not your review' using errcode = '42501'; end if;
  select data into a from cia.records where user_id = r.learner_id and collection = 'lab_attempts' and record_id = r.record_id;
  return a;
end $$;

-- Accept an invitation with its token (the e-mail must match the signed-in account).
create or replace function cia.accept_invitation(token_hash_in text) returns uuid language plpgsql security definer set search_path = cia, pg_temp as $$
declare i cia.invitations; e text;
begin
  select * into i from cia.invitations where token_hash = token_hash_in for update;
  if not found or i.accepted_at is not null or i.expires_at < now() then raise exception 'invitation not valid' using errcode = '22023'; end if;
  if i.created_by = cia.uid() then raise exception 'an invitation cannot be accepted by the person who sent it' using errcode = '42501'; end if;
  select email into e from cia.users where id = cia.uid();
  if lower(e) <> lower(i.email) then raise exception 'invitation is for another e-mail' using errcode = '42501'; end if;
  insert into cia.org_members (org_id, user_id, role) values (i.org_id, cia.uid(), i.role) on conflict (org_id, user_id) do nothing;
  update cia.invitations set accepted_at = now(), accepted_by = cia.uid() where id = i.id;
  insert into cia.audit_log (actor, action, target) values (cia.uid(), 'org.join', i.org_id::text);
  return i.org_id;
end $$;

-- Names of an organisation's members (company administrators only; never e-mail addresses of others).
create or replace function cia.org_people(o uuid) returns table (user_id uuid, display_name text, role text, department_id uuid, job_role_id text, joined_at timestamptz)
language plpgsql stable security definer set search_path = cia, pg_temp as $$
begin
  if not cia.is_org_admin(o) then raise exception 'not an administrator of this organisation' using errcode = '42501'; end if;
  return query select m.user_id, u.display_name, m.role, m.department_id, m.job_role_id, m.joined_at from cia.org_members m join cia.users u on u.id = m.user_id where m.org_id = o order by u.display_name;
end $$;

-- Analytics: count an event (whitelisted by the API) and, for a signed-in person, a daily-rotating keyed hash.
create or replace function cia.track(ev text, d text) returns void language plpgsql security definer set search_path = cia, pg_temp as $$
declare k text; today date := (now() at time zone 'utc')::date;
begin
  insert into cia.analytics_daily (day, event, dim, count) values (today, ev, left(coalesce(d, ''), 80), 1)
    on conflict (day, event, dim) do update set count = cia.analytics_daily.count + 1;
  if cia.uid() is not null then
    insert into cia.analytics_keys (day, key) values (today, encode(gen_random_uuid()::text::bytea, 'hex')) on conflict (day) do nothing;
    delete from cia.analytics_keys where day < today;
    select key into k from cia.analytics_keys where day = today;
    insert into cia.analytics_active (day, hash) values (today, encode(sha256((k || ':' || cia.uid()::text)::bytea), 'hex')) on conflict do nothing;
  end if;
end $$;

-- Analytics summary for administrators; counts under 5 are returned as null ("fewer than 5").
create or replace function cia.analytics_summary(from_day date, to_day date) returns table (event text, dim text, count bigint, suppressed boolean)
language plpgsql stable security definer set search_path = cia, pg_temp as $$
begin
  if not cia.has_role('admin') then raise exception 'not an administrator' using errcode = '42501'; end if;
  return query
    select a.event, a.dim, case when sum(a.count) < 5 then null else sum(a.count) end, sum(a.count) < 5 from cia.analytics_daily a
     where a.day between from_day and to_day group by a.event, a.dim
    union all
    select 'active_learners'::text, ''::text, case when count(*) < 5 then null else count(*) end, count(*) < 5 from cia.analytics_active x where x.day between from_day and to_day
    order by 1, 3 desc nulls last;
end $$;

revoke all on function cia.claim_review(uuid, text), cia.assign_review(uuid, uuid, text), cia.complete_review(uuid, jsonb, jsonb), cia.review_attempt(uuid),
  cia.accept_invitation(text), cia.org_people(uuid), cia.track(text, text), cia.analytics_summary(date, date) from public;
grant execute on function cia.claim_review(uuid, text), cia.assign_review(uuid, uuid, text), cia.complete_review(uuid, jsonb, jsonb), cia.review_attempt(uuid),
  cia.accept_invitation(text), cia.org_people(uuid), cia.track(text, text), cia.analytics_summary(date, date), cia.uid(), cia.has_role(text),
  cia.is_org_admin(uuid), cia.is_org_member(uuid), cia.guarded(text) to cia_app;
grant execute on function cia.uid(), cia.has_role(text) to cia_auth;

create table cia.schema_migrations (version text primary key, applied_at timestamptz not null default now());
insert into cia.schema_migrations (version) values ('001_init');

commit;
