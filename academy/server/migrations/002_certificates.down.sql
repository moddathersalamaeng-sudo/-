-- Down-migration for 002_certificates. Take a backup first (see 001_init.down.sql).
begin;
drop function if exists cia.revoke_certificate(text, text);
drop function if exists cia.verify_certificate(text);
drop table if exists cia.certificates;
delete from cia.schema_migrations where version = '002_certificates';
commit;
