import { describe, expect, it } from "vitest";
import type { Question, Resource } from "../supabase/types";
import { organizeSessionResources } from "./sessionResources";

const q = (id: string, position: number, text = `Task ${position}`): Question => ({
  id,
  user_id: "u1",
  phase_id: "p1",
  axis: "foundation",
  position,
  text,
  low_label: "low",
  high_label: "high",
  created_at: "2026-01-01T00:00:00Z",
});

const r = (
  id: string,
  overrides: Partial<Resource> = {},
): Resource => ({
  id,
  user_id: "u1",
  phase_id: overrides.phase_id ?? null,
  question_id: overrides.question_id ?? null,
  title: overrides.title ?? id,
  url: overrides.url ?? `https://example.com/${id}`,
  kind: overrides.kind ?? "link",
  notes: overrides.notes ?? null,
  position: overrides.position ?? 0,
  created_at: "2026-01-01T00:00:00Z",
});

describe("organizeSessionResources", () => {
  it("groups direct resources by the session's scored training tasks", () => {
    const result = organizeSessionResources({
      questions: [q("q2", 2, "Canter transition"), q("q1", 1, "Ground tie")],
      phaseResources: [],
      resourcesByQuestionId: {
        q2: [r("video", { question_id: "q2", kind: "youtube" })],
      },
    });

    expect(result.questionGroups).toHaveLength(1);
    expect(result.questionGroups[0].question.text).toBe("Canter transition");
    expect(result.questionGroups[0].resources[0].id).toBe("video");
    expect(result.videoCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it("keeps phase-wide resources separate from task-specific resources", () => {
    const result = organizeSessionResources({
      questions: [q("q1", 1)],
      phaseResources: [r("phase-video", { phase_id: "p1", kind: "youtube" })],
      resourcesByQuestionId: {
        q1: [r("task-link", { question_id: "q1", kind: "link" })],
      },
    });

    expect(result.phaseResources.map((resource) => resource.id)).toEqual([
      "phase-video",
    ]);
    expect(result.questionGroups.map((group) => group.resources[0].id)).toEqual([
      "task-link",
    ]);
    expect(result.videoCount).toBe(1);
    expect(result.linkCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("sorts resources and task groups by training order", () => {
    const result = organizeSessionResources({
      questions: [q("late", 20), q("early", 1)],
      phaseResources: [
        r("b", { position: 2, title: "B" }),
        r("a", { position: 1, title: "A" }),
      ],
      resourcesByQuestionId: {
        early: [r("early-resource", { question_id: "early" })],
        late: [r("late-resource", { question_id: "late" })],
      },
    });

    expect(result.phaseResources.map((resource) => resource.id)).toEqual(["a", "b"]);
    expect(result.questionGroups.map((group) => group.question.id)).toEqual([
      "early",
      "late",
    ]);
  });
});
