// Exact canonical Foundation Phase 1 labels. Keep any custom or historical
// rubric wording in the app instead of sending it to a speech provider.
const questionPrompts = new Map([
  ["Good to Catch (Review Groundwork)", "How did your horse do when you went to catch them?"],
  ["Stand to Saddle and Accept Bridle", "How did your horse stand for saddling and accept the bridle?"],
  ["Horizontal Direction & Stage 1 (on the ground, in and away from you)", "How was your horse’s horizontal direction and Stage 1 on the ground, in and away from you?"],
  ["Horizontal Direction & Stage 1 (on their side and on their back)", "How was your horse’s horizontal direction and Stage 1 on their side and on their back?"],
  ["Stand to Get On", "How well did your horse stand while you got on?"],
  ["Doubling Walking, Trotting and Loping (revelation w/in 3 steps from initial cue)", "How did your horse do doubling at the walk, trot, and lope within three steps of the initial cue?"],
  ["Move Out Soft In a Lope", "How softly did your horse move out in a lope?"],
  ["Stage 2 w/ Willing Submission (standing)", "How was your horse’s Stage 2 with willing submission while standing?"],
  ["Self-preservation (fight or flight)", "How strong was your horse’s fight-or-flight response?"],
  ["Confidence", "How confident was your horse?"],
  ["Energy (motivation and determination)", "How was your horse’s energy and motivation?"],
  ["Sensitivity (response to light pressure)", "How sensitive was your horse to light pressure?"],
  ["Willingness (response to request)", "How willing was your horse to respond to requests?"],
  ["Reaction to social separation", "How did your horse react to being separated from other horses?"],
]);

export const rideQuestionPrompt = (rubricText: string) => questionPrompts.get(rubricText);

export const RIDE_READBACK_TEXT = {
  clarification: "I couldn’t tell which score you meant. Which one should I record?",
  complete: "All scores are recorded. Your ride is ready to review.",
  retry: "I couldn’t check that answer. Try again or pick a score.",
  temperament_offer: "Foundation is done. Would you like to score Temperament now or later?",
  temperament_clarification: "Say ‘now’ to score Temperament or ‘later’ to review the ride.",
} as const;

export type RidePromptKind = "question" | keyof typeof RIDE_READBACK_TEXT;

export type RideSummaryPrompt = "complete" | "temperament_offer" | "temperament_clarification";
export function isRideSummaryPrompt(kind: unknown): kind is RideSummaryPrompt {
  return kind === "complete" || kind === "temperament_offer" || kind === "temperament_clarification";
}
