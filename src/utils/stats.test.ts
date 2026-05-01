import { describe, expect, it } from "vitest";
import type { Question, TQAWithRatings } from "../supabase/types";
import {
  overallTrend,
  questionAverages,
  round1,
  tqaAverage,
  tqaAverages,
} from "./stats";

const mkTqa = (
  id: string,
  occurredAt: string,
  scores: Record<string, number>,
): TQAWithRatings => ({
  id,
  user_id: "u",
  horse_id: "h",
  phase_id: "p",
  occurred_at: occurredAt,
  notes: null,
  created_at: occurredAt,
  updated_at: occurredAt,
  ratings: Object.entries(scores).map(([qid, score]) => ({
    id: `${id}-${qid}`,
    user_id: "u",
    tqa_id: id,
    question_id: qid,
    question_text_snapshot: `q-${qid}`,
    score: score as 1 | 2 | 3 | 4 | 5,
    comment: null,
  })),
});

describe("stats", () => {
  it("tqaAverages computes mean per TQA in chronological order", () => {
    const tqas = [
      mkTqa("t2", "2025-02-01T10:00:00Z", { a: 4, b: 4 }),
      mkTqa("t1", "2025-01-01T10:00:00Z", { a: 3, b: 5 }),
    ];
    const result = tqaAverages(tqas);
    expect(result.map((p) => p.tqaId)).toEqual(["t1", "t2"]);
    expect(result[0].average).toBe(4);
    expect(result[1].average).toBe(4);
  });

  it("questionAverages aggregates across TQAs", () => {
    const questions: Question[] = [
      {
        id: "a",
        user_id: "u",
        phase_id: "p",
        text: "A",
        position: 0,
        active: true,
        deleted_at: null,
        created_at: "",
        updated_at: "",
      },
    ];
    const tqas = [
      mkTqa("t1", "2025-01-01", { a: 2 }),
      mkTqa("t2", "2025-01-02", { a: 4 }),
    ];
    expect(questionAverages(questions, tqas)[0]).toMatchObject({
      questionId: "a",
      average: 3,
      count: 2,
    });
  });

  it("overallTrend reports up/down/flat/n/a", () => {
    expect(
      overallTrend([
        { tqaId: "1", occurredAt: "1", phaseId: "p", average: 2, count: 1 },
        { tqaId: "2", occurredAt: "2", phaseId: "p", average: 4, count: 1 },
      ]).direction,
    ).toBe("up");
    expect(
      overallTrend([
        { tqaId: "1", occurredAt: "1", phaseId: "p", average: 4, count: 1 },
        { tqaId: "2", occurredAt: "2", phaseId: "p", average: 2, count: 1 },
      ]).direction,
    ).toBe("down");
    expect(overallTrend([]).direction).toBe("n/a");
  });

  it("round1 keeps one decimal and renders dash for null", () => {
    expect(round1(null)).toBe("—");
    expect(round1(3)).toBe("3.0");
    expect(round1(3.456)).toBe("3.5");
  });

  it("tqaAverage handles empty input", () => {
    expect(tqaAverage(undefined)).toBeNull();
    expect(tqaAverage([])).toBeNull();
  });
});
