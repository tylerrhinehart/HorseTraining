import type { DraftRating } from "../components/PhaseScoreSheet";
import type { Question } from "../supabase/types";

export function hasEntries(drafts: Record<string, DraftRating>) {
  return Object.values(drafts).some(draft => draft.score != null || draft.comment?.trim());
}

// When a sheet changes, retain the old observations as labeled ride notes.
// Otherwise only standalone comments need moving; scored comments stay on their question.
export function prepareRideEntries(questions: Question[], drafts: Record<string, DraftRating>, notes: string, archivePhase?: string) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const observations: string[] = [];
  const ratings = [];
  for (const [id, draft] of Object.entries(drafts)) {
    const comment = draft.comment?.trim();
    if (draft.score == null && !comment) continue;
    const q = byId.get(id);
    if (!q) throw new Error("An entered question is missing from this sheet. Reload the sheet before saving.");
    if (archivePhase || draft.score == null) {
      const score = draft.score == null ? "" : ` (score ${draft.score})`;
      observations.push(`${q.text}${score}${comment ? ` — ${comment}` : ""}`);
    } else {
      ratings.push({ question_id: id, axis: q.axis, question_text_snapshot: q.text, score: draft.score, comment: comment ?? null });
    }
  }
  const heading = archivePhase ? `Previous sheet · ${archivePhase}` : "Unscored observations";
  const noteBlock = observations.length ? [heading, ...observations].join("\n") : "";
  return { ratings, notes: [notes, noteBlock].filter(Boolean).join("\n\n") };
}
