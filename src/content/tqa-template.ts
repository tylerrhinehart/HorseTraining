// Canonical TQA template — five phases × (8 Foundation + 6 Temperament) = 70 rows.
// Verbatim from the published TQA score-sheet PDFs. Mirrored in
// supabase/schema.sql so the seed trigger inserts the same rows on signup.

export type PhaseCode =
  | "groundwork"
  | "phase_1"
  | "phase_2"
  | "phase_3"
  | "phase_4";

export type Axis = "foundation" | "temperament";

export interface PhaseTemplate {
  code: PhaseCode;
  position: number;
  name: string;
}

export interface QuestionTemplate {
  phase_code: PhaseCode;
  axis: Axis;
  position: number;
  text: string;
  low_label: string;
  high_label: string;
}

export const PHASES: PhaseTemplate[] = [
  { code: "groundwork", position: 0, name: "Groundwork" },
  { code: "phase_1", position: 1, name: "Phase 1" },
  { code: "phase_2", position: 2, name: "Phase 2" },
  { code: "phase_3", position: 3, name: "Phase 3" },
  { code: "phase_4", position: 4, name: "Phase 4" },
];

// Universal Temperament dimensions in their canonical 1..6 order.
// Phase 4 keeps this order; Groundwork reorders below.
const STANDARD_TEMPERAMENT: Array<Omit<QuestionTemplate, "phase_code" | "position">> = [
  {
    axis: "temperament",
    text: "Self-preservation (fight or flight)",
    low_label: "High",
    high_label: "Low",
  },
  {
    axis: "temperament",
    text: "Confidence",
    low_label: "Low",
    high_label: "High",
  },
  {
    axis: "temperament",
    text: "Energy (motivation and determination)",
    low_label: "Low",
    high_label: "High",
  },
  {
    axis: "temperament",
    text: "Sensitivity (response to light pressure)",
    low_label: "Dull",
    high_label: "Very Responsive",
  },
  {
    axis: "temperament",
    text: "Willingness (response to request)",
    low_label: "Resistant",
    high_label: "Willing",
  },
  {
    axis: "temperament",
    text: "Reaction to social separation",
    low_label: "Calm",
    high_label: "Nervous",
  },
];

// Groundwork ordering per the PDF: 1 Self-preservation, 2 Confidence,
// 3 Willingness, 4 Reaction to social separation, 5 Energy, 6 Sensitivity.
const GROUNDWORK_TEMPERAMENT_ORDER = [
  "Self-preservation (fight or flight)",
  "Confidence",
  "Willingness (response to request)",
  "Reaction to social separation",
  "Energy (motivation and determination)",
  "Sensitivity (response to light pressure)",
];

function temperamentForPhase(code: PhaseCode): QuestionTemplate[] {
  const order =
    code === "groundwork"
      ? GROUNDWORK_TEMPERAMENT_ORDER
      : STANDARD_TEMPERAMENT.map((t) => t.text);
  return order.map((text, i) => {
    const t = STANDARD_TEMPERAMENT.find((x) => x.text === text)!;
    return {
      phase_code: code,
      axis: "temperament" as const,
      position: i,
      text: t.text,
      low_label: t.low_label,
      high_label: t.high_label,
    };
  });
}

const FOUNDATION_LABELS = { low_label: "Did Not Complete", high_label: "Mastered" };

const FOUNDATION_BY_PHASE: Record<PhaseCode, string[]> = {
  groundwork: [
    "Good to catch",
    "Stage 1 w/ Willing Submission (in a crisis, standing & walking)",
    "Horizontal Direction (standing & walking)",
    "Stage 2 w/ Willing Submission",
    "Stage 3 w/ Willing Submission",
    "Stage 4 w/ Willing Submission",
    "Lead w/ Willing Submission and Respect",
    "Pick up feet",
  ],
  phase_1: [
    "Good to Catch (Review Groundwork)",
    "Stand to Saddle and Accept Bridle",
    "Horizontal Direction & Stage 1 (on the ground, in and away from you)",
    "Horizontal Direction & Stage 1 (on their side and on their back)",
    "Stand to Get On",
    "Doubling Walking, Trotting and Loping (revelation w/in 3 steps from initial cue)",
    "Move Out Soft In a Lope",
    "Stage 2 w/ Willing Submission (standing)",
  ],
  phase_2: [
    "Review groundwork, Stand to Saddle, Accept Bridle (Prepare for rope, Stage 1 w/ Snaffle)",
    "Horizontal Direction & Stage 1 (on the ground)",
    "Stand to get on, Horizontal Direction & Stage 1 (on their side and on their back)",
    "Doubling Walking, Trotting and Loping",
    "Stage 2 w/ Willing Submission (standing & walking)",
    "Lope in a straight line outside",
    "Stage 3 w/ Willing Submission (on fence)",
    "Horizontal Direction (walk and slow trot)",
  ],
  phase_3: [
    "Review Ground Work & Phase 1 — Stage 1 & HD Standing, Double (Walk, Trot, Lope)",
    "Lope in a Straight Line Outside",
    "Horizontal Direction (Slow and Extended Trot)",
    "Stage 2 w/ Willing Submission (standing, walking, trotting)",
    "Stage 3 w/ Willing Submission (open/close gate)",
    "Stage 3 and 4 w/ Willing Submission (on fence)",
    "Vertical Direction (walking and slow trot)",
    "Accept Rope, Drag Log, Track Dummy — track cow if available",
  ],
  phase_4: [
    "Review: Groundwork & Phase 1 — TQA Sale Horse Warm Up, or Ranch Horse Reality",
    "Horizontal Direction (standing, walking, trotting, loping)",
    "Stage 2 w/ Willing Submission (standing, walking, trotting, loping)",
    "Stage 3 w/ Willing Submission (not using fence)",
    "Stage 4 w/ Willing Submission (HD into Stage 4, inside leg/outside leg)",
    "Roll Backs on Fence (whatever speed you can do it correct)",
    "Vertical Direction (walk, slow & extended trot)",
    "Drag & Rope Dummy (show 4 stages w/ WS & VD) — track and rope cow if available",
  ],
};

export const QUESTIONS: QuestionTemplate[] = PHASES.flatMap((phase) => {
  const foundation: QuestionTemplate[] = FOUNDATION_BY_PHASE[phase.code].map(
    (text, i) => ({
      phase_code: phase.code,
      axis: "foundation" as const,
      position: i,
      text,
      low_label: FOUNDATION_LABELS.low_label,
      high_label: FOUNDATION_LABELS.high_label,
    }),
  );
  return [...foundation, ...temperamentForPhase(phase.code)];
});

export const SCORE_LEGEND: Record<-3 | -2 | -1 | 0 | 1 | 2 | 3, string> = {
  [-3]: "Dangerous for client",
  [-2]: "Far below standard",
  [-1]: "Below standard",
  [0]: "Average",
  [1]: "Above standard",
  [2]: "Industry standard",
  [3]: "Ready for inexperienced rider",
};
