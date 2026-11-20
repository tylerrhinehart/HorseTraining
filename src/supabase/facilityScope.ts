import { clearCache } from "./cache";
import { requireSupabase } from "./client";

let facilityId: string | null = null;
let controller = new AbortController();
let generation = 0;

// This is UI/request isolation, not authorization. RLS/RPCs enforce authority.
export function setFacilityScope(id: string | null) {
  if (facilityId === id) return;
  controller.abort();
  controller = new AbortController();
  facilityId = id;
  generation++;
  clearCache();
}

export function captureFacilityScope() {
  if (!facilityId) throw new Error("Choose a facility first.");
  const id = facilityId;
  const signal = controller.signal;
  const version = generation;
  const assertCurrent = () => {
    if (version !== generation || signal.aborted) throw new Error("Facility changed. Reopen this page before continuing.");
  };
  return { id, signal, assertCurrent, client: () => { assertCurrent(); return requireSupabase(); } };
}
