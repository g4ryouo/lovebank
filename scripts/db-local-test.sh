#!/usr/bin/env bash
# 沒有 Docker 時的替代驗證:用本機 PostgreSQL + pgTAP 重跑所有 migration 與 pgTAP 測試。
# 用法:scripts/db-local-test.sh   (需要 postgresql-16、postgresql-16-pgtap、pg_prove)
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
export PGHOST=/tmp/lovebank-pg PGPORT=54399 PGUSER=postgres PGDATABASE=lovebank_test
DATA=/tmp/lovebank-pg/data

if [ ! -d "$DATA" ]; then
  mkdir -p "$PGHOST" && chmod 777 "$PGHOST"
  chown -R postgres "$PGHOST" 2>/dev/null || true
  su postgres -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust" >/dev/null
fi
if ! "$PGBIN/pg_isready" -q; then
  su postgres -c "$PGBIN/pg_ctl -D $DATA -o \"-p $PGPORT -k $PGHOST -c listen_addresses=''\" -l $PGHOST/log -w start" >/dev/null
fi

psql -qX -d postgres -c "drop database if exists $PGDATABASE" -c "create database $PGDATABASE"
psql -qX -v ON_ERROR_STOP=1 -c "create schema if not exists extensions" -c "create extension if not exists pgtap with schema extensions"
psql -qX -v ON_ERROR_STOP=1 -c "alter role postgres set search_path = \"\$user\", public, extensions"
psql -qX -v ON_ERROR_STOP=1 -f supabase/local/shim.sql
for f in supabase/migrations/*.sql; do
  echo "migrate: $f"
  psql -qX -v ON_ERROR_STOP=1 -f "$f"
done
[ -f supabase/seed.sql ] && psql -qX -v ON_ERROR_STOP=1 -f supabase/seed.sql
pg_prove -v supabase/tests/*.test.sql
