import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./client",()=>({requireSupabase:()=>({})}));
import {captureFacilityScope,setFacilityScope} from "./facilityScope";
import {fetchQuery,getCached,mutateCache} from "./cache";
afterEach(()=>setFacilityScope(null));
describe("facility request isolation",()=>{
 it("aborts old requests and removes cached records on switch",()=>{
  setFacilityScope("A");const old=captureFacilityScope();mutateCache(["horses"],["A horse"]);
  setFacilityScope("B");
  expect(old.signal.aborted).toBe(true);expect(()=>old.client()).toThrow("Facility changed");
  expect(getCached(["horses"])).toBeUndefined();expect(captureFacilityScope().id).toBe("B");
 });
 it("does not repopulate shared cache from a late old response",async()=>{
  setFacilityScope("A");let finish!:(data:string[])=>void;
  const old=fetchQuery(["horses"],()=>new Promise<string[]>(resolve=>{finish=resolve;}),{retries:0});
  setFacilityScope("B");mutateCache(["horses"],["B horse"]);finish(["A horse"]);await old;
  expect(getCached(["horses"])).toEqual(["B horse"]);
 });
 it("retains current requests when refreshing the same facility",()=>{
  setFacilityScope("A");const scope=captureFacilityScope();setFacilityScope("A");expect(scope.signal.aborted).toBe(false);
 });
});
