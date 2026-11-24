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
]);

export const rideQuestionPrompt = (rubricText: string) => questionPrompts.get(rubricText);

export const RIDE_READBACK_TEXT = {
  clarification: "I couldn’t tell which score you meant. Which one should I record?",
  complete: "All scores are recorded. Your ride is ready to review.",
  retry: "I couldn’t check that answer. Try again or pick a score.",
} as const;

export type RidePromptKind = "question" | keyof typeof RIDE_READBACK_TEXT;
