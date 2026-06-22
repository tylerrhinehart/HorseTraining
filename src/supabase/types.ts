// Row shapes mirroring supabase/schema.sql.

export type ID = string;
export type TqaScore = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type Axis = "foundation" | "temperament";
export type TrifectaAxisDb = "foundation" | "task_completion" | "temperament";
export type ResourceKind = "youtube" | "link";
export type PhaseCode =
  | "groundwork"
  | "phase_1"
  | "phase_2"
  | "phase_3"
  | "phase_4"
  | "performance_warmup";

// The "type of training" picked per horse — determines which score sheets are
// filled out. See src/content/programs.ts.
export type TrainingType = "foundation" | "foundation_to_finish" | "sale_horse";

// Score-sheet scale. Foundation uses the −3…+3 TQA scale; Performance/Sale use
// a 1…5 scale. The scale is a property of the phase.
export type RatingScaleKind = "tqa" | "five";

// One Task Completion picked during a performance warm-up session.
export interface TaskCompletion {
  job: string; // TaskJob.code
  phase: number; // 1–4
}

// Sale-horse target framing + selected performance disciplines.
export interface ProgramMeta {
  target_market?: string;
  price_low?: number;
  price_high?: number;
}

export const TQA_SCORES: TqaScore[] = [-3, -2, -1, 0, 1, 2, 3];

export interface Profile {
  id: ID;
  display_name: string | null;
  created_at: string;
}

export type HorseStatus = 'in_training' | 'complete' | 'archived';

export interface Horse {
  id: ID;
  user_id: ID;
  name: string;
  breed: string | null;
  dob: string | null;
  sex: string | null;
  color: string | null;
  notes: string | null;
  // new fields:
  owner_name: string | null;
  owner_contact: string | null;
  arrival_date: string | null;
  status: HorseStatus;
  current_phase_id: ID | null;
  // training program:
  training_type: TrainingType;
  program_meta: ProgramMeta;
  // existing:
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: ID;
  user_id: ID;
  code: PhaseCode;
  program: TrainingType;
  scale: RatingScaleKind;
  position: number;
  name: string;
  created_at: string;
}

export interface Question {
  id: ID;
  user_id: ID;
  phase_id: ID;
  axis: Axis;
  position: number;
  text: string;
  low_label: string;
  high_label: string;
  created_at: string;
}

export interface Session {
  id: ID;
  user_id: ID;
  horse_id: ID;
  phase_id: ID;
  occurred_at: string;
  notes: string | null;
  // performance/sale programs only:
  rider: string | null;
  bit: string | null;
  task_completions: TaskCompletion[];
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: ID;
  user_id: ID;
  session_id: ID;
  question_id: ID;
  axis_snapshot: Axis;
  question_text_snapshot: string;
  // -3…+3 on the TQA scale, or 1…5 on the performance scale.
  score: number;
  comment: string | null;
}

export interface SessionWithRatings extends Session {
  ratings: Rating[];
}

export interface TrifectaEvaluation {
  id: ID;
  user_id: ID;
  horse_id: ID;
  evaluated_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrifectaScore {
  id: ID;
  user_id: ID;
  evaluation_id: ID;
  axis: TrifectaAxisDb;
  item_code: string;
  item_text_snapshot: string;
  score: TqaScore;
  comment: string | null;
}

export interface TrifectaEvaluationWithScores extends TrifectaEvaluation {
  scores: TrifectaScore[];
}

export interface Resource {
  id: ID;
  user_id: ID;
  phase_id: ID | null;
  question_id: ID | null;
  title: string;
  url: string;
  kind: ResourceKind;
  notes: string | null;
  position: number;
  created_at: string;
}
