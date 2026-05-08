import { Link } from "react-router-dom";
import { useMemo } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import {
  listEngagementsForHorse,
  listHorses,
  listPhases,
  listSessionsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { useActiveHorseId } from "../state/activeHorse";
import { round1, sessionAverage, sessionAverages, trend } from "../utils/stats";
import Sparkline from "../components/Sparkline";

const ADVANCE_THRESHOLD = 2.0;

export default function Dashboard() {
  const horses = useQuery(() => listHorses(false), []);
  const phases = useQuery(() => listPhases(), []);
  const [activeId] = useActiveHorseId();

  const horse =
    horses.data?.find((h) => h.id === activeId) ?? horses.data?.[0] ?? null;

  const engagements = useQuery(
    () =>
      horse ? listEngagementsForHorse(horse.id) : Promise.resolve([]),
    [horse?.id],
  );

  const sessions = useQuery(
    () => (horse ? listSessionsForHorse(horse.id) : Promise.resolve([])),
    [horse?.id],
  );

  const sortedEngagements = useMemo(() => {
    const data = engagements.data ?? [];
    return [...data].sort((a, b) => {
      const ad = a.arrival_date ?? a.created_at;
      const bd = b.arrival_date ?? b.created_at;
      return bd.localeCompare(ad);
    });
  }, [engagements.data]);
  const activeEngagement = sortedEngagements[0] ?? null;

  const sortedSessions = useMemo(
    () =>
      [...(sessions.data ?? [])].sort((a, b) =>
        a.occurred_at.localeCompare(b.occurred_at),
      ),
    [sessions.data],
  );
  const latestSession = sortedSessions[sortedSessions.length - 1] ?? null;

  if (horses.loading || phases.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }

  if (!horse) {
    return (
      <div className="view">
        <div className="eyebrow">Today</div>
        <h1 className="h-display">No horse registered</h1>
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <p className="muted" style={{ margin: 0 }}>
            Register your first horse to start logging Training Quality
            Assessments.
          </p>
          <Link to="/horses/new" className="btn btn-leather">
            + Register first horse
          </Link>
        </div>
      </div>
    );
  }

  const points = sessionAverages(sortedSessions);
  const trendInfo = trend(points);

  const currentPhase = latestSession
    ? phases.data?.find((p) => p.id === latestSession.phase_id) ?? null
    : null;
  const phaseIdx =
    currentPhase && phases.data
      ? phases.data.findIndex((p) => p.id === currentPhase.id)
      : -1;
  const nextPhase =
    phaseIdx >= 0 && phases.data && phaseIdx < phases.data.length - 1
      ? phases.data[phaseIdx + 1]
      : null;

  const today = new Date();
  const dateLabel = format(today, "EEEE, MMMM d");

  const arrival = activeEngagement?.arrival_date
    ? new Date(activeEngagement.arrival_date + "T12:00:00")
    : null;
  const dayN = arrival ? differenceInCalendarDays(today, arrival) + 1 : null;

  const latestAvg = latestSession
    ? sessionAverage(latestSession.ratings)
    : null;

  const recent = sortedSessions.slice(-7);
  const recentScores: number[] = [];
  for (const s of recent) for (const r of s.ratings ?? []) recentScores.push(r.score);
  const recentAvg =
    recentScores.length > 0
      ? recentScores.reduce((sum, n) => sum + n, 0) / recentScores.length
      : null;

  const baseline = sortedSessions.slice(0, Math.max(0, sortedSessions.length - 7));
  const baselineScores: number[] = [];
  for (const s of baseline) for (const r of s.ratings ?? []) baselineScores.push(r.score);
  const baselineAvg =
    baselineScores.length > 0
      ? baselineScores.reduce((sum, n) => sum + n, 0) / baselineScores.length
      : null;

  const sparkValues = points
    .map((p) => p.combinedAverage)
    .filter((v): v is number => v !== null);

  const fmtAvg = (v: number | null) => round1(v);
  const deltaTone =
    latestAvg !== null && baselineAvg !== null
      ? latestAvg >= baselineAvg
        ? "pos"
        : "neg"
      : null;
  const deltaArrow = deltaTone === "pos" ? "▲" : deltaTone === "neg" ? "▼" : "";

  const sessionCount = sortedSessions.length;

  return (
    <div className="view">
      <div className="eyebrow">
        {dateLabel}
        {dayN !== null ? ` · Day ${dayN}` : ""}
      </div>
      <h1 className="h-display">Today's session with {horse.name}</h1>

      <div className="today-summary">
        <div className="summary-tile">
          <span className="lab">Current phase</span>
          <span className="val">{currentPhase?.name ?? "—"}</span>
          <span className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>
            {nextPhase ? `Next up: ${nextPhase.name}` : "Final phase reached"}
          </span>
        </div>
        <div className="summary-tile">
          <span className="lab">Latest session avg</span>
          <span
            className="val"
            style={{
              color:
                latestAvg === null
                  ? "var(--muted)"
                  : latestAvg > 0
                    ? "var(--ok)"
                    : latestAvg < 0
                      ? "var(--bad)"
                      : "var(--ink-2)",
            }}
          >
            {fmtAvg(latestAvg)}
          </span>
          <span className="delta mono">
            {sessionCount} session{sessionCount === 1 ? "" : "s"} logged
          </span>
        </div>
        <div className="summary-tile">
          <span className="lab">7-session average</span>
          <span className="val">{fmtAvg(recentAvg)}</span>
          {latestAvg !== null && baselineAvg !== null && (
            <span className={`delta mono ${deltaTone}`}>
              {deltaArrow} {Math.abs(latestAvg - baselineAvg).toFixed(2)} vs prior
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--gap)" }}>
        <div className="card-head">
          <h2 className="card-title">Session trend</h2>
          <span className="card-meta">−3 to +3 scale · per session</span>
        </div>
        {sparkValues.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No sessions recorded yet for {horse.name}.
          </p>
        ) : (
          <div style={{ color: "var(--leather)" }}>
            <Sparkline
              values={sparkValues}
              width={800}
              height={90}
              stroke="currentColor"
              dotLast
            />
            <div
              className="mono muted"
              style={{ fontSize: 10, marginTop: 4, letterSpacing: 1.2 }}
            >
              Combined session average · −3 to +3 scale
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span className="mono muted" style={{ fontSize: 11 }}>
            {trendInfo.direction === "n/a"
              ? "Need more sessions to compute a trend"
              : `Trend ${trendInfo.direction === "up" ? "rising ▲" : trendInfo.direction === "down" ? "falling ▼" : "flat →"} ${trendInfo.delta?.toFixed(2) ?? ""}`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/horses/${horse.id}`} className="btn btn-ghost">
              View progress
            </Link>
            {activeEngagement ? (
              <Link
                to={`/engagements/${activeEngagement.id}`}
                className="btn btn-leather"
              >
                Open engagement
              </Link>
            ) : (
              <Link
                to={`/horses/${horse.id}/engagements/new`}
                className="btn btn-leather"
              >
                + Start engagement
              </Link>
            )}
          </div>
        </div>
      </div>

      {nextPhase && recentAvg !== null && recentAvg >= ADVANCE_THRESHOLD && (
        <div className="banner" style={{ marginTop: "var(--gap)" }}>
          <div>
            <strong
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                display: "block",
              }}
            >
              Ready to advance to {nextPhase.name}?
            </strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Recent average: {fmtAvg(recentAvg)} · TQA recommends{" "}
              +{ADVANCE_THRESHOLD.toFixed(1)} or higher.
            </div>
          </div>
          <Link to={`/horses/${horse.id}`} className="btn">
            Review advance
          </Link>
        </div>
      )}
    </div>
  );
}
