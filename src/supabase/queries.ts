import { todayLocal } from "../utils/dates";
import { invalidate } from "./cache";
import { requireSupabase } from "./client";
import type {
  Horse,
  HorseStatus,
  ID,
  Phase,
  ProgramMeta,
  Question,
  Resource,
  Session,
  SessionWithRatings,
  TaskCompletion,
  TqaScore,
  TrainingType,
  TrifectaAxisDb,
  TrifectaEvaluation,
  TrifectaEvaluationWithScores,
  TrifectaScore,
} from "./types";

const sb = () => requireSupabase();

const throwIfError = <T>(res: { data: T | null; error: { message: string } | null }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
};

// Scores must be saved in one database transaction. Older databases require
// migration_programs.sql; never fall back to deleting/replacing scores in
// separate requests where a failed insert would destroy the previous record.
function requireAtomicSave(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === "PGRST202" || error.message.includes("Could not find the function")) {
    throw new Error("Saving is unavailable until the database is updated for atomic score saves. Your existing records have not been changed. Ask the app administrator to apply migration_programs.sql.");
  }
  throw new Error(error.message);
}

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

export async function listPhasesForProgram(
  program: TrainingType,
): Promise<Phase[]> {
  const res = await sb()
    .from("phases")
    .select("*")
    .eq("program", program)
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
  training_type?: TrainingType;
  program_meta?: ProgramMeta;
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
  const today = todayLocal();
  const trainingType: TrainingType = input.training_type ?? "foundation";
  // Start the horse on the first phase of its chosen program (Groundwork for
  // Foundation, the Performance Horse Warm-Up for the performance programs).
  const phases = await listPhasesForProgram(trainingType);
  const firstPhase = phases[0] ?? null;

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
      training_type: trainingType,
      program_meta: input.program_meta ?? {},
      current_phase_id: firstPhase?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(["horses"]);
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
      | "program_meta"
      | "training_type"
    >
  >,
): Promise<void> {
  const res = await sb().from("horses").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  invalidate(["horses"]);
  invalidate(["horse", id]);
}

// Switching a horse's program resets its current phase to that program's first
// phase (different programs have entirely different score sheets).
export async function setHorseTrainingType(
  id: ID,
  trainingType: TrainingType,
): Promise<void> {
  const phases = await listPhasesForProgram(trainingType);
  const firstPhase = phases[0] ?? null;
  const { error } = await sb()
    .from("horses")
    .update({ training_type: trainingType, current_phase_id: firstPhase?.id ?? null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidate(["horses"]);
  invalidate(["horse", id]);
}

export async function setHorseStatus(id: ID, status: HorseStatus): Promise<void> {
  const { error } = await sb()
    .from("horses")
    .update({ status })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  invalidate(["horses"]);
  invalidate(["horse", id]);
}

export async function setHorseCurrentPhase(id: ID, phaseId: ID): Promise<void> {
  const { error } = await sb()
    .from("horses")
    .update({ current_phase_id: phaseId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidate(["horses"]);
  invalidate(["horse", id]);
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
  invalidate(["horses"]);
  invalidate(["horse", id]);
  invalidate(["sessions", id]);
  invalidate(["sessions", "dates"]);
  invalidate(["ratings", id]);
  invalidate(["trifecta", id]);
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

// Lightweight feed for the Today dashboard: dates only, newest first.
export async function listSessionDates(): Promise<
  { id: ID; horse_id: ID; occurred_at: string }[]
> {
  const res = await sb()
    .from("sessions")
    .select("id, horse_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(500);
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
  rider?: string | null;
  bit?: string | null;
  task_completions?: TaskCompletion[];
  ratings: SessionRatingInput[];
}

export async function createSession(input: SessionInput): Promise<Session> {
  // Atomic path: one transaction so a malformed rating can't orphan a session.
  const { data, error } = await sb().rpc("create_session_with_ratings", {
    p_horse_id: input.horse_id,
    p_phase_id: input.phase_id,
    p_occurred_at: input.occurred_at,
    p_notes: input.notes ?? null,
    p_rider: input.rider ?? null,
    p_bit: input.bit ?? null,
    p_task_completions: input.task_completions ?? [],
    p_ratings: input.ratings,
  });
  requireAtomicSave(error);
  const session = data as Session;
  invalidate(["sessions", input.horse_id]);
  invalidate(["sessions", "dates"]);
  invalidate(["ratings", input.horse_id]);
  return session;
}

export interface SessionUpdateInput {
  horse_id?: ID;
  phase_id?: ID;
  occurred_at?: string;
  notes?: string | null;
  rider?: string | null;
  bit?: string | null;
  task_completions?: TaskCompletion[];
  ratings?: SessionRatingInput[];
}

export async function updateSession(
  id: ID,
  input: SessionUpdateInput,
): Promise<void> {
  // Atomic path: the session row plus its full rating set update in one
  // transaction. notes/rider/bit are always overwritten (the edit form sends
  // the complete current state); occurred_at/task_completions stay unchanged
  // when omitted. horse_id/phase_id aren't editable here, so they're not sent.
  const { error } = await sb().rpc("update_session_with_ratings", {
    p_session_id: id,
    p_occurred_at: input.occurred_at ?? null,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
    p_rider: input.rider?.trim() ? input.rider.trim() : null,
    p_bit: input.bit || null,
    p_task_completions: input.task_completions ?? null,
    p_ratings: input.ratings ?? null,
  });
  requireAtomicSave(error);
  invalidate(["session", id]);
  invalidate(["sessions"]);
  invalidate(["ratings"]);
}

export async function deleteSession(id: ID): Promise<void> {
  const res = await sb().from("sessions").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
  invalidate(["session", id]);
  invalidate(["sessions"]);
  invalidate(["ratings"]);
}

// ---------- Export helpers (all rows for the signed-in user) ----------

export async function listAllSessionsWithRatings(): Promise<SessionWithRatings[]> {
  const res = await sb()
    .from("sessions")
    .select("*, ratings(*)")
    .order("occurred_at", { ascending: true });
  return throwIfError(res) ?? [];
}

// ---------- Trifecta evaluations ----------

export async function getTrifectaForHorse(
  horseId: ID,
): Promise<{ evaluation: TrifectaEvaluation; scores: TrifectaScore[] } | null> {
  const { data: evaluation, error: evaluationError } = await sb()
    .from("trifecta_evaluations")
    .select("*")
    .eq("horse_id", horseId)
    .maybeSingle();
  if (evaluationError) throw new Error(evaluationError.message);
  if (!evaluation) return null;
  const { data: scores, error: scoresError } = await sb()
    .from("trifecta_scores")
    .select("*")
    .eq("evaluation_id", evaluation.id);
  if (scoresError) throw new Error(scoresError.message);
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

export interface TrifectaEvaluationInput {
  horse_id: ID;
  notes?: string | null;
  scores: TrifectaScoreInput[];
}

export async function upsertTrifectaEvaluation(
  input: TrifectaEvaluationInput,
): Promise<TrifectaEvaluation> {
  // Atomic path: evaluation upsert + score replacement in one transaction.
  const { data, error } = await sb().rpc("upsert_trifecta_with_scores", {
    p_horse_id: input.horse_id,
    p_notes: input.notes ?? null,
    p_scores: input.scores.map((s) => ({
      axis: s.axis,
      item_code: s.itemCode,
      item_text_snapshot: s.itemTextSnapshot,
      score: s.score,
      comment: s.comment?.trim() || null,
    })),
  });
  requireAtomicSave(error);
  const evaluation = data as TrifectaEvaluation;
  invalidate(["trifecta", input.horse_id]);
  return evaluation;
}

export async function deleteTrifectaEvaluation(id: ID): Promise<void> {
  const res = await sb().from("trifecta_evaluations").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function listAllTrifectas(): Promise<TrifectaEvaluationWithScores[]> {
  const res = await sb()
    .from("trifecta_evaluations")
    .select("*, trifecta_scores(*)");
  const rows = throwIfError(res) ?? [];
  return (rows as (TrifectaEvaluation & { trifecta_scores: TrifectaScore[] })[]).map(
    ({ trifecta_scores, ...evaluation }) => ({
      ...evaluation,
      scores: trifecta_scores ?? [],
    }),
  );
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
  const resource = throwIfError(res);
  invalidate(["resources"]);
  return resource;
}

export async function updateResource(
  id: ID,
  patch: Partial<Pick<Resource, "title" | "url" | "kind" | "notes" | "position">>,
): Promise<void> {
  const res = await sb().from("resources").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  invalidate(["resources"]);
}

export async function deleteResource(id: ID): Promise<void> {
  const res = await sb().from("resources").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
  invalidate(["resources"]);
}
