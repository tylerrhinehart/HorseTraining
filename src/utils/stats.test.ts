import { describe, expect, it } from "vitest";
import type { Question, SessionWithRatings, TqaScore } from "../supabase/types";
import {
  meetsCertificationThreshold,
  questionAverages,
  round1,
  sessionAverage,
  sessionAverages,
  trend,
} from "./stats";

interface RatingSpec {
  questionId: string;
  axis: "foundation" | "temperament";
  score: TqaScore;
}

const mkSession = (
  id: string,
  occurredAt: string,
  ratings: RatingSpec[],
): SessionWithRatings => ({
  id,
  user_id: "u",
  horse_id: "h",
  phase_id: "p",
  occurred_at: occurredAt,
  notes: null,
  created_at: occurredAt,
  updated_at: occurredAt,
  ratings: ratings.map((r, i) => ({
    id: `${id}-${i}`,
    user_id: "u",
    session_id: id,
    question_id: r.questionId,
    axis_snapshot: r.axis,
    question_text_snapshot: `q-${r.questionId}`,
    score: r.score,
    comment: null,
  })),
});

describe("stats", () => {
  it("sessionAverages computes per-axis means in chronological order", () => {
    const sessions = [
      mkSession("s2", "2025-02-01T10:00:00Z", [
        { questionId: "f1", axis: "foundation", score: 2 },
        { questionId: "t1", axis: "temperament", score: -1 },
      ]),
      mkSession("s1", "2025-01-01T10:00:00Z", [
        { questionId: "f1", axis: "foundation", score: 1 },
        { questionId: "t1", axis: "temperament", score: 0 },
      ]),
    ];
    const result = sessionAverages(sessions);
    expect(result.map((p) => p.sessionId)).toEqual(["s1", "s2"]);
    expect(result[0].foundationAverage).toBe(1);
    expect(result[0].temperamentAverage).toBe(0);
    expect(result[1].foundationAverage).toBe(2);
    expect(result[1].temperamentAverage).toBe(-1);
  });

  it("sessionAverage handles axis filter and empties", () => {
    expect(sessionAverage(undefined)).toBeNull();
    expect(sessionAverage([])).toBeNull();
    const session = mkSession("s", "2025-01-01", [
      { questionId: "f1", axis: "foundation", score: 3 },
      { questionId: "f2", axis: "foundation", score: -3 },
      { questionId: "t1", axis: "temperament", score: 2 },
    ]);
    expect(sessionAverage(session.ratings, "foundation")).toBe(0);
    expect(sessionAverage(session.ratings, "temperament")).toBe(2);
    expect(sessionAverage(session.ratings)).toBeCloseTo(2 / 3);
  });

  it("questionAverages can restrict to a single axis", () => {
    const questions: Question[] = [
      {
        id: "f1",
        user_id: "u",
        phase_id: "p",
        axis: "foundation",
        position: 0,
        text: "Foundation Q",
        low_label: "Low",
        high_label: "High",
        created_at: "",
      },
      {
        id: "t1",
        user_id: "u",
        phase_id: "p",
        axis: "temperament",
        position: 0,
        text: "Temperament Q",
        low_label: "Low",
        high_label: "High",
        created_at: "",
      },
    ];
    const sessions = [
      mkSession("s1", "2025-01-01", [
        { questionId: "f1", axis: "foundation", score: -2 },
        { questionId: "t1", axis: "temperament", score: 3 },
      ]),
      mkSession("s2", "2025-01-02", [
        { questionId: "f1", axis: "foundation", score: 2 },
        { questionId: "t1", axis: "temperament", score: 1 },
      ]),
    ];
    expect(
      questionAverages(questions, sessions, "foundation"),
    ).toEqual([
      {
        questionId: "f1",
        text: "Foundation Q",
        axis: "foundation",
        average: 0,
        count: 2,
      },
    ]);
    expect(
      questionAverages(questions, sessions, "temperament")[0].average,
    ).toBe(2);
  });

  it("trend reports direction on the requested axis", () => {
    const points = [
      {
        sessionId: "1",
        occurredAt: "1",
        phaseId: "p",
        foundationAverage: -1,
        temperamentAverage: 3,
        combinedAverage: 1,
        count: 2,
      },
      {
        sessionId: "2",
        occurredAt: "2",
        phaseId: "p",
        foundationAverage: 2,
        temperamentAverage: 1,
        combinedAverage: 1.5,
        count: 2,
      },
    ];
    expect(trend(points, "foundation").direction).toBe("up");
    expect(trend(points, "temperament").direction).toBe("down");
    expect(trend([]).direction).toBe("n/a");
  });

  it("round1 keeps one decimal with sign and dash for null", () => {
    expect(round1(null)).toBe("—");
    expect(round1(0)).toBe("0.0");
    expect(round1(-1.46)).toBe("-1.5");
    expect(round1(2.7)).toBe("+2.7");
  });

  it("meetsCertificationThreshold requires 2.7+ on both axes", () => {
    const base = {
      sessionId: "1",
      occurredAt: "1",
      phaseId: "p",
      combinedAverage: null,
      count: 0,
    };
    expect(
      meetsCertificationThreshold({
        ...base,
        foundationAverage: 2.7,
        temperamentAverage: 2.7,
      }),
    ).toBe(true);
    expect(
      meetsCertificationThreshold({
        ...base,
        foundationAverage: 3,
        temperamentAverage: 2.5,
      }),
    ).toBe(false);
    expect(
      meetsCertificationThreshold({
        ...base,
        foundationAverage: null,
        temperamentAverage: 3,
      }),
    ).toBe(false);
  });
});
