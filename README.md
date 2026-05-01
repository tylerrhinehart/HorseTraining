# HorseTraining

A Vite + React app backed by Supabase, deployed to GitHub Pages.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Supabase project values:
   ```
   cp .env.example .env
   ```
   - `VITE_SUPABASE_URL` — your project URL (e.g. `https://xxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — the project's publishable / anon API key
3. Apply the schema in `supabase/schema.sql` to your Supabase project.
4. Start the dev server:
   ```
   npm run dev
   ```

`.env` is gitignored. Both vars are read by `src/supabase/client.ts`.

## Deployment

Pushes to `main` (and the branches listed in `.github/workflows/deploy.yml`)
trigger a GitHub Pages deploy. The build step injects the Supabase env vars
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
