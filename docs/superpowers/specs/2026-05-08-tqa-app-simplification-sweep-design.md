# UX & Functionality Sweep: Simplification Spec

## Context

**Why this work:** The HorseTraining app has accreted complexity that misaligns with its end users. The trainer is non-tech-savvy and uses the app to evaluate a horse against the TQA framework — receive horse → progress through phases → produce assessment. Today's app obscures that flow with overlapping concepts and split surfaces:

- **"Engagement" is overloaded.** The schema treats it as a client booking (owner, payment, dates), the UX treats it as a training program (weeks, sessions, progress tabs), and the Trifecta calls it the evaluation cycle. One record carries three meanings.
- **Phases are unconstrained.** A trainer can log a Phase 3 session with no Phase 1 history. There is no "complete this phase" or "advance" action; advancement is a side effect of changing the dropdown.
- **Assessment is fragmented.** To see one horse's status, the trainer must hop between Session detail → Engagement → Progress tab → Engagement → Trifecta tab → PDF report.
- **Navigation is dishonest.** The bottom-tab "Report" silently routes to the most-recent engagement; "Progress" silently routes to the active horse's detail page. Both depend on hidden state.
- **Three reference destinations** (Phases, Resources, Foundation Doctrine) compete for a non-tech-savvy user's attention.
- **Implicit features** (Riders, Weekly comments, 10 auto-created weeks vs. TQA's 8-week timeline) add cognitive load without serving the core flow.

**Outcome:** A flatter, single-workspace-per-horse app with one clear linear flow (intake → phase progression → finish) backed by the TQA-aligned vocabulary. Engagement disappears as a concept; Weeks dissolve; Riders is removed; reference content consolidates. The trainer always knows: which horse, which phase, what's next.

**Scope note:** This is a sweeping UX refactor, not a feature add. Production data is empty/test-only, so a clean schema migration is acceptable.

---

## Principles

1. **One horse = one training cycle.** Confirmed by the user: each arrival is one-time. We collapse the Horse↔Engagement relationship into the Horse alone.
2. **One workspace per horse.** Everything about a horse — owner info, current phase, sessions, progress, finish — is on a single page. No tabs across multiple URLs.
3. **TQA-aligned defaults, trainer-final decisions.** The app encodes the TQA framework (5 phases, 8-week timeline, ±3 scale, +2.0 industry standard, Trifecta as the deliverable) but never overrides the trainer's judgment.
4. **Auto-fill the obvious.** Phase, date, and Trifecta values pre-fill from context so the trainer just confirms.
5. **Make navigation honest.** Tabs go to a single destination, not "the most recent X."

---

## Design

### 1. Data model & vocabulary changes

**Removed:**
- `engagements` table → fields move to `horses`
- `weeks` table → sessions attach directly to horses; group by phase in UI
- `riders` table and all rider associations on sessions
- All "engagement," "engagements," "new engagement," "open engagement" UI strings

**Horse gets these added/relocated fields:**
- `owner_name` (required at intake)
- `owner_contact` (optional, single free-text field — replaces split owner_email/owner_info; trainer enters phone or email or address as they prefer)
- `arrival_date` (defaults to today at intake)
- `notes` (optional)
- `status`: enum of `in_training` (default), `complete`, `archived`
- `current_phase_id` (denormalized convenience pointer to the horse's current phase)

**Horse loses payment fields entirely.** `payment_method` and `payment_amount` are removed; trainers track that elsewhere.

**Sessions schema simplification:**
- Drop `week_id`, `engagement_id`, and rider association
- Keep `horse_id`, `phase_id`, `date`, `notes`, ratings
- Rating shape unchanged (per question, ±3 score, optional comment)

**Trifecta evaluation moves from `engagement_id` to `horse_id`.** One Trifecta per horse, finalized via the Finish flow.

### 2. Information architecture

**Bottom tabs (3 — down from 4):**
- **Today** — primary daily entry point
- **Horses** — full list including completed/archived
- **TQA Reference** — combines Phases curriculum, Resources library, and Foundation Doctrine into one tab with three sections

Settings remains in the header. The current "Progress" and "Report" tabs are removed (their functionality lives inside the Horse workspace).

### 3. Today (home screen)

Auto-routes based on count of `status = in_training` horses:

- **0 in-training horses** → empty state with a single CTA: "Add your first horse"
- **1 in-training horse** → renders the Horse workspace directly (skips a redundant picker step)
- **2+ in-training horses** → list of compact "Today cards," one per active horse:
  - Horse name + photo + owner name
  - Current phase badge (e.g., "Phase 2 — Liberty")
  - Last session date and 7-session average
  - Single button: "Log today's session" (opens the session entry pre-filled for that horse + current phase)
  - Tapping the card opens the full Horse workspace

Today never shows completed or archived horses — those live on the Horses tab.

### 4. Horse workspace (the core screen)

Single page, no inner-tab navigation. URL: `/horses/:id`.

**Sections, top to bottom:**

a. **Header:** Horse name, photo, owner name, arrival date ("Day 12 of 60-day program" — soft orientation, computed from `arrival_date + 60 days`, no enforcement).

b. **Phase progression strip:** Vertical list of all 5 phases with state icons:
- ✓ completed (collapsed by default; tap to expand its sessions list)
- ● current (always expanded; this is where the next action happens)
- · upcoming (collapsed; tap shows "Locked — finish [previous phase] first" + a "Start this phase early" link for the regression case)

Tapping a completed phase expands its session list. Tapping the current phase header collapses or expands details.

c. **Current phase card** (always expanded — the visual focal point):
- Phase name and number
- Phase running average (with color cue: green ≥ +2.0, neutral 0..+2.0, red < 0)
- Session count and last session date
- Primary CTA: **"Log today's session"** → opens session entry with phase auto-filled
- Secondary CTA: **"Advance to Phase X"** with soft gate:
  - If avg ≥ +2.0: button shows "Recommended" highlight; one tap advances
  - If avg < +2.0: tapping shows confirmation referencing TQA explicitly — *"This phase's average is +1.4, below the +2.0 TQA industry standard. Some horses need more time — that's a recordable outcome. Continue to Phase X?"* — and proceeds on confirm
- Sessions list for this phase, chronological newest-first, tap to view/edit

d. **Wrap-up:** Always-available **"Finish training"** button (full-width, distinct from the per-phase "Advance" action). Triggers the Finish flow (section 6).

e. **Edit details:** Collapsed accordion — owner name, owner contact, arrival date, notes. Trainer can update at any time.

f. **Danger actions:** Collapsed accordion — "Archive horse" and (for completed horses) "Re-open training."

### 5. Session entry simplifications

URL changes from `/engagements/:id/weeks/:weekId/sessions/new` to `/horses/:id/sessions/new`.

- **Phase auto-filled** to the horse's current phase. A small "Use a different phase" link reveals the dropdown for regression cases.
- **Date auto-filled** to today.
- **Rider field removed** entirely.
- **Week field removed** entirely.
- **Inline help on questions:** Each rating question shows a small (i) icon. Tapping reveals the question's description and any attached video inline (no navigation away). Replaces the in-flow need for the Phases or Resources pages.
- **Notes** field stays, attached to the session itself.

### 6. Finish training flow

Triggered by the "Finish training" button on the Horse workspace (always available — trainer decides when).

Three steps, dedicated full-screen flow:

**Step 1 — Trifecta:**
- All 15 items (8 Foundation + 4 Task Completion + 5 Temperament — pulled from existing TQA template) are pre-filled from the horse's session data using the existing suggestion logic in `TrifectaEvaluation.tsx`.
- Trainer reviews each item; can adjust score or comment inline.
- Single screen with three vertical sections (Foundation / Task Completion / Temperament). No tabs.
- "Save & continue" button at the bottom.

**Step 2 — Report:**
- Renders the existing PDF (the `EngagementReport` PDF component, renamed and adapted to read from the horse rather than an engagement). All current report sections preserved: horse metadata, sessions grouped by phase, per-question averages, training log, Trifecta summary.
- Single tap: **"Generate report"** → opens the PDF in the browser viewer with download/share options.

**Step 3 — Mark complete:**
- Horse status flips to `complete`.
- A success summary screen confirms: "[Horse Name]'s training is complete." with links to "View report again" and "Back to Today."
- Completed horses still appear on the Horses tab (filterable by status). The trainer can re-open the Trifecta or regenerate the report from the completed horse's page at any time.
- "Re-open training" action exists for the rare case the trainer marked complete in error (flips status back to `in_training`).

### 7. TQA Reference tab

Single tab combining the three current reference destinations. URL: `/reference`.

Three sub-sections (anchored on the same page or as light internal navigation):

- **Phases & Questions** — current `/phases` and `/phases/:id` content. Browseable curriculum with the 5 phases, their questions, and any attached videos.
- **Videos & Resources** — current `/resources` content. Library of videos and external links, organized by phase/question.
- **Foundation Doctrine** — current `/foundation` content. Reference doc on TQA principles.

Plus inline help in the session-entry flow (described in section 5) so the trainer rarely needs to open this tab during a session.

### 8. Removed surfaces (cleanup checklist)

These pages, components, and routes can be deleted entirely or merged:

- `src/pages/EngagementNew.tsx`
- `src/pages/EngagementDetail.tsx`
- `src/pages/Riders.tsx`
- `src/pages/PhasesList.tsx` (functionality moves into TQA Reference)
- `src/pages/PhaseDetail.tsx` (functionality moves into TQA Reference)
- `src/pages/Resources.tsx` (functionality moves into TQA Reference)
- `src/pages/FoundationDoctrine.tsx` (functionality moves into TQA Reference)
- `src/pages/Report.tsx` (folds into the Finish flow)
- `src/pages/Dashboard.tsx` (replaced by the new Today screen)
- The `weeks` table and `weeks_*` query helpers in `src/supabase/queries.ts`
- The `riders` table and `riders_*` query helpers
- The `engagements` table after migration
- All "engagement" string occurrences across pages and components (replace with "horse," "training," or remove)

### 9. Renamed surfaces

- "Now training: [Horse]" header chip → either remove (Today already shows the horse) or simplify to "[Horse] — Phase 2"
- "Training Quality Assurance — Engagement Report" PDF title → "Training Quality Assurance Report — [Horse Name]"
- "End-of-engagement evaluation" → "Final evaluation" or "Trifecta evaluation"

---

## Critical files to modify

- `src/App.tsx` — route table (remove engagement, week, rider routes; restructure horse routes)
- `src/components/AppShell.tsx` — bottom tabs (3 not 4); remove "active engagement" lookup
- `src/supabase/types.ts` — Horse adds fields; Engagement/Week/Rider types removed
- `src/supabase/queries.ts` — drop engagement/week/rider helpers; add horse-scoped session helpers
- `supabase/schema.sql` — schema migration (drop engagements/weeks/riders; add fields to horses)
- `src/pages/HorseDetail.tsx` — becomes the new Horse workspace (the core page)
- `src/pages/HorseNew.tsx` — simplified intake (horse name + owner name + optional contact + optional notes; arrival defaults today)
- `src/pages/HorsesList.tsx` — list filters by status
- `src/pages/SessionNew.tsx` — phase auto-fill, rider removed, inline help, week removed
- `src/pages/SessionDetail.tsx` — rider removed
- `src/components/TrifectaEvaluation.tsx` — moves into a Finish flow, reads from horse not engagement
- `src/features/pdf/Report.tsx` — reads from horse not engagement; rename
- New: `src/pages/Today.tsx` — replaces Dashboard
- New: `src/pages/Reference.tsx` — combines Phases + Resources + Foundation
- New: `src/pages/HorseFinish.tsx` (or a flow component) — the Finish wrap-up

## Reused existing functionality

- `src/components/TrifectaEvaluation.tsx` — the auto-suggestion logic from session averages already exists; reuse as the prefill engine for the Finish flow's Step 1.
- `src/features/pdf/Report.tsx` — the PDF rendering pipeline stays; only the data source changes (horse instead of engagement).
- `src/content/tqa-template.ts` — the 5 phases × 14 questions × ±3 scale template stays exactly as-is.
- `src/content/timeline.ts` — keep but correct the value to 8 weeks (TQA-aligned), used only for the soft "Day X of 60" header strip.
- `src/content/trifecta.ts` — the 15-item Trifecta template stays exactly as-is.
- The existing `useQuery` Supabase hook, React Hook Form patterns, and Zod validation patterns are reused throughout.
- The existing soft "advance suggestion" threshold logic on Dashboard (avg ≥ +2.0) gets relocated to the Horse workspace's current-phase card.

---

## Verification

End-to-end test plan, in order:

1. **Fresh install / first run:** Sign up, land on Today empty state, tap "Add your first horse," fill horse name + owner name, save → land on Horse workspace, see Phase Groundwork as current with a "Log today's session" CTA.
2. **Log a session:** Tap "Log today's session" → form has phase auto-filled to Groundwork, date auto-filled to today, no rider field, no week field. Rate a few questions, tap a (i) icon to confirm inline help shows. Save → return to Horse workspace, session appears under the current phase card.
3. **Advance with confirmation (soft gate, below threshold):** Log 3 sessions averaging +0.5 in Groundwork. Tap "Advance to Phase 1" → confirmation dialog mentions the TQA standard and the current average. Confirm → workspace shows Phase 1 as current, Groundwork as ✓ completed.
4. **Advance with recommendation (soft gate, above threshold):** Log enough sessions in Phase 1 to push the 7-session avg ≥ +2.0. Tap "Advance to Phase 2" → no confirmation, advances directly. Button styling shows "Recommended" pre-tap.
5. **Regression: log against a prior phase:** From the Horse workspace, expand the completed Groundwork phase and tap "Log session in Groundwork." Form opens with phase pre-filled to Groundwork (not the current phase). Save → session appears under Groundwork; horse remains in the current phase.
6. **Multiple active horses:** Add a second horse. Visit Today → see two cards. Tap one card's "Log today's session" → session entry opens for the right horse with that horse's current phase.
7. **Reference tab inline:** From session entry, tap (i) on a question → see the description and video inline. Visit TQA Reference tab separately → see the same content under Phases & Questions, plus Resources and Foundation sections.
8. **Finish flow:** From a horse's workspace, tap "Finish training." Step 1 Trifecta opens with all 15 items pre-filled with sensible values from session averages. Adjust one item, save & continue. Step 2 generates the PDF, which now says "Training Quality Assurance Report — [Horse Name]" and contains all sessions, per-phase averages, and the Trifecta. Step 3: success screen, horse status now `complete`. Verify the horse is no longer on Today, but appears under Horses with a "complete" badge.
9. **Re-open completed horse:** Visit a completed horse, expand "Danger actions," tap "Re-open training" → status flips to `in_training`, horse re-appears on Today.
10. **Bottom tab honesty:** Verify Today, Horses, and TQA Reference each route to a single deterministic destination — no "most recent X" logic.
11. **Type-check & build:** `npm run typecheck` and `npm run build` pass with no references to engagement, week, or rider types remaining.
12. **Database integrity:** Run the migration on a fresh Supabase project; confirm `engagements`, `weeks`, `riders` tables are dropped and `horses` has the new fields.

---

## Open follow-ups (out of scope here, capture for later)

- Multi-tenant: if the app ever supports multiple organizations sharing horses, this design assumes single-trainer scope (matches user's stated constraint).
- Cross-horse analytics ("how are my horses doing on average across Phase 2?") — possible future feature, not part of this sweep.
- Customizable phase timelines (different program lengths) — TQA's 8-week canonical is hard-coded; if trainers ever want 12-week programs, revisit.
- Re-introduce Riders if a team forms — the data model for it can return as a clean addition.
