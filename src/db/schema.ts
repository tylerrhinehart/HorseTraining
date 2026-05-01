import Dexie, { type Table } from "dexie";

export type ID = string;

export interface Horse {
  id: ID;
  name: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  startDate: string; // YYYY-MM-DD (local)
  durationDays: number;
  notes?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  archivedAt?: string; // ISO when manually archived
}

export interface Question {
  id: ID;
  text: string;
  order: number;
  active: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rating {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  questionTextSnapshot: string;
}

export interface Evaluation {
  id: ID;
  horseId: ID;
  date: string; // YYYY-MM-DD (local)
  ratings: Record<ID, Rating>;
  createdAt: string;
  updatedAt: string;
}

export interface AppStateRow {
  id: "singleton";
  activeHorseId?: ID;
  schemaVersion: number;
  lastBackupAt?: string;
  seeded?: boolean;
}

export class HorseTrainingDB extends Dexie {
  horses!: Table<Horse, ID>;
  questions!: Table<Question, ID>;
  evaluations!: Table<Evaluation, ID>;
  appState!: Table<AppStateRow, "singleton">;

  constructor() {
    super("horse-training-tracker");
    this.version(1).stores({
      horses: "id, name, startDate, archivedAt",
      questions: "id, order, active, deletedAt",
      evaluations: "id, horseId, date, [horseId+date]",
      appState: "id",
    });
  }
}

export const db = new HorseTrainingDB();

export const APP_STATE_ID = "singleton" as const;
export const SCHEMA_VERSION = 1;
