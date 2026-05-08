import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { listEngagements, listHorses } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { useActiveHorseId } from "../state/activeHorse";
import { gradientFor, hashTone, initialsOf } from "../components/HorseAvatar";
import { formatHumanDate } from "../utils/dates";
import type { Engagement } from "../supabase/types";

export default function HorsesList() {
  const [params, setParams] = useSearchParams();
  const showArchived = params.get("filter") === "archived";

  const horsesQuery = useQuery(() => listHorses(true), []);
  const engagementsQuery = useQuery(() => listEngagements(false), []);
  const [activeId, setActiveId] = useActiveHorseId();

  const horses = (horsesQuery.data ?? []).filter((h) =>
    showArchived ? !!h.archived_at : !h.archived_at,
  );

  const latestByHorse = useMemo(() => {
    const map = new Map<string, Engagement>();
    for (const e of engagementsQuery.data ?? []) {
      const cur = map.get(e.horse_id);
      const curKey = cur ? cur.arrival_date ?? cur.created_at : "";
      const newKey = e.arrival_date ?? e.created_at;
      if (!cur || newKey.localeCompare(curKey) > 0) map.set(e.horse_id, e);
    }
    return map;
  }, [engagementsQuery.data]);

  return (
    <div className="view">
      <div className="eyebrow">
        Roster · {horses.length} {showArchived ? "archived" : "in training"}
      </div>
      <h1 className="h-display">Horses</h1>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <p
          className="muted"
          style={{ margin: 0, fontSize: 14, maxWidth: 520 }}
        >
          Tap a horse to make them the active subject. New sessions save
          against that horse.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const next = new URLSearchParams(params);
              if (showArchived) next.delete("filter");
              else next.set("filter", "archived");
              setParams(next);
            }}
          >
            {showArchived ? "Show active" : "Show archived"}
          </button>
          <Link to="/horses/new" className="btn btn-leather">
            + Register
          </Link>
        </div>
      </div>

      {horsesQuery.loading && (
        <div className="card muted">Loading horses…</div>
      )}
      {horsesQuery.error && (
        <div className="card" style={{ color: "var(--bad)" }}>
          {horsesQuery.error.message}
        </div>
      )}
      {!horsesQuery.loading && horses.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", color: "var(--muted)" }}
        >
          {showArchived
            ? "No archived horses."
            : "No horses yet. Register your first to get started."}
        </div>
      )}

      <div className="roster">
        {horses.map((h) => {
          const tone = hashTone(h.name);
          const photoBg = gradientFor(tone);
          const isActive = h.id === activeId;
          const eng = latestByHorse.get(h.id) ?? null;
          const arrival = eng?.arrival_date
            ? new Date(eng.arrival_date + "T12:00:00")
            : null;
          const days = arrival
            ? differenceInCalendarDays(new Date(), arrival)
            : null;
          return (
            <Link
              key={h.id}
              to={`/horses/${h.id}`}
              className={`horse-card ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveId(h.id)}
            >
              <div className="horse-photo" style={{ background: photoBg }}>
                <span className="horse-initials">{initialsOf(h.name)}</span>
                {isActive && !h.archived_at && (
                  <span className="horse-active-flag">In session</span>
                )}
                {h.archived_at && (
                  <span className="horse-archived-flag">Archived</span>
                )}
              </div>
              <div className="horse-body">
                <h3 className="horse-name">{h.name}</h3>
                <span className="horse-sub">
                  {[h.breed, h.sex].filter(Boolean).join(" · ") || "—"}
                </span>
                {eng?.owner_name && (
                  <span
                    className="horse-sub"
                    style={{ color: "var(--leather)" }}
                  >
                    Owner: {eng.owner_name}
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
                      {eng?.arrival_date
                        ? formatHumanDate(eng.arrival_date).replace(/^\w+, /, "")
                        : "—"}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="k">Added</span>
                    <span className="v" style={{ fontSize: 12 }}>
                      {formatHumanDate(h.created_at).replace(/^\w+, /, "")}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
