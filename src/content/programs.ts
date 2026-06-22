// Training programs ("types of training" the trainer picks per horse). Each
// program determines which score sheets are filled out:
//
//   foundation          — Colt Starting / Foundation Tune-Ups (the original
//                         5-phase Groundwork→Phase 4 model, scored -3…+3).
//   foundation_to_finish — Performance Horse ("Outside Horse", a client's horse).
//                         One recurring Performance Horse Warm-Up score sheet,
//                         scored 1…5, plus a Task Completion job picked daily.
//   sale_horse          — Same Performance Horse Warm-Up + Task Completion, but
//                         the trainer rides for a future buyer at a target price.
//
// Verbatim from Wade Black's TQA documents. Mirrored in supabase/schema.sql.

import type { TrainingType } from "../supabase/types";

export interface ProgramDef {
  id: TrainingType;
  label: string;
  tagline: string;
  description: string;
}

export const PROGRAMS: ProgramDef[] = [
  {
    id: "foundation",
    label: "Foundation",
    tagline: "Colt Starting / Foundation Tune-Ups",
    description:
      "Groundwork through Phase 4. The client pays a monthly fee plus feed and board to have the horse started or tuned up for the public. Scored on the −3…+3 TQA scale.",
  },
  {
    id: "foundation_to_finish",
    label: "Foundation to Finish",
    tagline: "Performance Horse · Outside Horse",
    description:
      "The Performance Horse Warm-Up score sheet, logged daily and scored 1…5. After the warm-up the trainer picks a Task Completion job (Reining, Fence Work, Rope Horse, Barrels, and more) for the day. For a client's horse trained toward a performance discipline.",
  },
  {
    id: "sale_horse",
    label: "Sale Horse",
    tagline: "Performance Horse · Selling to the public",
    description:
      "The same Performance Horse Warm-Up and Task Completions as Foundation to Finish, but the trainer rides the horse for a future buyer against a target market and sale price.",
  },
];

export function programDef(id: TrainingType): ProgramDef {
  return PROGRAMS.find((p) => p.id === id) ?? PROGRAMS[0];
}

export function programLabel(id: TrainingType): string {
  return programDef(id).label;
}

// ---------------------------------------------------------------------------
// Rating scales
// ---------------------------------------------------------------------------

// Foundation uses the −3…+3 TQA scale (legend lives in tqa-template.ts).
// Performance/Sale use a 1…5 scale with two legends, one per column.
export const FIVE_SCALE_VALUES = [1, 2, 3, 4, 5] as const;

export const FIVE_FOUNDATION_LEGEND: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
};

export const FIVE_TEMPERAMENT_LEGEND: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "No signs of behavior",
  2: "Very low frequency of behavior",
  3: "Low frequency of behavior",
  4: "Intermediate frequency",
  5: "High frequency",
};

// ---------------------------------------------------------------------------
// Task Completion menu (warm-up row 8 → "Pick One Job From Task Completion
// Sheet"). Each job is worked through Phase 1–4. Wade's note: advancement
// through these phases is NOT tracked in the daily log — the trainer goes
// through the warm-up, then picks a job + phase to work that day.
// ---------------------------------------------------------------------------

export interface TaskJob {
  code: string;
  name: string;
}

export const TASK_COMPLETION_JOBS: TaskJob[] = [
  { code: "outside_riding", name: "Outside Riding (Straight Lines)" },
  { code: "reining", name: "TQA Reining Cow Horse Foundation (Reining)" },
  { code: "fence_work", name: "Fence Work" },
  { code: "feed_lot", name: "Feed Lot" },
  { code: "branding_pasture", name: "Branding & Pasture Doctoring (Competitions)" },
  { code: "rope_heading_heeling", name: "Rope Horse (Heading & Heeling)" },
  { code: "rope_breakaway_calf", name: "Rope Horse (Breakaway & Calf Roping)" },
  { code: "barrels", name: "Barrels" },
];

export const TASK_PHASES = [1, 2, 3, 4] as const;

export function taskJobName(code: string): string {
  return TASK_COMPLETION_JOBS.find((j) => j.code === code)?.name ?? code;
}

// ---------------------------------------------------------------------------
// Bit selection, recorded per week on the Foundation to Finish "Outside Horse"
// form (and useful for Sale Horse logs too).
// ---------------------------------------------------------------------------

export interface BitOption {
  code: string;
  label: string;
}

export const BIT_OPTIONS: BitOption[] = [
  { code: "bit_1", label: "Bit 1 (Snaffle)" },
  { code: "bit_2", label: "Bit 2 (Chain)" },
  { code: "bit_3", label: "Bit 3 (2 Rein / High Port)" },
  { code: "bit_4", label: "Bit 4 (Half Breed)" },
];

export function bitLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return BIT_OPTIONS.find((b) => b.code === code)?.label ?? code;
}

// Official source documents (Dropbox) for the performance/sale score sheets.
export const PERFORMANCE_DOC_URL =
  "https://www.dropbox.com/scl/fi/nxkwk88abu146k17e8zkj/TQA-All-Around-Performance-Horse-Warmup-1.pdf";
export const SALE_HORSE_DOC_URL =
  "https://www.dropbox.com/scl/fi/4mbij1k3aj6f06wga4p8g/Sale-Horse-Ready-2024-All-Around-Performance-Horse.docx";
