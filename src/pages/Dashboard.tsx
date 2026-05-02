import { Link } from "react-router-dom";
import { listEngagements, listHorses } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";

export default function Dashboard() {
  const horses = useQuery(() => listHorses(false), []);
  const engagements = useQuery(() => listEngagements(false), []);

  const horseName = (id: string) =>
    horses.data?.find((h) => h.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Active engagements and horses currently in training.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/horses/new" className="btn-primary text-sm">
            + Register horse
          </Link>
          <Link to="/foundation" className="btn-secondary text-sm">
            Foundation doctrine
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Active engagements</h2>
        {engagements.loading && (
          <div className="card text-slate-400">Loading…</div>
        )}
        {!engagements.loading && (engagements.data ?? []).length === 0 && (
          <div className="card text-center text-slate-400">
            No active engagements. Register a horse and start one.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {(engagements.data ?? []).map((e) => (
            <Link
              key={e.id}
              to={`/engagements/${e.id}`}
              className="card hover:ring-2 hover:ring-brand-500 transition flex flex-col gap-2"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-medium">{horseName(e.horse_id)}</div>
                  <div className="text-xs text-slate-400">
                    {e.owner_name ?? "Owner unspecified"}
                  </div>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  {e.arrival_date ? formatHumanDate(e.arrival_date) : "—"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Horses</h2>
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
              </div>
              <div className="text-xs text-slate-400">
                {h.breed && <span>{h.breed}</span>}
                {h.sex && <span> · {h.sex}</span>}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  to={`/horses/${h.id}/engagements/new`}
                  className="btn-primary text-xs"
                >
                  + Engagement
                </Link>
                <Link to={`/horses/${h.id}`} className="btn-ghost text-xs">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
