import { useState } from "react";
import { Link } from "react-router-dom";
import type { Horse } from "../supabase/types";
import { listSessionsForHorse, updateHorse } from "../supabase/queries";
import { qk } from "../supabase/keys";
import { useQuery } from "../supabase/useQuery";
import { goalReviews } from "../utils/goalReview";
import { formatDateTime } from "../utils/dates";
import ErrorState from "./ErrorState";

export default function GoalAssessments({ horse, onDirty }: { horse: Horse; onDirty: (dirty: boolean) => void }) {
  const sessions = useQuery(qk.sessions(horse.id), () => listSessionsForHorse(horse.id));
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  if (sessions.error) return <ErrorState error={sessions.error} onRetry={sessions.refresh} />;
  if (!sessions.data) return <p role="status">Loading supporting rides…</p>;
  const reviews = goalReviews(horse, sessions.data);
  function change(code: string, text: string, saved: string) {
    const next = { ...changes, [code]: text };
    if (text === saved) delete next[code];
    setChanges(next);
    onDirty(Object.keys(next).length > 0);
    setMessage("");
  }
  async function save() {
    setSaving(true);
    try {
      const assessments = { ...horse.program_meta.goal_assessments, ...changes };
      await updateHorse(horse.id, {
        program_meta: { ...horse.program_meta, goal_assessments: assessments },
      }, horse.updated_at);
      setChanges({});
      onDirty(false);
      setMessage("Goal assessments saved.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const dirty = Object.keys(changes).length > 0;
  return <section className="card"><h2 className="card-title">Training goals</h2>
    {reviews.map(goal => <div className="task-row" key={goal.code}>
      <h3>{goal.name}</h3>
      {goal.rides.length ? <details><summary>Phases worked: {goal.phases.join(", ")} · {goal.rides.length} supporting {goal.rides.length === 1 ? "ride" : "rides"}</summary>
        <ul>{goal.rides.map(ride => <li key={ride.id}>
          <Link to={`/sessions/${ride.id}`}>{formatDateTime(ride.date)} · Phase {ride.phase}</Link>{ride.notes && ` · ${ride.notes}`}
        </li>)}</ul></details> : <p className="muted">No rides recorded for this goal.</p>}
      <label className="label" htmlFor={`assessment-${goal.code}`}>Trainer assessment · {goal.name}</label>
      <textarea className="input" id={`assessment-${goal.code}`} rows={2} disabled={saving}
        value={changes[goal.code] ?? goal.assessment} onChange={e => change(goal.code, e.target.value, goal.assessment)} />
    </div>)}
    <div className="task-choice">
      <button className="btn btn-leather" type="button" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save goal assessments"}</button>
      {!dirty && <Link to={`/horses/${horse.id}/report`} target="_blank" rel="noreferrer">Preview saved owner report ↗</Link>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
