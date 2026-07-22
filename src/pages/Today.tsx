import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listInTrainingHorses,
  listPhases,
  listSessionDates,
  getHorse,
  listSessionsForHorse,
  listRatingsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { prefetchQuery } from "../supabase/cache";
import { useActiveHorseId } from "../state/activeHorse";
import { gradientFor, hashTone, initialsOf } from "../components/HorseAvatar";
import { SkeletonCard } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Horse, Phase } from "../supabase/types";

// Warm the horse workspace caches on intent (hover/focus/touch) so tapping a
// card opens instantly.
function prefetchHorse(id: string) {
  prefetchQuery(qk.horse(id), () => getHorse(id));
  prefetchQuery(qk.sessions(id), () => listSessionsForHorse(id));
  prefetchQuery(qk.ratings(id), () => listRatingsForHorse(id));
}

export default function Today() {
  const navigate = useNavigate();
  const horses = useQuery(qk.horses("in_training"), () =>
    listInTrainingHorses(),
  );

  const list = horses.data ?? [];
  const singleId = !horses.loading && list.length === 1 ? list[0].id : null;

  // Single in-training horse: land directly on its workspace (no card flash).
  useEffect(() => {
    if (singleId) navigate(`/horses/${singleId}`, { replace: true });
  }, [singleId, navigate]);

  if (horses.error && horses.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={horses.error} onRetry={horses.refresh} />
      </div>
    );
  }

  // First load or redirecting to a single horse: show the card skeleton layout.
  if (horses.loading || singleId) {
    return (
      <div className="view">
        <div style={{ display: "grid", gap: 10 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    );
  }

  if (list.length === 0) return <EmptyState />;
  return <MultiHorseToday horses={list} />;
}

function EmptyState() {
  return (
    <div className="view" style={{ textAlign: "center" }}>
      <div className="eyebrow">Today</div>
      <h1 className="h-display">No horses yet</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Add a horse to start tracking training.
      </p>
      <Link to="/horses/new" className="btn btn-leather">
        Add your first horse
      </Link>
    </div>
  );
}

function MultiHorseToday({ horses }: { horses: Horse[] }) {
  const phases = useQuery(qk.phases(), () => listPhases());
  const sessionDates = useQuery(qk.sessionDates(), () => listSessionDates());
  const phasesById = new Map<string, Phase>(
    (phases.data ?? []).map((p) => [p.id, p]),
  );
  const [activeId] = useActiveHorseId();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const prevWeekAgo = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const allDates = sessionDates.data ?? [];
  const day = (d: string) => d.slice(0, 10);
  const inTrainingIds = new Set(horses.map((h) => h.id));

  const thisWeek = allDates.filter((s) => day(s.occurred_at) >= weekAgo).length;
  const prevWeek = allDates.filter(
    (s) => day(s.occurred_at) >= prevWeekAgo && day(s.occurred_at) < weekAgo,
  ).length;
  const weekDelta = thisWeek - prevWeek;

  const workedTodayIds = new Set(
    allDates
      .filter((s) => day(s.occurred_at) === today && inTrainingIds.has(s.horse_id))
      .map((s) => s.horse_id),
  );

  // Most recent session date per horse, for the "days since" indicator.
  const lastByHorse = new Map<string, string>();
  for (const s of allDates) {
    const cur = lastByHorse.get(s.horse_id);
    if (!cur || day(s.occurred_at) > cur) lastByHorse.set(s.horse_id, day(s.occurred_at));
  }

  return (
    <div className="view">
      <div className="eyebrow">Today · {format(new Date(), "EEEE, MMM d")}</div>
      <h1 className="h-display">In training</h1>

      <div className="today-summary">
        <div className="summary-tile">
          <span className="lab">Worked today</span>
          <span className="val">
            {workedTodayIds.size}
            <span className="muted" style={{ fontSize: 18 }}>
              {" "}
              / {horses.length}
            </span>
          </span>
          <span className="delta">
            {workedTodayIds.size === horses.length
              ? "Every horse logged — nice."
              : `${horses.length - workedTodayIds.size} still to go`}
          </span>
        </div>
        <div className="summary-tile">
          <span className="lab">Sessions · 7 days</span>
          <span className="val">{sessionDates.loading ? "—" : thisWeek}</span>
          {!sessionDates.loading && (
            <span
              className={`delta${weekDelta > 0 ? " pos" : weekDelta < 0 ? " neg" : ""}`}
            >
              {weekDelta === 0
                ? "level with last week"
                : `${weekDelta > 0 ? "+" : ""}${weekDelta} vs last week`}
            </span>
          )}
        </div>
        <div className="summary-tile">
          <span className="lab">In training</span>
          <span className="val">{horses.length}</span>
          <span className="delta">
            <Link to="/horses" style={{ color: "var(--leather)" }}>
              View roster →
            </Link>
          </span>
        </div>
      </div>

      <div className="roster">
        {horses.map((h) => (
          <TodayCard
            key={h.id}
            horse={h}
            phasesById={phasesById}
            isActive={h.id === activeId}
            workedToday={workedTodayIds.has(h.id)}
            lastSession={lastByHorse.get(h.id) ?? null}
            datesReady={!sessionDates.loading || sessionDates.data !== undefined}
          />
        ))}
      </div>
    </div>
  );
}

function TodayCard({
  horse,
  phasesById,
  isActive,
  workedToday,
  lastSession,
  datesReady,
}: {
  horse: Horse;
  phasesById: Map<string, Phase>;
  isActive: boolean;
  workedToday: boolean;
  lastSession: string | null;
  datesReady: boolean;
}) {
  const navigate = useNavigate();
  const phase = horse.current_phase_id
    ? phasesById.get(horse.current_phase_id)
    : null;
  const arrival = horse.arrival_date ? parseISO(horse.arrival_date) : null;
  const dayN = arrival ? differenceInCalendarDays(new Date(), arrival) + 1 : null;
  const sinceDays = lastSession
    ? differenceInCalendarDays(new Date(), parseISO(lastSession))
    : null;
  const warm = () => prefetchHorse(horse.id);

  let workedLine: { text: string; tone: string } | null = null;
  if (datesReady) {
    if (workedToday) {
      workedLine = { text: "✓ Logged today", tone: "var(--ok)" };
    } else if (sinceDays === null) {
      workedLine = { text: "No sessions yet", tone: "var(--muted)" };
    } else if (sinceDays <= 1) {
      workedLine = { text: "Last worked yesterday", tone: "var(--muted)" };
    } else {
      workedLine = {
        text: `${sinceDays} days since last session`,
        tone: sinceDays >= 3 ? "var(--rust)" : "var(--muted)",
      };
    }
  }

  return (
    <div
      className={`horse-card ${isActive ? "is-active" : ""}`}
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      onClick={() => navigate(`/horses/${horse.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="horse-photo" style={{ background: gradientFor(hashTone(horse.name)) }}>
        <span className="horse-initials">{initialsOf(horse.name)}</span>
        {isActive && <span className="horse-active-flag">In session</span>}
      </div>
      <div className="horse-body">
        <h3 className="horse-name">
          <Link
            to={`/horses/${horse.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
            onClick={(e) => e.stopPropagation()}
          >
            {horse.name}
          </Link>
        </h3>
        <span className="horse-sub">
          {horse.owner_name ? `Owner: ${horse.owner_name}` : "—"}
          {phase ? ` · ${phase.name}` : ""}
          {dayN != null ? ` · Day ${dayN}` : ""}
        </span>
        {workedLine && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: workedLine.tone,
            }}
          >
            {workedLine.text}
          </span>
        )}
        <Link
          to={`/horses/${horse.id}/sessions/new`}
          className="btn btn-leather btn-sm"
          style={{ marginTop: 6, justifyContent: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          Log session
        </Link>
      </div>
    </div>
  );
}
