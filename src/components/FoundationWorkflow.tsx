import { useState } from "react";
import { Link } from "react-router-dom";
import type { Horse, Phase } from "../supabase/types";
import { updateHorse } from "../supabase/queries";
import { QUESTIONS } from "../content/tqa-template";
import { phaseReferenceVideo } from "../content/source-videos";
import { nextPhase } from "../utils/phaseProgression";
import GuideDialog from "./GuideDialog";

export default function FoundationWorkflow({ horse, current, phases }: { horse: Horse; current: Phase; phases: Phase[] }) {
  const [review, setReview] = useState<{ phase: Phase; version: string; action?: "advance" | "undo" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = nextPhase(current, phases);
  const changes = horse.program_meta?.foundation_phase_changes ?? [];
  const last = changes.at(-1);
  const previous = last?.action === "advance" && last.to === current.id ? phases.find(p => p.id === last.from) : undefined;
  const active = horse.status === "in_training";
  const exercises = (phase: Phase) => QUESTIONS.filter(q => q.phase_code === phase.code && q.axis === "foundation");
  function show(phase: Phase, action?: "advance" | "undo") {
    setError(""); setReview({phase, action, version:horse.updated_at});
  }
  async function changePhase() {
    if (!active || !review?.action) return;
    setBusy(true);
    try {
      await updateHorse(horse.id, {current_phase_id:review.phase.id, program_meta:{...horse.program_meta,
        foundation_phase_changes:[...changes,{from:current.id,to:review.phase.id,at:new Date().toISOString(),action:review.action}]}}, review.version);
      setReview(null);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const video = review && phaseReferenceVideo(review.phase.code);
  return <>
    <div className="eyebrow">Current foundation phase</div><h2 className="card-title">{current.name}</h2>
    <ol className="phase-trail">{phases.map(p => <li key={p.id} aria-current={p.id === current.id ? "step" : undefined}>{p.name}</li>)}</ol>
    <p>{exercises(current).slice(0,2).map(q => q.text).join(" · ")}</p>
    <div className="workflow-actions">
      <button className="workflow-link" onClick={() => show(current)}>View exercises</button>
      {active && (next ? <button className="btn btn-ghost btn-sm" onClick={() => show(next,"advance")}>Review {next.name} →</button> :
        <Link className="btn btn-ghost btn-sm" to={`/horses/${horse.id}/finish`}>Review final evaluation</Link>)}
      {active && previous && <button className="workflow-link" onClick={() => show(previous,"undo")}>Undo advance</button>}
    </div>
    {review && <GuideDialog title={`${review.phase.name} · Foundation guide`} onClose={() => setReview(null)} busy={busy}
      actions={review.action && active && <button className="btn btn-leather" disabled={busy} onClick={changePhase}>
        {review.action === "advance" ? "Advance to" : "Return to"} {review.phase.name}</button>}>
      <ul>{exercises(review.phase).map(q => <li key={q.position}>{q.text}</li>)}</ul>
      {video && <a href={video.url} target="_blank" rel="noreferrer">{review.phase.name} video ↗</a>}
      {review.action && <p>This sets {horse.name}’s default phase for future rides. Previously logged rides keep their recorded phases.</p>}
      {error && <p role="alert">{error}</p>}
    </GuideDialog>}
  </>;
}
