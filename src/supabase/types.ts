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
  | "phase_4";

export const TQA_SCORES: TqaScore[] = [-3, -2, -1, 0, 1, 2, 3];

export interface Profile {
  id: ID;
  display_name: string | null;
  created_at: string;
}

export interface Rider {
  id: ID;
  user_id: ID;
  name: string;
  role: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Horse {
  id: ID;
  user_id: ID;
  name: string;
  breed: string | null;
  dob: string | null;
  sex: string | null;
  color: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Engagement {
  id: ID;
  user_id: ID;
  horse_id: ID;
  owner_name: string | null;
  owner_info: string | null;
  owner_email: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  arrival_date: string | null;
  departure_date: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: ID;
  user_id: ID;
  code: PhaseCode;
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

export interface Week {
  id: ID;
  user_id: ID;
  engagement_id: ID;
  week_number: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: ID;
  user_id: ID;
  engagement_id: ID;
  week_id: ID;
  horse_id: ID;
  phase_id: ID;
  rider_id: ID | null;
  occurred_at: string;
  session_number: number | null;
  notes: string | null;
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
  score: TqaScore;
  comment: string | null;
}

export interface SessionWithRatings extends Session {
  ratings: Rating[];
}

export interface TrifectaEvaluation {
  id: ID;
  user_id: ID;
  engagement_id: ID;
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
