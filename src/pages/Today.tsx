import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import { useActiveHorseId } from "../state/activeHorse";
import { listInTrainingHorses, listPhases } from "../supabase/queries";
import type { Horse, Phase } from "../supabase/types";
import { useQuery } from "../supabase/useQuery";

const UX_VARIANT: string = "ux-command-map";
const UX_TITLE = "Trainer Command Map";
const UX_SHORT = "Split-screen command map with persistent side rail, active-horse inspector, and route tiles.";

export default function Today() {
  const horses = useQuery(() => listInTrainingHorses(), []);

  if (horses.loading) {
    return (
      <div className="view variant-view">
        <div className="variant-loading-card">Loading training workspace…</div>
      </div>
    );
  }

  const list = horses.data ?? [];
  if (list.length === 0) return <EmptyState />;
  if (list.length === 1) return <SingleHorseRedirect horseId={list[0].id} />;
  return <VariantToday horses={list} />;
}

function EmptyState() {
  return (
    <div className="view variant-view variant-empty">
      <div className="variant-page-kicker">{UX_TITLE}</div>
      <h1 className="variant-page-title">Build your first training workspace</h1>
      <p>{UX_SHORT}</p>
      <Link to="/horses/new" className="btn btn-leather">Add your first horse</Link>
    </div>
  );
}

function SingleHorseRedirect({ horseId }: { horseId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/horses/${horseId}`, { replace: true });
  }, [horseId, navigate]);
  return (
    <div className="view variant-view">
      <div className="variant-loading-card">Opening horse workspace…</div>
    </div>
  );
}

function VariantToday({ horses }: { horses: Horse[] }) {
  const phases = useQuery(() => listPhases(), []);
  const phasesById = new Map<string, Phase>((phases.data ?? []).map((p) => [p.id, p]));
  const [activeId] = useActiveHorseId();
  const activeHorse = horses.find((h) => h.id === activeId) ?? horses[0];
  const inPhase = horses.filter((h) => h.current_phase_id).length;
  const needsPhase = horses.length - inPhase;

  if (UX_VARIANT === "ux-command-map") {
    return <CommandMap horses={horses} activeHorse={activeHorse} phasesById={phasesById} inPhase={inPhase} />;
  }
  if (UX_VARIANT === "ux-session-kiosk") {
    return <SessionKiosk horses={horses} activeHorse={activeHorse} phasesById={phasesById} needsPhase={needsPhase} />;
  }
  if (UX_VARIANT === "ux-stable-kanban") {
    return <StableKanban horses={horses} phasesById={phasesById} />;
  }
  if (UX_VARIANT === "ux-profile-crm") {
    return <ProfileCrm horses={horses} activeHorse={activeHorse} phasesById={phasesById} />;
  }
  return <MobileCoach horses={horses} activeHorse={activeHorse} phasesById={phasesById} />;
}

function CommandMap({ horses, activeHorse, phasesById, inPhase }: { horses: Horse[]; activeHorse: Horse; phasesById: Map<string, Phase>; inPhase: number }) {
  return (
    <div className="view variant-view command-map-page">
      <section className="command-map-hero">
        <div>
          <div className="variant-page-kicker">Live command map</div>
          <h1 className="variant-page-title">Run the barn from one split-screen console.</h1>
          <p>{horses.length} active horses, {inPhase} assigned to phases. The active horse stays pinned while the roster becomes a route map.</p>
        </div>
        <div className="command-map-actions">
          <Link to={`/horses/${activeHorse.id}/sessions/new`} className="btn btn-leather">Start {activeHorse.name}</Link>
          <Link to="/horses/new" className="btn">Add horse</Link>
        </div>
      </section>
      <section className="command-map-layout">
        <div className="command-map-roster">
          <div className="variant-section-title">Training route tiles</div>
          {horses.map((horse, index) => <RouteTile key={horse.id} horse={horse} phase={phaseFor(horse, phasesById)} index={index + 1} active={horse.id === activeHorse.id} />)}
        </div>
        <aside className="command-map-inspector">
          <div className="variant-section-title">Pinned inspector</div>
          <HorseAvatar name={activeHorse.name} tone={hashTone(activeHorse.name)} size={86} />
          <h2>{activeHorse.name}</h2>
          <p>{activeHorse.owner_name ? `Owner: ${activeHorse.owner_name}` : "Owner not entered"}</p>
          <div className="inspector-stat"><span>Current phase</span><strong>{phaseFor(activeHorse, phasesById) || "Unassigned"}</strong></div>
          <div className="inspector-stat"><span>Training day</span><strong>{trainingDay(activeHorse)}</strong></div>
          <Link to={`/horses/${activeHorse.id}`} className="btn btn-leather">Open workspace</Link>
          <Link to={`/horses/${activeHorse.id}/sessions/new`} className="btn">Log session</Link>
        </aside>
      </section>
    </div>
  );
}

function SessionKiosk({ horses, activeHorse, phasesById, needsPhase }: { horses: Horse[]; activeHorse: Horse; phasesById: Map<string, Phase>; needsPhase: number }) {
  return (
    <div className="view variant-view kiosk-page">
      <section className="kiosk-stage">
        <div className="kiosk-stepper"><span className="is-current">1 Pick horse</span><span>2 Log session</span><span>3 Decide phase</span></div>
        <h1 className="variant-page-title">Who are we training right now?</h1>
        <p>Designed for a tablet on the barn wall: fewer lists, bigger tap targets, and a session-first workflow.</p>
        <div className="kiosk-primary-card">
          <HorseAvatar name={activeHorse.name} tone={hashTone(activeHorse.name)} size={96} />
          <div><small>Suggested next</small><h2>{activeHorse.name}</h2><p>{phaseFor(activeHorse, phasesById) || "Ready for phase assignment"} · {trainingDay(activeHorse)}</p></div>
          <Link to={`/horses/${activeHorse.id}/sessions/new`} className="btn btn-leather">Begin session</Link>
        </div>
      </section>
      <section className="kiosk-picker">
        <div className="variant-section-title">Tap a horse to start</div>
        {horses.map((horse) => <KioskHorse key={horse.id} horse={horse} phase={phaseFor(horse, phasesById)} />)}
      </section>
      <aside className="kiosk-status"><strong>{needsPhase}</strong><span>need phase review</span><Link to="/reference">Open TQA guide</Link></aside>
    </div>
  );
}

function StableKanban({ horses, phasesById }: { horses: Horse[]; phasesById: Map<string, Phase> }) {
  const groups = new Map<string, Horse[]>();
  horses.forEach((horse) => {
    const key = phaseFor(horse, phasesById) || "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), horse]);
  });
  return (
    <div className="view variant-view kanban-page">
      <section className="kanban-topline">
        <div><div className="variant-page-kicker">Stable board</div><h1 className="variant-page-title">Manage training like a phase pipeline.</h1></div>
        <Link to="/horses/new" className="btn btn-leather">Add card</Link>
      </section>
      <section className="kanban-board">
        {Array.from(groups.entries()).map(([phase, group]) => (
          <div className="kanban-column" key={phase}>
            <div className="kanban-column-head"><strong>{phase}</strong><span>{group.length}</span></div>
            {group.map((horse) => <KanbanCard key={horse.id} horse={horse} phase={phase} />)}
          </div>
        ))}
      </section>
    </div>
  );
}

function ProfileCrm({ horses, activeHorse, phasesById }: { horses: Horse[]; activeHorse: Horse; phasesById: Map<string, Phase> }) {
  return (
    <div className="view variant-view crm-page">
      <section className="crm-directory">
        <div className="variant-page-kicker">Client roster CRM</div>
        <h1 className="variant-page-title">Every horse becomes a profile account.</h1>
        <div className="crm-search">Search by horse, owner, phase, or next decision…</div>
        {horses.map((horse) => <CrmProfile key={horse.id} horse={horse} phase={phaseFor(horse, phasesById)} active={horse.id === activeHorse.id} />)}
      </section>
      <aside className="crm-timeline">
        <div className="variant-section-title">Relationship timeline</div>
        <h2>{activeHorse.name}</h2>
        {["Review last session notes", "Send owner update", "Confirm next TQA decision"].map((label, index) => (
          <div className="timeline-item" key={label}><span>{index + 1}</span><strong>{label}</strong><small>{index === 0 ? "Today" : index === 1 ? "After session" : "Next checkpoint"}</small></div>
        ))}
        <Link to={`/horses/${activeHorse.id}`} className="btn btn-leather">Open full profile</Link>
      </aside>
    </div>
  );
}

function MobileCoach({ horses, activeHorse, phasesById }: { horses: Horse[]; activeHorse: Horse; phasesById: Map<string, Phase> }) {
  return (
    <div className="view variant-view mobile-coach-page">
      <section className="coach-hero-card">
        <div className="variant-page-kicker">Coach companion</div>
        <h1 className="variant-page-title">Today’s ride plan in your pocket.</h1>
        <p>Swipe-style cards, a sticky action tray, and mobile-first hierarchy for walking the aisle.</p>
      </section>
      <section className="coach-story-strip">
        {horses.slice(0, 8).map((horse) => <Link to={`/horses/${horse.id}`} className="coach-story" key={horse.id}><HorseAvatar name={horse.name} tone={hashTone(horse.name)} /><span>{horse.name}</span></Link>)}
      </section>
      <section className="coach-card-stack">
        {horses.map((horse) => <CoachCard key={horse.id} horse={horse} phase={phaseFor(horse, phasesById)} featured={horse.id === activeHorse.id} />)}
      </section>
      <div className="coach-action-tray"><span>Ready: {activeHorse.name}</span><Link to={`/horses/${activeHorse.id}/sessions/new`} className="btn btn-leather">Log now</Link></div>
    </div>
  );
}

function RouteTile({ horse, phase, index, active }: { horse: Horse; phase: string | null; index: number; active: boolean }) {
  return <Link to={`/horses/${horse.id}`} className={`route-tile ${active ? "is-active" : ""}`}><span className="route-index">{String(index).padStart(2, "0")}</span><HorseAvatar name={horse.name} tone={hashTone(horse.name)} /><strong>{horse.name}</strong><small>{phase || "Unassigned"} · {trainingDay(horse)}</small></Link>;
}
function KioskHorse({ horse, phase }: { horse: Horse; phase: string | null }) {
  return <Link to={`/horses/${horse.id}/sessions/new`} className="kiosk-horse"><HorseAvatar name={horse.name} tone={hashTone(horse.name)} size={58} /><span><strong>{horse.name}</strong><small>{phase || "Set phase"} · {trainingDay(horse)}</small></span><em>Start</em></Link>;
}
function KanbanCard({ horse, phase }: { horse: Horse; phase: string }) {
  return <article className="kanban-card"><Link to={`/horses/${horse.id}`}><strong>{horse.name}</strong></Link><small>{horse.owner_name || "No owner"}</small><p>{trainingDay(horse)} · {phase}</p><Link to={`/horses/${horse.id}/sessions/new`} className="btn btn-sm">Session</Link></article>;
}
function CrmProfile({ horse, phase, active }: { horse: Horse; phase: string | null; active: boolean }) {
  return <Link to={`/horses/${horse.id}`} className={`crm-profile ${active ? "is-active" : ""}`}><HorseAvatar name={horse.name} tone={hashTone(horse.name)} size={54} /><span><strong>{horse.name}</strong><small>{horse.owner_name || "Owner missing"}</small></span><em>{phase || "No phase"}</em></Link>;
}
function CoachCard({ horse, phase, featured }: { horse: Horse; phase: string | null; featured: boolean }) {
  return <article className={`coach-card ${featured ? "is-featured" : ""}`}><div><HorseAvatar name={horse.name} tone={hashTone(horse.name)} size={72} /><span><strong>{horse.name}</strong><small>{phase || "Phase review"}</small></span></div><p>{trainingDay(horse)} · {horse.owner_name ? `Owner: ${horse.owner_name}` : "Owner not entered"}</p><footer><Link to={`/horses/${horse.id}`} className="btn">Open</Link><Link to={`/horses/${horse.id}/sessions/new`} className="btn btn-leather">Log</Link></footer></article>;
}
function phaseFor(horse: Horse, phasesById: Map<string, Phase>) {
  return horse.current_phase_id ? phasesById.get(horse.current_phase_id)?.name ?? null : null;
}
function trainingDay(horse: Horse) {
  if (!horse.arrival_date) return "No arrival date";
  const day = differenceInCalendarDays(new Date(), parseISO(horse.arrival_date)) + 1;
  return `Day ${day}`;
}
