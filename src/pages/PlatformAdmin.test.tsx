import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),facilities:vi.fn(),controls:vi.fn(),list:vi.fn(),enroll:vi.fn(),verify:vi.fn()}));
vi.mock("../facilities/api",()=>({getPlatformAccess:mocks.access,listPlatformFacilities:mocks.facilities,setControls:mocks.controls}));
vi.mock("../supabase/client",()=>({requireSupabase:()=>({auth:{mfa:{listFactors:mocks.list,enroll:mocks.enroll,challengeAndVerify:mocks.verify}}})}));
import PlatformAdmin from "./PlatformAdmin";
beforeEach(()=>{vi.clearAllMocks();mocks.facilities.mockResolvedValue([{id:"facility",name:"Test facility",status:"active",voice_enabled:false}]);mocks.list.mockResolvedValue({data:{totp:[{id:"verified-factor",status:"verified"}]},error:null});mocks.verify.mockResolvedValue({error:null});});
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
