#!/usr/bin/env bash
# Backup and restore drill (PRODUCTION_ARCHITECTURE.md §12). Dumps the cia schema, restores it into a fresh database and
# compares row counts table by table. Usage: SOURCE_URL=postgres://owner@host/db SCRATCH_ADMIN_URL=postgres://owner@host/postgres ./backup_drill.sh
set -euo pipefail
: "${SOURCE_URL:?}" "${SCRATCH_ADMIN_URL:?}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ); DUMP="cia-backup-$STAMP.dump"; SCRATCH="cia_restore_drill_$(date +%s)"
pg_dump --schema=cia --format=custom --no-owner --file="$DUMP" "$SOURCE_URL"
psql -q "$SCRATCH_ADMIN_URL" -c "create database $SCRATCH"
RESTORE_URL="${SCRATCH_ADMIN_URL%/*}/$SCRATCH"
psql -q "$RESTORE_URL" -c "do \$\$ begin if not exists (select from pg_roles where rolname='cia_app') then create role cia_app nologin; end if; if not exists (select from pg_roles where rolname='cia_auth') then create role cia_auth nologin; end if; end \$\$;"
pg_restore --no-owner --dbname="$RESTORE_URL" "$DUMP"
Q="select string_agg(t || '=' || n, ' ' order by t) from (select relname as t, n_live_tup as n from pg_stat_user_tables where schemaname='cia') x"
COUNT="select string_agg(table_name || '=' || (xpath('/row/c/text()', query_to_xml('select count(*) as c from cia.' || table_name, false, true, '')))[1]::text, ' ' order by table_name) from information_schema.tables where table_schema='cia' and table_type='BASE TABLE'"
A=$(psql -tA "$SOURCE_URL" -c "$COUNT"); B=$(psql -tA "$RESTORE_URL" -c "$COUNT")
psql -q "$SCRATCH_ADMIN_URL" -c "drop database $SCRATCH"
if [ "$A" == "$B" ]; then echo "DRILL OK $STAMP: row counts match ($A)"; else echo "DRILL FAILED: source [$A] restore [$B]"; exit 1; fi
