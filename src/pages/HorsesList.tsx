import { Link, useSearchParams } from "react-router-dom";
import { listHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";

export default function HorsesList() {
  const [params, setParams] = useSearchParams();
  const showArchived = params.get("filter") === "archived";

  const horsesQuery = useQuery(() => listHorses(showArchived), [showArchived]);
  const phasesQuery = useQuery(() => listPhases(), []);

  const phaseName = (id: string | null) =>
    phasesQuery.data?.find((p) => p.id === id)?.name ?? "—";

  const horses =
    horsesQuery.data?.filter((h) =>
      showArchived ? !!h.archived_at : !h.archived_at,
    ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Horses</h1>
        <div className="flex items-center gap-2">
          <button
            className={
              showArchived ? "btn-secondary text-sm" : "btn-ghost text-sm"
            }
            onClick={() => {
              const next = new URLSearchParams(params);
              if (showArchived) next.delete("filter");
              else next.set("filter", "archived");
              setParams(next);
            }}
          >
            {showArchived ? "Show active" : "Show archived"}
          </button>
          <Link to="/horses/new" className="btn-primary">
            + Register horse
          </Link>
        </div>
      </div>

      {horsesQuery.loading && (
        <div className="card text-slate-400">Loading horses…</div>
      )}
      {horsesQuery.error && (
        <div className="card text-red-400">{horsesQuery.error.message}</div>
      )}
      {!horsesQuery.loading && horses.length === 0 && (
        <div className="card text-center text-slate-400">
          {showArchived
            ? "No archived horses."
            : "No horses yet. Register your first one to get started."}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {horses.map((h) => (
          <div key={h.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to={`/horses/${h.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {h.name}
                </Link>
                <div className="text-xs text-slate-400 mt-1 space-x-2">
                  {h.breed && <span>{h.breed}</span>}
                  {h.owner_name && <span>· Owner: {h.owner_name}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="pill bg-brand-600/20 text-brand-100 border border-brand-600/40">
                  {phaseName(h.current_phase_id)}
                </span>
                {h.archived_at && (
                  <span className="pill bg-slate-700 text-slate-300">
                    Archived
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {h.start_date
                ? `Started ${formatHumanDate(h.start_date)}`
                : `Added ${formatHumanDate(h.created_at)}`}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link to={`/horses/${h.id}`} className="btn-ghost text-xs">
                View
              </Link>
              <Link
                to={`/horses/${h.id}/tqa/new`}
                className="btn-secondary text-xs"
              >
                Record TQA
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
