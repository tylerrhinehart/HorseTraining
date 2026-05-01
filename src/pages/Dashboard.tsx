import { Link } from "react-router-dom";
import { listHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";

export default function Dashboard() {
  const horses = useQuery(() => listHorses(false), []);
  const phases = useQuery(() => listPhases(), []);

  const phaseName = (id: string | null) =>
    phases.data?.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Quick view of horses currently in training.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/horses/new" className="btn-primary text-sm">
            + Register horse
          </Link>
          <Link to="/phases" className="btn-secondary text-sm">
            Phases
          </Link>
        </div>
      </div>

      {horses.loading && (
        <div className="card text-slate-400">Loading…</div>
      )}
      {!horses.loading && (horses.data ?? []).length === 0 && (
        <div className="card text-center text-slate-400">
          No horses yet.{" "}
          <Link to="/horses/new" className="underline text-brand-500">
            Register your first one
          </Link>
          .
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(horses.data ?? []).map((h) => (
          <div key={h.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/horses/${h.id}`}
                className="text-lg font-semibold hover:underline"
              >
                {h.name}
              </Link>
              <span className="pill bg-brand-600/20 text-brand-100 border border-brand-600/40">
                {phaseName(h.current_phase_id)}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {h.breed && <span>{h.breed}</span>}
              {h.owner_name && <span> · Owner: {h.owner_name}</span>}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                to={`/horses/${h.id}/tqa/new`}
                className="btn-primary text-xs"
              >
                Record TQA
              </Link>
              <Link to={`/horses/${h.id}`} className="btn-ghost text-xs">
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
