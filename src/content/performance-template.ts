// Performance Horse Warm-Up score sheet — a single recurring sheet used by both
// the Foundation to Finish (Performance Horse) and Sale Horse programs.
// Verbatim from Wade Black's "TQA All-Around Performance Horse Warm-Up" PDF.
// Scored 1…5 (see FIVE_*_LEGEND in programs.ts). Mirrored in supabase/schema.sql.

import type { Axis } from "./tqa-template";

export interface PerfQuestionTemplate {
  axis: Axis;
  position: number;
  text: string;
  low_label: string;
  high_label: string;
}

export const PERFORMANCE_PHASE = {
  code: "performance_warmup",
  position: 0,
  name: "Performance Horse Warm-Up",
} as const;

// Foundation / Task Completion column (8 rows). Row 8 references the Task
// Completion job menu in programs.ts.
const PERFORMANCE_FOUNDATION: string[] = [
  "Ground Work & Phase 1 Review",
  "HD & Stage 4 (Inside → Outside Rein) — Snake Trails (Walk, Slow & Extended Trot, Lope)",
  "Vertical & Horizontal Direction — Walking, Slow Trot, Extended Trot, Loping",
  "Large Fasts and Small Slows — w/ Willing Submission and Vertical Direction",
  "Stage 2 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping",
  "Stage 3 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping",
  "Stage 4 w/ Willing Submission & Vertical Direction — Standing, Walking, Trotting, Rollbacks and Spins",
  'Task Completion — Pick One Job From the "Task Completion" Sheet',
];

// Temperament column (6 rows). Note the warm-up labels self-preservation
// Low→High (unlike the foundation sheet which uses High→Low).
const PERFORMANCE_TEMPERAMENT: Array<Omit<PerfQuestionTemplate, "position">> = [
  { axis: "temperament", text: "Self-preservation (fight or flight)", low_label: "Low", high_label: "High" },
  { axis: "temperament", text: "Confidence", low_label: "Low", high_label: "High" },
  { axis: "temperament", text: "Sensitivity (response to light pressure)", low_label: "Dull", high_label: "Very Responsive" },
  { axis: "temperament", text: "Energy (motivation and determination)", low_label: "Low", high_label: "High" },
  { axis: "temperament", text: "Willingness (response to request)", low_label: "Resistant", high_label: "Willing" },
  { axis: "temperament", text: "Reaction to social separation", low_label: "Calm", high_label: "Nervous" },
];

export const PERFORMANCE_QUESTIONS: PerfQuestionTemplate[] = [
  ...PERFORMANCE_FOUNDATION.map((text, i) => ({
    axis: "foundation" as const,
    position: i,
    text,
    low_label: "Very Poor",
    high_label: "Excellent",
  })),
  ...PERFORMANCE_TEMPERAMENT.map((t, i) => ({ ...t, position: i })),
];

// Trainer guidance printed at the bottom of the warm-up sheet.
export const PERFORMANCE_NOTES: string[] = [
  "Make sure to start each day going through the vocab words. Then gradually build in speed and intensity as your horse remembers and understands what you are asking them. Also remember the “Four Stages of Setting a Solid Foundation” and what stage they are in.",
  "Remember the focus of the Foundation for Perfection is to achieve the “Training Trifecta” (Task Completion, Temperament, and Foundation). To achieve this, during your training sessions primarily focus on 2 of the 3 in the Training Trifecta and make sure to mix it up until you have all three.",
];
