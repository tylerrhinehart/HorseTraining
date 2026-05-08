// "Training Trifecta" final evaluation, taken verbatim from the
// public Foundation page on trainingqualityassurance.org. The 15 outcome
// items are decomposed into Foundation (items 4–11) and Task Completion
// (items 1–3, 12–15). Temperament uses 5 dimensions on the website (Willingness
// is intentionally omitted at the Trifecta level even though the per-phase
// PDFs list it as one of 6).

export type TrifectaAxis = "foundation" | "task_completion" | "temperament";

export interface TrifectaItem {
  axis: TrifectaAxis;
  // Stable slug for the DB primary identifier within an evaluation.
  code: string;
  // Position within its axis (0-based).
  position: number;
  // Full display text matching the website wording.
  text: string;
  // Optional sub-text (e.g. discipline-applied jobs list).
  detail?: string;
  // Optional polar labels for temperament dimensions.
  low_label?: string;
  high_label?: string;
}

export const FOUNDATION_ITEMS: TrifectaItem[] = [
  {
    axis: "foundation",
    code: "lope_straight_away_from_barn",
    position: 0,
    text: "Lope in a straight line away from the barn",
  },
  {
    axis: "foundation",
    code: "wtl_circle_both_directions",
    position: 1,
    text: "Walk, trot and lope a circle both directions",
  },
  {
    axis: "foundation",
    code: "stop_at_wtl_both_reins",
    position: 2,
    text: "Stop at a walk, trot and lope by asking with both reins",
  },
  {
    axis: "foundation",
    code: "pivot_inside_front_disengage",
    position: 3,
    text: "Pivot around an inside front foot (disengage hindquarters)",
  },
  {
    axis: "foundation",
    code: "hindquarters_back",
    position: 4,
    text: "Use hindquarters to pull horse in reverse motion (stopping & backing)",
  },
  {
    axis: "foundation",
    code: "lateral_motion",
    position: 5,
    text: "Front feet and hind feet move together in a lateral motion (side pass / two track)",
  },
  {
    axis: "foundation",
    code: "roll_back_spin",
    position: 6,
    text: "Stop the inside hind foot and walk/pull the other feet forward around it (roll back / spin)",
  },
  {
    axis: "foundation",
    code: "vertical_flexion",
    position: 7,
    text: "Vertical flexion",
  },
];

export const TASK_COMPLETION_ITEMS: TrifectaItem[] = [
  {
    axis: "task_completion",
    code: "good_to_catch",
    position: 0,
    text: "Good to catch",
  },
  {
    axis: "task_completion",
    code: "stand_to_saddle_bridle",
    position: 1,
    text: "Stand to saddle and accept bridle",
  },
  {
    axis: "task_completion",
    code: "stand_to_get_on",
    position: 2,
    text: "Stand to get on (for an inexperienced rider)",
  },
  {
    axis: "task_completion",
    code: "pickup_feet",
    position: 3,
    text: "Pickup feet",
  },
  {
    axis: "task_completion",
    code: "load_in_trailer",
    position: 4,
    text: "Load in trailer",
  },
  {
    axis: "task_completion",
    code: "stand_quiet_tied",
    position: 5,
    text: "Stand quiet tied up",
  },
  {
    axis: "task_completion",
    code: "discipline_jobs",
    position: 6,
    text: "Foundation applied to jobs (catered to discipline)",
    detail:
      "Open/close gate, accept rope/tarp, track cow/roping dummy, cut flag, go over jump, cross water/bridge, exposed to starting gate/track, crack whip, etc.",
  },
];

// Five temperament dimensions per the website's Trifecta evaluation.
// Polar labels mirror the per-phase PDF temperament block.
export const TEMPERAMENT_ITEMS: TrifectaItem[] = [
  {
    axis: "temperament",
    code: "energy",
    position: 0,
    text: "Energy",
    low_label: "Low",
    high_label: "High",
  },
  {
    axis: "temperament",
    code: "self_preservation",
    position: 1,
    text: "Self-preservation",
    low_label: "High",
    high_label: "Low",
  },
  {
    axis: "temperament",
    code: "confidence",
    position: 2,
    text: "Confidence",
    low_label: "Low",
    high_label: "High",
  },
  {
    axis: "temperament",
    code: "sensitivity",
    position: 3,
    text: "Sensitivity",
    low_label: "Dull",
    high_label: "Very Responsive",
  },
  {
    axis: "temperament",
    code: "reaction_social_separation",
    position: 4,
    text: "Reaction to social separation",
    low_label: "Calm",
    high_label: "Nervous",
  },
];

export const TRIFECTA_ITEMS: TrifectaItem[] = [
  ...FOUNDATION_ITEMS,
  ...TASK_COMPLETION_ITEMS,
  ...TEMPERAMENT_ITEMS,
];

export const TRIFECTA_AXIS_LABELS: Record<TrifectaAxis, string> = {
  foundation: "Foundation",
  task_completion: "Task Completion",
  temperament: "Temperament",
};
