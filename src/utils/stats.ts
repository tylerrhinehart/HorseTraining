import type {
  Axis,
  Question,
  Rating,
  SessionWithRatings,
} from "../supabase/types";

export interface SessionPoint {
  sessionId: string;
  occurredAt: string;
  phaseId: string;
  foundationAverage: number | null;
  temperamentAverage: number | null;
  combinedAverage: number | null;
  count: number;
}

const avg = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((s, n) => s + n, 0) / xs.length;

const filterAxis = (ratings: Rating[], axis: Axis) =>
  ratings.filter((r) => r.axis_snapshot === axis).map((r) => r.score);

/** Per-axis averages over the chronologically sorted sessions. */
export function sessionAverages(sessions: SessionWithRatings[]): SessionPoint[] {
  return [...sessions]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((s) => {
      const ratings = s.ratings ?? [];
      const foundation = filterAxis(ratings, "foundation");
      const temperament = filterAxis(ratings, "temperament");
      return {
        sessionId: s.id,
        occurredAt: s.occurred_at,
        phaseId: s.phase_id,
        foundationAverage: avg(foundation),
        temperamentAverage: avg(temperament),
        combinedAverage: avg(ratings.map((r) => r.score)),
        count: ratings.length,
      };
    });
}

/** Average across one session for a single axis (or all ratings if no axis). */
export function sessionAverage(
  ratings: Rating[] | undefined,
  axis?: Axis,
): number | null {
  if (!ratings) return null;
  const scores = axis ? filterAxis(ratings, axis) : ratings.map((r) => r.score);
  return avg(scores);
}

/**
 * Per-question averages across sessions. Restricts to the requested axis if
 * provided, otherwise considers all questions.
 */
export function questionAverages(
  questions: Question[],
  sessions: SessionWithRatings[],
  axis?: Axis,
): { questionId: string; text: string; axis: Axis; average: number | null; count: number }[] {
  const byQuestion = new Map<string, number[]>();
  for (const session of sessions) {
    for (const r of session.ratings ?? []) {
      if (axis && r.axis_snapshot !== axis) continue;
      if (!byQuestion.has(r.question_id)) byQuestion.set(r.question_id, []);
      byQuestion.get(r.question_id)!.push(r.score);
    }
  }
  return questions
    .filter((q) => !axis || q.axis === axis)
    .map((q) => {
      const scores = byQuestion.get(q.id) ?? [];
      return {
        questionId: q.id,
        text: q.text,
        axis: q.axis,
        average: avg(scores),
        count: scores.length,
      };
    });
}

/** Direction between earliest and latest non-null averages on the given axis. */
export function trend(
  points: SessionPoint[],
  axis: Axis | "combined" = "combined",
): { direction: "up" | "down" | "flat" | "n/a"; delta: number | null } {
  const key =
    axis === "foundation"
      ? "foundationAverage"
      : axis === "temperament"
        ? "temperamentAverage"
        : "combinedAverage";
  const valid = points
    .map((p) => p[key])
    .filter((v): v is number => v !== null);
  if (valid.length < 2) return { direction: "n/a", delta: null };
  const delta = valid[valid.length - 1] - valid[0];
  if (Math.abs(delta) < 0.05) return { direction: "flat", delta };
  return { direction: delta > 0 ? "up" : "down", delta };
}

/** Format helper: one decimal, dash for missing. */
export function round1(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = n.toFixed(1);
  return n > 0 ? `+${v}` : v;
}

/**
 * 90% certification threshold per the published TQA criteria — the horse must
 * average 2.7+ on a +3 max on BOTH the Foundation and Temperament axes.
 */
export function meetsCertificationThreshold(point: SessionPoint): boolean {
  const f = point.foundationAverage;
  const t = point.temperamentAverage;
  return f !== null && t !== null && f >= 2.7 && t >= 2.7;
}
