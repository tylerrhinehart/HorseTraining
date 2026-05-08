import { describe, expect, it } from "vitest";
import {
  ADVANCE_THRESHOLD,
  WINDOW_SIZE,
  computePhaseAverage,
  computeRollingAverage,
  isAtOrAboveStandard,
  nextPhase,
  prevPhase,
} from "./phaseProgression";
import type { Phase } from "../supabase/types";

const phases: Phase[] = [
  { id: "p0", user_id: "u", code: "groundwork", position: 0, name: "Groundwork", created_at: "" },
  { id: "p1", user_id: "u", code: "phase_1", position: 1, name: "Phase 1", created_at: "" },
  { id: "p2", user_id: "u", code: "phase_2", position: 2, name: "Phase 2", created_at: "" },
  { id: "p3", user_id: "u", code: "phase_3", position: 3, name: "Phase 3", created_at: "" },
  { id: "p4", user_id: "u", code: "phase_4", position: 4, name: "Phase 4", created_at: "" },
];

describe("phaseProgression", () => {
  it("ADVANCE_THRESHOLD is +2.0 (TQA industry standard)", () => {
    expect(ADVANCE_THRESHOLD).toBe(2);
  });

  it("WINDOW_SIZE rolls over the last 7 sessions", () => {
    expect(WINDOW_SIZE).toBe(7);
  });

  it("computePhaseAverage averages all rating scores in a phase", () => {
    const scores = [3, 1, -1, 2, 0]; // sum=5, n=5, avg=1
    expect(computePhaseAverage(scores)).toBe(1);
  });

  it("computePhaseAverage returns null for an empty list", () => {
    expect(computePhaseAverage([])).toBeNull();
  });

  it("computeRollingAverage uses only the last WINDOW_SIZE session averages", () => {
    const sessionAverages = [-3, -3, 0, 1, 2, 3, 3, 3, 3]; // last 7 = [0,1,2,3,3,3,3] sum=15 avg=15/7
    expect(computeRollingAverage(sessionAverages)).toBeCloseTo(15 / 7, 5);
  });

  it("isAtOrAboveStandard returns true at exactly +2.0", () => {
    expect(isAtOrAboveStandard(2)).toBe(true);
    expect(isAtOrAboveStandard(1.999)).toBe(false);
    expect(isAtOrAboveStandard(null)).toBe(false);
  });

  it("nextPhase returns the phase at position+1 or null at the end", () => {
    expect(nextPhase(phases[0], phases)?.code).toBe("phase_1");
    expect(nextPhase(phases[4], phases)).toBeNull();
  });

  it("prevPhase returns the phase at position-1 or null at the start", () => {
    expect(prevPhase(phases[1], phases)?.code).toBe("groundwork");
    expect(prevPhase(phases[0], phases)).toBeNull();
  });
});
