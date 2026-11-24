import { choiceScores, type TurnBinding, type VoiceScore } from "./voiceCommand";
import { captureFacilityScope } from "../../supabase/facilityScope";
import type { SessionInput } from "../../supabase/queries";

export interface RideDraft {
  id: string;
  facility_id: string;
  horse_id: string;
  phase_id: string;
  status: "draft" | "completed" | "discarded";
  version: number;
  session_id: string | null;
  occurred_at: string;
  notes: string | null;
  rider: string | null;
  bit: string | null;
  task_completions: NonNullable<SessionInput["task_completions"]>;
  stage_notes: Record<string, unknown>;
  ratings: SessionInput["ratings"];
  guided_question_ids: string[] | null;
  guided_cursor: number;
  active_voice_turn: string | null;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<RideDraft> {
  const scope = captureFacilityScope();
  const { data, error } = await scope.client().rpc(name, args).abortSignal(scope.signal);
  scope.assertCurrent();
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "string" || typeof data.version !== "number" || data.facility_id !== scope.id) {
    throw new Error("The ride draft response was unavailable.");
  }
  return data as RideDraft;
}

export const openDraft = (facility: string, horse: string, phase: string, request: string) =>
  rpc("create_ride_draft", {
    p_facility_id: facility, p_horse_id: horse, p_phase_id: phase, p_request_id: request,
  });

export const getDraft = (draft: string) => rpc("get_ride_draft", { p_draft_id: draft });

const versioned = (d: RideDraft, request: string) => ({
  p_draft_id: d.id, p_expected_version: d.version, p_request_id: request,
});

export const saveDraft = (d: RideDraft, request: string, input: SessionInput) =>
  rpc("save_ride_draft", {
    ...versioned(d, request), p_notes: input.notes ?? null, p_stage_notes: d.stage_notes ?? {},
    p_ratings: input.ratings.map(({ question_id, score, comment }) => ({ question_id, score, comment: comment ?? null })), p_occurred_at: input.occurred_at, p_rider: input.rider ?? null,
    p_bit: input.bit ?? null, p_task_completions: input.task_completions ?? [],
  });

export const closeDraft = (d: RideDraft, request: string, action: "finalize" | "discard") =>
  rpc(`${action}_ride_draft`, versioned(d, request));

export async function bindTurn(d: RideDraft, question: string, turn: string): Promise<TurnBinding> {
  const scope = captureFacilityScope();
  const { data, error } = await scope.client().rpc("bind_guided_turn", {
    p_draft_id: d.id, p_expected_version: d.version, p_question_id: question, p_turn_id: turn,
  }).abortSignal(scope.signal);
  scope.assertCurrent();
  const expected = { draft_id: d.id, version: d.version, question_id: question, turn_id: turn };
  if (error || !data || Object.entries(expected).some(([k,v]) => data[k] !== v)) throw new Error("Couldn't bind this question. Reload the saved draft.");
  return expected;
}
export const confirmGuidedScore = (d: RideDraft, proposal: VoiceScore, input: SessionInput) =>
  rpc("confirm_guided_score", {
    p_draft_id: d.id, p_expected_version: proposal.binding.version, p_turn_id: proposal.binding.turn_id,
    p_question_id: proposal.questionId, p_score: proposal.score,
    p_notes: input.notes ?? null, p_stage_notes: d.stage_notes ?? {},
    p_ratings: input.ratings.map(({ question_id, score, comment }) => ({ question_id, score, comment: comment ?? null })),
    p_occurred_at: input.occurred_at, p_rider: input.rider ?? null, p_bit: input.bit ?? null,
    p_task_completions: input.task_completions ?? [],
  });

export async function interpretTurn(binding: TurnBinding, answer: string | Blob, signal: AbortSignal) {
  const body = new FormData();
  for (const [key, value] of Object.entries(binding)) body.set(key, String(value));
  if (typeof answer === "string") body.set("answer", answer);
  else body.set("audio", answer, "turn");
  const scope = captureFacilityScope();
  const { data, error } = await scope.client().functions.invoke("transcribe-ride-turn", { body, signal: AbortSignal.any([signal, scope.signal]) });
  scope.assertCurrent();
  if (error || !data || Object.entries(binding).some(([k,v]) => data[k] !== v) || typeof data.transcript !== "string")
    throw new Error("I couldn't check that answer. Try again or pick a score.");
  if (typeof data.choice !== "string" || !(data.choice === "needs_clarification" || Object.hasOwn(choiceScores, data.choice)))
    throw new Error("The score was unavailable.");
  return { transcript: data.transcript as string, score: data.choice === "needs_clarification" ? null : choiceScores[data.choice] };
}
