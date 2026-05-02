import { Link, useNavigate, useParams } from "react-router-dom";
import {
  archiveHorse,
  deleteHorse,
  getHorse,
  listEngagementsForHorse,
  unarchiveHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const engagements = useQuery(
    () => (id ? listEngagementsForHorse(id) : Promise.resolve([])),
    [id],
  );

  if (!id) return null;
  if (horse.loading) return <div className="card">Loading…</div>;
  if (!horse.data) {
    return (
      <div className="card">
        Horse not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  const handleArchive = async () => {
    if (horse.data!.archived_at) {
      await unarchiveHorse(id);
    } else {
      await archiveHorse(id);
    }
    horse.refresh();
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Permanently delete "${horse.data!.name}", all engagements, and all sessions? This cannot be undone.`,
      )
    )
      return;
    await deleteHorse(id);
    navigate("/horses");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {horse.data.name}
            {horse.data.archived_at && (
              <span className="pill bg-slate-700 text-slate-300">
                Archived
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {horse.data.breed && <>{horse.data.breed} · </>}
            {horse.data.sex && <>{horse.data.sex} · </>}
            {horse.data.color && <>{horse.data.color} · </>}
            Added {formatHumanDate(horse.data.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/horses/${id}/engagements/new`}
            className="btn-primary text-sm"
          >
            + New engagement
          </Link>
          <button className="btn-ghost text-sm" onClick={handleArchive}>
            {horse.data.archived_at ? "Unarchive" : "Archive"}
          </button>
          <button className="btn-danger text-sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {horse.data.notes && (
        <div className="card">
          <h2 className="font-semibold mb-1">Notes</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {horse.data.notes}
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Training engagements</h2>
        {engagements.loading && (
          <div className="card text-slate-400">Loading…</div>
        )}
        {!engagements.loading && (engagements.data ?? []).length === 0 && (
          <div className="card text-center text-slate-400">
            No engagements yet.{" "}
            <Link
              to={`/horses/${id}/engagements/new`}
              className="underline text-brand-500"
            >
              Start one
            </Link>
            .
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
                  <div className="font-medium">
                    {e.owner_name ?? "Owner unspecified"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {e.arrival_date
                      ? `Arrived ${formatHumanDate(e.arrival_date)}`
                      : "No arrival date"}
                    {e.departure_date
                      ? ` · departs ${formatHumanDate(e.departure_date)}`
                      : ""}
                  </div>
                </div>
                {e.archived_at && (
                  <span className="pill bg-slate-700 text-slate-300">
                    Archived
                  </span>
                )}
              </div>
              {e.payment_amount !== null && (
                <div className="text-xs text-slate-400">
                  Payment: ${e.payment_amount.toFixed(2)}
                  {e.payment_method ? ` (${e.payment_method})` : ""}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
