import { requireSupabase } from "./client";
import type {
  Horse,
  HorseStatus,
  ID,
  Phase,
  Question,
  Resource,
  Session,
  SessionWithRatings,
  TqaScore,
  TrifectaAxisDb,
  TrifectaEvaluation,
  TrifectaScore,
} from "./types";

const sb = () => requireSupabase();

const throwIfError = <T>(res: { data: T | null; error: { message: string } | null }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
};

async function currentUserId(): Promise<ID> {
  const userId = (await sb().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  return userId;
}

// ---------- Phases (canonical, read-only after seed) ----------

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

// ---------- Questions (canonical, read-only after seed) ----------

export async function listQuestionsForPhase(phaseId: ID): Promise<Question[]> {
  const res = await sb()
    .from("questions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("axis", { ascending: true })
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listAllQuestions(): Promise<Question[]> {
  const res = await sb()
    .from("questions")
    .select("*")
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getCanonicalPhasesAndQuestions(): Promise<{
  phases: Phase[];
  questions: Question[];
}> {
  const [phases, questions] = await Promise.all([listPhases(), listAllQuestions()]);
  return { phases, questions };
}

// ---------- Horses ----------

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

export async function listHorses(opts?: { statuses?: HorseStatus[] }): Promise<Horse[]> {
  let q = sb().from("horses").select("*");
  if (opts?.statuses) q = q.in("status", opts.statuses);
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Horse[];
}

export async function listInTrainingHorses(): Promise<Horse[]> {
  const { data, error } = await sb()
    .from("horses")
    .select("*")
    .eq("status", "in_training")
    .order("arrival_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Horse[];
}

export async function getHorse(id: ID): Promise<Horse | null> {
  const res = await sb().from("horses").select("*").eq("id", id).maybeSingle();
  return throwIfError(res);
}

export async function createHorse(input: HorseInput): Promise<Horse> {
  const userId = await currentUserId();
  const today = new Date().toISOString().slice(0, 10);
  const phases = await listPhases();
  const groundwork = phases.find((p) => p.code === "groundwork");

  const { data, error } = await sb()
    .from("horses")
    .insert({
      user_id: userId,
      name: input.name,
      owner_name: input.owner_name ?? null,
      owner_contact: input.owner_contact ?? null,
      arrival_date: input.arrival_date ?? today,
      notes: input.notes ?? null,
      breed: input.breed ?? null,
      dob: input.dob ?? null,
      sex: input.sex ?? null,
      color: input.color ?? null,
      status: "in_training",
      current_phase_id: groundwork?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Horse;
}

export async function updateHorse(
  id: ID,
  patch: Partial<
    Pick<
      Horse,
      | "name"
      | "breed"
      | "dob"
      | "sex"
      | "color"
      | "notes"
      | "owner_name"
      | "owner_contact"
      | "arrival_date"
      | "status"
      | "current_phase_id"
    >
  >,
): Promise<void> {
  const res = await sb().from("horses").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function setHorseStatus(id: ID, status: HorseStatus): Promise<void> {
  const { error } = await sb()
    .from("horses")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setHorseCurrentPhase(id: ID, phaseId: ID): Promise<void> {
  const { error } = await sb()
    .from("horses")
    .update({ current_phase_id: phaseId })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function archiveHorse(id: ID): Promise<void> {
  await setHorseStatus(id, "archived");
}

export async function unarchiveHorse(id: ID): Promise<void> {
  await setHorseStatus(id, "in_training");
}

export async function deleteHorse(id: ID): Promise<void> {
  const res = await sb().from("horses").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function listRatingsForHorse(
  horseId: ID,
): Promise<{ session_id: ID; phase_id: ID; score: number }[]> {
  const { data, error } = await sb()
    .from("ratings")
    .select("session_id, score, sessions!inner(phase_id, horse_id)")
    .eq("sessions.horse_id", horseId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    session_id: r.session_id,
    phase_id: r.sessions.phase_id,
    score: r.score,
  }));
}

// ---------- Sessions ----------

export async function listSessionsForHorse(
  horseId: ID,
): Promise<SessionWithRatings[]> {
  const res = await sb()
    .from("sessions")
    .select("*, ratings(*)")
    .eq("horse_id", horseId)
    .order("occurred_at", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getSession(id: ID): Promise<SessionWithRatings | null> {
  const res = await sb()
    .from("sessions")
    .select("*, ratings(*)")
    .eq("id", id)
    .maybeSingle();
  return throwIfError(res);
}

export interface SessionRatingInput {
  question_id: ID;
  axis: "foundation" | "temperament";
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
  const userId = await currentUserId();
  const { data: session, error } = await sb()
    .from("sessions")
    .insert({
      user_id: userId,
      horse_id: input.horse_id,
      phase_id: input.phase_id,
      occurred_at: input.occurred_at,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.ratings.length > 0) {
    const { error: rerr } = await sb()
      .from("ratings")
      .insert(
        input.ratings.map((r) => ({
          user_id: userId,
          session_id: session.id,
          question_id: r.question_id,
          axis_snapshot: r.axis,
          question_text_snapshot: r.question_text_snapshot,
          score: r.score,
          comment: r.comment ?? null,
        })),
      );
    if (rerr) throw new Error(rerr.message);
  }

  return session as Session;
}

export async function updateSession(
  id: ID,
  input: {
    horse_id?: ID;
    phase_id?: ID;
    occurred_at?: string;
    notes?: string | null;
    ratings?: SessionRatingInput[];
  },
): Promise<void> {
  const userId = await currentUserId();
  const patch: Record<string, unknown> = {};
  if (input.horse_id !== undefined) patch.horse_id = input.horse_id;
  if (input.phase_id !== undefined) patch.phase_id = input.phase_id;
  if (input.occurred_at !== undefined) patch.occurred_at = input.occurred_at;
  if (input.notes !== undefined)
    patch.notes = input.notes?.trim() ? input.notes.trim() : null;
  if (Object.keys(patch).length > 0) {
    const res = await sb().from("sessions").update(patch).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }
  if (input.ratings) {
    const del = await sb().from("ratings").delete().eq("session_id", id);
    if (del.error) throw new Error(del.error.message);
    if (input.ratings.length > 0) {
      const ratingRows = input.ratings.map((r) => ({
        user_id: userId,
        session_id: id,
        question_id: r.question_id,
        axis_snapshot: r.axis,
        question_text_snapshot: r.question_text_snapshot,
        score: r.score,
        comment: r.comment ?? null,
      }));
      const ratingRes = await sb().from("ratings").insert(ratingRows);
      if (ratingRes.error) throw new Error(ratingRes.error.message);
    }
  }
}

export async function deleteSession(id: ID): Promise<void> {
  const res = await sb().from("sessions").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Trifecta evaluations ----------

export async function getTrifectaForHorse(
  horseId: ID,
): Promise<{ evaluation: TrifectaEvaluation; scores: TrifectaScore[] } | null> {
  const { data: evaluation } = await sb()
    .from("trifecta_evaluations")
    .select("*")
    .eq("horse_id", horseId)
    .maybeSingle();
  if (!evaluation) return null;
  const { data: scores } = await sb()
    .from("trifecta_scores")
    .select("*")
    .eq("evaluation_id", evaluation.id);
  return {
    evaluation: evaluation as TrifectaEvaluation,
    scores: (scores ?? []) as TrifectaScore[],
  };
}

export interface TrifectaScoreInput {
  axis: TrifectaAxisDb;
  itemCode: string;
  itemTextSnapshot: string;
  score: TqaScore;
  comment?: string;
}

export async function upsertTrifectaEvaluation(input: {
  horse_id: ID;
  notes?: string | null;
  scores: TrifectaScoreInput[];
}): Promise<TrifectaEvaluation> {
  const userId = await currentUserId();
  const { data: evaluation, error } = await sb()
    .from("trifecta_evaluations")
    .upsert(
      {
        user_id: userId,
        horse_id: input.horse_id,
        notes: input.notes ?? null,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: "horse_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  await sb().from("trifecta_scores").delete().eq("evaluation_id", evaluation.id);
  if (input.scores.length > 0) {
    const { error: serr } = await sb()
      .from("trifecta_scores")
      .insert(
        input.scores.map((s) => ({
          user_id: userId,
          evaluation_id: evaluation.id,
          axis: s.axis,
          item_code: s.itemCode,
          item_text_snapshot: s.itemTextSnapshot,
          score: s.score,
          comment: s.comment?.trim() || null,
        })),
      );
    if (serr) throw new Error(serr.message);
  }
  return evaluation as TrifectaEvaluation;
}

export async function deleteTrifectaEvaluation(id: ID): Promise<void> {
  const res = await sb().from("trifecta_evaluations").delete().eq("id", id);
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
  const userId = await currentUserId();
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
