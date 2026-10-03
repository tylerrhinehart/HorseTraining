#!/bin/sh
set -eu
# Never point this script at another database. Requires the disposable container.
DB='postgresql://postgres@127.0.0.1:56432/tqa_test'
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/bootstrap.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migration_integrity.sql
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/acceptance.sql
