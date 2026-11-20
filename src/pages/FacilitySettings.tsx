import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useFacility } from "../auth/FacilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { inviteLink } from "../facilities/pendingInvite";
import { createInvite, listMembers, removeMember, setMemberRole } from "../facilities/api";
import type { FacilityMembership, FacilityRole } from "../supabase/types";
export default function FacilitySettings(){
 const {facility,membership,refresh}=useFacility();
 const {user}=useAuth();
 const [members,setMembers]=useState<FacilityMembership[]>([]);
 const [email,setEmail]=useState("");
 const [role,setRole]=useState<FacilityRole>("trainer");
 const [token,setToken]=useState("");
 const [copyStatus,setCopyStatus]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const manager=membership?.role==="owner"||membership?.role==="admin";
 useEffect(()=>{let live=true;if(facility&&manager)listMembers(facility.id).then(rows=>{if(live)setMembers(rows);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[facility?.id,manager]);
 async function invite(e:FormEvent){e.preventDefault();if(!facility)return;setBusy(true);setError("");setToken("");setCopyStatus("");try{setToken(await createInvite(facility.id,email,role));setEmail("");}catch(e){setError(e instanceof Error?e.message:"Invitation failed.");}finally{setBusy(false);}}
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setCopyStatus(`${label} copied.`);}catch{setCopyStatus("Clipboard unavailable. Select and copy the text manually.");}}
 async function change(member:FacilityMembership,next?:FacilityRole){if(!facility)return;if(!window.confirm(next?`Change this member's role to ${next}?`:"Remove this member from the facility?"))return;setBusy(true);setError("");try{if(next)await setMemberRole(facility.id,member.user_id,next);else await removeMember(facility.id,member.user_id);setMembers(await listMembers(facility.id));await refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to update membership.");}finally{setBusy(false);}}
 return <div className="view max-w-2xl mx-auto space-y-5"><h1 className="text-2xl font-semibold">{facility?.name} team</h1><Link to="/facilities">Switch or create a facility</Link><p>Your role: {membership?.role}. Voice assistance: {facility?.voice_enabled?"enabled":"disabled"}.</p>{error&&<p role="alert">{error}</p>}
 {!manager?<p>Contact a facility owner or administrator to manage invitations and membership.</p>:<>
 <form className="card space-y-3" onSubmit={e=>void invite(e)}><h2>Invite a teammate</h2><label className="block">Email<input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Role<select className="input" value={role} onChange={e=>setRole(e.target.value as FacilityRole)}><option value="trainer">Trainer</option>{membership?.role==="owner"&&<option value="admin">Administrator</option>}</select></label><button className="btn" disabled={busy}>Create invitation</button></form>
 {token&&<div className="card"><p>Share the invitation privately with the invited teammate. No email has been sent. If they confirm their account in a different browser or tab, they can reopen the link or paste the token under Your facilities.</p><label className="block">Invitation link<input readOnly className="input" value={inviteLink(token)} onFocus={e=>e.target.select()}/></label><button className="btn" onClick={()=>void copy(inviteLink(token),"Invitation link")}>Copy link</button><label className="block">Manual invitation token<input readOnly className="input" value={token} onFocus={e=>e.target.select()}/></label><button className="btn" onClick={()=>void copy(token,"Invitation token")}>Copy token</button>{copyStatus&&<p role="status">{copyStatus}</p>}</div>}
 <section className="card space-y-4"><h2>Members</h2>{members.map(m=><div key={m.user_id} className="space-y-2"><p className="break-all">{m.user_id===user?.id?"You":m.user_id} · {m.role}</p>{membership?.role==="owner"&&<label>Role <select className="input" disabled={busy} value={m.role} onChange={e=>void change(m,e.target.value as FacilityRole)}><option value="owner">Owner</option><option value="admin">Administrator</option><option value="trainer">Trainer</option></select></label>}{(membership?.role==="owner"||m.role==="trainer")&&<button className="btn" disabled={busy} onClick={()=>void change(m)}>Remove member</button>}</div>)}</section></>}
 </div>;
}
