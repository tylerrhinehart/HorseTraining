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
3. Use a **new local or staging Supabase project**. Apply `supabase/schema.sql`, `supabase/ride_drafts.sql`, `supabase/guided_voice.sql`, `supabase/ride_prompt_readback.sql`, `supabase/guided_temperament.sql`, `supabase/facility_transition.sql`, `supabase/platform_access_status.sql`, and `supabase/platform_facility_controls.sql` in that order, with a privileged database connection. For existing per-user records, use the [non-destructive facility upgrade](supabase/facility-transition.md). Existing facility installs apply only their pending additive updates. For readback on an existing guided-voice installation, apply `supabase/ride_prompt_readback.sql` when pending. Apply `supabase/guided_temperament.sql` after that migration for optional Temperament. Deploy both updated Ride-along Edge Functions before the web app. Keep the historical `migration_*.sql` files out of fresh installs. Run local tests and provisioning against a dedicated local or staging project.
4. Start the dev server:
   ```
   npm run dev
   ```

`.env` is gitignored. Both vars are read by `src/supabase/client.ts`.

## Facility and voice pilot

- Verify your Supabase Auth email, then register a facility. Facility owners invite coworkers by generating a one-time signup link for the coworker's verified email address. A facility link or ID alone does not grant access.
- Use a separate platform operator account for facility management. Follow [facility setup](supabase/facilities.md) to grant this role, then enroll and verify its TOTP factor before using the platform console. Never give an operator grant through the public signup flow.
- Voice is opt-in per facility. Setup requires the Supabase scoring and readback functions, the exact allowed web origins, and server-side provider secrets. OpenRouter handles transcription and Jev scoring. ElevenLabs reads the app's rubric prompts. See [guided scoring](supabase/functions/transcribe-ride-turn/README.md) and [ElevenLabs readback setup](supabase/functions/speak-ride-prompt/README.md).
- Ride-along guides the trainer through Foundation Phase 1. Speak a signed score, type a score such as `3` or `negative two`, or tap a score in the chat. A clear answer records into the draft and opens the next question once the save succeeds. An uncertain spoken answer leaves the current question open. The mic button toggles both the microphone and readback. Typing works with voice off. Leave the scorer or background the app to release the microphone. After Foundation, choose **Score Temperament now** or **Later**. Later takes you to review, and you can return to Temperament from the draft or edit the final ride. Select **Save ride** from the review screen to add the ride to history.

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
