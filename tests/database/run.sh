#!/bin/sh
set -eu
# Never point this script at another database. Requires the disposable container.
DB='postgresql://postgres@127.0.0.1:56432/tqa_test'
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/bootstrap.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/ride_drafts.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/guided_voice.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/facility_transition.sql
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/acceptance.sql
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/ride-accuracy.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/facilities.sql
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/ride-drafts.sql
psql "$DB" -v ON_ERROR_STOP=1 -f tests/database/guided-voice.sql
node tests/database/guided-resume.mjs
node tests/database/legacy-transition.mjs
