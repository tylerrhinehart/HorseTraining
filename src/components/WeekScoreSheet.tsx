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
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Week {week.week_number}</h3>
        <Link
          to={`/engagements/${engagementId}/weeks/${week.id}/sessions/new`}
          className="btn-primary text-xs"
        >
          + New session
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">No sessions logged this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="text-left py-2">#</th>
                <th className="text-left">Date</th>
                <th className="text-left">Rider</th>
                <th className="text-left">Phase</th>
                <th className="text-right">Foundation</th>
                <th className="text-right">Temperament</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.map((s, i) => {
                const f = sessionAverage(s.ratings, "foundation");
                const t = sessionAverage(s.ratings, "temperament");
                return (
                  <tr key={s.id}>
                    <td className="py-2 text-slate-400">
                      {s.session_number ?? i + 1}
                    </td>
                    <td>{formatHumanDate(s.occurred_at)}</td>
                    <td>{riderFor(s.rider_id)}</td>
                    <td>{phaseFor(s.phase_id)}</td>
                    <td className="text-right font-medium">{round1(f)}</td>
                    <td className="text-right font-medium">{round1(t)}</td>
                    <td className="text-right">
                      <Link
                        to={`/sessions/${s.id}`}
                        className="text-brand-300 text-xs hover:underline"
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
      <div className="space-y-1">
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
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-secondary text-xs"
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
