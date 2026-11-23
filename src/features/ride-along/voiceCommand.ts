
import type { Phase } from "../../supabase/types";

const VOICE_PHASE = "phase_1";
export function isRideAlongPhase(phase: Phase) {
  return phase.program === "foundation" && phase.code === VOICE_PHASE && phase.scale === "tqa";
}
export interface TurnBinding { draft_id: string; question_id: string; version: number; turn_id: string }
export interface VoiceScore { questionId: string; label: string; score: number; binding: TurnBinding }
export const choiceScores: Record<string, number> = { minus_three: -3, minus_two: -2, minus_one: -1, zero: 0, plus_one: 1, plus_two: 2, plus_three: 3 };

export function scoreReadback(proposal: VoiceScore) {
  const value = ["zero", "one", "two", "three"][Math.abs(proposal.score)];
  const sign = proposal.score === 0 ? "" : proposal.score < 0 ? "minus " : "plus ";
  return `For ${proposal.label}, I have ${sign}${value}. Is that right?`;
}
