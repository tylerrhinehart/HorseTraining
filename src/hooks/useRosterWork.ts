import { useMemo } from "react";
import { listSessionDates } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { taskJobName } from "../content/programs";
import { formatShortDate } from "../utils/dates";

export function useRosterWork() {
  const rides = useQuery(qk.sessionDates(), listSessionDates);
  const summaries = useMemo(() => {
    if (!rides.data) return undefined;
    const byHorse = new Map<string, Map<string, string>>();
    // The feed is ordered by ride time, with creation time breaking ties.
    for (const ride of rides.data) {
      if (!ride.task_completions?.length) continue;
      const work = byHorse.get(ride.horse_id) ?? new Map<string, string>();
      for (const task of ride.task_completions) {
        if (!work.has(task.job)) work.set(task.job, `${taskJobName(task.job)} · Phase ${task.phase} · ${formatShortDate(ride.occurred_at)}`);
      }
      byHorse.set(ride.horse_id, work);
    }
    return new Map([...byHorse].map(([id, work]) => {
      const labels = [...work.values()].slice(0, 2);
      if (work.size > 2) labels.push(`+${work.size - 2} more`);
      return [id, labels.join(" / ")] as const;
    }));
  }, [rides.data]);
  return {rides, summaries};
}
