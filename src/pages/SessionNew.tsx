import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createSession,
  getHorse,
  listPhases,
  listQuestionsForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import TaskCompletionPicker from "../components/TaskCompletionPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { BIT_OPTIONS } from "../content/programs";
import type { TaskCompletion } from "../supabase/types";

/** Two-column ghost of the score sheet (8 Foundation + 6 Temperament rows). */
function ScoreSheetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {[8, 6].map((rows, col) => (
          <div key={col} className="space-y-2">
            <Skeleton h={11} w="55%" style={{ marginBottom: 8 }} />
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="card">
                <Skeleton h={14} w="90%" style={{ marginBottom: 10 }} />
                <Skeleton h={36} w="100%" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const horse = useQuery(id ? qk.horse(id) : null, () => getHorse(id!));
  const phases = useQuery(qk.phases(), () => listPhases());

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
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
    phaseId ? qk.questions(phaseId) : null,
    () => listQuestionsForPhase(phaseId),
  );

  // Reset drafts when phase changes (different question set).
  useEffect(() => {
    setDrafts({});
  }, [phaseId]);

  // Any entered data makes the session dirty — guard against accidental loss.
  const dirty =
    Object.values(drafts).some(
      (d) => typeof d.score === "number" || !!d.comment,
    ) ||
    notes.trim() !== "" ||
    rider.trim() !== "" ||
    bit !== "" ||
    tasks.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!id) return null;

  if (horse.error && horse.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={horse.error} onRetry={horse.refresh} />
      </div>
    );
  }
  if (phases.error && phases.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={phases.error} onRetry={phases.refresh} />
      </div>
    );
  }

  if (horse.data === undefined || phases.data === undefined) {
    return (
      <div className="view">
        <div className="eyebrow">New session</div>
        <h1 className="h-display">Score sheet</h1>
        <SkeletonCard lines={2} />
        <div style={{ height: 12 }} />
        <ScoreSheetSkeleton />
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

  const currentPhase = phases.data.find((p) => p.id === phaseId) ?? null;
  const currentPhaseName = currentPhase?.name ?? "—";
  const scale = currentPhase?.scale ?? "tqa";
  const isPerformance = horse.data.training_type !== "foundation";

  const total = questions.data?.length ?? 0;
  const scored =
    questions.data?.filter((q) => typeof drafts[q.id]?.score === "number")
      .length ?? 0;

  const setScore = (qid: string, score: number) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

  const cancel = () => {
    if (dirty) setConfirmDiscard(true);
    else navigate(`/horses/${id}`);
  };

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
      toast.success("Session saved");
      navigate(`/horses/${id}`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
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
          <div>
            <span className="pill pill-leather">{currentPhaseName}</span>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            Logged against the current phase
          </span>
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

      <div
        style={{
          position: "sticky",
          top: "calc(60px + env(safe-area-inset-top, 0px))",
          zIndex: 20,
          display: "flex",
          justifyContent: "flex-end",
          margin: "4px 0 8px",
        }}
      >
        <span className="pill">
          {scored} of {total} scored
        </span>
      </div>

      {questions.loading || !phaseId ? (
        <ScoreSheetSkeleton />
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
        <div role="alert" className="alert-error" style={{ marginTop: 10 }}>
          <span className="alert-error-icon" aria-hidden>
            ⚠
          </span>
          <span className="alert-error-body">{error}</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 12,
        }}
      >
        {total > 0 && scored < total && (
          <span
            className="muted"
            style={{ fontSize: 13, marginRight: "auto" }}
          >
            {total - scored} of {total} not yet scored
          </span>
        )}
        <button type="button" className="btn btn-ghost" onClick={cancel}>
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

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this session?"
        body="Your scores and notes won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => navigate(`/horses/${id}`)}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
