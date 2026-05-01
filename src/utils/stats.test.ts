import { describe, expect, it } from "vitest";
import type { Evaluation, Question } from "../db/schema";
import {
  dailyAverages,
  overallTrend,
  questionAverages,
  questionTrend,
  round1,
} from "./stats";

const startDate = "2025-01-10";

const mkEval = (
  date: string,
  ratings: Record<string, number>,
): Evaluation => ({
  id: `e-${date}`,
  horseId: "h1",
  date,
  ratings: Object.fromEntries(
    Object.entries(ratings).map(([qid, score]) => [
      qid,
      {
        score: score as 1 | 2 | 3 | 4 | 5,
        questionTextSnapshot: `q-${qid}`,
      },
    ]),
  ),
  createdAt: "",
  updatedAt: "",
});

describe("stats", () => {
  it("dailyAverages computes per-day mean and skips empty entries", () => {
    const evals = [
      mkEval("2025-01-10", { a: 3, b: 5 }),
      mkEval("2025-01-12", { a: 4, b: 4 }),
    ];
    const result = dailyAverages(startDate, evals);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ day: 1, average: 4, count: 2 });
    expect(result[1]).toMatchObject({ day: 3, average: 4, count: 2 });
  });

  it("questionTrend returns one point per evaluation, null if not rated", () => {
    const evals = [
      mkEval("2025-01-10", { a: 2 }),
      mkEval("2025-01-11", { a: 4, b: 5 }),
    ];
    const points = questionTrend(startDate, "b", evals);
    expect(points.map((p) => p.score)).toEqual([null, 5]);
  });

  it("questionAverages aggregates across evaluations", () => {
    const questions: Question[] = [
      {
        id: "a",
        text: "A",
        order: 0,
        active: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const evals = [
      mkEval("2025-01-10", { a: 2 }),
      mkEval("2025-01-11", { a: 4 }),
    ];
    const result = questionAverages(questions, evals);
    expect(result[0]).toMatchObject({ questionId: "a", average: 3, count: 2 });
  });

  it("overallTrend reports up/down/flat", () => {
    expect(
      overallTrend([
        { date: "1", day: 1, average: 2, count: 1 },
        { date: "2", day: 2, average: 4, count: 1 },
      ]).direction,
    ).toBe("up");
    expect(
      overallTrend([
        { date: "1", day: 1, average: 4, count: 1 },
        { date: "2", day: 2, average: 2, count: 1 },
      ]).direction,
    ).toBe("down");
    expect(
      overallTrend([
        { date: "1", day: 1, average: 3, count: 1 },
        { date: "2", day: 2, average: 3, count: 1 },
      ]).direction,
    ).toBe("flat");
  });

  it("round1 keeps one decimal and renders dash for null", () => {
    expect(round1(null)).toBe("—");
    expect(round1(3)).toBe("3.0");
    expect(round1(3.456)).toBe("3.5");
  });
});
