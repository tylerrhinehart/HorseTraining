# HorseTraining

A Vite + React app backed by Supabase, deployed to homelab k3s at
[tqa.tylerrhinehart.com](https://tqa.tylerrhinehart.com).

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

## Homelab deploy

Production runs on the homelab k3s cluster behind a Cloudflare tunnel. The
manifests live in `k8s/` (kustomize base + production overlay), the build
recipe in `deploy/`, and the orchestrator in `scripts/deploy.sh`.

### One-time tunnel setup

```
cloudflared tunnel login
cloudflared tunnel create horsetraining
cloudflared tunnel route dns horsetraining tqa.tylerrhinehart.com
```

Copy the resulting tunnel credentials into `deploy/secrets.yaml`:

```
cp deploy/secrets.example.yaml deploy/secrets.yaml
# paste contents of ~/.cloudflared/<tunnel-id>.json into credentials.json
```

`deploy/secrets.yaml` is gitignored.

### Deploy

```
./scripts/deploy.sh                 # build, push, apply
./scripts/deploy.sh --dry-run       # render manifests without applying
./scripts/deploy.sh --skip-build    # redeploy current image
./scripts/deploy.sh --tag v1        # pin to a specific image tag
```

The script sources `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
`.env.local` (or your shell) and passes them as build args. Vite inlines
them into the static bundle, so they are visible to anyone loading the
site — that's expected for the anon key. Protect data with Row Level
Security policies in Supabase, never with key secrecy.

### GitHub Pages

The legacy GitHub Pages workflow at `.github/workflows/deploy.yml` is
`workflow_dispatch`-only — push triggers are disabled. Trigger it
manually from the Actions tab if the homelab is unavailable.
