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

export async function transcribeTurn(draft: string, turn: string, clip: Blob, signal: AbortSignal) {
  const body = new FormData();
  body.set("draft_id", draft);
  body.set("turn_id", turn);
  body.set("audio", clip, "turn");
  const scope = captureFacilityScope();
  const { data, error } = await scope.client().functions.invoke("transcribe-ride-turn", { body, signal: AbortSignal.any([signal, scope.signal]) });
  scope.assertCurrent();
  if (error || data?.turn_id !== turn || typeof data?.transcript !== "string")
    throw new Error("Couldn't transcribe this clip. Try again or enter the score manually.");
  return data.transcript as string;
}
