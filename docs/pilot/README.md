# TQA pilot inspection and requirements traceability

Inspected 2026-10-02. Source repository: `/Users/trhinehart/development/HorseTraining`. Isolated clone: `/Users/trhinehart/Documents/Codex/2026-10-02/task/tqa-pilot`, branch `codex/tqa-pilot-baseline`, based on verified GitHub main `d8a5174e6a03f7c85098350d5c321d9c496079d9`.

The original clean checkout remains on `claude/autonomous-uat-pass` (`c937fcc`), with 33 UAT commits absent from GitHub main. GitHub main has newer programs/reference work; the two branches diverge. The original work was not overwritten. No repository `.agents`, `.claude`, `.codex`, AGENTS.md or skill files were found. Global Codex instructions were read; the memories directory is empty and the local memory database yielded no matching HorseTraining/TQA memory. BeReminded tasks, processes, ports 3107/3110, credentials and production data were untouched.

## Architecture and existing behavior

React 18 + TypeScript, React Router, Vite 6, Tailwind, Supabase Auth/Postgres/RLS, module-level SWR query cache, React PDF exports and PWA shell cache. Records include horses, program-specific phases/questions, sessions, question snapshots/ratings, trifecta evaluations/scores and resources. RLS uses account ownership; this is per-account isolation, not a shared trainer organization model. No paid-service architecture was added.

Existing main supports horse creation/edit/archive, Today/horses lists, three programs, score-sheet session create/edit/delete, multi-task performance sessions, horse progress, finish evaluation, PDF export and Reference content. Performance/Sale have one recurring warm-up rather than daily phase advancement. Atomic create/edit/finish RPCs exist in both SQL files. Local transaction/RLS and browser persistence were exercised as documented below.

## Current implementation and evidence

Implemented persisted Foundation subtype, arbitrary training-goal subsets, departure/payment fields, Sale date/estimated rides/purchase price, weekly comments and Foundation rider entry. Existing metadata is preserved when editing fields. Ten separate disciplines support independent phases 1–4; historical combined codes remain readable/editable. Performance bit wording follows its original log; Sale wording follows the Sale form without changing stored codes.

Tyler's latest instructions supersede the earlier Reference wishlist: **Videos & Resources** is first/default, with only **Phases & Questions** beside it. Overview, Industry Standards and Philosophy UI/navigation were removed. Original philosophy text/source artifacts remain preserved. Verified broad phase videos sit beside daily Foundation/task scoring rows and explicitly say “phase reference”; no task-specific demonstration or timestamp was invented. Links open in another tab and retain the original form draft. Duplicate resources are hidden by URL/video ID.

Cache/account-switch and horse-route isolation fixes prevent stale responses crossing contexts. Local datetimes are used for ride entry. Missing atomic RPCs fail closed instead of performing destructive partial fallback writes. Unsupported automatic advancement/certification cutoffs were removed. `migration_integrity.sql` adds ownership, phase/program, axis and scale guards, plus unavailable-session detection. It does not rewrite history. Production SQL has **not** been run; `schema.sql` remains destructive and is for fresh databases only.

### Verification completed

- **53 unit/component tests**, production TypeScript/Vite build and `git diff --check` pass.
- Disposable PostgreSQL 16.15 at localhost **56432**, separate from existing BeReminded services: `tests/database/run.sh` passed twice. Asserts two-horse separation, persisted Foundation rider and Performance Fence Work P2 + Heading P3, atomic create/edit rollback, rating integrity, cross-account read isolation and foreign-owner write rejection.
- Actual browser app against local PostgREST/PostgreSQL with synthetic authentication, clearly marked fixture at **4174**: mobile 390×844 Foundation ride entry/save/reload, rider and notes persistence; opening phase video retained unsaved draft. Weekly comments saved/reloaded. Sale horse creation/reloaded form preserved estimated rides 30, purchase price 5000, sale date and Fence Work/Heading goals. Sale ride saved/reloaded with Fence Work P2 + Heading P3 and rider/rating/notes. Switching trainer A→B hid all A horses; switching B→A restored the 3-horse roster without reload after fixing a missing account dependency in `useQuery`.
- This is **synthetic auth**, not a claim that production signup/signin has been tested. Direct rendering of the actual report component from persisted local fixture data produced `synthetic-sale-report.pdf`. PDFKit read all 3 pages and asserted horse, rider, Fence Work Phase 2, Heading Phase 3, rating 4.0 and exact notes. The rendered page was visually inspected. Fixed unrelated-program phase rows, omitted rider/tasks and cramped temperament labels. IAB embedded viewer/download capture remains a browser-specific unverified path; no repeated capture attempts. Reproduce with `node tests/pdf/verify.mjs` then `swift -module-cache-path /tmp/tqa-swift-cache tests/pdf/inspect.swift docs/pilot/synthetic-sale-report.pdf`.

## Run locally

```sh
cd /Users/trhinehart/Documents/Codex/2026-10-02/task/tqa-pilot
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Port **4173** is the real app preview, currently running. Its gitignored `.env.local` uses only the existing public frontend URL/anon key extracted from the publicly deployed bundle, under explicit authorization. No private credentials were copied or created. The browser first showed the sign-in form without missing-config errors. Final read-only check showed an authenticated Today roster with 3 existing horses, the cause of this availability change is unknown. This agent did not restore, sign in or write production records.

The separately running test fixture uses `vite.config.fixture.ts` and `tests/browser/`; its synthetic account bypass is excluded from the normal production build. Disposable services: `tqa-pilot-db-20261002` (56432), `tqa-pilot-rest-20261002` (56433), Node proxy `tests/browser/proxy.mjs` (56434), `npx vite --config vite.config.fixture.ts` (4174). `tests/database/browser-auth.sql` is **test database only**. It must never be applied to production. Run `tests/database/run.sh` only against its hardcoded disposable database; it resets synthetic fixtures.

## Remaining pilot blockers

1. Confirm existing Supabase is healthy, then verify real sign-in and apply reviewed additive migrations with backup and explicit authorization. Earlier dashboard observation was “Coming up…”. Final real-preview browser check displayed an authenticated Today roster with 3 existing horses, verifying authenticated reads. No restore, sign-in or production writes were performed by this agent; production writes/migration readiness remain unverified.
2. Wade must resolve Groundwork social-separation polarity and Phase 3/4 legend discrepancy before any scoring normalization. Existing history remains unchanged. No certification or phase-pass threshold is assumed.
3. Detailed per-discipline criteria and exact video demos/timestamps are absent from supplied task sheet; its phase matrix alone does not establish those rules.
4. Offline ride writes are not implemented: PWA caches shell only. Offline was a preexisting aspirational feature; no supplied Wade source explicitly requires offline writes. It is not an online-pilot gate. Real authenticated reads now work; production writes remain untested.

## Read-only deployment evidence

GitHub main/HEAD verified as `d8a5174…`; `https://tqa.pages.dev` returned HTTP 200 and its public bundle identified `jdoypblyvhrljqiadzgq.supabase.co`. No production login/write, push, merge or deployment performed. Existing original checkout and BeReminded ports/tasks were preserved. Build warnings concern bundle size and stale Browserslist data, not compile failures.

## Source provenance

May 26 supersedes May 24’s four program choices; Aug 26 prioritizes ride tracking. Original email links, source attachments and extracted provenance remain in the private local pilot checkout. The public release includes implementation, tests and synthetic acceptance evidence. Performance warm-up/log/task sources confirm the recurring warm-up, program-specific bit labels and original combined matrix; later email clarification controls the ten independent jobs. No source document establishes automatic certification or resolves the identified scale/polarity conflicts.

## Concrete review / acceptance gate

Current branch `codex/tqa-pilot-baseline`, base **d8a5174e6a03f7c85098350d5c321d9c496079d9**. Implementation is committed locally on the isolated branch after explicit closeout authorization; see the final response/git log for exact SHA. No push/merge/deployment. The original checkout is still clean at `c937fcc`. `.env.local` is gitignored. Tests include synthetic-auth code only under a separate fixture config, excluded from normal build.

| Source / acceptance row | Evidence / remaining decision |
| --- | --- |
| May26 three programs + independent disciplines | Implemented; legacy combined codes preserved. SQL + browser verified Fence Work2/Heading3. |
| Colt log: rider, departure/payment | Fields implemented; Foundation rider browser/SQL persisted. Form amounts validated and metadata round-trip tests pass. |
| Sale2026 date/est rides/price/comments/goals | Implemented; Sale create/edit reload and weekly comments tested with local DB. |
| External Performance warm-up PDF | Preserved in local source archive; 8 task +6 temperament rows match current warm-up. |
| External Performance log DOCX | Preserved in local source archive; Chain and 2Rein/HighPort differ from Sale Chain/Hack and 2Rein/Weaver. UI labels now program-specific; codes preserved/tested. |
| External task sheet DOCX | Preserved in local source archive; original eight combined jobs and 1–4 matrix only. Later May26 clarification controls ten independent choices. Detailed discipline criteria absent; do not invent. |
| Tyler current Reference instructions | Two tabs only, resources default; exact source philosophy preserved but no philosophy UI. |
| Source-linked daily assistance | Ten supplied videos retained; broad phase reference adjacent score rows, target_blank preserves draft. Exact task demos/timestamps unprovided. |
| Groundwork social polarity | Source Nervous→Calm versus current seed Calm→Nervous. Needs Wade clarification and explicit historical-label migration strategy; no inversion performed. |
| Phase3/4 scales/order | PDF legends1–5 conflict with -3…3 answers; temperament order differs. Needs Wade clarification; no rewrite/certification inference. |
| PDF | Direct 3-page generated artifact/text/render verified using persisted synthetic Sale ride. IAB viewer/capture remains unverified. |
| Offline | Not source-required; future work, not online-pilot gate. |

**Online pilot gate:** review the local diff and existing live schema/backup, authorize the specific additive migration and controlled test-record workflow, verify create/edit/reload/two-horse isolation against real Supabase, then let Wade test. For ambiguous Foundation items, clarify source interpretation before relying on scores; no automatic pass/fail is claimed. Publishing this checkout is a separate approval.

**Production migration review:** `migration_integrity.sql` is the new minimal integrity/RPC-update migration when program columns and atomic RPCs already exist. `migration_programs.sql` is required only if the existing DB lacks program columns/phases/questions/create/update/finish RPCs; it also includes the integrity additions, swaps constraints and seeds absent resources. Review existing schema first—authenticated reads alone do not prove RPC/migration state. Never run destructive `schema.sql` on existing records, never apply `tests/database/browser-auth.sql` or fixture grants/actors to production. Later read-only live schema inventory verified program columns and atomic RPCs already exist, integrity validators absent, RLS enabled, and no scheduled Free-plan backup. **Only migration_integrity.sql is selected**; see `production-approval.md` for exact scope/rollback/preflight. No live migration was performed. Preserve old question IDs/history and review trigger compatibility against existing data before approval.

Read-only production inspection and bounded approval proposal: [production-approval.md](production-approval.md); [preflight SQL](live-preflight.sql) (validated on local fixture, not run live).

## Trainer UX follow-up

See [ux-audit.md](ux-audit.md) for the prioritized independent review, fixes, repeatable desktop/mobile task journeys, error recovery and remaining limits. Current test count is 53; the final response/git log identifies the additional local commit.
