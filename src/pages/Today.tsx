import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listInTrainingHorses,
  listPhases,
  getHorse,
  listSessionsForHorse,
  listRatingsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { prefetchQuery } from "../supabase/cache";
import { useActiveHorseId } from "../state/activeHorse";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import { SkeletonCard } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { differenceInCalendarDays, parseISO } from "date-fns";
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
  const phasesById = new Map<string, Phase>(
    (phases.data ?? []).map((p) => [p.id, p]),
  );
  const [activeId] = useActiveHorseId();

  return (
    <div className="view">
      <div className="eyebrow">Today</div>
      <h1 className="h-display">In training</h1>
      <p className="muted" style={{ marginBottom: 14, fontSize: 14 }}>
        {horses.length} horses currently in training. Tap a card to open its
        workspace, or log today's session in one tap.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {horses.map((h) => (
          <TodayCard
            key={h.id}
            horse={h}
            phasesById={phasesById}
            isActive={h.id === activeId}
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
}: {
  horse: Horse;
  phasesById: Map<string, Phase>;
  isActive: boolean;
}) {
  const phase = horse.current_phase_id ? phasesById.get(horse.current_phase_id) : null;
  const arrival = horse.arrival_date ? parseISO(horse.arrival_date) : null;
  const dayN = arrival ? differenceInCalendarDays(new Date(), arrival) + 1 : null;
  const warm = () => prefetchHorse(horse.id);
  return (
    <div
      className="card"
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        ...(isActive
          ? {
              borderColor: "var(--ink)",
              boxShadow: "0 0 0 2px var(--leather) inset",
            }
          : null),
      }}
    >
      <HorseAvatar name={horse.name} tone={hashTone(horse.name)} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          to={`/horses/${horse.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {horse.name}
            {isActive && <span className="horse-active-flag">In session</span>}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {horse.owner_name ? `Owner: ${horse.owner_name}` : "—"}
            {phase ? ` · ${phase.name}` : ""}
            {dayN != null ? ` · Day ${dayN}` : ""}
          </div>
        </Link>
      </div>
      <Link
        to={`/horses/${horse.id}/sessions/new`}
        className="btn btn-leather btn-sm"
      >
        Log session
      </Link>
    </div>
  );
}
