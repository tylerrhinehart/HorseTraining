import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useFacility } from "../auth/FacilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { clearPendingInvite, pendingInvite } from "../facilities/pendingInvite";
import { createFacility, redeemInvite } from "../facilities/api";

export default function Facilities() {
  const {memberships,facility,loading,error,refresh,selectFacility}=useFacility();
  const {signOut}=useAuth();
  const createRequestId=useRef<string|null>(null);
  const [name,setName]=useState("");
  const [token,setToken]=useState(pendingInvite);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent,kind:"create"|"join"){
    e.preventDefault();setBusy(true);setMessage("");
    try { if(kind==="create"){createRequestId.current??=crypto.randomUUID();await createFacility(name,createRequestId.current);createRequestId.current=null;}else { await redeemInvite(token); clearPendingInvite(); }setName("");setToken("");await refresh();setMessage("Facility ready. Select it below to begin.");}
    catch(e){setMessage(kind==="join"?"Could not accept the invitation. Check the token and make sure you are signed in with the invited, verified email address.":e instanceof Error?e.message:"Unable to continue.");}
    finally{setBusy(false);}
  }
  return <div className="view max-w-2xl mx-auto space-y-6">
    <h1 className="text-2xl font-semibold">Your facilities</h1>
    <p>Each facility has its own horses, score sheets, rides and team. Create a facility or enter an invitation token from its manager.</p>
    {loading&&<p>Loading…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <div className="card space-y-3">{memberships.length===0?<p>No facility memberships yet.</p>:memberships.map(m=><div key={m.facility_id} className="flex gap-3 items-center justify-between"><span><strong>{m.facility.name}</strong> · {m.role} {m.facility.status==="suspended"?"· Suspended":""}</span><button className="btn" disabled={busy||m.facility.status!=="active"} onClick={()=>selectFacility(m.facility_id)}>{facility?.id===m.facility_id?"Open":"Select"}</button></div>)}</div>
    <form className="card space-y-3" onSubmit={e=>void submit(e,"create")}><h2 className="text-lg font-semibold">Create a facility</h2><label className="block">Facility name<input className="input" required maxLength={120} value={name} disabled={busy} onChange={e=>{createRequestId.current=null;setName(e.target.value);}}/></label><button className="btn btn-primary" disabled={busy||!name.trim()}>Create facility</button></form>
    <form className="card space-y-3" onSubmit={e=>void submit(e,"join")}><h2 className="text-lg font-semibold">Join a facility</h2><p className="text-sm">Sign in with the email address that received the invitation.</p><label className="block">Invitation token<input className="input" autoComplete="off" spellCheck={false} maxLength={128} required value={token} onChange={e=>setToken(e.target.value)}/></label><button className="btn" disabled={busy||!token.trim()}>Accept invitation</button>{token&&<button type="button" className="btn" disabled={busy} onClick={()=>{clearPendingInvite();setToken("");setMessage("");}}>Clear invitation</button>}</form>
    <div className="flex gap-3">{facility&&<Link className="btn" to="/facility-settings">Manage facility</Link>}<Link className="btn" to="/platform">Platform administration</Link><button className="btn" onClick={()=>void signOut()}>Sign out</button></div>
  </div>;
}
