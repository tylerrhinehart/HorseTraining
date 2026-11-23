import { requireSupabase } from "../supabase/client";
import type { Facility, FacilityMembership, FacilityRole } from "../supabase/types";
const check = <T,>(r: {data:T;error:{message:string}|null}) => { if(r.error) throw new Error(r.error.message); return r.data; };
export async function listMemberships(userId: string): Promise<FacilityMembership[]> {
  return check(await requireSupabase().from("facility_memberships").select("*, facility:facilities(*)").eq("user_id", userId)) ?? [];
}
export async function createFacility(name: string, requestId: string) { return check(await requireSupabase().rpc("create_facility", {p_name:name.trim(),p_request_id:requestId})); }
export async function redeemInvite(token: string) { return check(await requireSupabase().rpc("redeem_facility_invite", {p_token:token.trim()})); }
export async function createInvite(id: string, email: string, role: FacilityRole) { return check(await requireSupabase().rpc("create_facility_invite", {p_facility_id:id,p_email:email.trim(),p_role:role})); }
export async function listMembers(id: string) { return check(await requireSupabase().from("facility_memberships").select("*").eq("facility_id",id)) ?? []; }
export async function setMemberRole(id: string, user: string, role: FacilityRole) { check(await requireSupabase().rpc("set_facility_member_role",{p_facility_id:id,p_user_id:user,p_role:role})); }
export async function removeMember(id: string,user:string) { check(await requireSupabase().rpc("remove_facility_member",{p_facility_id:id,p_user_id:user})); }
export async function isSuperAdmin():Promise<boolean> { return !!check(await requireSupabase().rpc("platform_is_super_admin")); }
export async function listPlatformFacilities():Promise<Facility[]> { return check(await requireSupabase().rpc("platform_list_facilities")) ?? []; }
export async function setControls(id:string,status:Facility["status"],voice:boolean,reason:string) { check(await requireSupabase().rpc("platform_set_facility_controls",{p_facility_id:id,p_status:status,p_voice_enabled:voice,p_reason:reason})); }
export interface FacilityTransition {
  counts: Record<string, number>;
  has_pending_data: boolean;
  completed_facility_id: string | null;
}
export async function getFacilityTransition(): Promise<FacilityTransition> {
  return check(await requireSupabase().rpc("facility_transition_status"));
}
