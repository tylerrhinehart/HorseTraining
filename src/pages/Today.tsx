import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listInTrainingHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Horse, Phase } from "../supabase/types";

export default function Today() {
  const horses = useQuery(() => listInTrainingHorses(), []);

  if (horses.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }

  const list = horses.data ?? [];
  if (list.length === 0) return <EmptyState />;
  if (list.length === 1) return <SingleHorseRedirect horseId={list[0].id} />;
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

function SingleHorseRedirect({ horseId }: { horseId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/horses/${horseId}`, { replace: true });
  }, [horseId, navigate]);
  return (
    <div className="view">
      <div className="card">Loading…</div>
    </div>
  );
}

function MultiHorseToday({ horses }: { horses: Horse[] }) {
  const phases = useQuery(() => listPhases(), []);
  const phasesById = new Map<string, Phase>(
    (phases.data ?? []).map((p) => [p.id, p]),
  );

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
          <TodayCard key={h.id} horse={h} phasesById={phasesById} />
        ))}
      </div>
    </div>
  );
}

function TodayCard({
  horse,
  phasesById,
}: {
  horse: Horse;
  phasesById: Map<string, Phase>;
}) {
  const phase = horse.current_phase_id ? phasesById.get(horse.current_phase_id) : null;
  const arrival = horse.arrival_date ? parseISO(horse.arrival_date) : null;
  const dayN = arrival ? differenceInCalendarDays(new Date(), arrival) + 1 : null;
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
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
            }}
          >
            {horse.name}
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
