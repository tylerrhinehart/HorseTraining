import { programLabel, taskJobName } from "../content/programs";
import type { Phase, TaskCompletion } from "../supabase/types";

export function rideWork(phase: Pick<Phase, "name" | "program"> | undefined | null, tasks: TaskCompletion[] | null | undefined) {
  if (tasks?.length) return tasks.map(t => `${taskJobName(t.job)} · Phase ${t.phase}`).join(" / ");
  if (!phase) return "Ride";
  return phase.program === "foundation" ? phase.name : `${programLabel(phase.program)} ride`;
}
