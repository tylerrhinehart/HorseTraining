import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { listMemberships } from "../facilities/api";
import { setFacilityScope } from "../supabase/facilityScope";
import { setActiveHorseId } from "../state/activeHorse";
import type { Facility, FacilityMembership } from "../supabase/types";

interface Value {
  facility: Facility | null;
  membership: FacilityMembership | null;
  memberships: FacilityMembership[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectFacility: (id: string) => void;
}
const Context = createContext<Value | null>(null);
export function FacilityProvider({children}:{children:ReactNode}) {
  const {user} = useAuth();
  const navigate = useNavigate();
  const [memberships,setMemberships] = useState<FacilityMembership[]>([]);
  const [loadedFor,setLoadedFor] = useState<string|null>(null);
  const [active,setActive] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const request = useRef(0);
  const account = useRef(user?.id);
  account.current = user?.id;
  const activeRef = useRef(active);
  activeRef.current = active;
  const refresh = async () => {
    const uid = user?.id;
    const ticket = ++request.current;
    if (!uid) {setLoading(false); return;}
    setError(null);
    try {
      const rows = await listMemberships(uid);
      if (account.current !== uid || ticket !== request.current) return;
      const usable = rows.filter(m => m.facility);
      setMemberships(usable);
      setLoadedFor(uid);
      const activeRows = usable.filter(m=>m.facility.status==="active");
      let saved: string | null = null;
      try { saved = sessionStorage.getItem(`tqa.facility.${uid}`); } catch { /* storage is optional */ }
      const selected = activeRows.find(m=>m.facility_id === activeRef.current)
        ?? activeRows.find(m=>m.facility_id === saved)
        ?? (activeRows.length === 1 ? activeRows[0] : undefined);
      if (activeRef.current !== (selected?.facility_id ?? null)) setActiveHorseId(null);
      activeRef.current = selected?.facility_id ?? null;
      setFacilityScope(selected?.facility_id ?? null);
      setActive(selected?.facility_id ?? null);
    } catch(e) {
      if (account.current !== uid || ticket !== request.current) return;
      setFacilityScope(null); setActive(null); setMemberships([]); setLoadedFor(uid);
      setError(e instanceof Error?e.message:"Unable to load facilities.");
    } finally {if(account.current===uid && ticket===request.current)setLoading(false);}
  };
  useEffect(()=>{
    setFacilityScope(null); setActiveHorseId(null); setActive(null); setLoadedFor(null); activeRef.current=null; setMemberships([]); setLoading(true);
    void refresh();
    const onFocus=()=>{void refresh();};
    window.addEventListener("focus",onFocus);
    return ()=>{++request.current;window.removeEventListener("focus",onFocus);setFacilityScope(null);};
  },[user?.id]);
  const selectFacility=(id:string)=>{
    if (loadedFor !== user?.id || !memberships.some(m=>m.facility_id===id&&m.facility.status==="active")) return;
    ++request.current;
    activeRef.current=id;
    try { sessionStorage.setItem(`tqa.facility.${user?.id}`,id); } catch { /* storage is optional */ }
    setFacilityScope(id); setActiveHorseId(null); setActive(id); setLoading(false); navigate("/");
  };
  const visibleMemberships = loadedFor === user?.id ? memberships : [];
  const membership=visibleMemberships.find(m=>m.facility_id===active)??null;
  return <Context.Provider value={{facility:membership?.facility??null,membership,memberships:visibleMemberships,loading:loading || (!!user && loadedFor!==user.id),error,refresh,selectFacility}}>{children}</Context.Provider>;
}
export function useFacility() {const ctx=useContext(Context); if(!ctx)throw new Error("FacilityProvider required");return ctx;}
export function RequireFacility({children}:{children:ReactNode}) {
 const {facility,loading,error,refresh}=useFacility();
 if(loading)return <div className="view">Loading facility…</div>;
 if(error)return <div className="view" role="alert">{error}<button className="btn" onClick={()=>void refresh()}>Retry</button></div>;
 if(!facility)return <Navigate to="/facilities" replace/>;
 return <>{children}</>;
}
