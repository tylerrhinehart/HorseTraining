# HorseTraining

A Vite + React app backed by Supabase. The observed public pilot is https://tqa.pages.dev. See [pilot inspection and traceability](docs/pilot/README.md) for current evidence and blockers.

## Local development

1. Install dependencies:
   ```
   npm ci
   ```
2. Copy `.env.example` to `.env` and fill in your Supabase project values:
   ```
   cp .env.example .env
   ```
   - `VITE_SUPABASE_URL` — your project URL (e.g. `https://xxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — the project's publishable / anon API key
3. Use a **new local or staging Supabase project**. Apply `supabase/schema.sql`, then `supabase/ride_drafts.sql`, then `supabase/guided_voice.sql`, then `supabase/facility_transition.sql`, then `supabase/platform_access_status.sql`, then `supabase/platform_facility_controls.sql` in that order, with a privileged database connection. For existing per-user records, use the [non-destructive facility upgrade](supabase/facility-transition.md); never run the fresh schema directly. Existing facility installs apply only the additive `facility_transition.sql`, `platform_access_status.sql`, and `platform_facility_controls.sql` updates. The old `migration_*.sql` files are retained as history only; do not apply them after the new schema. Do not point local tests or provisioning at a live project.
4. Start the dev server:
   ```
   npm run dev
   ```

`.env` is gitignored. Both vars are read by `src/supabase/client.ts`.

## Facility and voice pilot

- Verify your Supabase Auth email, then register a facility. Facility owners invite coworkers by generating a one-time signup link for the coworker's verified email address. A facility link or ID alone does not grant access.
- Use a separate platform operator account for facility management. Follow [facility setup](supabase/facilities.md) to grant this role, then enroll and verify its TOTP factor before using the platform console. Never give an operator grant through the public signup flow.
- Voice is opt-in per facility. Deploy the `transcribe-ride-turn` Supabase Edge Function to staging, set `OPENROUTER_API_KEY` as the single backend-only provider secret and `TQA_VOICE_ALLOWED_ORIGINS` to the approved frontend origins, and enable voice for the test facility using the platform console. The browser must be on HTTPS (or localhost) and the user must explicitly allow the microphone. The UI shows readback and requires confirmation; the app does not retain raw audio or transcripts. Test with synthetic speech before using real barn audio.
- Voice starts with foreground push-to-talk for the Foundation column of Phase 1. Choose a horse and phase. The app asks one rubric question at a time; answer only its signed score (for example “minus two” or “zero”), confirm the current question and score into the recoverable draft, then explicitly save the ride to publish it to history. Naming a metric, unclear sign, conflicting scores or qualitative feedback requires clarification on the same question. The server binds each turn before listening and atomically saves confirmed scores with the next-question cursor. See [guided voice setup and test limits](supabase/functions/transcribe-ride-turn/README.md). Manual entry remains available. Background listening, lock-screen capture, and live arena readiness are not claimed.

## Verification

Run `npm test` and `npm run build` using Node 22. Run `sh tests/database/run.sh` only with a disposable PostgreSQL instance listening on `127.0.0.1:56432` with database `tqa_test`; it uses fixture Auth roles and synthetic users. For an optional REST smoke check, load `tests/database/browser-auth.sql` on that same disposable database, expose PostgREST on `127.0.0.1:56433` with the fixture-only `authenticated` role, start `node tests/browser/proxy.mjs` and run `node tests/database/postgrest.mjs`. Never expose the synthetic actor-header configuration outside localhost. These checks do not replace verification with real Supabase Auth and a physical phone/headset on a separate staging project.

## Deployment

The checked-in `.github/workflows/deploy.yml` triggers GitHub Pages builds on `stage`, not `main`. The public Cloudflare Pages pilot is a separate observed deployment; its build configuration was not verified. The build step injects the Supabase env vars
from repository secrets, so the following must be configured under
**Settings → Secrets and variables → Actions**:

| Secret name              | Value                                          |
| ------------------------ | ---------------------------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL                      |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable / anon key           |

These get inlined into the production bundle by Vite, so they are visible to
anyone loading the site. That's expected for the anon key — protect data with
Row Level Security policies in Supabase, never with key secrecy.

To set the secrets via the `gh` CLI:

```
gh secret set VITE_SUPABASE_URL --body "https://your-project-ref.supabase.co"
gh secret set VITE_SUPABASE_ANON_KEY --body "your-publishable-or-anon-key"
```
