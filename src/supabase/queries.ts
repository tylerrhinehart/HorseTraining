import { requireSupabase } from "./client";
import type {
  Horse,
  ID,
  Phase,
  Question,
  Rating,
  Resource,
  Score,
  TQA,
  TQAWithRatings,
} from "./types";

const sb = () => requireSupabase();

const throwIfError = <T>(res: { data: T | null; error: { message: string } | null }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
};

// ---------- Phases ----------

export async function listPhases(): Promise<Phase[]> {
  const res = await sb()
    .from("phases")
    .select("*")
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getPhase(id: ID): Promise<Phase | null> {
  const res = await sb().from("phases").select("*").eq("id", id).maybeSingle();
  return throwIfError(res);
}

export async function renamePhase(id: ID, name: string): Promise<void> {
  const res = await sb().from("phases").update({ name }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Questions ----------

export async function listQuestionsForPhase(
  phaseId: ID,
  includeDeleted = false,
): Promise<Question[]> {
  let q = sb().from("questions").select("*").eq("phase_id", phaseId);
  if (!includeDeleted) q = q.is("deleted_at", null);
  const res = await q.order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listAllQuestions(includeDeleted = false): Promise<Question[]> {
  let q = sb().from("questions").select("*");
  if (!includeDeleted) q = q.is("deleted_at", null);
  const res = await q.order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function createQuestion(input: {
  phaseId: ID;
  text: string;
}): Promise<Question> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  const existing = await listQuestionsForPhase(input.phaseId, true);
  const position =
    existing.reduce((max, q) => Math.max(max, q.position), -1) + 1;
  const res = await sb()
    .from("questions")
    .insert({
      user_id: userId,
      phase_id: input.phaseId,
      text: input.text.trim(),
      position,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function updateQuestion(
  id: ID,
  patch: Partial<Pick<Question, "text" | "position" | "active">>,
): Promise<void> {
  const res = await sb().from("questions").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function softDeleteQuestion(id: ID): Promise<void> {
  const res = await sb()
    .from("questions")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function reorderQuestions(orderedIds: ID[]): Promise<void> {
  // Supabase JS doesn't support batch updates with different values per row in
  // a single call without RPC, so issue parallel updates.
  await Promise.all(
    orderedIds.map((id, i) =>
      sb().from("questions").update({ position: i }).eq("id", id),
    ),
  );
}

// ---------- Horses ----------

export async function listHorses(includeArchived = false): Promise<Horse[]> {
  let q = sb().from("horses").select("*");
  if (!includeArchived) q = q.is("archived_at", null);
  const res = await q.order("created_at", { ascending: false });
  return throwIfError(res) ?? [];
}

export async function getHorse(id: ID): Promise<Horse | null> {
  const res = await sb().from("horses").select("*").eq("id", id).maybeSingle();
  return throwIfError(res);
}

export async function createHorse(input: {
  name: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  startDate?: string;
  notes?: string;
  currentPhaseId?: ID | null;
}): Promise<Horse> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  let phaseId = input.currentPhaseId ?? null;
  if (!phaseId) {
    const phases = await listPhases();
    phaseId = phases[0]?.id ?? null;
  }
  const res = await sb()
    .from("horses")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      breed: input.breed?.trim() || null,
      owner_name: input.ownerName?.trim() || null,
      owner_email: input.ownerEmail?.trim() || null,
      start_date: input.startDate || null,
      notes: input.notes?.trim() || null,
      current_phase_id: phaseId,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function updateHorse(
  id: ID,
  patch: Partial<
    Pick<
      Horse,
      | "name"
      | "breed"
      | "owner_name"
      | "owner_email"
      | "start_date"
      | "notes"
      | "current_phase_id"
    >
  >,
): Promise<void> {
  const res = await sb().from("horses").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function setHorsePhase(id: ID, phaseId: ID): Promise<void> {
  const res = await sb()
    .from("horses")
    .update({ current_phase_id: phaseId })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function archiveHorse(id: ID): Promise<void> {
  const res = await sb()
    .from("horses")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function unarchiveHorse(id: ID): Promise<void> {
  const res = await sb()
    .from("horses")
    .update({ archived_at: null })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteHorse(id: ID): Promise<void> {
  const res = await sb().from("horses").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- TQAs ----------

export async function listTQAsForHorse(horseId: ID): Promise<TQAWithRatings[]> {
  const res = await sb()
    .from("tqas")
    .select("*, ratings(*)")
    .eq("horse_id", horseId)
    .order("occurred_at", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getTQA(id: ID): Promise<TQAWithRatings | null> {
  const res = await sb()
    .from("tqas")
    .select("*, ratings(*)")
    .eq("id", id)
    .maybeSingle();
  return throwIfError(res);
}

export interface TQAInput {
  horseId: ID;
  phaseId: ID;
  occurredAt?: string; // ISO; defaults to now
  notes?: string;
  ratings: Array<{
    questionId: ID;
    questionTextSnapshot: string;
    score: Score;
    comment?: string;
  }>;
}

export async function createTQA(input: TQAInput): Promise<TQA> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  const tqaRes = await sb()
    .from("tqas")
    .insert({
      user_id: userId,
      horse_id: input.horseId,
      phase_id: input.phaseId,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();
  const tqa = throwIfError(tqaRes);
  if (input.ratings.length > 0) {
    const ratingRows = input.ratings.map((r) => ({
      user_id: userId,
      tqa_id: tqa.id,
      question_id: r.questionId,
      question_text_snapshot: r.questionTextSnapshot,
      score: r.score,
      comment: r.comment?.trim() || null,
    }));
    const ratingRes = await sb().from("ratings").insert(ratingRows);
    if (ratingRes.error) throw new Error(ratingRes.error.message);
  }
  return tqa;
}

export async function updateTQA(
  id: ID,
  input: {
    phaseId?: ID;
    occurredAt?: string;
    notes?: string | null;
    ratings?: Array<{
      questionId: ID;
      questionTextSnapshot: string;
      score: Score;
      comment?: string;
    }>;
  },
): Promise<void> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  const patch: Record<string, unknown> = {};
  if (input.phaseId !== undefined) patch.phase_id = input.phaseId;
  if (input.occurredAt !== undefined) patch.occurred_at = input.occurredAt;
  if (input.notes !== undefined)
    patch.notes = input.notes?.trim() ? input.notes.trim() : null;
  if (Object.keys(patch).length > 0) {
    const res = await sb().from("tqas").update(patch).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }
  if (input.ratings) {
    // Replace ratings for this TQA atomically-ish: delete then insert.
    const del = await sb().from("ratings").delete().eq("tqa_id", id);
    if (del.error) throw new Error(del.error.message);
    if (input.ratings.length > 0) {
      const ratingRows = input.ratings.map((r) => ({
        user_id: userId,
        tqa_id: id,
        question_id: r.questionId,
        question_text_snapshot: r.questionTextSnapshot,
        score: r.score,
        comment: r.comment?.trim() || null,
      }));
      const ratingRes = await sb().from("ratings").insert(ratingRows);
      if (ratingRes.error) throw new Error(ratingRes.error.message);
    }
  }
}

export async function deleteTQA(id: ID): Promise<void> {
  const res = await sb().from("tqas").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Resources ----------

export async function listResourcesForPhase(phaseId: ID): Promise<Resource[]> {
  const res = await sb()
    .from("resources")
    .select("*")
    .eq("phase_id", phaseId)
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listResourcesForQuestion(questionId: ID): Promise<Resource[]> {
  const res = await sb()
    .from("resources")
    .select("*")
    .eq("question_id", questionId)
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function createResource(input: {
  phaseId?: ID;
  questionId?: ID;
  title: string;
  url: string;
  kind: "youtube" | "link";
  notes?: string;
}): Promise<Resource> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  if ((!input.phaseId && !input.questionId) || (input.phaseId && input.questionId)) {
    throw new Error("Resource must target exactly one of phase or question");
  }
  const res = await sb()
    .from("resources")
    .insert({
      user_id: userId,
      phase_id: input.phaseId ?? null,
      question_id: input.questionId ?? null,
      title: input.title.trim(),
      url: input.url.trim(),
      kind: input.kind,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function updateResource(
  id: ID,
  patch: Partial<Pick<Resource, "title" | "url" | "kind" | "notes" | "position">>,
): Promise<void> {
  const res = await sb().from("resources").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteResource(id: ID): Promise<void> {
  const res = await sb().from("resources").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// Helpers re-exported for convenience.
export type { Horse, ID, Phase, Question, Rating, Resource, TQA, TQAWithRatings };
