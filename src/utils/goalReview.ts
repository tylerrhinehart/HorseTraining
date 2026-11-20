import { taskJobName } from "../content/programs";
import type { Horse, SessionWithRatings } from "../supabase/types";

export function goalReviews(horse: Horse, sessions: SessionWithRatings[]) {
  const goals = horse.program_meta?.training_goals ?? [];
  const notes = horse.program_meta?.goal_assessments ?? {};
  const chronological = sessions.filter(s => s.horse_id === horse.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return [...new Set(goals)].map(code => {
    const rides = chronological.flatMap(session => {
      const task = session.task_completions?.find(t => t.job === code);
      return task ? [{ id: session.id, date: session.occurred_at, phase: task.phase, notes: session.notes }] : [];
    });
    const phases = [...new Set(rides.map(ride => ride.phase))].sort((a, b) => a - b);
    return { code, name: taskJobName(code), rides, phases, assessment: notes[code] ?? "" };
  });
}
