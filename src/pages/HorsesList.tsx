import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import {
  listHorses,
  listPhases,
  getHorse,
  listSessionsForHorse,
  listRatingsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { prefetchQuery } from "../supabase/cache";
import { useActiveHorseId } from "../state/activeHorse";
import { gradientFor, hashTone, initialsOf } from "../components/HorseAvatar";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/Skeleton";
import { programLabel } from "../content/programs";
import { formatHumanDate } from "../utils/dates";
import type { Horse, Phase } from "../supabase/types";

// Warm the horse workspace caches on intent (hover/focus/touch) so tapping a
// card opens instantly.
function prefetchHorse(id: string) {
  prefetchQuery(qk.horse(id), () => getHorse(id));
  prefetchQuery(qk.sessions(id), () => listSessionsForHorse(id));
  prefetchQuery(qk.ratings(id), () => listRatingsForHorse(id));
}

export default function HorsesList() {
  const horsesQuery = useQuery(qk.horses("all"), () =>
    listHorses({ statuses: ["in_training", "complete", "archived"] }),
  );
  const phasesQuery = useQuery(qk.phases(), () => listPhases());
  const [activeId, setActiveId] = useActiveHorseId();
  const [search, setSearch] = useState("");

  const phasesById = useMemo(() => {
    const map = new Map<string, Phase>();
    for (const p of phasesQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [phasesQuery.data]);

  if (horsesQuery.error && horsesQuery.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={horsesQuery.error} onRetry={horsesQuery.refresh} />
      </div>
    );
  }

  const allHorses = horsesQuery.data ?? [];
  const q = search.trim().toLowerCase();
  const horses = q
    ? allHorses.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.owner_name ?? "").toLowerCase().includes(q),
      )
    : allHorses;
  const inTraining = horses.filter((h) => h.status === "in_training");
  const completed = horses.filter((h) => h.status === "complete");
  const archived = horses.filter((h) => h.status === "archived");

  return (
    <div className="view">
      <div className="eyebrow">Roster · {allHorses.length} horses</div>
      <h1 className="h-display">Horses</h1>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {allHorses.length > 3 && (
          <input
            type="search"
            className="input"
            placeholder="Search by horse or owner…"
            aria-label="Search horses"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 200px", maxWidth: 320 }}
          />
        )}
        <Link
          to="/horses/new"
          className="btn btn-leather"
          style={{ marginLeft: "auto" }}
        >
          + New horse
        </Link>
      </div>

      {q && horses.length === 0 && !horsesQuery.loading && (
        <div className="card muted" style={{ textAlign: "center" }}>
          No horses match “{search.trim()}”.
        </div>
      )}

      {horsesQuery.loading && (
        <div style={{ display: "grid", gap: 10 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      )}
      {!horsesQuery.loading && horses.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div className="eyebrow">Roster</div>
          <h1 className="h-display">No horses yet</h1>
          <p className="muted" style={{ marginBottom: 16 }}>
            Add a horse to start tracking training.
          </p>
          <Link to="/horses/new" className="btn btn-leather">
            + Add your first horse
          </Link>
        </div>
      )}

      <Section
        title="In training"
        horses={inTraining}
        defaultOpen
        phasesById={phasesById}
        activeId={activeId}
        setActiveId={setActiveId}
      />
      <Section
        title="Completed"
        horses={completed}
        phasesById={phasesById}
        activeId={activeId}
        setActiveId={setActiveId}
      />
      <Section
        title="Archived"
        horses={archived}
        phasesById={phasesById}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    </div>
  );
}

function Section({
  title,
  horses,
  defaultOpen,
  phasesById,
  activeId,
  setActiveId,
}: {
  title: string;
  horses: Horse[];
  defaultOpen?: boolean;
  phasesById: Map<string, Phase>;
  activeId: string | null;
  setActiveId: (id: string) => void;
}) {
  if (horses.length === 0) return null;
  return (
    <details open={defaultOpen} style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", padding: "8px 0", fontWeight: 600 }}>
        {title}{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          · {horses.length}
        </span>
      </summary>
      <div className="roster">
        {horses.map((h) => (
          <HorseCard
            key={h.id}
            horse={h}
            phasesById={phasesById}
            isActive={h.id === activeId}
            onClick={() => setActiveId(h.id)}
          />
        ))}
      </div>
    </details>
  );
}

function HorseCard({
  horse,
  phasesById,
  isActive,
  onClick,
}: {
  horse: Horse;
  phasesById: Map<string, Phase>;
  isActive: boolean;
  onClick: () => void;
}) {
  const tone = hashTone(horse.name);
  const photoBg = gradientFor(tone);
  const arrival = horse.arrival_date
    ? new Date(horse.arrival_date + "T12:00:00")
    : null;
  const days = arrival ? differenceInCalendarDays(new Date(), arrival) : null;
  const phase = horse.current_phase_id
    ? phasesById.get(horse.current_phase_id)
    : null;
  const warm = () => prefetchHorse(horse.id);

  return (
    <Link
      to={`/horses/${horse.id}`}
      className={`horse-card ${isActive ? "is-active" : ""}`}
      onClick={onClick}
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
    >
      <div className="horse-photo" style={{ background: photoBg }}>
        <span className="horse-initials">{initialsOf(horse.name)}</span>
        {isActive && horse.status === "in_training" && (
          <span className="horse-active-flag">In session</span>
        )}
        {horse.status === "archived" && (
          <span className="horse-archived-flag">Archived</span>
        )}
        {horse.status === "complete" && (
          <span className="horse-archived-flag" style={{ color: "var(--ok)" }}>
            Complete
          </span>
        )}
      </div>
      <div className="horse-body">
        <h3 className="horse-name">{horse.name}</h3>
        <span className="horse-sub">
          {horse.owner_name ? `Owner: ${horse.owner_name}` : "—"}
        </span>
        <span className="pill pill-muted" style={{ marginTop: 2, alignSelf: "flex-start" }}>
          {programLabel(horse.training_type)}
        </span>
        {phase && (
          <span className="horse-sub" style={{ color: "var(--leather)" }}>
            {phase.name}
          </span>
        )}
        <div className="horse-stats">
          <div className="stat">
            <span className="k">Days in</span>
            <span className="v">{days ?? "—"}</span>
          </div>
          <div className="stat">
            <span className="k">Arrived</span>
            <span className="v" style={{ fontSize: 12 }}>
              {horse.arrival_date
                ? formatHumanDate(horse.arrival_date).replace(/^\w+, /, "")
                : "—"}
            </span>
          </div>
          <div className="stat">
            <span className="k">Added</span>
            <span className="v" style={{ fontSize: 12 }}>
              {formatHumanDate(horse.created_at).replace(/^\w+, /, "")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
