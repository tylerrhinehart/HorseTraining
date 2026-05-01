import { Link, useSearchParams } from "react-router-dom";
import {
  setActiveHorse,
  useActiveHorse,
  useHorses,
} from "../db/queries";
import { endDate, formatHumanDate, isTrainingComplete } from "../utils/dates";

export default function HorsesList() {
  const [params, setParams] = useSearchParams();
  const showArchived = params.get("filter") === "archived";
  const horses = useHorses(showArchived) ?? [];
  const active = useActiveHorse();

  const visible = showArchived
    ? horses.filter((h) => !!h.archivedAt)
    : horses;

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

      {visible.length === 0 ? (
        <div className="card text-center text-slate-400">
          {showArchived
            ? "No archived horses."
            : "No horses yet. Register your first one to get started."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((h) => {
            const isActive = active?.id === h.id;
            const complete = isTrainingComplete(h.startDate, h.durationDays);
            return (
              <div
                key={h.id}
                className={[
                  "card flex flex-col gap-2",
                  isActive ? "ring-2 ring-brand-500" : "",
                ].join(" ")}
              >
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
                      {h.ownerName && <span>· Owner: {h.ownerName}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isActive && (
                      <span className="pill bg-brand-600 text-white">
                        Active
                      </span>
                    )}
                    {h.archivedAt && (
                      <span className="pill bg-slate-700 text-slate-300">
                        Archived
                      </span>
                    )}
                    {!h.archivedAt && complete && (
                      <span className="pill bg-emerald-600 text-white">
                        Training complete
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatHumanDate(h.startDate)} →{" "}
                  {formatHumanDate(endDate(h.startDate, h.durationDays))}{" "}
                  ({h.durationDays} days)
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {!h.archivedAt && !isActive && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => setActiveHorse(h.id)}
                    >
                      Set active
                    </button>
                  )}
                  <Link
                    to={`/horses/${h.id}`}
                    className="btn-ghost text-xs"
                  >
                    View progress
                  </Link>
                  <Link
                    to={`/evaluate/${h.id}`}
                    className="btn-ghost text-xs"
                  >
                    Evaluate today
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
