import { describe, expect, it } from "vitest";
import { backupSchema } from "./backup";

describe("backupSchema", () => {
  it("accepts a minimal valid backup", () => {
    const result = backupSchema.safeParse({
      app: "horse-training-tracker",
      schemaVersion: 1,
      exportedAt: "2025-01-01T00:00:00Z",
      horses: [],
      questions: [],
      evaluations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects backups missing required fields", () => {
    const result = backupSchema.safeParse({
      app: "horse-training-tracker",
      schemaVersion: 1,
      // missing exportedAt
      horses: [],
      questions: [],
      evaluations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects scores outside 1-5", () => {
    const result = backupSchema.safeParse({
      app: "horse-training-tracker",
      schemaVersion: 1,
      exportedAt: "2025-01-01",
      horses: [],
      questions: [],
      evaluations: [
        {
          id: "e",
          horseId: "h",
          date: "2025-01-01",
          ratings: {
            q: { score: 6, questionTextSnapshot: "x" },
          },
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
