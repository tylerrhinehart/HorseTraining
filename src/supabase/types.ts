// Row shapes mirroring supabase/schema.sql.

export type ID = string;
export type Score = 1 | 2 | 3 | 4 | 5;
export type ResourceKind = "youtube" | "link";

export interface Profile {
  id: ID;
  display_name: string | null;
  created_at: string;
}

export interface Phase {
  id: ID;
  user_id: ID;
  name: string;
  position: number;
  created_at: string;
}

export interface Question {
  id: ID;
  user_id: ID;
  phase_id: ID;
  text: string;
  position: number;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Horse {
  id: ID;
  user_id: ID;
  name: string;
  breed: string | null;
  owner_name: string | null;
  owner_email: string | null;
  start_date: string | null; // YYYY-MM-DD
  current_phase_id: ID | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TQA {
  id: ID;
  user_id: ID;
  horse_id: ID;
  phase_id: ID;
  occurred_at: string; // ISO timestamp
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: ID;
  user_id: ID;
  tqa_id: ID;
  question_id: ID;
  question_text_snapshot: string;
  score: Score;
  comment: string | null;
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

export interface TQAWithRatings extends TQA {
  ratings: Rating[];
}
