import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({listMemberships:vi.fn()}));
vi.mock("../facilities/api",()=>api);
vi.mock("./AuthProvider",()=>({useAuth:()=>({user:{id:"user-a"}})}));
vi.mock("../supabase/client",()=>({requireSupabase:()=>({})}));
import {FacilityProvider,useFacility} from "./FacilityProvider";
import {setFacilityScope} from "../supabase/facilityScope";
const membership=(id:string,status="active")=>({facility_id:id,user_id:"user-a",role:"owner",created_at:"",facility:{id,name:id,status,voice_enabled:false,created_at:""}});
function View(){const state=useFacility();return <><span data-testid="current">{state.loading?"loading":state.facility?.id??"choose"}</span><button onClick={()=>state.selectFacility("B")}>Choose B</button><button onClick={()=>void state.refresh()}>Refresh</button></>;}
function mount(){return render(<MemoryRouter><FacilityProvider><View/></FacilityProvider></MemoryRouter>);}
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();});
afterEach(()=>{cleanup();setFacilityScope(null);});
describe("facility selection",()=>{
 it("automatically opens the only active facility",async()=>{api.listMemberships.mockResolvedValue([membership("A")]);mount();await waitFor(()=>expect(screen.getByTestId("current")).toHaveTextContent("A"));});
 it("asks multi-facility users to choose and remembers their explicit selection",async()=>{
  api.listMemberships.mockResolvedValue([membership("A"),membership("B")]);mount();
  await waitFor(()=>expect(screen.getByTestId("current")).toHaveTextContent("choose"));
  fireEvent.click(screen.getByText("Choose B"));expect(screen.getByTestId("current")).toHaveTextContent("B");
  expect(sessionStorage.getItem("tqa.facility.user-a")).toBe("B");
 });
 it("does not select a suspended facility from stored preferences",async()=>{
  sessionStorage.setItem("tqa.facility.user-a","B");api.listMemberships.mockResolvedValue([membership("A"),membership("B","suspended")]);mount();
  await waitFor(()=>expect(screen.getByTestId("current")).toHaveTextContent("A"));
 });
 it("ignores a late membership refresh after explicit selection",async()=>{
  api.listMemberships.mockResolvedValue([membership("A"),membership("B")]);mount();
  await waitFor(()=>expect(screen.getByTestId("current")).toHaveTextContent("choose"));
  let finish!:(value:unknown)=>void;api.listMemberships.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  fireEvent.click(screen.getByText("Refresh"));fireEvent.click(screen.getByText("Choose B"));
  await act(async()=>{finish([membership("A")]);});
  expect(screen.getByTestId("current")).toHaveTextContent("B");
 });
});
