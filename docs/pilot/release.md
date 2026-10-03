# Production release preparation

The tested multiple-horse pilot and trainer UI changes are reconciled with main's daily database health check (PR #20). Reference remains exactly Videos & Resources first/default and Phases & Questions. Source scoring ambiguities remain unresolved and are not normalized.

Final checks: 53 app tests, six isolated health-check tests, TypeScript/Vite build. Vitest now scopes app tests to src so the independent Node health-check suites retain their own runner. The existing Cloudflare Pages project `tqa` uses main for production at https://tqa.pages.dev; the stage-triggered GitHub Pages workflow is a separate destination and is not the production release target.

A fresh read-only Supabase inventory verifies existing program/metadata fields, invoker create/edit/evaluation RPCs and RLS on ten public tables. Seven integrity preflight categories have zero violations. The new validator triggers are not installed, and the existing update RPC lacks the unavailable-session guard. The frontend works with the existing schema/RPCs; migration_integrity.sql remains optional hardening until a verified backup is authorized and available. No destructive schema/program migration is required.

Automatic approval review rejected exporting all production application rows into a local backup because deployment authorization did not clearly cover local retention of potentially sensitive horse/owner data. The export was not performed and no migration applied. Backup/integrity approval is requested separately; app publication proceeds independently. Original records, RLS/auth settings and credentials remain unchanged.

Production verification must establish both the deployed commit/artifact and browser rendering. Test journeys against a synthetic local backend must be explicitly distinguished from authenticated live database writes. Do not claim real trainer sign-in or production ride persistence without evidence. Publishing the frontend does not waive the backup requirement for the optional integrity migration.
