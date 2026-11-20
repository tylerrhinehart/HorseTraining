import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listInTrainingHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { useRosterWork } from "../hooks/useRosterWork";
import { programLabel } from "../content/programs";

export default function HorseWorkflowLayout({children}: {children: ReactNode}) {
  const {id} = useParams();
  const navigate = useNavigate();
  const horses = useQuery(qk.horses("in_training"), listInTrainingHorses);
  const phases = useQuery(qk.phases(), listPhases);
  const {summaries} = useRosterWork();
  const roster = horses.data ?? [];
  return <div className="horse-workspace">
    {roster.length > 0 && <nav className="workspace-roster card" aria-label="Horses in training"><h2 className="card-title">Horses in training</h2>
      {roster.map(h => <Link key={h.id} aria-current={id === h.id ? "page" : undefined} to={`/horses/${h.id}`}>
        <strong>{h.name}</strong><small>{programLabel(h.training_type)}</small>
        <small>{h.training_type === "foundation" ? phases.data?.find(p => p.id === h.current_phase_id)?.name : summaries?.get(h.id)}</small>
      </Link>)}
    </nav>}
    <div key={id} className="workspace-body">
      {roster.length > 0 && <label className="workspace-switch label">Horse<select className="input" value={id}
        onChange={e => navigate(`/horses/${e.target.value}`)}>
        {!roster.some(h => h.id === id) && <option value={id}>Current horse</option>}
        {roster.map(h => <option key={h.id} value={h.id}>{h.name} · {programLabel(h.training_type)}</option>)}
      </select></label>}
      {children}
    </div>
  </div>;
}
