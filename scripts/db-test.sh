#!/usr/bin/env bash
# Runs the database test kit (supabase/tests) against a throwaway PostgreSQL 16 database.
# Uses the standard PG* environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# NEVER point this at the real Supabase project: the stub creates fake auth and storage schemas.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${EDRAM_TEST_DB:-edram_test}"
dropdb --if-exists "$DB"
createdb "$DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/tests/supabase_stub.sql
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/migrations/0001_init.sql
out="$(psql -d "$DB" -f supabase/tests/db_tests.sql 2>&1)" || true
echo "$out"
if [[ "$(echo "$out" | tail -n 1)" != "ALL TESTS PASSED" ]]; then
  echo "Database tests FAILED" >&2
  exit 1
fi
