import { describe, expect, it } from "vitest";
import {
  BIT_OPTIONS,
  bitLabel,
  FIVE_FOUNDATION_LEGEND,
  FIVE_TEMPERAMENT_LEGEND,
  PROGRAMS,
  TASK_COMPLETION_JOBS,
  programLabel,
} from "./programs";
import {
  PERFORMANCE_QUESTIONS,
  PERFORMANCE_PHASE,
} from "./performance-template";

describe("programs content", () => {
  it("defines the three training types", () => {
    expect(PROGRAMS.map((p) => p.id)).toEqual([
      "foundation",
      "foundation_to_finish",
      "sale_horse",
    ]);
  });

  it("programLabel resolves known and falls back for unknown", () => {
    expect(programLabel("sale_horse")).toBe("Sale Horse");
    // @ts-expect-error — exercising the fallback path
    expect(programLabel("nope")).toBe("Foundation");
  });

  it("keeps every requested discipline independently selectable", () => {
    expect(TASK_COMPLETION_JOBS).toHaveLength(10);
    expect(TASK_COMPLETION_JOBS.map((j) => j.code)).toContain("fence_work");
    expect(TASK_COMPLETION_JOBS.map((j) => j.code)).toEqual(expect.arrayContaining(["heading", "heeling", "breakaway", "calf_roping", "daywork", "ranch_roping"]));
  });

  it("has four bit options", () => {
    expect(BIT_OPTIONS.map((b) => b.code)).toEqual([
      "bit_1",
      "bit_2",
      "bit_3",
      "bit_4",
    ]);
  });

  it("1-5 legends cover every value", () => {
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(FIVE_FOUNDATION_LEGEND[s]).toBeTruthy();
      expect(FIVE_TEMPERAMENT_LEGEND[s]).toBeTruthy();
    }
  });
});

describe("performance warm-up template", () => {
  it("is a single 1-5 phase with 8 foundation + 6 temperament rows", () => {
    expect(PERFORMANCE_PHASE.code).toBe("performance_warmup");
    expect(PERFORMANCE_QUESTIONS.filter((q) => q.axis === "foundation")).toHaveLength(8);
    expect(PERFORMANCE_QUESTIONS.filter((q) => q.axis === "temperament")).toHaveLength(6);
  });

  it("row 8 is the Task Completion link to the job menu", () => {
    const last = PERFORMANCE_QUESTIONS.filter((q) => q.axis === "foundation").at(-1);
    expect(last?.text).toContain("Task Completion");
  });
});

it("uses each original program log bit wording without changing codes", () => {
 expect(bitLabel("bit_2", "foundation_to_finish")).toBe("Bit 2 (Chain)");
 expect(bitLabel("bit_3", "foundation_to_finish")).toBe("Bit 3 (2 Rein/High Port)");
 expect(bitLabel("bit_2", "sale_horse")).toBe("Bit 2 (Chain/Hack)");
});
