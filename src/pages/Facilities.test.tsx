import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({state:{memberships:[] as unknown[],facility:null,transition:{counts:{} as Record<string,number>,has_pending_data:false,completed_facility_id:null},loading:false,error:null,refresh:vi.fn(),selectFacility:vi.fn()},create:vi.fn(),join:vi.fn(),navigate:vi.fn()}));
vi.mock("../auth/FacilityProvider",()=>({useFacility:()=>mocks.state}));
vi.mock("../auth/AuthProvider",()=>({useAuth:()=>({signOut:vi.fn()})}));
vi.mock("../facilities/api",()=>({createFacility:mocks.create,redeemInvite:mocks.join}));
vi.mock("react-router-dom",async original=>({...await original<typeof import("react-router-dom")>(),useNavigate:()=>mocks.navigate}));
import Facilities from "./Facilities";
beforeEach(()=>{vi.clearAllMocks();mocks.state.transition={counts:{},has_pending_data:false,completed_facility_id:null};mocks.state.refresh.mockResolvedValue(undefined);mocks.create.mockResolvedValue({id:"new-facility"});});
afterEach(cleanup);
function mount(){return render(<MemoryRouter><Facilities/></MemoryRouter>);}
it("guides existing accounts with no facility into setup without promising erased records",()=>{
 mount();expect(screen.getByRole("heading",{name:"Set up your facility"})).toBeInTheDocument();expect(screen.getByText(/existing account still works/)).toBeInTheDocument();expect(screen.getByText(/No earlier training records are available/)).toBeInTheDocument();
});
it("shows only the signed-in user's pending counts and disables joining until private setup",()=>{
 mocks.state.transition={counts:{horses:2,sessions:7,ratings:21},has_pending_data:true,completed_facility_id:null};mount();
 expect(screen.getByText("2 horses, 7 rides, 21 ratings")).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("Invitation token"),{target:{value:"invitation"}});
 expect(screen.getByRole("button",{name:"Accept invitation"})).toBeDisabled();expect(mocks.join).not.toHaveBeenCalled();
});
it("creates/imports once and opens the returned owned facility after refreshing membership",async()=>{
 mocks.state.transition={counts:{horses:2},has_pending_data:true,completed_facility_id:null};mount();
 fireEvent.change(screen.getByLabelText("Facility name"),{target:{value:"Wade's facility"}});
 fireEvent.click(screen.getByRole("button",{name:"Create facility and bring in my records"}));
 await waitFor(()=>expect(mocks.state.refresh).toHaveBeenCalledWith("new-facility"));
 expect(mocks.create).toHaveBeenCalledWith("Wade's facility",expect.any(String));
});
it("keeps the same request ID after a failed import and does not advance",async()=>{
 mocks.create.mockRejectedValueOnce(new Error("Import needs review")).mockResolvedValueOnce({id:"new-facility"});mount();
 fireEvent.change(screen.getByLabelText("Facility name"),{target:{value:"Facility"}});
 fireEvent.click(screen.getByRole("button",{name:"Create facility"}));
 await screen.findByText("Import needs review");expect(mocks.navigate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Create facility"}));
 await waitFor(()=>expect(mocks.create).toHaveBeenCalledTimes(2));expect(mocks.create.mock.calls[0][1]).toBe(mocks.create.mock.calls[1][1]);
});
it("does not navigate when an old request finishes after the screen unmounts",async()=>{
 let finish!:(v:unknown)=>void;mocks.create.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const view=mount();
 fireEvent.change(screen.getByLabelText("Facility name"),{target:{value:"Facility"}});fireEvent.click(screen.getByRole("button",{name:"Create facility"}));view.unmount();finish({id:"old-facility"});
 await new Promise(resolve=>setTimeout(resolve,0));expect(mocks.navigate).not.toHaveBeenCalled();expect(mocks.state.refresh).not.toHaveBeenCalled();
});
