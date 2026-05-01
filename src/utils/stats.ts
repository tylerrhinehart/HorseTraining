import type { Question, Rating, TQAWithRatings } from "../supabase/types";

export interface TQAPoint {
  tqaId: string;
  occurredAt: string; // ISO
  phaseId: string;
  average: number | null;
  count: number;
}

/** Average score per TQA in chronological order. */
export function tqaAverages(tqas: TQAWithRatings[]): TQAPoint[] {
  return [...tqas]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((t) => {
      const scores = (t.ratings ?? []).map((r) => r.score);
      const avg =
        scores.length === 0
          ? null
          : scores.reduce((s, n) => s + n, 0) / scores.length;
      return {
        tqaId: t.id,
        occurredAt: t.occurred_at,
        phaseId: t.phase_id,
        average: avg,
        count: scores.length,
      };
    });
}

/** Average score per question across the given TQAs. */
export function questionAverages(
  questions: Question[],
  tqas: TQAWithRatings[],
): { questionId: string; text: string; average: number | null; count: number }[] {
  const byQuestion = new Map<string, number[]>();
  for (const t of tqas) {
    for (const r of t.ratings ?? []) {
      if (!byQuestion.has(r.question_id)) byQuestion.set(r.question_id, []);
      byQuestion.get(r.question_id)!.push(r.score);
    }
  }
  return questions.map((q) => {
    const scores = byQuestion.get(q.id) ?? [];
    return {
      questionId: q.id,
      text: q.text,
      average:
        scores.length === 0
          ? null
          : scores.reduce((s, n) => s + n, 0) / scores.length,
      count: scores.length,
    };
  });
}

/** Direction of the trend between earliest and latest TQA averages. */
export function overallTrend(points: TQAPoint[]): {
  direction: "up" | "down" | "flat" | "n/a";
  delta: number | null;
} {
  const valid = points.filter(
    (p): p is TQAPoint & { average: number } => p.average !== null,
  );
  if (valid.length < 2) return { direction: "n/a", delta: null };
  const delta = valid[valid.length - 1].average - valid[0].average;
  if (Math.abs(delta) < 0.05) return { direction: "flat", delta };
  return { direction: delta > 0 ? "up" : "down", delta };
}

export function round1(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1);
}

/** Average score across all ratings in a TQA. */
export function tqaAverage(ratings: Rating[] | undefined): number | null {
  if (!ratings || ratings.length === 0) return null;
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
}
