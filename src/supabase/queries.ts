import { requireSupabase } from "./client";
import type {
  Axis,
  Engagement,
  Horse,
  ID,
  Phase,
  Question,
  Resource,
  Rider,
  Session,
  SessionWithRatings,
  TqaScore,
  TrifectaAxisDb,
  TrifectaEvaluation,
  TrifectaEvaluationWithScores,
  Week,
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

// ---------- Riders ----------

export async function listRiders(includeArchived = false): Promise<Rider[]> {
  let q = sb().from("riders").select("*");
  if (!includeArchived) q = q.is("archived_at", null);
  const res = await q.order("created_at", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function createRider(input: {
  name: string;
  role?: string;
}): Promise<Rider> {
  const userId = await currentUserId();
  const res = await sb()
    .from("riders")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      role: input.role?.trim() || null,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function updateRider(
  id: ID,
  patch: Partial<Pick<Rider, "name" | "role">>,
): Promise<void> {
  const res = await sb().from("riders").update(patch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function archiveRider(id: ID): Promise<void> {
  const res = await sb()
    .from("riders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function unarchiveRider(id: ID): Promise<void> {
  const res = await sb().from("riders").update({ archived_at: null }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteRider(id: ID): Promise<void> {
  const res = await sb().from("riders").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
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
  dob?: string;
  sex?: string;
  color?: string;
  notes?: string;
}): Promise<Horse> {
  const userId = await currentUserId();
  const res = await sb()
    .from("horses")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      breed: input.breed?.trim() || null,
      dob: input.dob || null,
      sex: input.sex?.trim() || null,
      color: input.color?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function updateHorse(
  id: ID,
  patch: Partial<
    Pick<Horse, "name" | "breed" | "dob" | "sex" | "color" | "notes">
  >,
): Promise<void> {
  const res = await sb().from("horses").update(patch).eq("id", id);
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
  const res = await sb().from("horses").update({ archived_at: null }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteHorse(id: ID): Promise<void> {
  const res = await sb().from("horses").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Engagements ----------

export async function listEngagementsForHorse(horseId: ID): Promise<Engagement[]> {
  const res = await sb()
    .from("engagements")
    .select("*")
    .eq("horse_id", horseId)
    .order("arrival_date", { ascending: false, nullsFirst: false });
  return throwIfError(res) ?? [];
}

export async function listEngagements(includeArchived = false): Promise<Engagement[]> {
  let q = sb().from("engagements").select("*");
  if (!includeArchived) q = q.is("archived_at", null);
  const res = await q.order("arrival_date", { ascending: false, nullsFirst: false });
  return throwIfError(res) ?? [];
}

export async function getEngagement(id: ID): Promise<Engagement | null> {
  const res = await sb()
    .from("engagements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return throwIfError(res);
}

export interface EngagementInput {
  horseId: ID;
  ownerName?: string;
  ownerInfo?: string;
  ownerEmail?: string;
  paymentMethod?: string;
  paymentAmount?: number | null;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
  initialWeeks?: number; // create N empty weeks alongside the engagement
}

export async function createEngagement(input: EngagementInput): Promise<Engagement> {
  const userId = await currentUserId();
  const res = await sb()
    .from("engagements")
    .insert({
      user_id: userId,
      horse_id: input.horseId,
      owner_name: input.ownerName?.trim() || null,
      owner_info: input.ownerInfo?.trim() || null,
      owner_email: input.ownerEmail?.trim() || null,
      payment_method: input.paymentMethod?.trim() || null,
      payment_amount: input.paymentAmount ?? null,
      arrival_date: input.arrivalDate || null,
      departure_date: input.departureDate || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();
  const engagement = throwIfError(res);
  if (input.initialWeeks && input.initialWeeks > 0) {
    const rows = Array.from({ length: input.initialWeeks }, (_, i) => ({
      user_id: userId,
      engagement_id: engagement.id,
      week_number: i + 1,
      comments: null,
    }));
    const wRes = await sb().from("weeks").insert(rows);
    if (wRes.error) throw new Error(wRes.error.message);
  }
  return engagement;
}

export async function updateEngagement(
  id: ID,
  patch: Partial<{
    ownerName: string | null;
    ownerInfo: string | null;
    ownerEmail: string | null;
    paymentMethod: string | null;
    paymentAmount: number | null;
    arrivalDate: string | null;
    departureDate: string | null;
    notes: string | null;
  }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.ownerName !== undefined) dbPatch.owner_name = patch.ownerName;
  if (patch.ownerInfo !== undefined) dbPatch.owner_info = patch.ownerInfo;
  if (patch.ownerEmail !== undefined) dbPatch.owner_email = patch.ownerEmail;
  if (patch.paymentMethod !== undefined) dbPatch.payment_method = patch.paymentMethod;
  if (patch.paymentAmount !== undefined) dbPatch.payment_amount = patch.paymentAmount;
  if (patch.arrivalDate !== undefined) dbPatch.arrival_date = patch.arrivalDate;
  if (patch.departureDate !== undefined) dbPatch.departure_date = patch.departureDate;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (Object.keys(dbPatch).length === 0) return;
  const res = await sb().from("engagements").update(dbPatch).eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function archiveEngagement(id: ID): Promise<void> {
  const res = await sb()
    .from("engagements")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteEngagement(id: ID): Promise<void> {
  const res = await sb().from("engagements").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Weeks ----------

export async function listWeeksForEngagement(engagementId: ID): Promise<Week[]> {
  const res = await sb()
    .from("weeks")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("week_number", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function getWeek(id: ID): Promise<Week | null> {
  const res = await sb().from("weeks").select("*").eq("id", id).maybeSingle();
  return throwIfError(res);
}

export async function createWeek(input: {
  engagementId: ID;
  weekNumber: number;
  comments?: string;
}): Promise<Week> {
  const userId = await currentUserId();
  const res = await sb()
    .from("weeks")
    .insert({
      user_id: userId,
      engagement_id: input.engagementId,
      week_number: input.weekNumber,
      comments: input.comments?.trim() || null,
    })
    .select()
    .single();
  return throwIfError(res);
}

export async function appendWeek(engagementId: ID): Promise<Week> {
  const existing = await listWeeksForEngagement(engagementId);
  const next = existing.reduce((m, w) => Math.max(m, w.week_number), 0) + 1;
  return createWeek({ engagementId, weekNumber: next });
}

export async function updateWeekComments(
  id: ID,
  comments: string | null,
): Promise<void> {
  const res = await sb()
    .from("weeks")
    .update({ comments: comments?.trim() ? comments.trim() : null })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteWeek(id: ID): Promise<void> {
  const res = await sb().from("weeks").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Sessions ----------

export async function listSessionsForEngagement(
  engagementId: ID,
): Promise<SessionWithRatings[]> {
  const res = await sb()
    .from("sessions")
    .select("*, ratings(*)")
    .eq("engagement_id", engagementId)
    .order("occurred_at", { ascending: true });
  return throwIfError(res) ?? [];
}

export async function listSessionsForWeek(
  weekId: ID,
): Promise<SessionWithRatings[]> {
  const res = await sb()
    .from("sessions")
    .select("*, ratings(*)")
    .eq("week_id", weekId)
    .order("session_number", { ascending: true, nullsFirst: false });
  return throwIfError(res) ?? [];
}

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
  questionId: ID;
  axis: Axis;
  questionTextSnapshot: string;
  score: TqaScore;
  comment?: string;
}

export interface SessionInput {
  engagementId: ID;
  weekId: ID;
  horseId: ID;
  phaseId: ID;
  riderId?: ID | null;
  occurredAt?: string;
  sessionNumber?: number;
  notes?: string;
  ratings: SessionRatingInput[];
}

export async function createSession(input: SessionInput): Promise<Session> {
  const userId = await currentUserId();
  const sessionRes = await sb()
    .from("sessions")
    .insert({
      user_id: userId,
      engagement_id: input.engagementId,
      week_id: input.weekId,
      horse_id: input.horseId,
      phase_id: input.phaseId,
      rider_id: input.riderId ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      session_number: input.sessionNumber ?? null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();
  const session = throwIfError(sessionRes);
  if (input.ratings.length > 0) {
    const ratingRows = input.ratings.map((r) => ({
      user_id: userId,
      session_id: session.id,
      question_id: r.questionId,
      axis_snapshot: r.axis,
      question_text_snapshot: r.questionTextSnapshot,
      score: r.score,
      comment: r.comment?.trim() || null,
    }));
    const ratingRes = await sb().from("ratings").insert(ratingRows);
    if (ratingRes.error) throw new Error(ratingRes.error.message);
  }
  return session;
}

export async function updateSession(
  id: ID,
  input: {
    phaseId?: ID;
    riderId?: ID | null;
    occurredAt?: string;
    sessionNumber?: number | null;
    notes?: string | null;
    ratings?: SessionRatingInput[];
  },
): Promise<void> {
  const userId = await currentUserId();
  const patch: Record<string, unknown> = {};
  if (input.phaseId !== undefined) patch.phase_id = input.phaseId;
  if (input.riderId !== undefined) patch.rider_id = input.riderId;
  if (input.occurredAt !== undefined) patch.occurred_at = input.occurredAt;
  if (input.sessionNumber !== undefined) patch.session_number = input.sessionNumber;
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
        question_id: r.questionId,
        axis_snapshot: r.axis,
        question_text_snapshot: r.questionTextSnapshot,
        score: r.score,
        comment: r.comment?.trim() || null,
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

export async function getTrifectaForEngagement(
  engagementId: ID,
): Promise<TrifectaEvaluationWithScores | null> {
  const res = await sb()
    .from("trifecta_evaluations")
    .select("*, scores:trifecta_scores(*)")
    .eq("engagement_id", engagementId)
    .maybeSingle();
  return throwIfError(res);
}

export interface TrifectaScoreInput {
  axis: TrifectaAxisDb;
  itemCode: string;
  itemTextSnapshot: string;
  score: TqaScore;
  comment?: string;
}

export async function upsertTrifectaEvaluation(input: {
  engagementId: ID;
  evaluatedAt?: string;
  notes?: string | null;
  scores: TrifectaScoreInput[];
}): Promise<TrifectaEvaluation> {
  const userId = await currentUserId();
  const existing = await getTrifectaForEngagement(input.engagementId);
  let evaluation: TrifectaEvaluation;
  if (existing) {
    const upd = await sb()
      .from("trifecta_evaluations")
      .update({
        evaluated_at: input.evaluatedAt ?? existing.evaluated_at,
        notes: input.notes ?? null,
      })
      .eq("id", existing.id)
      .select()
      .single();
    evaluation = throwIfError(upd);
  } else {
    const ins = await sb()
      .from("trifecta_evaluations")
      .insert({
        user_id: userId,
        engagement_id: input.engagementId,
        evaluated_at: input.evaluatedAt ?? new Date().toISOString(),
        notes: input.notes ?? null,
      })
      .select()
      .single();
    evaluation = throwIfError(ins);
  }
  const del = await sb()
    .from("trifecta_scores")
    .delete()
    .eq("evaluation_id", evaluation.id);
  if (del.error) throw new Error(del.error.message);
  if (input.scores.length > 0) {
    const rows = input.scores.map((s) => ({
      user_id: userId,
      evaluation_id: evaluation.id,
      axis: s.axis,
      item_code: s.itemCode,
      item_text_snapshot: s.itemTextSnapshot,
      score: s.score,
      comment: s.comment?.trim() || null,
    }));
    const ins = await sb().from("trifecta_scores").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }
  return evaluation;
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
