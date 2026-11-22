import {beforeEach,expect,it,vi} from "vitest";
const db=vi.hoisted(()=>({rpc:vi.fn(),functions:{invoke:vi.fn()}}));
vi.mock("../../supabase/client",()=>({requireSupabase:()=>db}));
import {setFacilityScope} from "../../supabase/facilityScope";
import {bindTurn,transcribeTurn,type RideDraft} from "./draftClient";
const binding={draft_id:"draft",question_id:"question",version:3,turn_id:"turn"};
beforeEach(()=>{vi.clearAllMocks();setFacilityScope(null);setFacilityScope("facility");});
it("checks the exact server binding before returning permission to listen",async()=>{
 db.rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:binding,error:null})});
 expect(await bindTurn({id:"draft",version:3} as RideDraft,"question","turn")).toEqual(binding);
 expect(db.rpc).toHaveBeenCalledWith("bind_guided_turn",{p_draft_id:"draft",p_expected_version:3,p_question_id:"question",p_turn_id:"turn"});
 db.rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:{...binding,version:2},error:null})});
 await expect(bindTurn({id:"draft",version:3} as RideDraft,"question","turn")).rejects.toThrow("Reload");
});
it.each(["draft_id","question_id","version","turn_id"])("rejects a mismatched response %s",async key=>{
 db.functions.invoke.mockResolvedValue({data:{...binding,[key]:"stale",transcript:"plus two",choice:"plus_two"},error:null});
 await expect(transcribeTurn(binding,new Blob(["fixture"]),new AbortController().signal)).rejects.toThrow();
});
it("rejects unknown choice ids without parsing transcript as fallback",async()=>{
 db.functions.invoke.mockResolvedValue({data:{...binding,transcript:"plus two",choice:"question-two"},error:null});
 await expect(transcribeTurn(binding,new Blob(["fixture"]),new AbortController().signal)).rejects.toThrow();
});
it("keeps clarification distinct from zero and sends every binding field",async()=>{
 db.functions.invoke.mockResolvedValue({data:{...binding,transcript:"two",choice:"needs_clarification"},error:null});
 expect(await transcribeTurn(binding,new Blob(["fixture"]),new AbortController().signal)).toEqual({transcript:"two",score:null});
 const body=db.functions.invoke.mock.calls[0][1].body as FormData;
 expect(Object.fromEntries([...body.entries()].filter(([k])=>k!=="audio"))).toEqual({...binding,version:"3"});
});
it("rejects a late result after the facility switches",async()=>{
 let finish!:(r:unknown)=>void;
 db.functions.invoke.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const pending=transcribeTurn(binding,new Blob(["fixture"]),new AbortController().signal);
 setFacilityScope("other");finish({data:{...binding,transcript:"plus two",choice:"plus_two"},error:null});
 await expect(pending).rejects.toThrow("Facility changed");
});
