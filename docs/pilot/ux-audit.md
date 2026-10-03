# Trainer workflow and UI audit

Local audit completed 2026-10-02/03 on `codex/tqa-pilot-baseline`. The original checkout, user browser profile, production records and BeReminded services were preserved. An independent read-only reviewer examined the implementation; its findings were reconciled with actual desktop/mobile synthetic database journeys.

## Priority fixes delivered

| Priority | Finding | Result |
| --- | --- | --- |
| P1 | Editing a ride could erase rider/equipment; date/tasks were not editable | Full-field atomic update; saved values reload; score-sheet failures disable save rather than clearing history. |
| P1 | Saved score buttons appeared editable | Review scores are disabled with readable styling; explicit Edit ride enables changes. |
| P1 | Navigation/back could discard drafts | Consistent leave/keep-editing dialog plus native reload warning for ride, horse, weekly comments and evaluation drafts; weekly changes also require discard confirmation. |
| P1 | Completion could bounce back while the cache refreshed | Confirmed completion stays visible; unavailable horse status mutations fail rather than claiming success. |
| P1 | Untouched optional goals could prevent horse creation | Empty checkbox groups are accepted; regression covers the observed React Hook Form false value. |
| P1 | Evaluations auto-filled inferred normalized scores | New evaluations start blank. Existing scores remain. Trainer enters observed scores; no conversion or certification inference. |
| P1 | Reports mixed different program scales | Summary/averages/chart use current program; completion shows days and ride count without a mixed-program average; all historical logs and score sheets remain with their phase's original scale. |
| P2 | Main actions/history/report were difficult to find | Horse name, last ride, goals, Log a ride and independent report action are near the top; all-program history accessible; finish and administrative details are secondary. |
| P2 | Today implied mandatory daily training; UTC dates distorted today's rides | Neutral local-date activity wording, consistent one/many horse workspace, retry for failed activity reads; future dates excluded from weekly activity. |
| P2 | Empty roster and no search matches were conflated | Separate onboarding, no horses in training, and no-match states. |
| P2 | Archived horses lacked a restore action | Resume training restores them without deleting rides. Completion can be reopened. |
| P2 | Navigation and source assistance were confusing | Horses remains active in ride/horse screens; badge says Selected horse; source videos preserve drafts; Reference remains exactly Videos & Resources first/default and Phases & Questions. |
| P2 | Optional form detail overwhelmed onboarding | Horse/owner first; optional goals/dates/payments expandable; price fields have accessible labels; score help has a larger target. |

## Evidence and limits

`ux-browser-evidence.txt`: six successful task journeys (desktop 1280×900 and mobile 390×844, all three programs). They cover required-field validation, owner/goals/program metadata, blank scores, link/back draft protection, video popup return, atomic save/edit/reload of rider/date/equipment/independent tasks/ratings/notes, weekly comments, report access and search empty states. Account A/B switching verifies a genuinely empty second account. Reference has exactly two tabs and no horizontal overflow. Screenshots `ux-*-saved.png` and `ux-*-reference.png` are synthetic data only.

`ux-recovery-evidence.txt` records successful additional failure/retry, deletion-confirmation, evaluation, browser PDF download, completion/reopen/archive/resume checks. `ux-browser-download.pdf` is an actual browser download; PDFKit verified four readable pages, the synthetic horse, report sections and saved +2 evaluation (`tests/pdf/check-browser-download.swift`). The direct persisted Sale fixture report separately passes the existing PDFKit three-page content assertions. Synthetic authentication is not production sign-in/write validation; this audit does not claim a full accessibility certification or real-world Wade usability sign-off.

Unit/component regressions cover full-field ride updates, failed sheet loading, read-only review, internal/Back navigation blocking, completion with stale cache, and untouched optional goals. Existing database acceptance covers atomic rollback, ownership/RLS and horse separation. Build warnings remain bundle size and stale Browserslist, with no compile errors.

## Reproduce

Use the disposable database/proxy/fixture described in README.md. Never point fixture scripts at production. Browser acceptance requires an already installed Playwright module and compatible browser; no new dependency or credential was provisioned. This Mac used:

```sh
TQA_PLAYWRIGHT_MODULE=/Users/trhinehart/.npm/_npx/360550e4913b8759/node_modules/playwright/index.mjs \
TQA_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node tests/browser/ux-audit.mjs
# Same environment variables:
node tests/browser/ux-recovery.mjs
npm test
npm run build
```

Every run creates uniquely named synthetic horses in the hardcoded localhost fixture. Browser profiles are temporary and do not attach to an existing session. Reference video navigation is intercepted locally during acceptance.

## Pilot blockers

Production migration/write testing still requires the bounded approval in production-approval.md, including backup/preflight. Source disagreements about Groundwork social polarity and Foundation Phase 3/4 scale/order remain unresolved; no history was rewritten. Exact per-discipline criteria/video timestamps were not supplied. Offline writes remain unimplemented and are not claimed. Wade should test the real trainer workflow after controlled production validation and a separately authorized publishing step.
