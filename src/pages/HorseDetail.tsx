import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import {
  archiveHorse,
  deleteHorse,
  getHorse,
  listEngagementsForHorse,
  listSessionsForHorse,
  unarchiveHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";
import { useActiveHorseId } from "../state/activeHorse";
import { round1, sessionAverages, trend } from "../utils/stats";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import Sparkline from "../components/Sparkline";

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, setActiveId] = useActiveHorseId();

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const engagements = useQuery(
    () => (id ? listEngagementsForHorse(id) : Promise.resolve([])),
    [id],
  );
  const sessions = useQuery(
    () => (id ? listSessionsForHorse(id) : Promise.resolve([])),
    [id],
  );

  useEffect(() => {
    if (id && horse.data && !horse.data.archived_at) setActiveId(id);
  }, [id, horse.data, setActiveId]);

  if (!id) return null;
  if (horse.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }
  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">
          Horse not found.{" "}
          <Link to="/horses" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
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

  const points = sessionAverages(sessions.data ?? []);
  const sparkValues = points
    .map((p) => p.combinedAverage)
    .filter((v): v is number => v !== null);
  const trendInfo = trend(points);
  const sessionCount = sessions.data?.length ?? 0;
  const overallAvg =
    sparkValues.length > 0
      ? sparkValues.reduce((s, n) => s + n, 0) / sparkValues.length
      : null;

  return (
    <div className="view">
      <div className="eyebrow">Horse profile</div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 4,
        }}
      >
        <HorseAvatar
          name={horse.data.name}
          tone={hashTone(horse.data.name)}
          size={64}
        />
        <div style={{ flex: 1 }}>
          <h1
            className="h-display"
            style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}
          >
            {horse.data.name}
            {horse.data.archived_at && (
              <span className="pill pill-muted">Archived</span>
            )}
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {horse.data.breed && <>{horse.data.breed} · </>}
            {horse.data.sex && <>{horse.data.sex} · </>}
            {horse.data.color && <>{horse.data.color} · </>}
            Added {formatHumanDate(horse.data.created_at)}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "flex-end",
          margin: "12px 0 14px",
        }}
      >
        <Link
          to={`/horses/${id}/engagements/new`}
          className="btn btn-leather btn-sm"
        >
          + New engagement
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={handleArchive}>
          {horse.data.archived_at ? "Unarchive" : "Archive"}
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          Delete
        </button>
      </div>

      {sessionCount > 0 && (
        <div className="today-summary">
          <div className="summary-tile">
            <span className="lab">Sessions</span>
            <span className="val">{sessionCount}</span>
            <span className="delta mono">total logged</span>
          </div>
          <div className="summary-tile">
            <span className="lab">Overall average</span>
            <span
              className="val"
              style={{
                color:
                  overallAvg === null
                    ? "var(--muted)"
                    : overallAvg > 0
                      ? "var(--ok)"
                      : overallAvg < 0
                        ? "var(--bad)"
                        : "var(--ink-2)",
              }}
            >
              {round1(overallAvg)}
            </span>
            <span className="delta mono">−3 to +3 scale</span>
          </div>
          <div className="summary-tile">
            <span className="lab">Trend</span>
            <span className="val" style={{ fontSize: 22 }}>
              {trendInfo.direction === "up"
                ? "Rising ▲"
                : trendInfo.direction === "down"
                  ? "Falling ▼"
                  : trendInfo.direction === "flat"
                    ? "Flat →"
                    : "—"}
            </span>
            {trendInfo.delta !== null && (
              <span className="delta mono">
                Δ {trendInfo.delta.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {sparkValues.length > 1 && (
        <div className="card" style={{ marginTop: "var(--gap)" }}>
          <div className="card-head">
            <h2 className="card-title">Session trend</h2>
            <span className="card-meta">combined average · per session</span>
          </div>
          <div style={{ color: "var(--leather)" }}>
            <Sparkline
              values={sparkValues}
              width={800}
              height={80}
              stroke="currentColor"
              dotLast
            />
          </div>
        </div>
      )}

      {horse.data.notes && (
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Notes</h2>
          </div>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14 }}>
            {horse.data.notes}
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Training engagements</h2>
          <span className="card-meta">
            {engagements.data?.length ?? 0} total
          </span>
        </div>
      </div>
      {engagements.loading && (
        <div className="card muted">Loading…</div>
      )}
      {!engagements.loading && (engagements.data ?? []).length === 0 && (
        <div className="card muted" style={{ textAlign: "center" }}>
          No engagements yet.{" "}
          <Link
            to={`/horses/${id}/engagements/new`}
            style={{ color: "var(--leather)" }}
          >
            Start one
          </Link>
          .
        </div>
      )}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {(engagements.data ?? []).map((e) => (
          <Link
            key={e.id}
            to={`/engagements/${e.id}`}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {e.owner_name ?? "Owner unspecified"}
                </div>
                <div className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {e.arrival_date
                    ? `Arrived ${formatHumanDate(e.arrival_date)}`
                    : "No arrival date"}
                  {e.departure_date
                    ? ` · departs ${formatHumanDate(e.departure_date)}`
                    : ""}
                </div>
              </div>
              {e.archived_at && (
                <span className="pill pill-muted">Archived</span>
              )}
            </div>
            {e.payment_amount !== null && (
              <div className="mono muted" style={{ fontSize: 12 }}>
                Payment: ${e.payment_amount.toFixed(2)}
                {e.payment_method ? ` (${e.payment_method})` : ""}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
