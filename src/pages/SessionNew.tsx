import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createSession,
  getHorse,
  listPhases,
  listQuestionsForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import TaskCompletionPicker from "../components/TaskCompletionPicker";
import { BIT_OPTIONS } from "../content/programs";
import type { TaskCompletion } from "../supabase/types";

export default function SessionNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const phases = useQuery(() => listPhases(), []);

  const [phaseId, setPhaseId] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>(
    new Date().toISOString().slice(0, 16),
  );
  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [rider, setRider] = useState("");
  const [bit, setBit] = useState("");
  const [tasks, setTasks] = useState<TaskCompletion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sessions are always logged against the horse's current phase. Advancing
  // through phases happens via the workspace's "Advance to <next>" gate.
  useEffect(() => {
    if (phaseId) return;
    if (horse.loading || !phases.data) return;
    if (horse.data?.current_phase_id) {
      setPhaseId(horse.data.current_phase_id);
      return;
    }
    if (phases.data.length > 0) {
      setPhaseId(phases.data[0].id);
    }
  }, [horse.data, horse.loading, phases.data, phaseId]);

  const questions = useQuery(
    () => (phaseId ? listQuestionsForPhase(phaseId) : Promise.resolve([])),
    [phaseId],
  );

  // Reset drafts when phase changes (different question set).
  useEffect(() => {
    setDrafts({});
  }, [phaseId]);

  if (!id) return null;
  if (horse.loading || phases.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }
  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">Horse not found.</div>
      </div>
    );
  }

  const currentPhase = phases.data?.find((p) => p.id === phaseId) ?? null;
  const currentPhaseName = currentPhase?.name ?? "—";
  const scale = currentPhase?.scale ?? "tqa";
  const isPerformance = horse.data.training_type !== "foundation";

  const setScore = (qid: string, score: number) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

  const submit = async () => {
    setError(null);
    if (!phaseId) {
      setError("Pick a phase first.");
      return;
    }
    const ratings = (questions.data ?? [])
      .filter((q) => typeof drafts[q.id]?.score === "number")
      .map((q) => ({
        question_id: q.id,
        axis: q.axis,
        question_text_snapshot: q.text,
        score: drafts[q.id]!.score!,
        comment: drafts[q.id]?.comment ?? null,
      }));
    if (ratings.length === 0) {
      setError("Score at least one item.");
      return;
    }
    setSaving(true);
    try {
      await createSession({
        horse_id: id,
        phase_id: phaseId,
        occurred_at: new Date(occurredAt).toISOString(),
        notes: notes || null,
        rider: isPerformance ? rider || null : null,
        bit: isPerformance ? bit || null : null,
        task_completions: isPerformance ? tasks : [],
        ratings,
      });
      navigate(`/horses/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view">
      <div className="eyebrow">New session</div>
      <h1 className="h-display">Score sheet</h1>
      <p className="muted" style={{ margin: "4px 0 14px", fontSize: 14 }}>
        {horse.data.name}
      </p>

      <div
        className="card"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <div className="field">
          <label className="label">Phase</label>
          <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>
            {currentPhaseName}
          </p>
        </div>
        <div className="field">
          <label className="label" htmlFor="session-when">
            When
          </label>
          <input
            id="session-when"
            type="datetime-local"
            className="input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
        {isPerformance && (
          <>
            <div className="field">
              <label className="label" htmlFor="session-rider">
                Rider
              </label>
              <input
                id="session-rider"
                className="input"
                placeholder="Who rode today"
                value={rider}
                onChange={(e) => setRider(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="session-bit">
                Bit (this week)
              </label>
              <select
                id="session-bit"
                className="input"
                value={bit}
                onChange={(e) => setBit(e.target.value)}
              >
                <option value="">—</option>
                {BIT_OPTIONS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {isPerformance && (
        <TaskCompletionPicker value={tasks} onChange={setTasks} />
      )}

      {questions.loading ? (
        <div className="card">Loading questions…</div>
      ) : (
        <PhaseScoreSheet
          questions={questions.data ?? []}
          drafts={drafts}
          onScore={setScore}
          onComment={setComment}
          scale={scale}
        />
      )}

      <div className="card">
        <label className="label" htmlFor="session-notes">
          Session notes
        </label>
        <textarea
          id="session-notes"
          rows={3}
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <p style={{ color: "var(--bad)", fontSize: 13, margin: 0 }}>{error}</p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/horses/${id}`)}
        >
          Cancel
        </button>
        <button
          className="btn btn-leather"
          disabled={saving}
          onClick={submit}
        >
          {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}
