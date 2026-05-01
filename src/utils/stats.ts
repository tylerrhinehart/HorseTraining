import type { Evaluation, ID, Question } from "../db/schema";
import { trainingDayNumber } from "./dates";

export interface DailyAverage {
  date: string;
  day: number;
  average: number | null;
  count: number;
}

/** Average score across all questions for each evaluation date, in order. */
export function dailyAverages(
  startDate: string,
  evals: Evaluation[],
): DailyAverage[] {
  return [...evals]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((ev) => {
      const scores = Object.values(ev.ratings).map((r) => r.score);
      const avg =
        scores.length === 0
          ? null
          : scores.reduce((s, n) => s + n, 0) / scores.length;
      return {
        date: ev.date,
        day: trainingDayNumber(startDate, ev.date),
        average: avg,
        count: scores.length,
      };
    });
}

export interface QuestionTrendPoint {
  date: string;
  day: number;
  score: number | null;
}

/** Score timeline for a single question across evaluation dates. */
export function questionTrend(
  startDate: string,
  questionId: ID,
  evals: Evaluation[],
): QuestionTrendPoint[] {
  return [...evals]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((ev) => ({
      date: ev.date,
      day: trainingDayNumber(startDate, ev.date),
      score: ev.ratings[questionId]?.score ?? null,
    }));
}

/** Average score per question across all evaluations. */
export function questionAverages(
  questions: Question[],
  evals: Evaluation[],
): { questionId: ID; text: string; average: number | null; count: number }[] {
  return questions.map((q) => {
    const scores = evals
      .map((ev) => ev.ratings[q.id]?.score)
      .filter((s): s is NonNullable<typeof s> => typeof s === "number");
    const avg =
      scores.length === 0
        ? null
        : scores.reduce((s, n) => s + n, 0) / scores.length;
    return {
      questionId: q.id,
      text: q.text,
      average: avg,
      count: scores.length,
    };
  });
}

/** Difference between the latest and earliest daily averages. */
export function overallTrend(averages: DailyAverage[]): {
  direction: "up" | "down" | "flat" | "n/a";
  delta: number | null;
} {
  const valid = averages.filter(
    (a): a is DailyAverage & { average: number } => a.average !== null,
  );
  if (valid.length < 2) {
    return { direction: "n/a", delta: null };
  }
  const delta = valid[valid.length - 1].average - valid[0].average;
  if (Math.abs(delta) < 0.05) return { direction: "flat", delta };
  return { direction: delta > 0 ? "up" : "down", delta };
}

export function round1(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}
