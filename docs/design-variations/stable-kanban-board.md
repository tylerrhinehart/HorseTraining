# Stable Kanban Board

Phase-based kanban board that organizes horses by training stage instead of a normal list.

## What is intentionally different
- Replaces the normal shared top/bottom app shell with a concept-specific navigation model.
- Reorganizes the Today experience around a different mental model, not just a palette change.
- Uses different components and information architecture: side rails, boards, inspectors, kiosks, timelines, or mobile action trays depending on the concept.
- Preserves underlying routes, auth, Supabase queries, and existing horse/session behavior so the PR is still reviewable as an isolated UX concept.

## Files changed
- `src/components/AppShell.tsx`
- `src/pages/Today.tsx`
- `src/index.css`
