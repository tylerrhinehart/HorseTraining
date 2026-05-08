import { Link } from "react-router-dom";
import { round1, sessionAverage } from "../utils/stats";
import { formatHumanDate } from "../utils/dates";
import type {
  Phase,
  Rider,
  SessionWithRatings,
  Week,
} from "../supabase/types";

interface Props {
  week: Week;
  sessions: SessionWithRatings[];
  phases: Phase[];
  riders: Rider[];
  engagementId: string;
  onCommentsChange: (next: string) => void;
  comments: string;
  onSaveComments: () => void;
  commentsSaving?: boolean;
}

/**
 * One row per recorded session within the week, mirroring the Colt Starting
 * Training Log layout: date / rider / phase / averages, with a per-week
 * comments box at the bottom.
 */
export default function WeekScoreSheet({
  week,
  sessions,
  phases,
  riders,
  engagementId,
  comments,
  onCommentsChange,
  onSaveComments,
  commentsSaving = false,
}: Props) {
  const phaseFor = (id: string) =>
    phases.find((p) => p.id === id)?.name ?? "—";
  const riderFor = (id: string | null) =>
    riders.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Week {week.week_number}</h3>
        <Link
          to={`/engagements/${engagementId}/weeks/${week.id}/sessions/new`}
          className="btn btn-leather btn-sm"
        >
          + New session
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          No sessions logged this week.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
            <thead
              className="mono muted"
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              <tr>
                <th style={{ textAlign: "left", padding: "8px 6px" }}>#</th>
                <th style={{ textAlign: "left" }}>Date</th>
                <th style={{ textAlign: "left" }}>Rider</th>
                <th style={{ textAlign: "left" }}>Phase</th>
                <th style={{ textAlign: "right" }}>Foundation</th>
                <th style={{ textAlign: "right" }}>Temperament</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const f = sessionAverage(s.ratings, "foundation");
                const t = sessionAverage(s.ratings, "temperament");
                return (
                  <tr
                    key={s.id}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td
                      className="mono muted"
                      style={{ padding: "8px 6px" }}
                    >
                      {s.session_number ?? i + 1}
                    </td>
                    <td>{formatHumanDate(s.occurred_at)}</td>
                    <td>{riderFor(s.rider_id)}</td>
                    <td>{phaseFor(s.phase_id)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {round1(f)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {round1(t)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={`/sessions/${s.id}`}
                        style={{
                          color: "var(--leather)",
                          fontSize: 12,
                          textDecoration: "none",
                        }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <label className="label" htmlFor={`week-${week.id}-comments`}>
          Week comments
        </label>
        <textarea
          id={`week-${week.id}-comments`}
          rows={2}
          className="input"
          placeholder="Comments for the week…"
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onSaveComments}
            disabled={commentsSaving}
          >
            {commentsSaving ? "Saving…" : "Save comments"}
          </button>
        </div>
      </div>
    </div>
  );
}
