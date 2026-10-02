# Concrete production approval preparation — 2026-10-02

Read-only inspection used the existing signed-in Supabase dashboard, in a separate temporary tab; existing application session and records were preserved. No credentials were created/accessed, SQL executed, backup created, or production data changed.

## Observed live state

Project `jdoypblyvhrljqiadzgq` is Healthy. Authenticated application roster reads work. Dashboard migration page says “Run your first migration”; overview says No migrations. This establishes no *recorded* migration history, not absence of manually applied SQL. Scheduled backups page explicitly says Free Plan does not include project backups; no dashboard scheduled backup is available. Other externally stored backups were not discoverable/verified; do not claim none exist anywhere.

- `horses`: 18 columns including `training_type text NOT NULL`, `program_meta jsonb NOT NULL`.
- `phases`: 8 columns including `program text NOT NULL`, `scale text NOT NULL`.
- `sessions`: 11 columns including nullable `rider text`, `bit text`, and `task_completions jsonb NOT NULL`.
- Functions: `create_session_with_ratings(uuid,uuid,timestamptz,text,text,text,jsonb,jsonb)` returns sessions, `update_session_with_ratings(uuid,timestamptz,text,text,text,jsonb,jsonb)` returns void, `upsert_trifecta_with_scores(uuid,text,jsonb)` returns trifecta_evaluations. All listed as Invoker. Existing update body moves straight from UPDATE to rating replacement; missing `if not found` check verified in visible source.
- No `validate_owned_references` function in complete public function list. Public data triggers only four `touch_*` update triggers; integrity triggers absent.
- Policy page shows RLS enabled for all ten public tables and one `own …` ALL/public policy per table. Representative `own horses` policy has USING and WITH CHECK `(user_id = auth.uid())`; other policy expressions were not individually opened. Proposed migration changes none.
- Table inventory also includes legacy `tqas`; proposed migration does not target it. Estimated row counts showed 0 even while actual app roster had records; those estimates are not data-count evidence.

## Exactly selected migration

**`supabase/migration_integrity.sql` only**, after read-only preflight and backup/rollback capture. Do not run `migration_programs.sql`: its columns and atomic RPCs already exist and its broad constraint/backfill work is unnecessary for this pilot. Do not run destructive `schema.sql` or any synthetic fixture SQL.

Selected migration creates/replaces one INVOKER trigger function, installs seven BEFORE INSERT/UPDATE triggers on horses/questions/sessions/ratings/trifecta_evaluations/trifecta_scores/resources, replaces the existing session-update function to error when inaccessible/missing, and preserves its authenticated EXECUTE grant. **No new columns, tables, RLS policies, auth settings, credentials or historical rewrites.** Application form fields use the existing JSON metadata column.

## Compatibility and rollback

Guards reject foreign-owner references, horse/current-phase program mismatch, rating phase/axis mismatch and scores outside phase scale. Historical sessions may keep their former program after a horse changes program; only new sessions enforce current program. Existing invalid references are not rewritten or scanned on DDL installation, but later edits to those rows may be rejected, including unrelated field edits. Existing rating replacement rolls back wholly on violation. This may expose existing legacy inconsistencies; `live-preflight.sql` provides read-only counts and original function/policy/constraint output for review. It has **not** been executed live.

Execute approved DDL inside one transaction; abort on any failure. Capture original update function, existing trigger definitions/grants, and a verified external database dump before application. Free-plan dashboard offers no scheduled restore point. No connection/CLI management token is presently configured for a backup export; earlier CLI read failed for missing access token. Existing dashboard access works, but it does not establish a verified dump/restore path. An authorized operator must provide an existing backup/export path or perform/export a verified backup; no request for secret values in chat or new paid plan.

Rollback: remove only the seven newly installed `validate_owned_references` triggers, remove its new function, restore the *captured live* `update_session_with_ratings` definition/grants. Do not guess the prior definition from repository SQL. This restores prior validation behavior without deleting data; records created since migration remain. Backups are necessary for any unexpected data impact; DDL rollback is not a substitute for a data backup.

## Exact proposed test-record approval scope (not performed)

Within the existing approved trainer account, create **three new horses only**, named `TQA PILOT TEST 2026-10-02 Foundation`, `… Performance`, `… Sale`, owner `Synthetic pilot test`, notes marker `tqa-pilot-20261002`. Record created UUIDs in an explicit allowlist. No edits to any existing horse, question, phase, user or training history; no new account/credential. Use existing canonical phases/questions and capture original before/after IDs/counts read-only.

Create at most **two sessions per test horse (six total)**. Foundation: rider and -3…3 ratings using unchanged current labels; use only unambiguous items for acceptance. Performance/Sale: rider/bit, one recurring warm-up rating and Fence Work P2 + Heading P3; tasks may vary next ride without forced advancement. Save/reload, edit only these sessions once, reload and verify rider/date/score/notes/task values; verify each test horse's list contains only its own sessions. Save/reload goals, dates/amounts and weekly comments on these three horses. Render PDF and compare these synthetic sessions. Account-isolation production check requires a second *existing authorized* test account; do not create credentials or manipulate another real user's horses.

Expected records: ≤3 horses, ≤6 sessions and their ≤84 ratings (14 each); no finish evaluation required. Verify ordinary failure UI with controlled client-side validation; do not deliberately inject bad production rows. Retain test records clearly marked unless cleanup is separately authorized; archiving the three allowlisted horses is reversible and can be included in approval, permanent deletion is excluded. No deploy/push/merge included. Review this migration + bounded synthetic workflow together, or approve test workflow separately without DDL if reviewing current live behavior first.

## Scoring clarification

Wade: Groundwork social separation is Nervous→Calm in original source versus current seeded Calm→Nervous; phases1–4 differ. Phase3/4 legends1–5 conflict with -3…3 answer choices, and Energy/Sensitivity ordering differs. Clarify before relying on those ambiguous scores or changing historical interpretation. No certification/pass cutoff supplied. Per-discipline exact criteria/demonstrations are absent from task sheet; broad phase-reference videos are correctly labeled. Offline writes were not explicitly required by supplied Wade sources and are **not an online-pilot gate**.
