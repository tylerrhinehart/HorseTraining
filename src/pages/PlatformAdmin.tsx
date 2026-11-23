import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getPlatformAccess, listPlatformFacilities, listPlatformFacilityAudit, updatePlatformFacility,
  type PlatformAccess, type PlatformFacilityAudit,
} from "../facilities/api";
import { useFacility } from "../auth/FacilityProvider";
import { requireSupabase } from "../supabase/client";
import type { Facility } from "../supabase/types";
import "./platform-admin.css";

type Control = "status" | "voice";
type Change = (control: Control, enabled: boolean) => Promise<void>;
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const time = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function describeActivity(event: PlatformFacilityAudit) {
  const changes = [];
  if (event.before_state.status !== event.after_state.status)
    changes.push(event.after_state.status === "active" ? "Facility reactivated" : "Facility suspended");
  if (event.before_state.voice_enabled !== event.after_state.voice_enabled)
    changes.push(event.after_state.voice_enabled ? "Voice enabled" : "Voice disabled");
  return changes.join(" · ") || "Settings reviewed";
}

function Activity({ id, revision }: { id: string; revision: number }) {
  const [events, setEvents] = useState<PlatformFacilityAudit[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    setError("");
    void listPlatformFacilityAudit(id, request.signal).then(
      rows => { if (!request.signal.aborted) setEvents(rows); },
      error => { if (!request.signal.aborted) setError(message(error, "Activity could not be loaded.")); },
    );
    return () => request.abort();
  }, [id, revision, attempt]);
  if (error) return <div className="platform-feedback"><p role="alert">{error}</p>
    <button type="button" className="btn" onClick={() => setAttempt(n => n + 1)}>Retry activity</button></div>;
  if (!events) return <p role="status">Loading activity…</p>;
  if (!events.length) return <p className="platform-secondary">No changes recorded yet.</p>;
  return <ol className="platform-events">{events.map(event => (
    <li key={event.id}>
      <strong>{describeActivity(event)}</strong>
      <time dateTime={event.created_at}>{time.format(new Date(event.created_at))}</time>
    </li>
  ))}</ol>;
}

function FacilityCard({ facility, change, pending, error, revision }: {
  facility: Facility;
  change: Change;
  pending?: Control;
  error?: string;
  revision: number;
}) {
  const [activityOpen, setActivityOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = `facility-${facility.id}`;
  const active = facility.status === "active";
  const voice = facility.voice_enabled;
  return <article className="card platform-facility" aria-labelledby={heading}>
    <header className="platform-facility-heading">
      <h3 id={heading}>{facility.name}</h3>
      <span className={`platform-badge ${active ? "platform-badge-on" : "platform-badge-paused"}`}>
        {active ? "Active" : "Suspended"}
      </span>
    </header>
    <div className="platform-controls">
      <div className="platform-control">
        <div>
          <h4>Facility access</h4>
          <p>{active ? "Members can open this facility." : "Members cannot open this facility."}</p>
        </div>
        <button type="button" className={`btn ${active ? "btn-danger" : "btn-primary"}`} disabled={!!pending} aria-describedby={heading}
          onClick={() => active ? dialog.current?.showModal() : void change("status", true)}>
          {pending === "status" ? "Saving…" : active ? "Suspend access" : "Reactivate access"}
        </button>
      </div>
      <div className="platform-control">
        <div>
          <h4>Voice scoring <span className={`platform-badge ${voice ? "platform-badge-on" : ""}`}>{voice ? "On" : "Off"}</span></h4>
          <p>{!active && voice ? "Available again when access is restored." : "For Foundation Phase 1 rides."}</p>
        </div>
        <button type="button" className={`btn ${!voice ? "btn-primary" : ""}`} disabled={!!pending} aria-describedby={heading}
          onClick={() => void change("voice", !voice)}>
          {pending === "voice" ? "Saving…" : voice ? "Disable voice" : "Enable voice"}
        </button>
      </div>
    </div>
    {error && <p className="platform-feedback platform-error" role="alert">{error}</p>}
    <details className="platform-activity" aria-describedby={heading} onToggle={event => setActivityOpen(event.currentTarget.open)}>
      <summary>Recent activity</summary>
      {activityOpen && <Activity id={facility.id} revision={revision} />}
    </details>
    <dialog ref={dialog} className="card platform-dialog" aria-labelledby={`suspend-${facility.id}`}>
      <h4 id={`suspend-${facility.id}`}>Suspend access to {facility.name}?</h4>
      <p>Members will lose access to this facility until you reactivate it. Facility records are kept.</p>
      <form method="dialog" className="platform-actions">
        <button type="submit" className="btn" autoFocus>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={() => {
          dialog.current?.close();
          void change("status", false);
        }}>Suspend facility</button>
      </form>
    </dialog>
  </article>;
}

type RowFeedback = { pending?: Control; error?: string; revision: number };
type Filter = "all" | "active" | "suspended" | "voice";
const matchesFilter = (facility: Facility, filter: Filter) =>
  filter === "all" || (filter === "voice" ? facility.voice_enabled : facility.status === filter);

export default function PlatformAdmin() {
  const { memberships, refresh } = useFacility();
  const [access, setAccess] = useState<PlatformAccess | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [factor, setFactor] = useState<{ id: string; qr?: string } | null>(null);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState<Record<string, RowFeedback>>({});
  const [notice, setNotice] = useState("");
  const filterInput = useRef<HTMLSelectElement>(null);
  const pending = useRef(new Set<string>());
  const loadVersion = useRef(0);
  const mfaLock = useRef(false);

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setNotice("");
    setError("");
    try {
      const next = await getPlatformAccess();
      const rows = next.assigned && next.mfa_verified ? await listPlatformFacilities() : [];
      if (version !== loadVersion.current) return;
      setAccess(next);
      setFacilities(rows);
      if (!next.assigned || next.mfa_verified) {
        setFactor(null);
        setCode("");
      }
    } catch (err) {
      if (version !== loadVersion.current) return;
      setAccess(null);
      setFactor(null);
      setCode("");
      setFacilities([]);
      setError(message(err, "Platform access could not be checked."));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { ++loadVersion.current; };
  }, []);

  async function withMfa(action: () => Promise<void>, fallback: string) {
    if (mfaLock.current) return;
    mfaLock.current = true;
    setMfaBusy(true);
    setError("");
    try { await action(); }
    catch (err) { setError(message(err, fallback)); }
    finally { mfaLock.current = false; setMfaBusy(false); }
  }

  function prepareMfa() {
    return withMfa(async () => {
      const mfa = requireSupabase().auth.mfa;
      const { data, error } = await mfa.listFactors();
      if (error) throw error;
      const existing = data.totp.find(item => item.status === "verified");
      if (existing) { setFactor({ id: existing.id }); return; }
      const { data: enrolled, error: failure } = await mfa.enroll({
        factorType: "totp", friendlyName: "TQA platform administration",
      });
      if (failure) throw failure;
      setFactor({ id: enrolled.id, qr: enrolled.totp.qr_code });
    }, "The authenticator could not be prepared.");
  }

  function verify() {
    if (!factor) return;
    return withMfa(async () => {
      const { error } = await requireSupabase().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) { setCode(""); throw error; }
      setFactor(null);
      setCode("");
      await load();
    }, "The authenticator code could not be verified.");
  }

  async function change(id: string, control: Control, enabled: boolean) {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setNotice("");
    const revision = feedback[id]?.revision ?? 0;
    setFeedback(current => ({ ...current, [id]: { pending: control, revision } }));
    try {
      const updated = await updatePlatformFacility(id, control, enabled);
      setFacilities(current => current.map(row => row.id === id ? updated : row));
      const notice = control === "voice"
        ? (updated.voice_enabled ? "Voice scoring enabled." : "Voice scoring disabled.")
        : (updated.status === "active" ? "Facility access restored." : "Facility access suspended.");
      setNotice(`${updated.name} · ${notice}`);
      const focusedCard = document.activeElement?.closest("article");
      if (focusedCard?.getAttribute("aria-labelledby") === `facility-${id}` && !matchesFilter(updated, (filterInput.current?.value as Filter) ?? filter)) {
        filterInput.current?.focus();
      }
      setFeedback(current => ({ ...current, [id]: { revision: revision + 1 } }));
      if (memberships.some(row => row.facility_id === id)) void refresh();
    } catch (err) {
      setFeedback(current => ({ ...current, [id]: { error: message(err, "The setting could not be saved."), revision } }));
    } finally { pending.current.delete(id); }
  }

  const allowed = access?.assigned && access.mfa_verified;
  const counts = {
    active: facilities.filter(row => row.status === "active").length,
    suspended: facilities.filter(row => row.status === "suspended").length,
    voice: facilities.filter(row => row.voice_enabled).length,
  };
  const visible = facilities.filter(row =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      matchesFilter(row, filter));
  const saving = Object.values(feedback).some(row => !!row.pending);

  return <div className="view platform-admin">
    <header className="platform-header">
      <div><h1>Platform administration</h1><p>Manage facility access and voice scoring.</p></div>
      <Link className="btn" to="/facilities">Your facilities</Link>
    </header>
    {loading ? <p className="card" role="status">Checking platform access…</p> : !allowed ? (
      <section className="card platform-access" aria-labelledby="platform-access-heading">
        <h2 id="platform-access-heading">{access?.assigned ? "Verify your authenticator" : "Administrator access"}</h2>
        {error && <p role="alert" className="platform-error">{error}</p>}
        {access && !access.assigned && <p>This account has not been assigned platform-administrator access.</p>}
        {access?.assigned && !factor && <>
          <p>Use a code from your authenticator app. You can set one up here if you need to.</p>
          <button type="button" className="btn btn-primary" disabled={mfaBusy} onClick={() => void prepareMfa()}>
            {mfaBusy ? "Preparing…" : "Set up or verify authenticator"}
          </button>
        </>}
        {access?.assigned && factor && <form className="platform-mfa" onSubmit={event => { event.preventDefault(); void verify(); }}>
          {factor.qr ? <><p>Scan this QR code with your authenticator app, then enter the code it shows.</p>
            <img src={factor.qr} alt="Authenticator enrollment QR code" width={220} height={220} />
          </> : <p>Enter the current six-digit code from your authenticator app.</p>}
          <label>Six-digit code<input className="input" autoComplete="one-time-code" inputMode="numeric"
            pattern="[0-9]{6}" required maxLength={6} value={code}
            onChange={event => setCode(event.target.value)} /></label>
          <button className="btn btn-primary" disabled={mfaBusy}>{mfaBusy ? "Verifying…" : "Verify"}</button>
        </form>}
        <button type="button" className="btn btn-ghost" disabled={mfaBusy} onClick={() => void load()}>Refresh access</button>
      </section>
    ) : (
      <section aria-labelledby="platform-facilities-heading">
        <div className="platform-toolbar-heading">
          <h2 id="platform-facilities-heading">Facilities <span className="platform-total">{facilities.length}</span></h2>
          <button type="button" className="btn" disabled={saving} onClick={() => void load()}>Refresh facilities</button>
        </div>
        {facilities.length ? <>
          <div className="platform-filters">
            <label>Search facilities<input type="search" className="input" value={query}
              onChange={event => setQuery(event.target.value)} placeholder="Facility name" /></label>
            <label>Filter<select ref={filterInput} className="input" value={filter} onChange={event => setFilter(event.target.value as Filter)}>
              <option value="all">All facilities ({facilities.length})</option>
              <option value="active">Active ({counts.active})</option>
              <option value="suspended">Suspended ({counts.suspended})</option>
              <option value="voice">Voice enabled ({counts.voice})</option>
            </select></label>
          </div>
          <p className={notice ? "platform-save-status" : "sr-only"} role="status">{notice}</p>
          {visible.length ? <div className="platform-facilities">{visible.map(facility => (
            <FacilityCard key={facility.id} facility={facility}
              {...(feedback[facility.id] ?? { revision: 0 })}
              change={(control, enabled) => change(facility.id, control, enabled)} />
          ))}</div> : <div className="card platform-feedback">
            <p>No facilities match your search and filter.</p>
            <button type="button" className="btn" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>
          </div>}
        </> : <div className="card platform-feedback"><p>No facilities exist yet.</p>
          <Link className="btn btn-primary" to="/facilities">Set up a facility</Link></div>}
      </section>
    )}
  </div>;
}
