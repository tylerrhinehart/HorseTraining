# TQA read-only database health check — daily external read check

Project `jdoypblyvhrljqiadzgq`, repository `tylerrhinehart/HorseTraining`.

Inspection 2026-10-03: existing Supabase CLI access reported `ACTIVE_HEALTHY`. A genuine PostgREST GET of `horses?select=id&limit=1`, using the existing public anon key, returned HTTP 200 and an empty JSON array under RLS. No records, policies, functions, extensions or credentials were changed. No horse identifiers/names/owner data or response bodies are logged. This confirms anonymous database read availability, not authenticated trainer sign-in/write readiness.

GitHub repository is public, Actions enabled, default branch `main` (`d8a5174e6a03f7c85098350d5c321d9c496079d9`). Existing secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` already support this check. Only existing workflow is Deploy to GitHub Pages, triggered by `stage` pushes/manual dispatch. The daily workflow in this change runs at 09:37 UTC, subject to GitHub scheduling delays. Neither secret value was retrieved from GitHub; the first local check used only the already authorized public `.env.local` values from the pilot checkout.

## Prepared implementation

This isolated branch `codex/tqa-healthcheck` is based directly on verified GitHub main; it does not contain the unreviewed pilot UX commits or pending database migrations.

- `scripts/tqa-db-healthcheck.mjs`: one bounded GET; 20-second timeout; fixed TQA project; anon role/RLS retained; unexpected row visibility fails without printing values; HTTP/network/invalid responses fail visibly. No packages to install, no service-role key or user session.
- `.github/workflows/tqa-db-healthcheck.yml`: daily at 09:37 UTC and manual dispatch. Read-only repository permissions, no persisted checkout credential, existing public app secrets, two-minute job limit. No deployment steps or application build.
- `scripts/tqa-healthcheck-cadence.mjs`: daily or anchor-relative every five UTC days, starting 2026-10-03. Five-day intervals are tested across month/year/leap-year boundaries. `*/5` in day-of-month is deliberately avoided because it resets at the month boundary.
- Six Node tests pass: read-only bounded request, HTTP failure, no data in errors, fixed-project key transmission guard and cadence transitions.

## Approved daily activation

Tyler approved daily checks on 2026-10-03. Publication is restricted to this isolated scheduling change; pilot UX work and database migrations remain separate.

The configured trigger is `37 9 * * *` (09:37 UTC daily), with `TQA_INTERVAL_DAYS=1`. This is 03:37 in America/Boise during daylight saving time and 02:37 during standard time. Manual dispatch provides an immediate verification, distinct from the first future cron-triggered execution. The retained five-day helper/tests are unused by the daily configuration. Runtime remains subject to GitHub delays/dropouts.

To activate on GitHub, publish **only this scheduling change** on default `main`, then run `gh workflow run tqa-db-healthcheck.yml --ref main`; verify run result/logs and the new workflow's active schedule. Default-branch publication of this minimal check is authorized; do not push or merge the entire pilot branch. The current deployment workflow only responds to `stage` pushes; do not assume external Cloudflare settings are known. A different cloud scheduler can invoke the same lightweight read, but do not create duplicate tasks.

GitHub uses existing secrets. No new credentials, app authorization, database access grants or paid services are required by this prepared workflow. Public repositories receive free standard runners under GitHub's normal policy. It remains important to monitor task failures and Supabase pause-warning emails.

## Supabase internal cron and pausing limits

Supabase supports recurring SQL/database functions through `pg_cron`, and recurring Edge Function invocations through `pg_cron` plus `pg_net`. An Edge Function alone does not establish a schedule, and is unnecessary for this read. This project’s installed cron state/job inventory is **not verified**: the installed CLI's linked-query command failed at its direct IPv6 preflight before executing SQL. Its v2.90.0 source shows that a normal link/connect fallback can create a temporary login role; that workaround was not used because new credentials/access changes were outside scope. The already signed-in Dashboard Cron page was opened read-only, but no loaded cron state was captured; no extension was enabled. The supported extension is available on hosted Supabase according to official docs, distinct from proving it is installed in this project.

For an authorized SQL-editor inventory, run only:

```sql
select name, default_version, installed_version
from pg_available_extensions where name in ('pg_cron', 'pg_net');
-- Only if cron is installed; omit command contents, which can embed tokens:
select jobid, jobname, schedule, active from cron.job;
```

An internal cron job stops with a paused database and cannot wake it. Official pausing docs specify sufficient **user database activity**, typically a few user requests each day. They do not say internal cron or one ping every five days qualifies. An external API read is genuine database traffic, but its sufficiency is an inference and no no-pause guarantee is claimed. Merely checking the frontend/auth health endpoint does not verify a database query. A paused-project failure must be reported for manual review; no automatic restore is implemented.

GitHub schedules can be delayed/dropped and public-repository schedules are disabled after 60 days without repository activity. A maintenance health check is therefore best effort; neither five-day nor daily checks are a guaranteed free-tier exemption. Supabase documents paid plans as the way to prevent automatic inactivity pausing; no upgrade is made or recommended as an authorized expense.

Sources: [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Cron](https://supabase.com/docs/guides/cron), [scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [GitHub schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [installed CLI routing source](https://github.com/supabase/cli/blob/v2.90.0/internal/utils/flags/db_url.go).

## Local verification

```sh
node --test scripts/tqa-*.test.mjs
# Supply the existing public frontend URL/anon key through environment variables:
node scripts/tqa-db-healthcheck.mjs
```

Do not paste keys into logs or command arguments. There are no database migrations in this change.
