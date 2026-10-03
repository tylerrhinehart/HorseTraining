import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./client", () => ({ requireSupabase: () => db }));
import { createSession, updateSession, upsertTrifectaEvaluation } from "./queries";

beforeEach(() => vi.clearAllMocks());

describe("atomic score persistence", () => {
  it.each(["create", "edit", "finish"])("blocks unsafe %s fallback when migration is missing", async (operation) => {
    db.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    const action = operation === "create"
      ? createSession({ horse_id: "horse", phase_id: "phase", occurred_at: "2026-10-02T08:35:00Z", ratings: [] })
      : operation === "edit" ? updateSession("session", { ratings: [] })
      : upsertTrifectaEvaluation({ horse_id: "horse", scores: [] });
    await expect(action).rejects.toThrow("existing records have not been changed");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("surfaces a rejected transaction rather than reporting success", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "Invalid rating" } });
    await expect(updateSession("session", { ratings: [] })).rejects.toThrow("Invalid rating");
    expect(db.from).not.toHaveBeenCalled();
  });
});
