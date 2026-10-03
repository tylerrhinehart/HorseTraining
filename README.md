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
3. For a **fresh disposable database only**, initialize with `supabase/schema.sql`. It drops existing tables. For an existing database, review `supabase/migration_programs.sql` and take a backup before applying changes. Score saving requires its atomic RPC functions. No database changes were made during this inspection.
4. Start the dev server:
   ```
   npm run dev
   ```

`.env` is gitignored. Both vars are read by `src/supabase/client.ts`.

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
