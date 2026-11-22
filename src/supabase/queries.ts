import { todayLocal } from "../utils/dates";
import { invalidate } from "./cache";
import { captureFacilityScope } from "./facilityScope";
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

async function currentUserId(scope: ReturnType<typeof captureFacilityScope>): Promise<ID> {
  const userId = (await scope.client().auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");
  return userId;
}

// ---------- Phases (canonical, read-only after seed) ----------

export async function listPhases(): Promise<Phase[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("phases")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listPhasesForProgram(
  program: TrainingType,
): Promise<Phase[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("phases")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("program", program)
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getPhase(id: ID): Promise<Phase | null> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("phases").select("*").eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id).maybeSingle();
  return throwIfError(res);
}

// ---------- Questions (canonical, read-only after seed) ----------

// Older accounts have the original single-job instruction in their seeded questions.
function currentQuestionText(question: Question): Question {
  if (question.text === 'Task Completion — Pick One Job From the "Task Completion" Sheet') {
    return { ...question, text: "Task Completion — Select the jobs and phases worked today" };
  }
  return question;
}

export async function listQuestionsForPhase(phaseId: ID): Promise<Question[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("questions")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("phase_id", phaseId)
    .order("axis", { ascending: true })
    .order("position", { ascending: true });
  return (throwIfError(res) ?? []).map(currentQuestionText);
}

export async function listAllQuestions(): Promise<Question[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("questions")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .order("position", { ascending: true });
  return (throwIfError(res) ?? []).map(currentQuestionText);
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
  const scope = captureFacilityScope();
  let q = scope.client().from("horses").select("*").eq("facility_id", scope.id).abortSignal(scope.signal);
  if (opts?.statuses) q = q.in("status", opts.statuses);
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Horse[];
}

export async function listInTrainingHorses(): Promise<Horse[]> {
  const scope = captureFacilityScope();
  const { data, error } = await scope.client()
    .from("horses")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("status", "in_training")
    .order("arrival_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Horse[];
}

export async function getHorse(id: ID): Promise<Horse | null> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("horses").select("*").eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id).maybeSingle();
  return throwIfError(res);
}

export async function createHorse(input: HorseInput): Promise<Horse> {
  const scope = captureFacilityScope();
  const userId = await currentUserId(scope);
  scope.assertCurrent();
  const today = todayLocal();
  const trainingType: TrainingType = input.training_type ?? "foundation";
  // Start the horse on the first phase of its chosen program (Groundwork for
  // Foundation, the Performance Horse Warm-Up for the performance programs).
  const phases = await listPhasesForProgram(trainingType);
  const firstPhase = phases[0] ?? null;

  const { data, error } = await scope.client()
    .from("horses")
    .insert({
      user_id: userId,
      facility_id: scope.id,
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
    .select().eq("facility_id", scope.id).abortSignal(scope.signal)
    .single();
  if (error) throw new Error(error.message);
  scope.assertCurrent();
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
  expectedUpdatedAt?: string,
): Promise<void> {
  const scope = captureFacilityScope();
  let query = scope.client().from("horses").update(patch).eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const res = await query.select("id").eq("facility_id", scope.id).abortSignal(scope.signal).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) {
    scope.assertCurrent();
    invalidate(["horse", id]);
    throw new Error("This horse changed or is unavailable. Review the latest details and retry.");
  }
  scope.assertCurrent();
  invalidate(["horses"]);
  invalidate(["horse", id]);
}

// Switching a horse's program resets its current phase to that program's first
// phase (different programs have entirely different score sheets).
export async function setHorseTrainingType(
  id: ID,
  trainingType: TrainingType,
): Promise<void> {
  const scope = captureFacilityScope();
  const phases = await listPhasesForProgram(trainingType);
  const firstPhase = phases[0] ?? null;
  const { error } = await scope.client()
    .from("horses")
    .update({ training_type: trainingType, current_phase_id: firstPhase?.id ?? null }).eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("id", id);
  if (error) throw new Error(error.message);
  scope.assertCurrent();
  invalidate(["horses"]);
  invalidate(["horse", id]);
}

export async function setHorseStatus(id: ID, status: HorseStatus): Promise<void> {
  const scope = captureFacilityScope();
  const { error } = await scope.client()
    .from("horses")
    .update({ status }).eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("id", id)
    .select("id").eq("facility_id", scope.id).abortSignal(scope.signal)
    .single();
  if (error) throw new Error(error.message);
  scope.assertCurrent();
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
  const scope = captureFacilityScope();
  const res = await scope.client().from("horses").delete().eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  scope.assertCurrent();
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
  const scope = captureFacilityScope();
  const { data, error } = await scope.client()
    .from("ratings")
    .select("session_id, score, sessions!inner(phase_id, horse_id)").eq("facility_id", scope.id).abortSignal(scope.signal)
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
  const scope = captureFacilityScope();
  // A discipline's most recent ride can be on any page of the horse's history.
  const rides: SessionWithRatings[] = [];
  const pageSize = 500;
  for (;;) {
    const res = await scope.client()
      .from("sessions")
      .select("*, ratings(*)").eq("facility_id", scope.id).abortSignal(scope.signal)
      .eq("horse_id", horseId)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(rides.length, rides.length + pageSize - 1);
    const page = throwIfError(res) ?? [];
    rides.push(...page);
    if (page.length < pageSize) return rides;
  }
}

// Shared roster feed. Include every page so infrequently ridden horses still have a last-worked summary.
export async function listSessionDates() {
  const scope = captureFacilityScope();
  const rows: Pick<Session, "id" | "horse_id" | "occurred_at" | "task_completions">[] = [];
  const pageSize = 500;
  for (;;) {
    const res = await scope.client().from("sessions").select("id, horse_id, occurred_at, task_completions").eq("facility_id", scope.id).abortSignal(scope.signal)
      .order("occurred_at", {ascending:false}).order("created_at", {ascending:false}).order("id", {ascending:false})
      .range(rows.length, rows.length + pageSize - 1);
    const page = throwIfError(res) ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function getSession(id: ID): Promise<SessionWithRatings | null> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("sessions")
    .select("*, ratings(*)").eq("facility_id", scope.id).abortSignal(scope.signal)
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
  const scope = captureFacilityScope();
  if (!await getHorse(input.horse_id)) throw new Error("Horse unavailable in this facility.");
  scope.assertCurrent();
  // Atomic path: one transaction so a malformed rating can't orphan a session.
  const { data, error } = await scope.client().rpc("create_session_with_ratings", {
    p_horse_id: input.horse_id,
    p_phase_id: input.phase_id,
    p_occurred_at: input.occurred_at,
    p_notes: input.notes ?? null,
    p_rider: input.rider ?? null,
    p_bit: input.bit ?? null,
    p_task_completions: input.task_completions ?? [],
    p_ratings: input.ratings,
  }).abortSignal(scope.signal);
  scope.assertCurrent();
  requireAtomicSave(error);
  const session = data as Session;
  invalidate(["sessions", input.horse_id]);
  invalidate(["sessions", "dates"]);
  invalidate(["ratings", input.horse_id]);
  return session;
}

export interface SessionUpdateInput {
  expectedUpdatedAt?: string;
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
  const scope = captureFacilityScope();
  if (input.phase_id && !input.expectedUpdatedAt) throw new Error("Reload the ride before changing its phase.");
  if (!await getSession(id)) throw new Error("Ride unavailable in this facility.");
  scope.assertCurrent();
  const versioned = !!input.expectedUpdatedAt;
  const { error } = await scope.client().rpc(versioned ? "update_ride_record" : "update_session_with_ratings", {
    ...(versioned ? { p_expected_updated_at: input.expectedUpdatedAt, p_phase_id: input.phase_id ?? null } : {}),
    p_session_id: id,
    p_occurred_at: input.occurred_at ?? null,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
    p_rider: input.rider?.trim() ? input.rider.trim() : null,
    p_bit: input.bit || null,
    p_task_completions: input.task_completions ?? null,
    p_ratings: input.ratings ?? null,
  }).abortSignal(scope.signal);
  if (versioned && error?.code === "PGRST202") throw new Error("Ride edits require the ride accuracy database update (migration_ride_accuracy.sql). Your edits are still here.");
  scope.assertCurrent();
  requireAtomicSave(error);
  invalidate(["session", id]);
  invalidate(["sessions"]);
  invalidate(["ratings"]);
}

export async function deleteSession(id: ID): Promise<void> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("sessions").delete().eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  scope.assertCurrent();
  invalidate(["session", id]);
  invalidate(["sessions"]);
  invalidate(["ratings"]);
}

// ---------- Export helpers (all rows for the signed-in user) ----------

export async function listAllSessionsWithRatings(): Promise<SessionWithRatings[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("sessions")
    .select("*, ratings(*)").eq("facility_id", scope.id).abortSignal(scope.signal)
    .order("occurred_at", { ascending: true });
  return throwIfError(res) ?? [];
}

// ---------- Trifecta evaluations ----------

export async function getTrifectaForHorse(
  horseId: ID,
): Promise<{ evaluation: TrifectaEvaluation; scores: TrifectaScore[] } | null> {
  const scope = captureFacilityScope();
  const { data: evaluation, error: evaluationError } = await scope.client()
    .from("trifecta_evaluations")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("horse_id", horseId)
    .maybeSingle();
  if (evaluationError) throw new Error(evaluationError.message);
  if (!evaluation) return null;
  const { data: scores, error: scoresError } = await scope.client()
    .from("trifecta_scores")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
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
  const scope = captureFacilityScope();
  if (!await getHorse(input.horse_id)) throw new Error("Horse unavailable in this facility.");
  scope.assertCurrent();
  // Atomic path: evaluation upsert + score replacement in one transaction.
  const { data, error } = await scope.client().rpc("upsert_trifecta_with_scores", {
    p_horse_id: input.horse_id,
    p_notes: input.notes ?? null,
    p_scores: input.scores.map((s) => ({
      axis: s.axis,
      item_code: s.itemCode,
      item_text_snapshot: s.itemTextSnapshot,
      score: s.score,
      comment: s.comment?.trim() || null,
    })),
  }).abortSignal(scope.signal);
  scope.assertCurrent();
  requireAtomicSave(error);
  const evaluation = data as TrifectaEvaluation;
  invalidate(["trifecta", input.horse_id]);
  return evaluation;
}

export async function deleteTrifectaEvaluation(id: ID): Promise<void> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("trifecta_evaluations").delete().eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function listAllTrifectas(): Promise<TrifectaEvaluationWithScores[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("trifecta_evaluations")
    .select("*, trifecta_scores(*)").eq("facility_id", scope.id).abortSignal(scope.signal);
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
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("resources")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
    .eq("phase_id", phaseId)
    .order("position", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listResourcesForQuestion(questionId: ID): Promise<Resource[]> {
  const scope = captureFacilityScope();
  const res = await scope.client()
    .from("resources")
    .select("*").eq("facility_id", scope.id).abortSignal(scope.signal)
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
  const scope = captureFacilityScope();
  const userId = await currentUserId(scope);
  if ((!input.phaseId && !input.questionId) || (input.phaseId && input.questionId)) {
    throw new Error("Resource must target exactly one of phase or question");
  }
  const res = await scope.client()
    .from("resources")
    .insert({
      user_id: userId,
      facility_id: scope.id,
      phase_id: input.phaseId ?? null,
      question_id: input.questionId ?? null,
      title: input.title.trim(),
      url: input.url.trim(),
      kind: input.kind,
      notes: input.notes?.trim() || null,
    })
    .select().eq("facility_id", scope.id).abortSignal(scope.signal)
    .single();
  const resource = throwIfError(res);
  scope.assertCurrent();
  invalidate(["resources"]);
  return resource;
}

export async function updateResource(
  id: ID,
  patch: Partial<Pick<Resource, "title" | "url" | "kind" | "notes" | "position">>,
): Promise<void> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("resources").update(patch).eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  scope.assertCurrent();
  invalidate(["resources"]);
}

export async function deleteResource(id: ID): Promise<void> {
  const scope = captureFacilityScope();
  const res = await scope.client().from("resources").delete().eq("facility_id", scope.id).abortSignal(scope.signal).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  scope.assertCurrent();
  invalidate(["resources"]);
}
