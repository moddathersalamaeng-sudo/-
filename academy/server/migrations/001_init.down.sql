-- Down-migration for 001_init (rollback plan, PRODUCTION_ARCHITECTURE.md §14). Take a backup first:
--   pg_dump --schema=cia --format=custom "$DATABASE_URL" > cia-before-down.dump
-- This removes every Academy table, function and policy. The roles cia_app / cia_auth are cluster-wide and kept.
begin;
drop schema if exists cia cascade;
commit;
