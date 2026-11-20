import type { Session } from "../supabase/types";
import { formatHumanDate } from "./dates";

type Ride = Pick<Session, "id" | "occurred_at" | "created_at" | "task_completions">;
type LastWorked = { phase: number; date: string };
export type DisciplineHistory = Map<string, LastWorked>;

export function lastWorkedByDiscipline(rides: Ride[]): DisciplineHistory {
  const latest: DisciplineHistory = new Map();
  const newestFirst = [...rides].sort((a, b) =>
    Date.parse(b.occurred_at) - Date.parse(a.occurred_at) ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    b.id.localeCompare(a.id)
  );
  for (const ride of newestFirst) {
    for (const task of ride.task_completions ?? []) {
      if (!latest.has(task.job)) latest.set(task.job, { phase: task.phase, date: ride.occurred_at });
    }
  }
  return latest;
}

export function lastWorkedLabel(last?: LastWorked): string {
  return last ? `Phase ${last.phase} · ${formatHumanDate(last.date)}` : "No rides logged";
}
