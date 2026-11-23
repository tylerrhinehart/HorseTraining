import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformAccess, listPlatformFacilities, setControls } from "../facilities/api";
import { requireSupabase } from "../supabase/client";
import type { Facility } from "../supabase/types";

export default function PlatformAdmin(){
 const [assigned,setAssigned]=useState<boolean|null>(null);
 const [notice,setNotice]=useState("");
 const [allowed,setAllowed]=useState(false);
 const [rows,setRows]=useState<Facility[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [code,setCode]=useState("");
 const [factor,setFactor]=useState<string|null>(null);
 const [qr,setQr]=useState("");
 const [reason,setReason]=useState("");
 async function load(){
   setError("");
   try{const access=await getPlatformAccess();
     setAssigned(access.assigned);const yes=access.assigned&&access.mfa_verified;setAllowed(yes);
     if(yes){setRows(await listPlatformFacilities());setNotice("");}
     else {setRows([]);setNotice(access.assigned?"Platform role confirmed. Verify your authenticator to continue.":"This account has not been assigned platform-administrator access. Verifying an authenticator does not grant that role.");}}
   catch(e){setAllowed(false);setRows([]);setAssigned(null);setError(e instanceof Error?e.message:"Admin access unavailable.");}
 }
 useEffect(()=>{void load();},[]);
 async function prepareMfa(){
   if(!assigned)return;
   setBusy(true);setError("");
   try{
     const {data,error}=await requireSupabase().auth.mfa.listFactors();if(error)throw error;
     const existing=data.totp.find(f=>f.status==="verified");
     if(existing)setFactor(existing.id);
     else{
       const {data:enrolled,error:failure}=await requireSupabase().auth.mfa.enroll({factorType:"totp",friendlyName:"TQA platform administration"});
       if(failure)throw failure;setFactor(enrolled.id);setQr(enrolled.totp.qr_code);
     }
   }catch(e){setError(e instanceof Error?e.message:"Unable to prepare MFA.");}finally{setBusy(false);}
 }
 async function verify(){
   if(!factor)return;setBusy(true);setError("");
   try{const {error}=await requireSupabase().auth.mfa.challengeAndVerify({factorId:factor,code});if(error)throw error;setQr("");setCode("");setNotice("Authenticator verified. Checking administrator access…");await load();}catch(e){setError(e instanceof Error?e.message:"Verification failed.");}finally{setBusy(false);}
 }
 async function update(row:Facility,status:Facility["status"],voice:boolean){
   if(!reason.trim()){setError("Enter an audit reason first.");return;}
   if(!window.confirm(`Update ${row.name}: ${status}, voice ${voice?"enabled":"disabled"}?`))return;
   setBusy(true);setError("");
   try{await setControls(row.id,status,voice,reason.trim());setRows(await listPlatformFacilities());setReason("");}catch(e){setError(e instanceof Error?e.message:"Update failed.");}finally{setBusy(false);}
 }
 return <div className="view max-w-3xl mx-auto space-y-5"><h1 className="text-2xl font-semibold">Platform administration</h1><Link to="/facilities">Your facilities</Link><p>Restricted to designated platform administrators with a verified two-factor session. This does not grant access to facility horse records.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!allowed?<section className="card space-y-3">{assigned===null?<p>Checking administrator access…</p>:assigned?<p>Your account has the platform role. Verify your authenticator to open the controls.</p>:<p>A designated administrator must assign the platform role before these controls are available.</p>}<button className="btn" disabled={busy} onClick={()=>void load()}>Refresh access</button>{assigned&&<><button className="btn" disabled={busy} onClick={()=>void prepareMfa()}>Set up or verify authenticator</button>{qr&&<><p>Scan this QR code in your authenticator app.</p><img src={qr} alt="Authenticator enrollment QR code" width={220}/></>}{factor&&<form onSubmit={e=>{e.preventDefault();void verify();}}><label>Six-digit code<input className="input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="btn" disabled={busy}>Verify</button></form>}</>}</section>:<>
 {rows.length===0&&<p>No facilities exist yet. Create one from Your facilities, then return here to enable voice.</p>}
 <label className="block">Audit reason<input className="input" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
 {rows.map(row=><section className="card space-y-3" key={row.id}><h2>{row.name}</h2><p>{row.status} · Voice {row.voice_enabled?"enabled":"disabled"}</p><button className="btn" disabled={busy} onClick={()=>void update(row,row.status==="active"?"suspended":"active",row.voice_enabled)}>{row.status==="active"?"Suspend":"Reactivate"}</button>{" "}<button className="btn" disabled={busy} onClick={()=>void update(row,row.status,!row.voice_enabled)}>{row.voice_enabled?"Disable":"Enable"} voice</button></section>)}</>}
 </div>;
}
