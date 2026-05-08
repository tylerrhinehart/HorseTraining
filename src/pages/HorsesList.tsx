import { useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { listHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { useActiveHorseId } from "../state/activeHorse";
import { gradientFor, hashTone, initialsOf } from "../components/HorseAvatar";
import { formatHumanDate } from "../utils/dates";
import type { Horse, Phase } from "../supabase/types";

export default function HorsesList() {
  const horsesQuery = useQuery(
    () => listHorses({ statuses: ["in_training", "complete", "archived"] }),
    [],
  );
  const phasesQuery = useQuery(() => listPhases(), []);
  const [activeId, setActiveId] = useActiveHorseId();

  const phasesById = useMemo(() => {
    const map = new Map<string, Phase>();
    for (const p of phasesQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [phasesQuery.data]);

  const horses = horsesQuery.data ?? [];
  const inTraining = horses.filter((h) => h.status === "in_training");
  const completed = horses.filter((h) => h.status === "complete");
  const archived = horses.filter((h) => h.status === "archived");

  return (
    <div className="view">
      <div className="eyebrow">Roster · {horses.length} horses</div>
      <h1 className="h-display">Horses</h1>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <Link to="/horses/new" className="btn btn-leather">+ New horse</Link>
      </div>

      {horsesQuery.loading && <div className="card muted">Loading…</div>}
      {horsesQuery.error && (
        <div className="card" style={{ color: "var(--bad)" }}>
          {horsesQuery.error.message}
        </div>
      )}
      {!horsesQuery.loading && horses.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          No horses yet. Tap "+ New horse" to start.
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

  return (
    <Link
      to={`/horses/${horse.id}`}
      className={`horse-card ${isActive ? "is-active" : ""}`}
      onClick={onClick}
    >
      <div className="horse-photo" style={{ background: photoBg }}>
        <span className="horse-initials">{initialsOf(horse.name)}</span>
        {isActive && horse.status === "in_training" && (
          <span className="horse-active-flag">In session</span>
        )}
      </div>
      <div className="horse-body">
        <h3 className="horse-name">{horse.name}</h3>
        <span className="horse-sub">
          {horse.owner_name ? `Owner: ${horse.owner_name}` : "—"}
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
