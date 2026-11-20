import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./client", () => ({ requireSupabase: () => db }));
import { createSession, updateSession, upsertTrifectaEvaluation, listHorses } from "./queries";
import { setFacilityScope } from "./facilityScope";

let builder: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  setFacilityScope(null); setFacilityScope("facility-a");
  builder = {};
  for(const method of ["select","eq","abortSignal","order"]) builder[method]=vi.fn(()=>builder);
  builder.maybeSingle=vi.fn().mockResolvedValue({data:{id:"horse",facility_id:"facility-a"},error:null});
  db.from.mockReturnValue(builder);
});
function rpcResult(result:unknown){db.rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue(result)});}

describe("atomic score persistence", () => {
  it.each(["create", "edit", "finish"])("blocks unsafe %s fallback when migration is missing", async (operation) => {
    rpcResult({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    const action = operation === "create"
      ? createSession({ horse_id: "horse", phase_id: "phase", occurred_at: "2026-10-02T08:35:00Z", ratings: [] })
      : operation === "edit" ? updateSession("session", { ratings: [] })
      : upsertTrifectaEvaluation({ horse_id: "horse", scores: [] });
    await expect(action).rejects.toThrow("existing records have not been changed");
    expect(db.from).toHaveBeenCalledTimes(1); // scoped parent lookup only, never destructive fallback
    expect(builder.eq).toHaveBeenCalledWith("facility_id","facility-a");
  });

  it("surfaces a rejected transaction rather than reporting success", async () => {
    rpcResult({ data: null, error: { code: "23514", message: "Invalid rating" } });
    await expect(updateSession("session", { ratings: [] })).rejects.toThrow("Invalid rating");
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch a write when workspace switches during parent lookup",async()=>{
    let finish!:(v:unknown)=>void;
    builder.maybeSingle.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    const pending=createSession({horse_id:"horse",phase_id:"phase",occurred_at:"2026-10-02",ratings:[]});
    setFacilityScope("facility-b");
    finish({data:{id:"horse"},error:null});
    await expect(pending).rejects.toThrow("Facility changed");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("fails closed before querying when no facility is selected",async()=>{
    setFacilityScope(null);
    await expect(listHorses()).rejects.toThrow("Choose a facility");
    expect(db.from).not.toHaveBeenCalled();
  });
});
