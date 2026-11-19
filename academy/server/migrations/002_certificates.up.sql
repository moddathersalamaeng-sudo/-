-- Phase 16 (D-123): the Academy certificate register. © 2026 Modather Salama.
-- One row per learner and course. The serial is fixed at first issue; the learner may correct the name (the seal follows).
-- Public verification goes through cia.verify_certificate(serial), which returns only what is printed on the certificate.
-- Withdrawal is an administrator action (cia.revoke_certificate) and is written to the audit trail by the API.
begin;

create table cia.certificates (
  serial         text primary key check (serial ~ '^CIA-C-[A-Z0-9]{1,10}-[0-9]{4}-[0-9A-Z]{7}$'),
  user_id        uuid not null references cia.users on delete cascade,
  course_id      text not null check (length(course_id) between 1 and 80),
  name           text not null check (length(name) between 2 and 80),
  issued_on      date not null,
  hours          numeric(6,1),
  score          smallint check (score between 0 and 100),
  seal           text not null check (seal ~ '^[0-9A-Z]{10}$'),
  status         text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_reason text,
  registered_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table cia.certificates enable row level security;
create policy crt_read   on cia.certificates for select to cia_app using (user_id = cia.uid() or cia.has_role('admin'));
create policy crt_insert on cia.certificates for insert to cia_app with check (user_id = cia.uid() and status = 'valid');
create policy crt_update on cia.certificates for update to cia_app using (user_id = cia.uid() and status = 'valid') with check (user_id = cia.uid() and status = 'valid');
grant select, insert on cia.certificates to cia_app;
grant update (name, hours, score, seal, updated_at) on cia.certificates to cia_app;

create or replace function cia.verify_certificate(s text)
returns table (serial text, course_id text, name text, issued_on date, hours numeric, score smallint, seal text, status text, registered_at timestamptz)
language sql stable security definer set search_path = cia, pg_temp as
$$ select c.serial, c.course_id, c.name, c.issued_on, c.hours, c.score, c.seal, c.status, c.registered_at from cia.certificates c where c.serial = upper(s) $$;

create or replace function cia.revoke_certificate(s text, reason text)
returns void language plpgsql security definer set search_path = cia, pg_temp as $$
begin
  if not cia.has_role('admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  update cia.certificates set status = 'revoked', revoked_reason = left(coalesce(reason, ''), 300), updated_at = now() where serial = upper(s) and status = 'valid';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

revoke all on function cia.verify_certificate(text), cia.revoke_certificate(text, text) from public;
grant execute on function cia.verify_certificate(text), cia.revoke_certificate(text, text) to cia_app;

insert into cia.schema_migrations (version) values ('002_certificates');
commit;
