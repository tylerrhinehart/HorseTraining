import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useFacility } from "../auth/FacilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { clearPendingInvite, pendingInvite } from "../facilities/pendingInvite";
import { createFacility, redeemInvite } from "../facilities/api";

export default function Facilities() {
  const {memberships,facility,transition,loading,error,refresh,selectFacility}=useFacility();
  const {signOut}=useAuth();
  const alive=useRef(true);
  const operationInFlight=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const createRequestId=useRef<string|null>(null);
  const [name,setName]=useState("");
  const [token,setToken]=useState(pendingInvite);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent,kind:"create"|"join"){
    e.preventDefault();if(operationInFlight.current||loading||error)return;operationInFlight.current=true;setBusy(true);setMessage("");
    try {
      let ready;
      if(kind==="create") {
        createRequestId.current??=crypto.randomUUID();
        ready=await createFacility(name,createRequestId.current);
        createRequestId.current=null;
      } else {
        if(transition?.has_pending_data) throw new Error("Create your own facility to bring in your earlier records first.");
        ready=await redeemInvite(token);clearPendingInvite();
      }
      if(!alive.current)return;
      setName("");setToken("");await refresh(ready.id);
    }
    catch(e){if(alive.current)setMessage(kind==="join"?"Could not accept the invitation. Check the token and make sure you are signed in with the invited, verified email address.":e instanceof Error?e.message:"Unable to continue.");}
    finally{operationInFlight.current=false;if(alive.current)setBusy(false);}
  }
  return <div className="view max-w-2xl mx-auto space-y-6">
    <h1 className="text-2xl font-semibold">{memberships.length===0 || transition?.has_pending_data ? "Set up your facility" : "Your facilities"}</h1>
    {(memberships.length===0 || transition?.has_pending_data) && <section className="card space-y-2" aria-label="Facility setup">
      <p>Your existing account still works. Create a facility to organize your horses, rides and team.</p>
      {!transition ? <p>Checking for earlier records…</p> : transition.has_pending_data ? <>
        <p>Your earlier records are waiting: <strong>{transition.counts.horses ?? 0} horses, {transition.counts.sessions ?? 0} rides, {transition.counts.ratings ?? 0} ratings</strong>.</p>
        <p>Creating your facility moves your available earlier records into it together. Original histories and scores are kept. Other accounts’ records stay private.</p>
      </> : <p>No earlier training records are available to transfer from this database. Creating a facility starts an empty horse roster.</p>}
    </section>}
    <p>Each facility has its own horses, score sheets, rides and team. Create a facility or enter an invitation token from its manager.</p>
    {loading&&<p>Loading…</p>}{error&&<div role="alert">{error}<button className="btn" disabled={busy} onClick={()=>void refresh()}>Retry loading facilities</button></div>}{message&&<p role="status">{message}</p>}
    <div className="card space-y-3">{memberships.length===0?<p>No facility memberships yet.</p>:memberships.map(m=><div key={m.facility_id} className="flex gap-3 items-center justify-between"><span><strong>{m.facility.name}</strong> · {m.role} {m.facility.status==="suspended"?"· Suspended":""}</span><button className="btn" disabled={busy||m.facility.status!=="active"} onClick={()=>selectFacility(m.facility_id)}>{facility?.id===m.facility_id?"Open":"Select"}</button></div>)}</div>
    <form className="card space-y-3" onSubmit={e=>void submit(e,"create")}><h2 className="text-lg font-semibold">Create a facility</h2><label className="block">Facility name<input className="input" required maxLength={120} value={name} disabled={busy} onChange={e=>{createRequestId.current=null;setName(e.target.value);}}/></label><button className="btn btn-primary" disabled={busy||loading||!!error||!name.trim()}>{transition?.has_pending_data?"Create facility and bring in my records":"Create facility"}</button></form>
    <form className="card space-y-3" onSubmit={e=>void submit(e,"join")}><h2 className="text-lg font-semibold">Join a facility</h2><p className="text-sm">{transition?.has_pending_data?"Set up your own facility and transfer your earlier records before joining another team.":"Sign in with the email address that received the invitation."}</p><label className="block">Invitation token<input className="input" autoComplete="off" spellCheck={false} maxLength={128} required value={token} onChange={e=>setToken(e.target.value)}/></label><button className="btn" disabled={busy||loading||!!error||!!transition?.has_pending_data||!token.trim()}>Accept invitation</button>{token&&<button type="button" className="btn" disabled={busy} onClick={()=>{clearPendingInvite();setToken("");setMessage("");}}>Clear invitation</button>}</form>
    <div className="flex gap-3">{facility&&<Link className="btn" to="/facility-settings">Manage facility</Link>}<Link className="btn" to="/platform">Platform administration</Link><button className="btn" onClick={()=>void signOut()}>Sign out</button></div>
  </div>;
}
