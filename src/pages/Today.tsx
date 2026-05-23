import { Link } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import { useActiveHorseId } from "../state/activeHorse";
import { listInTrainingHorses, listPhases } from "../supabase/queries";
import type { Horse, Phase } from "../supabase/types";
import { useQuery } from "../supabase/useQuery";

const UX_CONCEPT: string = "clipboard";
const UX_TITLE = "Field Clipboard";

export default function Today() {
  const horses = useQuery(() => listInTrainingHorses(), []);
  const phases = useQuery(() => listPhases(), []);

  if (horses.loading) {
    return <div className="view ux-lab-view"><div className="ux-lab-loading">Loading {UX_TITLE}…</div></div>;
  }

  const list = horses.data ?? [];
  const phaseMap = new Map<string, Phase>((phases.data ?? []).map((p) => [p.id, p]));
  if (list.length === 0) return <Empty />;
  return <ConceptHome horses={list} phaseMap={phaseMap} />;
}

function Empty() {
  return <div className="view ux-lab-view ux-empty-lab"><p className="ux-kicker">{UX_TITLE}</p><h1>Design your first training flow</h1><p>This variant now starts with an actual workflow, not a redirect or restyled list.</p><Link className="btn btn-leather" to="/horses/new">Add first horse</Link></div>;
}

function ConceptHome({ horses, phaseMap }: { horses: Horse[]; phaseMap: Map<string, Phase> }) {
  const [activeId] = useActiveHorseId();
  const active = horses.find((h) => h.id === activeId) ?? horses[0];
  const unassigned = horses.filter((h) => !h.current_phase_id).length;
  if (UX_CONCEPT === "ledger") return <Ledger horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "arena") return <Arena horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "pasture") return <Pasture horses={horses} active={active} phaseMap={phaseMap} unassigned={unassigned} />;
  if (UX_CONCEPT === "premium") return <Premium horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "clipboard") return <Clipboard horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "command") return <Command horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "kiosk") return <Kiosk horses={horses} active={active} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "kanban") return <Kanban horses={horses} phaseMap={phaseMap} />;
  if (UX_CONCEPT === "crm") return <Crm horses={horses} active={active} phaseMap={phaseMap} />;
  return <Coach horses={horses} active={active} phaseMap={phaseMap} />;
}

function Ledger({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-ledger-workflow"><section className="ledger-spread"><aside><p className="ux-kicker">Bound logbook</p><h1>Today’s training ledger</h1><p>No redirect: even one horse opens a planning desk with notes, next session, and phase evidence.</p><Link className="btn btn-leather" to={`/horses/${active.id}/sessions/new`}>Write session entry</Link></aside><div className="ledger-pages">{horses.map((h,i)=><HorseLine key={h.id} horse={h} phase={phase(h,phaseMap)} index={i+1} label="Open ledger" />)}</div></section><section className="ledger-checks"><Step title="Observe"/><Step title="Score TQA"/><Step title="Decide phase"/></section></main>;
}
function Arena({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-arena-workflow"><section className="arena-radar"><div><p className="ux-kicker">Night ops radar</p><h1>Pick the next move from the arena map</h1></div><Link className="btn btn-leather" to={`/horses/${active.id}/sessions/new`}>Launch active run</Link></section><section className="arena-panels"><div className="arena-ring">{horses.map((h,i)=><Link key={h.id} to={`/horses/${h.id}`} className={`radar-dot dot-${i%6}`}><HorseAvatar name={h.name} tone={hashTone(h.name)} /><span>{h.name}</span></Link>)}</div><aside className="arena-console"><h2>{active.name}</h2><Stat label="Phase" value={phase(active,phaseMap)}/><Stat label="Training" value={day(active)}/><Link className="btn" to={`/horses/${active.id}`}>Inspect horse</Link></aside></section></main>;
}
function Pasture({ horses, active, phaseMap, unassigned }: Props & { unassigned:number }) {
  return <main className="ux-lab-view ux-pasture-workflow"><section className="pasture-morning-plan"><p className="ux-kicker">Morning route</p><h1>Walk the barn in order</h1><div className="pasture-actions"><PlanChip text={`${horses.length} horses`}/><PlanChip text={`${unassigned} need phase`}/><PlanChip text="15 min review"/></div></section><section className="pasture-path">{horses.map((h,i)=><article key={h.id} className="pasture-stop"><span>{i+1}</span><HorseAvatar name={h.name} tone={hashTone(h.name)} /><div><h3>{h.name}</h3><p>{phase(h,phaseMap)} · {day(h)}</p></div><Link className="btn btn-sm" to={`/horses/${h.id}/sessions/new`}>Start</Link></article>)}</section><aside className="pasture-focus"><h2>Next best action</h2><p>Start with {active.name}, then continue down the route.</p></aside></main>;
}
function Premium({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-premium-workflow"><section className="premium-cover"><p className="ux-kicker">Show portfolio</p><h1>{active.name}</h1><p>{phase(active,phaseMap)} · {day(active)}</p><Link className="btn btn-leather" to={`/horses/${active.id}`}>View profile</Link></section><section className="premium-gallery">{horses.map(h=><Link key={h.id} to={`/horses/${h.id}`} className="premium-card"><HorseAvatar name={h.name} tone={hashTone(h.name)} size={72}/><h2>{h.name}</h2><p>{h.owner_name || "Owner profile pending"}</p><small>{phase(h,phaseMap)}</small></Link>)}</section><section className="premium-decision"><h2>Coach decision</h2><p>Review evidence, then promote or hold phase.</p><Link className="btn" to="/reference">Decision guide</Link></section></main>;
}
function Clipboard({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-clipboard-workflow"><header className="clipboard-header"><p className="ux-kicker">Field clipboard</p><h1>Today’s inspection sheet</h1><Link className="btn btn-leather" to={`/horses/${active.id}/sessions/new`}>Quick log</Link></header><section className="clipboard-sheet"><div className="sheet-row sheet-head"><b>Horse</b><b>Phase</b><b>Check</b><b>Action</b></div>{horses.map(h=><div key={h.id} className="sheet-row"><span>{h.name}</span><span>{phase(h,phaseMap)}</span><label><input type="checkbox" readOnly/> Ready</label><Link to={`/horses/${h.id}`} className="btn btn-sm">Open</Link></div>)}</section></main>;
}
function Command({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-command-workflow"><section className="command-split"><aside><p className="ux-kicker">Command route</p><h1>Active horse pinned. Roster becomes a route map.</h1><Link className="btn btn-leather" to={`/horses/${active.id}/sessions/new`}>Start {active.name}</Link></aside><div className="command-map-grid">{horses.map((h,i)=><HorseLine key={h.id} horse={h} phase={phase(h,phaseMap)} index={i+1} label="Inspect" />)}</div></section></main>;
}
function Kiosk({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-kiosk-workflow"><section className="kiosk-question"><p className="ux-kicker">Barn kiosk</p><h1>Who are we training now?</h1><Link className="btn btn-leather" to={`/horses/${active.id}/sessions/new`}>Start suggested: {active.name}</Link></section><section className="kiosk-choice-wall">{horses.map(h=><Link key={h.id} to={`/horses/${h.id}/sessions/new`} className="kiosk-choice"><HorseAvatar name={h.name} tone={hashTone(h.name)} size={76}/><span>{h.name}</span><small>{phase(h,phaseMap)}</small></Link>)}</section></main>;
}
function Kanban({ horses, phaseMap }: { horses: Horse[]; phaseMap: Map<string, Phase> }) {
  const groups = new Map<string,Horse[]>(); horses.forEach(h=>{const p=phase(h,phaseMap); groups.set(p,[...(groups.get(p)??[]),h]);});
  return <main className="ux-lab-view ux-kanban-workflow"><header><p className="ux-kicker">Phase pipeline</p><h1>Move training forward by column</h1></header><section className="kanban-swimlanes">{Array.from(groups.entries()).map(([p,hs])=><div className="swimlane" key={p}><h2>{p}<span>{hs.length}</span></h2>{hs.map(h=><Link key={h.id} to={`/horses/${h.id}`} className="swim-card"><b>{h.name}</b><small>{day(h)}</small></Link>)}</div>)}</section></main>;
}
function Crm({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-crm-workflow"><section className="crm-master"><p className="ux-kicker">Horse CRM</p><h1>Roster accounts</h1>{horses.map(h=><Link key={h.id} to={`/horses/${h.id}`} className="crm-account"><HorseAvatar name={h.name} tone={hashTone(h.name)}/><span><b>{h.name}</b><small>{h.owner_name || "Owner needed"}</small></span><em>{phase(h,phaseMap)}</em></Link>)}</section><aside className="crm-detail"><h2>{active.name}</h2><Step title="Owner update"/><Step title="Training evidence"/><Step title="Next checkpoint"/><Link className="btn btn-leather" to={`/horses/${active.id}`}>Open account</Link></aside></main>;
}
function Coach({ horses, active, phaseMap }: Props) {
  return <main className="ux-lab-view ux-coach-workflow"><section className="coach-now"><p className="ux-kicker">Pocket coach</p><h1>One-handed ride plan</h1><p>Designed around the next action rather than a dashboard.</p></section><section className="coach-feed">{horses.map(h=><article key={h.id} className="coach-feed-card"><HorseAvatar name={h.name} tone={hashTone(h.name)} size={68}/><div><h2>{h.name}</h2><p>{phase(h,phaseMap)} · {day(h)}</p></div><Link className="btn btn-leather" to={`/horses/${h.id}/sessions/new`}>Log</Link></article>)}</section><div className="coach-sticky"><span>Now: {active.name}</span><Link className="btn" to={`/horses/${active.id}`}>Open</Link></div></main>;
}

type Props = { horses: Horse[]; active: Horse; phaseMap: Map<string, Phase> };
function HorseLine({ horse, phase, index, label }: {horse: Horse; phase: string; index: number; label: string}) { return <Link to={`/horses/${horse.id}`} className="ux-horse-line"><b>{String(index).padStart(2,"0")}</b><HorseAvatar name={horse.name} tone={hashTone(horse.name)} /><span><strong>{horse.name}</strong><small>{phase} · {day(horse)}</small></span><em>{label}</em></Link>; }
function Step({ title }: { title: string }) { return <article className="ux-step"><span>✓</span><strong>{title}</strong></article>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="ux-stat"><span>{label}</span><strong>{value}</strong></div>; }
function PlanChip({ text }: { text: string }) { return <span className="plan-chip">{text}</span>; }
function phase(horse: Horse, phases: Map<string, Phase>) { return horse.current_phase_id ? phases.get(horse.current_phase_id)?.name ?? "Phase review" : "Unassigned"; }
function day(horse: Horse) { if (!horse.arrival_date) return "No arrival date"; return `Day ${differenceInCalendarDays(new Date(), parseISO(horse.arrival_date)) + 1}`; }
