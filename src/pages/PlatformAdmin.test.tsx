import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),facilities:vi.fn(),refresh:vi.fn(),controls:vi.fn(),audit:vi.fn(),list:vi.fn(),enroll:vi.fn(),verify:vi.fn()}));
vi.mock("../facilities/api",()=>({getPlatformAccess:mocks.access,listPlatformFacilities:mocks.facilities,updatePlatformFacility:mocks.controls,listPlatformFacilityAudit:mocks.audit}));
vi.mock("../auth/FacilityProvider",()=>({useFacility:()=>({memberships:[{facility_id:"facility"}],refresh:mocks.refresh})}));
vi.mock("../supabase/client",()=>({requireSupabase:()=>({auth:{mfa:{listFactors:mocks.list,enroll:mocks.enroll,challengeAndVerify:mocks.verify}}})}));
import PlatformAdmin from "./PlatformAdmin";
beforeEach(()=>{vi.resetAllMocks();mocks.audit.mockResolvedValue([]);mocks.facilities.mockResolvedValue([{id:"facility",name:"Test facility",status:"active",voice_enabled:false}]);mocks.list.mockResolvedValue({data:{totp:[{id:"verified-factor",status:"verified"}]},error:null});mocks.verify.mockResolvedValue({error:null});});
afterEach(cleanup);
function mount(){return render(<MemoryRouter><PlatformAdmin/></MemoryRouter>);}
it("explains that verified MFA does not grant a missing platform role",async()=>{
 mocks.access.mockResolvedValue({assigned:false,mfa_verified:true});mount();
 expect(await screen.findByText(/This account has not been assigned/)).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Set up or verify authenticator"})).toBeNull();expect(mocks.enroll).not.toHaveBeenCalled();
});
it("opens controls after an assigned administrator verifies their existing authenticator",async()=>{
 mocks.access.mockResolvedValueOnce({assigned:true,mfa_verified:false}).mockResolvedValue({assigned:true,mfa_verified:true});mount();
 fireEvent.click(await screen.findByRole("button",{name:"Set up or verify authenticator"}));
 fireEvent.change(await screen.findByLabelText("Six-digit code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify"}));
 expect(await screen.findByRole("button",{name:"Enable voice"})).toBeInTheDocument();expect(mocks.verify).toHaveBeenCalledWith({factorId:"verified-factor",code:"123456"});expect(mocks.enroll).not.toHaveBeenCalled();
});
it("shows a missing role explicitly if access is revoked during verification",async()=>{
 mocks.access.mockResolvedValueOnce({assigned:true,mfa_verified:false}).mockResolvedValue({assigned:false,mfa_verified:true});mount();
 fireEvent.click(await screen.findByRole("button",{name:"Set up or verify authenticator"}));fireEvent.change(await screen.findByLabelText("Six-digit code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify"}));
 expect(await screen.findByText(/This account has not been assigned/)).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Enable voice"})).toBeNull();
});
it("explains an empty facility list after successful access verification",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});mocks.facilities.mockResolvedValue([]);mount();
 expect(await screen.findByText(/No facilities exist yet/)).toBeInTheDocument();
});
it("allows an access refresh after the role is assigned without enrolling again",async()=>{
 mocks.access.mockResolvedValueOnce({assigned:false,mfa_verified:true}).mockResolvedValue({assigned:true,mfa_verified:true});mount();
 await screen.findByText(/This account has not been assigned/);fireEvent.click(screen.getByRole("button",{name:"Refresh access"}));
 expect(await screen.findByRole("button",{name:"Enable voice"})).toBeInTheDocument();expect(mocks.enroll).not.toHaveBeenCalled();
});


it("changes voice directly and shows the saved facility state",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});
 mocks.controls.mockResolvedValue({id:"facility",name:"Test facility",status:"active",voice_enabled:true});
 mount();
 fireEvent.click(await screen.findByRole("button",{name:"Enable voice"}));
 expect(mocks.controls).toHaveBeenCalledWith("facility","voice",true);
 expect(await screen.findByRole("button",{name:"Disable voice"})).toBeEnabled();
 expect(screen.getByText(/Test facility · Voice scoring enabled/)).toBeInTheDocument();
 expect(screen.queryByLabelText("Audit reason")).toBeNull();
 expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("filters facilities by name and status and clears empty results",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});
 mocks.facilities.mockResolvedValue([
  {id:"a",name:"Cedar Ranch",status:"active",voice_enabled:true},
  {id:"b",name:"Oak Ranch",status:"suspended",voice_enabled:false},
 ]);
 mount();
 await screen.findByRole("heading",{name:"Cedar Ranch"});
 fireEvent.change(screen.getByLabelText("Filter"),{target:{value:"suspended"}});
 expect(screen.queryByRole("heading",{name:"Cedar Ranch"})).toBeNull();
 expect(within(screen.getByRole("article",{name:"Oak Ranch"})).getByRole("button",{name:"Reactivate access"})).toBeEnabled();
 fireEvent.change(screen.getByLabelText("Search facilities"),{target:{value:"Cedar"}});
 expect(screen.getByText("No facilities match your search and filter.")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Clear filters"}));
 expect(screen.getAllByRole("article")).toHaveLength(2);
});

it("requires confirmation for suspension and shows an action error on the affected facility",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});
 mocks.controls.mockRejectedValue(new Error("Could not save settings."));
 const showModal = vi.fn();
 Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:showModal});
 Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:vi.fn()});
 try {
  mount();
  fireEvent.click(await screen.findByRole("button",{name:"Suspend access"}));
  expect(showModal).toHaveBeenCalledOnce();
  expect(mocks.controls).not.toHaveBeenCalled();
  const dialog = document.querySelector("dialog")!;
  fireEvent.click(within(dialog).getByText("Suspend facility"));
  await waitFor(()=>expect(mocks.controls).toHaveBeenCalledWith("facility","status",false));
  expect(await within(screen.getByRole("article",{name:"Test facility"})).findByRole("alert")).toHaveTextContent("Could not save settings.");
 } finally {
  Reflect.deleteProperty(HTMLDialogElement.prototype,"showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype,"close");
 }
});

it("loads activity for one facility on demand",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});
 mocks.audit.mockResolvedValue([{id:1,before_state:{status:"active",voice_enabled:false},
  after_state:{status:"active",voice_enabled:true},created_at:"2026-11-22T18:00:00Z"}]);
 mount();
 const details = (await screen.findByText("Recent activity")).closest("details")!;
 expect(mocks.audit).not.toHaveBeenCalled();
 details.open = true;
 fireEvent(details,new Event("toggle"));
 expect(await screen.findByText("Voice enabled")).toBeInTheDocument();
 expect(mocks.audit).toHaveBeenCalledWith("facility",expect.any(AbortSignal));
});


it("announces a saved change even when the facility leaves the current filter",async()=>{
 mocks.access.mockResolvedValue({assigned:true,mfa_verified:true});
 mocks.facilities.mockResolvedValue([{id:"b",name:"Oak Ranch",status:"suspended",voice_enabled:false}]);
 mocks.controls.mockResolvedValue({id:"b",name:"Oak Ranch",status:"active",voice_enabled:false});
 mount();
 const reactivate = await screen.findByRole("button",{name:"Reactivate access"});
 fireEvent.change(screen.getByLabelText("Filter"),{target:{value:"suspended"}});
 reactivate.focus();
 fireEvent.click(reactivate);
 expect(await screen.findByText(/Oak Ranch · Facility access restored/)).toBeInTheDocument();
 expect(screen.queryByRole("article",{name:"Oak Ranch"})).toBeNull();
});
