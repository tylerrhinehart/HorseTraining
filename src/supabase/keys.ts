import type { QueryKey } from "./cache";

// Canonical query keys. Structured as arrays so `invalidate(["horses"])` hits
// every filter variant by prefix.
export const qk = {
  horses: (filter = "all") => ["horses", filter] as const, // filter: "all" | "in_training" | statuses.join("+")
  horse: (id: string) => ["horse", id] as const,
  phases: () => ["phases"] as const,
  questions: (phaseId: string) => ["questions", phaseId] as const,
  sessions: (horseId: string) => ["sessions", horseId] as const,
  session: (id: string) => ["session", id] as const,
  ratings: (horseId: string) => ["ratings", horseId] as const,
  resourcesForPhase: (phaseId: string) => ["resources", "phase", phaseId] as const,
  resourcesForQuestion: (qid: string) => ["resources", "question", qid] as const,
  trifecta: (horseId: string) => ["trifecta", horseId] as const,
} satisfies Record<string, (...a: never[]) => QueryKey>;
