# Legacy account → facility transition

No account deletion or database reset is part of this workflow. A migration cannot recover records already deleted; recovery requires a separate surviving source backup. The UI reports available records only and does not promise missing history was restored.

## Existing facility-aware installation

Apply **only** `supabase/facility_transition.sql` before deploying the updated frontend. It adds private transition metadata, an authenticated own-account status RPC, and an atomic wrapper around the existing facility-creation RPC. Existing accounts, records, memberships, invitations, voice settings and access policies are preserved. Reapplication is safe. No private legacy archive is fabricated from current facility records.

## Upgrade a legacy per-user installation without losing its data

The supported source is the TQA per-user schema with the program migration (`phases.program`, horse `program_meta`) already applied. Generate an SQL file for review:

```sh
node scripts/build-facility-upgrade.mjs > /tmp/tqa-facility-upgrade.sql
```

This command does **not** connect to a database. Review the generated transaction and use a trusted administrator connection to apply it to the intended legacy project before deploying the facility frontend. It takes locks and aborts on unexpected tables, views, functions, an existing archive, or an already facility-aware database. Nonempty obsolete `tqas` records require a separately reviewed mapping; the upgrade refuses to silently discard them. Do not run the fresh-only `schema.sql` directly against existing records.

The transaction moves legacy application tables and their known functions into private `tqa_legacy`, preserving rows, IDs and relationships. It revokes client access to that schema, installs the authoritative facility/draft/guided/transition schemas, preserves all Auth accounts and copies original profiles. Platform-owned RLS automation is not removed. No training table or Auth account is dropped or truncated.

## First sign-in and import

- Existing login credentials continue to work. Accounts without a facility are routed to **Set up your facility**; a user with pending legacy records is also routed there even if they already joined another team.
- `facility_transition_status()` exposes only the caller's pending counts, with no caller-supplied user ID. The UI shows available horse/ride/rating totals and explains the transfer. Accounts with no surviving records see an explicit empty-roster message.
- The user names a new private facility and selects **Create facility and bring in my records**. Joining another facility does not implicitly share old data; users with pending records must create their owned facility first.
- Creation, ownership, import, idempotency receipt and completion marker share one transaction and an account-level lock. Only rows owned by `auth.uid()` are eligible; private helpers cannot be called by clients. Existing facility data cannot be used as an import target.
- Original phase/question/horse/ride/rating/evaluation/resource IDs, timestamps, labels, notes, owner fields, goals, weekly comments, signed scores and historical snapshots are retained. Missing canonical programs/questions/resources are filled without overwriting surviving custom content. Conflicting custom phases or inconsistent references abort the whole setup for review.
- A failed import rolls back the facility and all imported records. The frontend retries the same request UUID after errors. A successful retry cannot duplicate the facility or import the history twice. Source archive rows remain private and intact.
- On success the UI refreshes memberships, selects the returned facility and opens the app. Existing manual scoring, voice flags and facility permissions are unchanged.

## Verification

`npm test` covers setup, own-account count display, forced onboarding despite an existing membership, same-request retry, account/screen lifecycle and successful facility selection. `npm run build` validates the frontend.

`tests/database/run.sh` includes the existing facility/ride/draft/guided regressions and `legacy-transition.mjs`. The latter creates a **new** loopback-only `tqa_legacy_test` database; it never drops an existing database. A checked-in synthetic legacy-schema fixture is derived from pre-cutover commit `21d230d`. Two synthetic users verify full-field/ID/history preservation, private archives, tenant isolation, partial reference catalogs, injected import failure rollback, duplicate retries, and safe rejection of repeated/unmapped upgrades. Never run fixtures against production.
