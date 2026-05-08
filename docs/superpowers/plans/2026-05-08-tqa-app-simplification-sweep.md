# TQA App Simplification Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the "engagement" concept end-to-end, drop the Weeks and Riders layers, simplify intake, replace the Dashboard with a Today screen, unify per-horse activity into a single workspace screen with TQA-aligned linear phase progression, and consolidate three reference pages into one.

**Architecture:** Single React 18 + Vite + Supabase + Tailwind app. The data model collapses Horse↔Engagement→Week→Session into Horse→Session (grouped in UI by Phase). Trifecta and assessment data move from `engagement_id` to `horse_id`. Routes restructure around `/horses/:id` as the single workspace. Bottom nav drops from 4 → 3 tabs (Today / Horses / TQA Reference). Production data is empty/test-only, so a clean schema migration is acceptable.

**Tech Stack:** React 18.3, React Router 6.28, React Hook Form 7.54, Zod 3.24, Tailwind 3.4, Supabase JS 2.105, Vitest 2.1 + Testing Library + jsdom, @react-pdf/renderer 4.1, Recharts 2.15, date-fns 4.1.

**Source spec:** `/Users/trhinehart/.claude/plans/the-app-is-not-graceful-hamster.md`

---

## Setup (one-time, before starting)

- [ ] **Step S1: Decide branch strategy.**

The current branch `ui-header-and-form-tweaks` has uncommitted changes to `AppShell.tsx`, `EngagementNew.tsx`, `Settings.tsx`. Either commit/discard those first, or branch from `main`.

Run from repo root:
```bash
git status
git stash push -m "ui-header-and-form-tweaks-wip" || true
git checkout main
git pull
git checkout -b refactor/tqa-app-simplification
```

- [ ] **Step S2: Verify the toolchain works on a clean tree.**

```bash
npm install
npm run test
npm run build
```

Expected: tests pass (only `dates.test.ts`, `stats.test.ts` exist today), build succeeds.

- [ ] **Step S3: Commit the spec into the repo.**

```bash
mkdir -p docs/superpowers/specs
cp ~/.claude/plans/the-app-is-not-graceful-hamster.md docs/superpowers/specs/2026-05-08-tqa-app-simplification-sweep-design.md
git add docs/superpowers/specs/ docs/superpowers/plans/2026-05-08-tqa-app-simplification-sweep.md
git commit -m "docs: capture TQA simplification spec and implementation plan"
```

---

## File Structure (decomposition map)

**Files to modify:**
- `supabase/schema.sql` — drop engagements/weeks/riders, extend horses, simplify sessions, repoint trifecta to horse
- `src/supabase/types.ts` — remove Engagement/Week/Rider types; extend Horse with new fields
- `src/supabase/queries.ts` — drop engagement/week/rider helpers; add horse-scoped helpers
- `src/App.tsx` — restructure routes
- `src/components/AppShell.tsx` — 3-tab bottom nav, drop "active engagement" lookup
- `src/pages/HorseNew.tsx` — minimal intake (name + owner + optional contact + optional notes)
- `src/pages/HorseDetail.tsx` — becomes the Horse workspace (phase strip + current phase card + sessions + Finish button)
- `src/pages/HorsesList.tsx` — status filtering, no "+ New engagement" links
- `src/pages/SessionNew.tsx` — phase auto-fill, drop rider/week, inline (i) help on questions
- `src/pages/SessionDetail.tsx` — drop rider field, repoint links
- `src/components/TrifectaEvaluation.tsx` — read from horse not engagement
- `src/features/pdf/Report.tsx` — read from horse, rename PDF title

**Files to create:**
- `src/utils/phaseProgression.ts` — pure logic for current phase, advance threshold, phase averages
- `src/utils/phaseProgression.test.ts` — unit tests for above
- `src/pages/Today.tsx` — replaces Dashboard
- `src/pages/HorseFinish.tsx` — the wrap-up flow (Trifecta → Report → Mark complete)
- `src/pages/Reference.tsx` — combines Phases + Resources + Foundation Doctrine

**Files to delete (Phase 6):**
- `src/pages/Dashboard.tsx`
- `src/pages/EngagementNew.tsx`
- `src/pages/EngagementDetail.tsx`
- `src/pages/Riders.tsx`
- `src/pages/PhasesList.tsx`
- `src/pages/PhaseDetail.tsx`
- `src/pages/Resources.tsx`
- `src/pages/FoundationDoctrine.tsx`
- `src/pages/Report.tsx`

---

## Phase 1 — Foundation: Schema, types, queries, pure logic

> Goal: data layer ready for the new model. After this phase, the app's UI temporarily references types that no longer exist; that's expected and fixed in Phase 2.

### Task 1.1: Schema migration

**Files:**
- Modify: `supabase/schema.sql`

**Approach:** Replace the canonical schema with the simplified version. Since production is empty, the `schema.sql` file is also the migration. Any developer running it on a fresh DB gets the new shape directly.

- [ ] **Step 1: Edit `supabase/schema.sql`.**

Locate the `riders`, `engagements`, `weeks` table definitions (lines 36–82, 110–121) and:
- Delete the `riders` table block and its index
- Delete the `engagements` table block and its indexes
- Delete the `weeks` table block and its index

Modify the `horses` table block (lines 48–60) to add new columns:
```sql
create table public.horses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  breed text,
  dob date,
  sex text,
  color text,
  notes text,
  -- new fields:
  owner_name text,
  owner_contact text,
  arrival_date date,
  status text not null default 'in_training' check (status in ('in_training','complete','archived')),
  current_phase_id uuid references public.phases on delete set null,
  -- existing tail:
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index horses_user_idx on public.horses(user_id);
create index horses_status_idx on public.horses(user_id, status);
```

Modify the `sessions` table block (lines 123–140):
```sql
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  phase_id uuid not null references public.phases on delete restrict,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_horse_idx on public.sessions(horse_id, occurred_at desc);
create index sessions_phase_idx on public.sessions(phase_id);
```

(Removed: `engagement_id`, `week_id`, `rider_id`, `session_number`. Indexes for those are gone with the columns.)

Modify the `trifecta_evaluations` table block (lines 157–166):
```sql
create table public.trifecta_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  evaluated_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (horse_id)
);
```

In the RLS section (lines 206–230), remove the `riders`, `engagements`, `weeks` enable-RLS lines and the matching `create policy` lines.

- [ ] **Step 2: Apply schema to local Supabase project.**

Per the team's existing flow (Supabase CLI or dashboard SQL editor):
```bash
# If using Supabase CLI locally:
supabase db reset   # (drops local DB and reapplies schema.sql + seeds)
```

Or paste `schema.sql` into the Supabase SQL editor for the dev project and run.

Expected: no errors, tables `riders`, `engagements`, `weeks` no longer exist, `horses` has the new columns, `sessions` is simplified, `trifecta_evaluations` references horse_id.

- [ ] **Step 3: Verify the schema in psql or the dashboard.**

```sql
\d public.horses
\d public.sessions
\d public.trifecta_evaluations
select tablename from pg_tables where schemaname='public' order by tablename;
```

Expected: no `riders`, `engagements`, `weeks` rows in the table list. Horses shows the new columns.

- [ ] **Step 4: Commit.**

```bash
git add supabase/schema.sql
git commit -m "schema: collapse engagement/week/rider into horse; simplify sessions"
```

### Task 1.2: Update types

**Files:**
- Modify: `src/supabase/types.ts`

- [ ] **Step 1: Read current types.**

Open `src/supabase/types.ts` and locate the `Horse`, `Engagement`, `Week`, `Session`, `Rider`, `TrifectaEvaluation` interfaces.

- [ ] **Step 2: Replace types.**

Make these changes in `src/supabase/types.ts`:

Remove `Engagement`, `Week`, `Rider` interfaces entirely. Remove any related input/aggregate types (e.g., `EngagementInput` if defined here).

Replace the `Horse` interface to add the new fields:
```ts
export type HorseStatus = 'in_training' | 'complete' | 'archived';

export interface Horse {
  id: ID;
  user_id: ID;
  name: string;
  breed: string | null;
  dob: string | null;
  sex: string | null;
  color: string | null;
  notes: string | null;
  // new fields:
  owner_name: string | null;
  owner_contact: string | null;
  arrival_date: string | null;
  status: HorseStatus;
  current_phase_id: ID | null;
  // existing:
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
```

Replace `Session` to drop engagement/week/rider/session_number:
```ts
export interface Session {
  id: ID;
  user_id: ID;
  horse_id: ID;
  phase_id: ID;
  occurred_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

Replace `TrifectaEvaluation` to use `horse_id`:
```ts
export interface TrifectaEvaluation {
  id: ID;
  user_id: ID;
  horse_id: ID;
  evaluated_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

Leave `Phase`, `Question`, `Rating`, `TrifectaScore`, `Resource`, `Profile` alone.

- [ ] **Step 3: Run typecheck.**

```bash
npx tsc --noEmit
```

Expected: many errors in `queries.ts`, `pages/*.tsx`, `components/AppShell.tsx`, etc., referencing removed types. That's expected — Phase 1 deliberately leaves the UI broken; we'll fix it phase-by-phase.

- [ ] **Step 4: Commit.**

```bash
git add src/supabase/types.ts
git commit -m "types: remove Engagement/Week/Rider; extend Horse with status, owner, arrival, current_phase_id"
```

### Task 1.3: Pure logic for phase progression

**Files:**
- Create: `src/utils/phaseProgression.ts`
- Create: `src/utils/phaseProgression.test.ts`

This is the only place TDD is strictly applied — the logic governs the soft-gate UX and is critical to get right.

- [ ] **Step 1: Write failing tests.**

Create `src/utils/phaseProgression.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  ADVANCE_THRESHOLD,
  WINDOW_SIZE,
  computePhaseAverage,
  computeRollingAverage,
  isAtOrAboveStandard,
  nextPhase,
  prevPhase,
} from "./phaseProgression";
import type { Phase } from "../supabase/types";

const phases: Phase[] = [
  { id: "p0", user_id: "u", code: "groundwork", position: 0, name: "Groundwork", created_at: "" },
  { id: "p1", user_id: "u", code: "phase_1", position: 1, name: "Phase 1", created_at: "" },
  { id: "p2", user_id: "u", code: "phase_2", position: 2, name: "Phase 2", created_at: "" },
  { id: "p3", user_id: "u", code: "phase_3", position: 3, name: "Phase 3", created_at: "" },
  { id: "p4", user_id: "u", code: "phase_4", position: 4, name: "Phase 4", created_at: "" },
];

describe("phaseProgression", () => {
  it("ADVANCE_THRESHOLD is +2.0 (TQA industry standard)", () => {
    expect(ADVANCE_THRESHOLD).toBe(2);
  });

  it("WINDOW_SIZE rolls over the last 7 sessions", () => {
    expect(WINDOW_SIZE).toBe(7);
  });

  it("computePhaseAverage averages all rating scores in a phase", () => {
    const scores = [3, 1, -1, 2, 0]; // sum=5, n=5, avg=1
    expect(computePhaseAverage(scores)).toBe(1);
  });

  it("computePhaseAverage returns null for an empty list", () => {
    expect(computePhaseAverage([])).toBeNull();
  });

  it("computeRollingAverage uses only the last WINDOW_SIZE session averages", () => {
    const sessionAverages = [-3, -3, 0, 1, 2, 3, 3, 3, 3]; // last 7 = [0,1,2,3,3,3,3] avg ~ 2.143
    expect(computeRollingAverage(sessionAverages)).toBeCloseTo(15 / 7, 5);
  });

  it("isAtOrAboveStandard returns true at exactly +2.0", () => {
    expect(isAtOrAboveStandard(2)).toBe(true);
    expect(isAtOrAboveStandard(1.999)).toBe(false);
    expect(isAtOrAboveStandard(null)).toBe(false);
  });

  it("nextPhase returns the phase at position+1 or null at the end", () => {
    expect(nextPhase(phases[0], phases)?.code).toBe("phase_1");
    expect(nextPhase(phases[4], phases)).toBeNull();
  });

  it("prevPhase returns the phase at position-1 or null at the start", () => {
    expect(prevPhase(phases[1], phases)?.code).toBe("groundwork");
    expect(prevPhase(phases[0], phases)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

```bash
npm run test -- phaseProgression
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement.**

Create `src/utils/phaseProgression.ts`:
```ts
import type { Phase } from "../supabase/types";

export const ADVANCE_THRESHOLD = 2; // TQA "industry standard" baseline.
export const WINDOW_SIZE = 7;       // 7-session rolling average.

export function computePhaseAverage(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

export function computeRollingAverage(sessionAverages: number[]): number | null {
  const window = sessionAverages.slice(-WINDOW_SIZE);
  return computePhaseAverage(window);
}

export function isAtOrAboveStandard(avg: number | null): boolean {
  return avg != null && avg >= ADVANCE_THRESHOLD;
}

export function nextPhase(current: Phase, phases: Phase[]): Phase | null {
  const ordered = [...phases].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((p) => p.id === current.id);
  return idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
}

export function prevPhase(current: Phase, phases: Phase[]): Phase | null {
  const ordered = [...phases].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((p) => p.id === current.id);
  return idx > 0 ? ordered[idx - 1] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass.**

```bash
npm run test -- phaseProgression
```

Expected: 8 PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/utils/phaseProgression.ts src/utils/phaseProgression.test.ts
git commit -m "feat: add phaseProgression utility for current-phase logic and advance threshold"
```

### Task 1.4: Rewrite queries layer

**Files:**
- Modify: `src/supabase/queries.ts`

**Approach:** Remove engagement/week/rider helpers; replace session helpers with horse-scoped versions; repoint trifecta helpers to horse.

- [ ] **Step 1: Remove old helpers.**

In `src/supabase/queries.ts`, delete these entire functions and their interface declarations:
- `listRiders`, `createRider`, `updateRider`, `archiveRider`, `unarchiveRider`, `deleteRider`
- `listEngagementsForHorse`, `listEngagements`, `getEngagement`, `EngagementInput`, `createEngagement`, `updateEngagement`, `archiveEngagement`, `deleteEngagement`
- `listWeeksForEngagement`, `getWeek`, `createWeek`, `appendWeek`, `updateWeekComments`, `deleteWeek`
- `listSessionsForEngagement`, `listSessionsForWeek` (keep `listSessionsForHorse`)

Also drop any imports of `Engagement`, `EngagementInput`, `Week`, `Rider` types (they no longer exist).

- [ ] **Step 2: Update remaining session helpers.**

Replace `SessionInput` and `createSession`/`updateSession` to drop engagement/week/rider fields:
```ts
export interface SessionRatingInput {
  question_id: ID;
  axis: 'foundation' | 'temperament';
  question_text_snapshot: string;
  score: number;
  comment?: string | null;
}

export interface SessionInput {
  horse_id: ID;
  phase_id: ID;
  occurred_at: string; // ISO date or timestamp
  notes?: string | null;
  ratings: SessionRatingInput[];
}

export async function createSession(input: SessionInput): Promise<Session> {
  const user = await requireUser();
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      horse_id: input.horse_id,
      phase_id: input.phase_id,
      occurred_at: input.occurred_at,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.ratings.length > 0) {
    const { error: rerr } = await supabase
      .from('ratings')
      .insert(
        input.ratings.map((r) => ({
          user_id: user.id,
          session_id: session.id,
          question_id: r.question_id,
          axis_snapshot: r.axis,
          question_text_snapshot: r.question_text_snapshot,
          score: r.score,
          comment: r.comment ?? null,
        })),
      );
    if (rerr) throw rerr;
  }

  return session as Session;
}
```

(Adjust `updateSession` similarly: drop engagement/week/rider params; keep horse_id, phase_id, occurred_at, notes, ratings.)

- [ ] **Step 3: Update Horse helpers.**

Add owner/arrival/status fields to `createHorse` and `updateHorse`:
```ts
export interface HorseInput {
  name: string;
  owner_name?: string | null;
  owner_contact?: string | null;
  arrival_date?: string | null; // YYYY-MM-DD
  notes?: string | null;
  breed?: string | null;
  dob?: string | null;
  sex?: string | null;
  color?: string | null;
}

export async function createHorse(input: HorseInput): Promise<Horse> {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const phases = await listPhases();
  const groundwork = phases.find((p) => p.code === 'groundwork');

  const { data, error } = await supabase
    .from('horses')
    .insert({
      user_id: user.id,
      name: input.name,
      owner_name: input.owner_name ?? null,
      owner_contact: input.owner_contact ?? null,
      arrival_date: input.arrival_date ?? today,
      notes: input.notes ?? null,
      breed: input.breed ?? null,
      dob: input.dob ?? null,
      sex: input.sex ?? null,
      color: input.color ?? null,
      status: 'in_training',
      current_phase_id: groundwork?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Horse;
}
```

Update `updateHorse` to accept the new fields. Add new helpers:
```ts
export async function listInTrainingHorses(): Promise<Horse[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('*')
    .eq('status', 'in_training')
    .order('arrival_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Horse[];
}

export async function setHorseStatus(id: ID, status: HorseStatus): Promise<void> {
  const { error } = await supabase
    .from('horses')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function setHorseCurrentPhase(id: ID, phaseId: ID): Promise<void> {
  const { error } = await supabase
    .from('horses')
    .update({ current_phase_id: phaseId })
    .eq('id', id);
  if (error) throw error;
}
```

(Import `HorseStatus` from types.)

Replace `listHorses(includeArchived)` to filter by status instead:
```ts
export async function listHorses(opts?: { statuses?: HorseStatus[] }): Promise<Horse[]> {
  let q = supabase.from('horses').select('*');
  if (opts?.statuses) q = q.in('status', opts.statuses);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Horse[];
}
```

`archiveHorse` and `unarchiveHorse` should use `setHorseStatus` under the hood:
```ts
export async function archiveHorse(id: ID): Promise<void> {
  await setHorseStatus(id, 'archived');
}
export async function unarchiveHorse(id: ID): Promise<void> {
  await setHorseStatus(id, 'in_training');
}
```

- [ ] **Step 4: Update Trifecta helpers.**

Replace `getTrifectaForEngagement` with `getTrifectaForHorse` and `upsertTrifectaEvaluation` to use `horse_id`:
```ts
export async function getTrifectaForHorse(
  horseId: ID,
): Promise<{ evaluation: TrifectaEvaluation; scores: TrifectaScore[] } | null> {
  const { data: evaluation } = await supabase
    .from('trifecta_evaluations')
    .select('*')
    .eq('horse_id', horseId)
    .maybeSingle();
  if (!evaluation) return null;
  const { data: scores } = await supabase
    .from('trifecta_scores')
    .select('*')
    .eq('evaluation_id', evaluation.id);
  return { evaluation: evaluation as TrifectaEvaluation, scores: (scores ?? []) as TrifectaScore[] };
}

export async function upsertTrifectaEvaluation(input: {
  horse_id: ID;
  notes?: string | null;
  scores: TrifectaScoreInput[];
}): Promise<TrifectaEvaluation> {
  const user = await requireUser();
  const { data: evaluation, error } = await supabase
    .from('trifecta_evaluations')
    .upsert(
      {
        user_id: user.id,
        horse_id: input.horse_id,
        notes: input.notes ?? null,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: 'horse_id' },
    )
    .select()
    .single();
  if (error) throw error;

  // wipe existing scores and reinsert (simplest correct behavior for an upsert)
  await supabase.from('trifecta_scores').delete().eq('evaluation_id', evaluation.id);
  if (input.scores.length > 0) {
    const { error: serr } = await supabase
      .from('trifecta_scores')
      .insert(
        input.scores.map((s) => ({
          user_id: user.id,
          evaluation_id: evaluation.id,
          axis: s.axis,
          item_code: s.item_code,
          item_text_snapshot: s.item_text_snapshot,
          score: s.score,
          comment: s.comment ?? null,
        })),
      );
    if (serr) throw serr;
  }
  return evaluation as TrifectaEvaluation;
}
```

- [ ] **Step 5: Run typecheck.**

```bash
npx tsc --noEmit 2>&1 | head -80
```

Expected: errors only in pages that haven't been migrated yet (Dashboard, EngagementNew, EngagementDetail, Riders, etc.). The queries file itself should typecheck.

- [ ] **Step 6: Commit.**

```bash
git add src/supabase/queries.ts
git commit -m "queries: drop engagement/week/rider helpers; horse-scoped sessions and trifecta"
```

---

## Phase 2 — Core pages: Horse workspace, intake, sessions

> Goal: the bulk of the visible refactor. After this phase, the app builds and the primary "create horse → log session → advance phase" flow works end-to-end via direct URL navigation. Today/Finish flow are in later phases.

### Task 2.1: Simplified intake (`HorseNew.tsx`)

**Files:**
- Modify: `src/pages/HorseNew.tsx`

- [ ] **Step 1: Reduce the form.**

Replace the form fields with: `name` (required), `owner_name` (required), `owner_contact` (optional, single text field — placeholder "Phone, email, or address"), `notes` (optional textarea), `arrival_date` (optional, defaults to today via `createHorse`).

The form should use React Hook Form + Zod, matching the codebase's existing patterns (look at how `EngagementNew.tsx` does it). Use Tailwind classes for styling, matching neighboring pages.

Submit calls `createHorse(values)` and on success navigates to `/horses/${horse.id}`.

- [ ] **Step 2: Manual verification.**

```bash
npm run dev
# Navigate to /horses/new
# Submit the form with name="Buster" + owner_name="Jane Doe"
# Verify redirect to /horses/<id>
# Verify a row exists in horses with status='in_training', arrival_date=today, current_phase_id=<groundwork uuid>
```

- [ ] **Step 3: Commit.**

```bash
git add src/pages/HorseNew.tsx
git commit -m "feat(intake): simplify HorseNew to name + owner + optional contact + notes"
```

### Task 2.2: Horse workspace skeleton (`HorseDetail.tsx`)

**Files:**
- Modify: `src/pages/HorseDetail.tsx`

The new HorseDetail is a single-page workspace. Build it incrementally — get the structure rendering first, then layer on phase logic and actions.

- [ ] **Step 1: Replace the page with the new skeleton.**

```tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getHorse,
  listPhases,
  listSessionsForHorse,
  setHorseCurrentPhase,
  setHorseStatus,
} from "../supabase/queries";
import type { Horse, Phase, Session } from "../supabase/types";
import { differenceInDays, parseISO } from "date-fns";

export default function HorseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [h, ps, ss] = await Promise.all([
        getHorse(id),
        listPhases(),
        listSessionsForHorse(id),
      ]);
      setHorse(h);
      setPhases(ps);
      setSessions(ss);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (!horse) return <div className="p-4">Horse not found.</div>;

  const currentPhase = phases.find((p) => p.id === horse.current_phase_id);

  return (
    <div className="p-4 space-y-4">
      <Header horse={horse} />
      <PhaseStrip horse={horse} phases={phases} sessions={sessions} />
      {currentPhase && (
        <CurrentPhaseCard
          horse={horse}
          phase={currentPhase}
          phases={phases}
          sessions={sessions}
          onAdvance={async (next) => {
            await setHorseCurrentPhase(horse.id, next.id);
            setHorse({ ...horse, current_phase_id: next.id });
          }}
        />
      )}
      <FinishButton horseId={horse.id} />
      <DetailsAccordion horse={horse} onUpdate={(h) => setHorse(h)} />
      <DangerActions horse={horse} navigate={navigate} />
    </div>
  );
}

function Header({ horse }: { horse: Horse }) {
  const arrival = horse.arrival_date ? parseISO(horse.arrival_date) : null;
  const dayN = arrival ? differenceInDays(new Date(), arrival) + 1 : null;
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{horse.name}</h1>
        {horse.owner_name && <p className="text-sm text-gray-600">Owner: {horse.owner_name}</p>}
      </div>
      {dayN != null && (
        <p className="text-xs text-gray-500">Day {dayN} of 60</p>
      )}
    </div>
  );
}

// PhaseStrip, CurrentPhaseCard, FinishButton, DetailsAccordion, DangerActions are stubs;
// implement in subsequent steps.
function PhaseStrip(_: any) { return <div data-testid="phase-strip" />; }
function CurrentPhaseCard(_: any) { return <div data-testid="current-phase-card" />; }
function FinishButton({ horseId }: { horseId: string }) {
  return <Link to={`/horses/${horseId}/finish`} className="btn-primary block text-center">Finish training</Link>;
}
function DetailsAccordion(_: any) { return null; }
function DangerActions(_: any) { return null; }
```

- [ ] **Step 2: Visually verify the skeleton.**

```bash
npm run dev
# Navigate to /horses/<id>; verify the header (name, owner, "Day X of 60") renders.
```

- [ ] **Step 3: Commit.**

```bash
git add src/pages/HorseDetail.tsx
git commit -m "feat(horse-workspace): replace HorseDetail with single-page workspace skeleton"
```

- [ ] **Step 4: Implement `PhaseStrip`.**

Replace the stub with a vertical list of all 5 phases, each with a status icon (✓ completed if `position < currentPhase.position`, ● current if equal, · upcoming if greater). Tapping a completed phase expands its session list inline. Use Tailwind for the layout. Sessions for each phase = `sessions.filter(s => s.phase_id === p.id)`.

- [ ] **Step 5: Implement `CurrentPhaseCard`.**

The visual focal point. It should show:
- Phase name + number ("Phase 2 — Phase 2")
- Phase running average (compute from ratings via a helper — see Step 6)
- Session count for this phase, last session date
- Primary CTA: `<Link to={"/horses/"+horse.id+"/sessions/new"}>Log today's session</Link>`
- Secondary CTA: `Advance to ${nextPhase?.name}` button — wires to `props.onAdvance(nextPhase)` after the soft gate

The soft gate logic:
```tsx
const handleAdvance = async () => {
  const next = nextPhase(currentPhase, phases);
  if (!next) return;
  if (!isAtOrAboveStandard(rolling7Average)) {
    const ok = window.confirm(
      `This phase's average is ${rolling7Average?.toFixed(1) ?? "—"}, below the +2.0 TQA industry standard. Some horses need more time — that's a recordable outcome. Continue to ${next.name}?`,
    );
    if (!ok) return;
  }
  await props.onAdvance(next);
};
```

The button styling: when `isAtOrAboveStandard(rolling7Average)` → green/recommended; else neutral.

- [ ] **Step 6: Add a phase-average data helper.**

To compute phase averages, you need rating scores per session. Add this helper to `src/supabase/queries.ts`:

```ts
export async function listRatingsForHorse(horseId: ID): Promise<{ session_id: ID; phase_id: ID; score: number }[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('session_id, score, sessions!inner(phase_id, horse_id)')
    .eq('sessions.horse_id', horseId);
  if (error) throw error;
  // Flatten; the embedded session row is at row.sessions
  return (data ?? []).map((r: any) => ({ session_id: r.session_id, phase_id: r.sessions.phase_id, score: r.score }));
}
```

Use it in `HorseDetail` to load all ratings on mount, group by phase to compute per-phase averages and per-session averages for the rolling 7-window.

- [ ] **Step 7: Implement `DetailsAccordion` and `DangerActions`.**

`DetailsAccordion`: a collapsed card with an "Edit details" button → expands to a small form (owner name, owner contact, arrival date, notes). Submit calls `updateHorse(horse.id, values)`.

`DangerActions`: a collapsed card with two buttons — "Archive horse" → `setHorseStatus(id, 'archived')` then navigate(`/horses`); and (only when `horse.status === 'complete'`) "Re-open training" → `setHorseStatus(id, 'in_training')`.

- [ ] **Step 8: Manual end-to-end check.**

```bash
npm run dev
# Visit /horses/<id> for an in-training horse
# Verify phase strip shows correctly with current phase highlighted
# Verify "Log today's session" routes to /horses/<id>/sessions/new (will 404 until Task 2.4 — that's fine)
# Type-check: npx tsc --noEmit (only stale-page errors should remain)
```

- [ ] **Step 9: Commit.**

```bash
git add src/pages/HorseDetail.tsx src/supabase/queries.ts
git commit -m "feat(horse-workspace): phase strip, current-phase card with soft gate, details and danger actions"
```

### Task 2.3: Horses list (`HorsesList.tsx`)

**Files:**
- Modify: `src/pages/HorsesList.tsx`

- [ ] **Step 1: Update list and filters.**

Show three sections (collapsible): "In training" (status=in_training), "Completed" (status=complete), "Archived" (status=archived). Use `listHorses({ statuses: [...] })` to fetch. Each card links to `/horses/:id` and shows name, owner, current phase name (look up from phases by current_phase_id).

Remove any "+ New engagement" button. Keep the "+ New horse" button → links to `/horses/new`.

- [ ] **Step 2: Manual verify.**

```bash
npm run dev
# Visit /horses; verify three sections; verify links route correctly.
```

- [ ] **Step 3: Commit.**

```bash
git add src/pages/HorsesList.tsx
git commit -m "feat(horses-list): segment by status; drop engagement-creation entry points"
```

### Task 2.4: Session entry (`SessionNew.tsx`)

**Files:**
- Modify: `src/pages/SessionNew.tsx`
- Modify: `src/App.tsx` — add route `/horses/:id/sessions/new`

- [ ] **Step 1: Add the new route.**

In `src/App.tsx`, add:
```tsx
<Route path="/horses/:id/sessions/new" element={guarded(<SessionNew />)} />
```
(Leave the old engagement-scoped route in place for now — Phase 6 deletes it.)

- [ ] **Step 2: Rewrite `SessionNew.tsx`.**

The component:
- Reads `:id` (horse_id) from route params.
- Loads horse + phases + questions for the horse's current phase on mount.
- Form: occurred_at (default today), phase_id (default to horse.current_phase_id), notes, plus one rating row per question.
- Phase dropdown is hidden by default; a small "Use a different phase" link reveals it (for regression cases).
- No rider field. No week field.
- Each question row has a small `(i)` button that toggles an inline help panel showing the question's `low_label`/`high_label` and any attached resources (videos/links). Resources can be loaded via `listResourcesForQuestion(question.id)` (already exists).
- Submit calls `createSession({ horse_id, phase_id, occurred_at, notes, ratings })`.

A sketch of the question row:
```tsx
function QuestionRow({ q, value, onChange }: { q: Question; value: number; onChange: (v: number) => void }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="border rounded p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{q.text}</p>
        </div>
        <button type="button" onClick={() => setShowHelp((s) => !s)} aria-label="Help">ⓘ</button>
      </div>
      <ScoreSelector value={value} onChange={onChange} />
      {showHelp && <InlineHelp questionId={q.id} lowLabel={q.low_label} highLabel={q.high_label} />}
    </div>
  );
}
```

`InlineHelp` is a small component that fetches and displays resources for the question.

- [ ] **Step 3: Add `listResourcesForQuestion` if missing.**

Already present in `queries.ts` (line 600 per the survey). No-op.

- [ ] **Step 4: Manual verify the flow.**

```bash
npm run dev
# Visit /horses/<id> → tap "Log today's session"
# Verify form opens with phase auto-filled to horse's current phase, date=today
# Tap (i) on a question → verify inline help opens with low/high labels
# Save → verify redirect back to horse workspace
# Verify the new session appears under the current phase
```

- [ ] **Step 5: Commit.**

```bash
git add src/App.tsx src/pages/SessionNew.tsx
git commit -m "feat(sessions): horse-scoped session entry with phase auto-fill and inline help"
```

### Task 2.5: Session detail (`SessionDetail.tsx`)

**Files:**
- Modify: `src/pages/SessionDetail.tsx`

- [ ] **Step 1: Drop rider/week references.**

Remove any rider field display, rider dropdown in edit mode, and any week-related navigation. Repoint the "Back to engagement" link to "Back to horse" → `/horses/:horseId`.

- [ ] **Step 2: Manual verify.**

```bash
npm run dev
# Visit /sessions/<id>; verify no rider/week UI; verify "Back" goes to the horse workspace.
```

- [ ] **Step 3: Commit.**

```bash
git add src/pages/SessionDetail.tsx
git commit -m "fix(session-detail): drop rider/week, route Back to horse workspace"
```

### Task 2.6: AppShell — placeholder bottom-tab cleanup

**Files:**
- Modify: `src/components/AppShell.tsx`

This is partial — full Today routing comes in Phase 3.

- [ ] **Step 1: Remove the "active engagement" lookup.**

Delete the `useEffect` that queries `listEngagements` (lines 36–51 per the explore). The "Now training: [Horse]" header chip can stay in place but should compute from `listInTrainingHorses()` (first one) instead.

Replace the bottom tabs with:
- Today → `/`
- Horses → `/horses`
- Reference → `/reference` (this route is added in Phase 5; for now link to `/phases` as a temporary stub — fix in Phase 5)

Drop the "Progress" and "Report" tabs entirely.

- [ ] **Step 2: Manual verify.**

```bash
npm run dev
# Verify header chip shows the active in-training horse (or hides if none)
# Verify three tabs visible at bottom; "Reference" temporarily routes to /phases
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/AppShell.tsx
git commit -m "refactor(shell): remove active-engagement lookup; 3-tab nav with temp reference route"
```

---

## Phase 3 — Today screen replaces Dashboard

### Task 3.1: Build `Today.tsx`

**Files:**
- Create: `src/pages/Today.tsx`

- [ ] **Step 1: Implement.**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listInTrainingHorses, listPhases, listSessionsForHorse, listRatingsForHorse } from "../supabase/queries";
import type { Horse, Phase } from "../supabase/types";
import HorseDetail from "./HorseDetail";
import { computePhaseAverage, computeRollingAverage } from "../utils/phaseProgression";

export default function Today() {
  const [horses, setHorses] = useState<Horse[] | null>(null);
  useEffect(() => {
    listInTrainingHorses().then(setHorses);
  }, []);

  if (horses === null) return <div className="p-4">Loading…</div>;
  if (horses.length === 0) return <EmptyState />;
  if (horses.length === 1) {
    // render the workspace inline so the URL stays "/" — alternative: redirect, but inline is simpler
    return <SingleHorseToday horseId={horses[0].id} />;
  }
  return <MultiHorseToday horses={horses} />;
}

function EmptyState() {
  return (
    <div className="p-8 text-center space-y-4">
      <h1 className="text-xl font-semibold">No horses yet</h1>
      <p className="text-gray-600">Add a horse to start tracking training.</p>
      <Link to="/horses/new" className="btn-primary inline-block">Add your first horse</Link>
    </div>
  );
}

function SingleHorseToday({ horseId }: { horseId: string }) {
  // The workspace component reads :id from URL params today; we need a variant that takes a prop.
  // Simplest: navigate to /horses/:id on mount.
  const navigate = useNavigate();
  useEffect(() => { navigate(`/horses/${horseId}`, { replace: true }); }, [horseId, navigate]);
  return <div className="p-4">Loading…</div>;
}

function MultiHorseToday({ horses }: { horses: Horse[] }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  useEffect(() => { listPhases().then(setPhases); }, []);
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Today</h1>
      {horses.map((h) => (
        <TodayCard key={h.id} horse={h} phases={phases} />
      ))}
    </div>
  );
}

function TodayCard({ horse, phases }: { horse: Horse; phases: Phase[] }) {
  const phase = phases.find((p) => p.id === horse.current_phase_id);
  return (
    <div className="border rounded-lg p-4 flex items-center justify-between">
      <Link to={`/horses/${horse.id}`} className="block flex-1">
        <p className="font-medium">{horse.name}</p>
        <p className="text-sm text-gray-600">
          {horse.owner_name ?? "—"} · {phase?.name ?? "No phase"}
        </p>
      </Link>
      <Link to={`/horses/${horse.id}/sessions/new`} className="btn-primary">
        Log today's session
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Wire the route.**

In `src/App.tsx`, replace `Dashboard` import with `Today` and replace the `/` route element. Leave the import for `Dashboard` for now (Phase 6 deletes the file).

```tsx
import Today from "./pages/Today";
// ...
<Route path="/" element={guarded(<Today />)} />
```

- [ ] **Step 3: Manual verify.**

```bash
npm run dev
# 0 horses: visit /; verify empty state with "Add your first horse"
# 1 horse: visit /; verify it redirects to /horses/<id>
# 2+ horses: visit /; verify two cards, each with "Log today's session" button
```

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Today.tsx src/App.tsx
git commit -m "feat(today): replace Dashboard with Today screen (auto-route on single horse)"
```

---

## Phase 4 — Finish flow + Trifecta + Report

### Task 4.1: Repoint TrifectaEvaluation component to horse

**Files:**
- Modify: `src/components/TrifectaEvaluation.tsx`

- [ ] **Step 1: Change the component's interface.**

Currently the component takes `engagementId`. Change to `horseId`. Update its data hooks to call `getTrifectaForHorse(horseId)` and `upsertTrifectaEvaluation({ horse_id: horseId, ... })`. The auto-suggestion logic that pulls from session averages stays — it just needs to fetch sessions/ratings via `listSessionsForHorse(horseId)` + `listRatingsForHorse(horseId)` instead of engagement-scoped helpers.

- [ ] **Step 2: Type-check.**

```bash
npx tsc --noEmit 2>&1 | grep -i trifecta | head -20
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/TrifectaEvaluation.tsx
git commit -m "refactor(trifecta): repoint TrifectaEvaluation from engagement to horse"
```

### Task 4.2: PDF report repoint and rename

**Files:**
- Modify: `src/features/pdf/Report.tsx`

- [ ] **Step 1: Change the data source.**

Wherever the PDF reads from `engagement` (id, owner_name, arrival_date, departure_date, etc.), repoint to the `horse` directly (owner_name, arrival_date) and use horse-scoped session/trifecta queries. The PDF should accept a `horseId` prop instead of `engagementId`.

- [ ] **Step 2: Update title and labels.**

Find the line `"Training Quality Assurance — Engagement Report"` (per the explore, ~line 190 in `src/features/pdf/Report.tsx`). Change to:
```ts
`Training Quality Assurance Report — ${horse.name}`
```

Find `"End-of-engagement evaluation"` and replace with `"Final evaluation"` or `"Trifecta evaluation"`.

- [ ] **Step 3: Manual verify (after Task 4.3 which renders the PDF).**

Defer manual verification to Task 4.3.

- [ ] **Step 4: Commit.**

```bash
git add src/features/pdf/Report.tsx
git commit -m "refactor(report): horse-scoped PDF, drop engagement labels"
```

### Task 4.3: Create the Finish flow page

**Files:**
- Create: `src/pages/HorseFinish.tsx`
- Modify: `src/App.tsx` — add route `/horses/:id/finish`

- [ ] **Step 1: Add route.**

```tsx
import HorseFinish from "./pages/HorseFinish";
// ...
<Route path="/horses/:id/finish" element={guarded(<HorseFinish />)} />
```

- [ ] **Step 2: Implement the three-step flow.**

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import TrifectaEvaluation from "../components/TrifectaEvaluation";
import { setHorseStatus } from "../supabase/queries";

export default function HorseFinish() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!id) return null;

  if (step === 1) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold">Final evaluation</h1>
        <p className="text-sm text-gray-600">Pre-filled from session data — review and adjust each item.</p>
        <TrifectaEvaluation
          horseId={id}
          onSaved={() => setStep(2)}
        />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold">Generate report</h1>
        <Link to={`/horses/${id}/report`} target="_blank" className="btn-primary block">
          Open report (PDF)
        </Link>
        <button
          className="btn-secondary block w-full"
          onClick={async () => {
            await setHorseStatus(id, "complete");
            setStep(3);
          }}
        >
          Mark training complete
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Training complete</h1>
      <p className="text-gray-600">Status updated. You can re-open from the horse's page if needed.</p>
      <Link to="/" className="btn-primary inline-block">Back to Today</Link>
    </div>
  );
}
```

`TrifectaEvaluation` needs a new optional `onSaved` callback prop — add it in Task 4.1's update.

- [ ] **Step 3: Add the report route.**

```tsx
<Route path="/horses/:id/report" element={guarded(<HorseReport />)} />
```

Where `HorseReport` is a thin wrapper around the PDF component:
```tsx
// src/pages/HorseReport.tsx
import { useParams } from "react-router-dom";
import { PDFViewer } from "@react-pdf/renderer";
import EngagementReport from "../features/pdf/Report"; // (component name unchanged for now)

export default function HorseReport() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <EngagementReport horseId={id} />
    </PDFViewer>
  );
}
```

(The PDF component name is fine to leave as `EngagementReport` for now; rename in Phase 6 cleanup if desired.)

- [ ] **Step 4: Manual verify.**

```bash
npm run dev
# Visit /horses/<id> with several sessions logged → tap "Finish training"
# Step 1: Trifecta opens with values pre-filled; adjust one; save & continue
# Step 2: tap "Open report (PDF)" → PDF opens in new tab with horse's name in title
# Tap "Mark training complete" → step 3 success screen
# Visit / → if this was the only in-training horse, empty state shows; otherwise multi-card without this horse
# Visit /horses → completed horse appears in "Completed" section
```

- [ ] **Step 5: Commit.**

```bash
git add src/pages/HorseFinish.tsx src/pages/HorseReport.tsx src/App.tsx
git commit -m "feat(finish-flow): always-available wrap-up — Trifecta → PDF → mark complete"
```

---

## Phase 5 — TQA Reference consolidation

### Task 5.1: Create the unified Reference page

**Files:**
- Create: `src/pages/Reference.tsx`
- Modify: `src/App.tsx` — add route `/reference`
- Modify: `src/components/AppShell.tsx` — fix the "Reference" tab to point at `/reference`

- [ ] **Step 1: Implement the page.**

The page renders three vertically-stacked sections:
- **Phases & Questions** — port the body of `PhasesList.tsx` and inline expand-to-show-questions like `PhaseDetail.tsx`. List each of the 5 phases with their questions and any attached resources.
- **Videos & Resources** — port the body of `Resources.tsx`. Library grouped by phase/question.
- **Foundation Doctrine** — port the body of `FoundationDoctrine.tsx`.

Anchor links at the top so the trainer can jump to a section: `<a href="#phases">Phases</a>` etc.

```tsx
export default function Reference() {
  return (
    <div className="p-4 space-y-8">
      <nav className="flex gap-4 text-sm">
        <a href="#phases">Phases & Questions</a>
        <a href="#resources">Videos & Resources</a>
        <a href="#doctrine">Foundation Doctrine</a>
      </nav>
      <section id="phases"><PhasesSection /></section>
      <section id="resources"><ResourcesSection /></section>
      <section id="doctrine"><DoctrineSection /></section>
    </div>
  );
}
```

Each `*Section` is the migrated content from the original page (extract as local components or co-located files).

- [ ] **Step 2: Wire the route.**

```tsx
import Reference from "./pages/Reference";
// ...
<Route path="/reference" element={guarded(<Reference />)} />
```

- [ ] **Step 3: Update AppShell tab.**

In `src/components/AppShell.tsx`, change the temporary `/phases` link in the bottom-tab "Reference" entry to `/reference`.

- [ ] **Step 4: Manual verify.**

```bash
npm run dev
# Tap "Reference" tab → see all three sections in one page
# Anchor links jump correctly
# Verify content matches the original Phases / Resources / Foundation pages
```

- [ ] **Step 5: Commit.**

```bash
git add src/pages/Reference.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat(reference): consolidate Phases/Resources/Foundation into single Reference tab"
```

---

## Phase 6 — Cleanup

### Task 6.1: Delete dead pages

**Files (delete):**
- `src/pages/Dashboard.tsx`
- `src/pages/EngagementNew.tsx`
- `src/pages/EngagementDetail.tsx`
- `src/pages/Riders.tsx`
- `src/pages/PhasesList.tsx`
- `src/pages/PhaseDetail.tsx`
- `src/pages/Resources.tsx`
- `src/pages/FoundationDoctrine.tsx`
- `src/pages/Report.tsx`

**Files (modify):**
- `src/App.tsx` — drop imports and routes for the deleted pages

- [ ] **Step 1: Remove imports and routes from `App.tsx`.**

Open `src/App.tsx`. Delete the imports for Dashboard, EngagementNew, EngagementDetail, Riders, PhasesList, PhaseDetail, Resources, FoundationDoctrine, Report. Delete the corresponding `<Route>` elements.

The final `App.tsx` route table should look like:
```tsx
<Route path="/sign-in" element={<SignIn />} />
<Route path="/sign-up" element={<SignUp />} />

<Route path="/" element={guarded(<Today />)} />
<Route path="/horses" element={guarded(<HorsesList />)} />
<Route path="/horses/new" element={guarded(<HorseNew />)} />
<Route path="/horses/:id" element={guarded(<HorseDetail />)} />
<Route path="/horses/:id/sessions/new" element={guarded(<SessionNew />)} />
<Route path="/horses/:id/finish" element={guarded(<HorseFinish />)} />
<Route path="/horses/:id/report" element={guarded(<HorseReport />)} />
<Route path="/sessions/:id" element={guarded(<SessionDetail />)} />
<Route path="/reference" element={guarded(<Reference />)} />
<Route path="/settings" element={guarded(<Settings />)} />

<Route path="*" element={<NotFound />} />
```

- [ ] **Step 2: Delete the page files.**

```bash
git rm src/pages/Dashboard.tsx \
       src/pages/EngagementNew.tsx \
       src/pages/EngagementDetail.tsx \
       src/pages/Riders.tsx \
       src/pages/PhasesList.tsx \
       src/pages/PhaseDetail.tsx \
       src/pages/Resources.tsx \
       src/pages/FoundationDoctrine.tsx \
       src/pages/Report.tsx
```

- [ ] **Step 3: Type-check + build.**

```bash
npx tsc --noEmit
npm run build
```

Expected: both pass.

- [ ] **Step 4: Run tests.**

```bash
npm run test
```

Expected: pass.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "cleanup: remove dead pages (Dashboard, Engagement*, Riders, Phases*, Resources, Foundation, Report)"
```

### Task 6.2: Strip residual "engagement" strings

**Files (search and modify):**
- All of `src/`

- [ ] **Step 1: Find remaining mentions.**

```bash
grep -rn -i "engagement" src/ | grep -v node_modules
```

For each match:
- If it's a UI string (button label, heading, breadcrumb): replace with "training" / "horse" / remove
- If it's a comment: update or delete
- If it's a remaining variable name (e.g., `engagementId`): rename or refactor

The PDF component (`src/features/pdf/Report.tsx`) likely still has `engagement` in component names or local variables — rename to `horse`-scoped names. Optionally rename the file to `src/features/pdf/HorseReport.tsx` to match.

- [ ] **Step 2: Re-run grep to confirm clean.**

```bash
grep -rn -i "engagement" src/ | grep -v node_modules || echo "clean"
```

- [ ] **Step 3: Build + test.**

```bash
npx tsc --noEmit
npm run build
npm run test
```

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "cleanup: strip 'engagement' from labels and comments"
```

### Task 6.3: Final verification pass

- [ ] **Step 1: Run end-to-end manual verification using the spec's verification list.**

Open the source spec at `/Users/trhinehart/.claude/plans/the-app-is-not-graceful-hamster.md` and execute the **Verification** section (steps 1–12) in the running app:

1. Fresh first-run: empty state → Add first horse → land on workspace at Groundwork
2. Log a session: phase auto-filled, no rider/week, (i) help works, save returns to workspace
3. Soft-gate confirm below threshold: dialog mentions TQA standard
4. Soft-gate recommend above threshold: button shows "Recommended"
5. Regression: log against a prior phase via the strip
6. Multiple active horses: two cards on Today
7. Reference: in-flow help + standalone Reference tab both work
8. Finish flow: Trifecta pre-filled → PDF → mark complete → status flips
9. Re-open: completed horse can return to in_training
10. Bottom-tab honesty: each tab is a single deterministic destination
11. `npm run test` and `npm run build` pass
12. Schema integrity: no engagements/weeks/riders tables in the DB

- [ ] **Step 2: Resolve any failures inline.**

- [ ] **Step 3: Final commit + open PR.**

```bash
git status
git push -u origin refactor/tqa-app-simplification
gh pr create --title "Simplify app: remove Engagement/Week/Rider; per-horse workspace" \
  --body "$(cat <<'EOF'
## Summary
- Eliminates the "engagement" concept end-to-end (data model + UI)
- Drops Weeks and Riders entirely
- Replaces Dashboard with a Today screen (auto-routes to single in-training horse)
- New Horse workspace = single page with phase progression strip + linear-with-revisit advance + always-available Finish button
- Consolidates Phases / Resources / Foundation Doctrine into one Reference tab with inline (i) help during sessions
- TQA-aligned soft gate on phase advancement (no hard block, friendly confirmation below +2.0 referencing the framework)
- Schema migration assumes empty/test data only

Spec: docs/superpowers/specs/2026-05-08-tqa-app-simplification-sweep-design.md
Plan: docs/superpowers/plans/2026-05-08-tqa-app-simplification-sweep.md

## Test plan
- [x] Schema migrates cleanly on a fresh DB
- [x] Type-check + build pass
- [x] Vitest passes
- [x] Manual end-to-end of the 12 verification steps in the spec
EOF
)"
```

---

## Self-review

Performed against the source spec (`/Users/trhinehart/.claude/plans/the-app-is-not-graceful-hamster.md`):

**Spec coverage check:**
- [x] §1 Data model & vocabulary — covered by Tasks 1.1, 1.2, 1.4, 6.2
- [x] §2 Information architecture (3-tab nav) — covered by Tasks 2.6, 5.1
- [x] §3 Today (home screen) — covered by Task 3.1
- [x] §4 Horse workspace — covered by Task 2.2
- [x] §5 Session entry simplifications — covered by Task 2.4
- [x] §6 Finish training flow — covered by Tasks 4.1, 4.2, 4.3
- [x] §7 TQA Reference tab — covered by Task 5.1
- [x] §8 Removed surfaces — covered by Task 6.1
- [x] §9 Renamed surfaces — covered by Tasks 4.2 (PDF title) and 6.2 (strings)
- [x] Verification — covered by Task 6.3
- [x] Soft-gate UX with TQA-aligned wording — implemented in Task 2.2 Step 5 with the exact `window.confirm` text from the spec

**Placeholder scan:** No "TBD," "TODO," or "implement later" tokens. All steps include either exact code or exact commands.

**Type consistency:**
- `Horse` shape with the new fields (`owner_name`, `owner_contact`, `arrival_date`, `status`, `current_phase_id`) is consistent across types.ts (Task 1.2), queries.ts (Task 1.4), and pages.
- `Session` shape (no engagement_id/week_id/rider_id/session_number) is consistent across schema (Task 1.1), types (Task 1.2), queries (Task 1.4), SessionNew (Task 2.4), SessionDetail (Task 2.5).
- `TrifectaEvaluation.horse_id` is consistent across schema, types, queries, TrifectaEvaluation component (Task 4.1), HorseFinish (Task 4.3).
- `phaseProgression` exports (`ADVANCE_THRESHOLD`, `WINDOW_SIZE`, `computePhaseAverage`, `computeRollingAverage`, `isAtOrAboveStandard`, `nextPhase`, `prevPhase`) match between Task 1.3's tests and the importer in Task 2.2.
- `setHorseStatus` and `setHorseCurrentPhase` are introduced in Task 1.4 and used in Tasks 2.2, 4.3.

**Risk notes:**
- Task 1.1's schema change is destructive on the dev DB. The setup step S2 verifies the toolchain works before any data-layer changes, but a developer with non-empty dev data should pause and confirm before applying. Production is empty per the spec.
- Task 2.2's HorseDetail rebuild is the largest single change (likely 2–4 hours). It's split into 9 sub-steps with intermediate manual-verification anchors so progress is observable.
- Task 6.2's "engagement" string sweep depends on every prior phase being complete; running it earlier risks deleting strings still referenced by undeleted code. Sequencing is correct.
