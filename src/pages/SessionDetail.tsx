import useUnsavedChanges from "../hooks/useUnsavedChanges";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteSession,
  getSession,
  getHorse,
  listPhases,
  listQuestionsForPhase,
  updateSession,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { TaskCompletion } from "../supabase/types";
import { qk } from "../supabase/keys";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import TaskCompletionPicker from "../components/TaskCompletionPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { bitLabel, bitOptions } from "../content/programs";
import { formatAvg, sessionAverage } from "../utils/stats";
import { formatDateTime, localDateTimeInput } from "../utils/dates";

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

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const session = useQuery(id ? qk.session(id) : null, () => getSession(id!));
  const horse = useQuery(session.data ? qk.horse(session.data.horse_id) : null, () => getHorse(session.data!.horse_id));
  const phaseId = session.data?.phase_id;
  const phases = useQuery(qk.phases(), () => listPhases());
  const phase = phases.data?.find((p) => p.id === phaseId) ?? null;
  const questions = useQuery(
    phaseId ? qk.questions(phaseId) : null,
    () => listQuestionsForPhase(phaseId!),
  );

  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [rider, setRider] = useState("");
  const [bit, setBit] = useState("");
  const [when, setWhen] = useState("");
  const [tasks, setTasks] = useState<TaskCompletion[]>([]);
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session.data) return;
    const next: Record<string, DraftRating> = {};
    for (const r of session.data.ratings) {
      next[r.question_id] = {
        score: r.score,
        comment: r.comment ?? undefined,
      };
    }
    setDrafts(next);
    setNotes(session.data.notes ?? "");
    setRider(session.data.rider ?? ""); setBit(session.data.bit ?? "");
    setWhen(localDateTimeInput(new Date(session.data.occurred_at))); setTasks(session.data.task_completions ?? []);
    setEditing(false); setSaveError("");
  }, [session.data?.id]);

  // Dirty only matters while editing: compare local drafts/notes to the saved
  // session so we can guard against discarding unsaved changes.
  const dirty =
    editing &&
    !!session.data &&
    ((): boolean => {
      if (rider !== (session.data!.rider ?? "") || bit !== (session.data!.bit ?? "") || when !== localDateTimeInput(new Date(session.data!.occurred_at)) || JSON.stringify(tasks) !== JSON.stringify(session.data!.task_completions ?? [])) return true;
      if (notes !== (session.data!.notes ?? "")) return true;
      for (const q of questions.data ?? []) {
        const orig = session.data!.ratings.find(
          (r) => r.question_id === q.id,
        );
        const d = drafts[q.id] ?? {};
        if ((d.score ?? undefined) !== (orig?.score ?? undefined)) return true;
        if ((d.comment ?? "") !== (orig?.comment ?? "")) return true;
      }
      return false;
    })();

  const { dialog: unsavedDialog } = useUnsavedChanges(dirty && !saving);

  if (!id) return null;

  if (session.error && session.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={session.error} onRetry={session.refresh} />
      </div>
    );
  }

  if (session.data === undefined) {
    return (
      <div className="view">
        {unsavedDialog}
      <div className="eyebrow">Saved ride · {horse.data?.name ?? "Horse"}</div>
        <h1 className="h-display">Session</h1>
        <SkeletonCard lines={2} />
        <div style={{ height: 12 }} />
        <ScoreSheetSkeleton />
      </div>
    );
  }

  if (!session.data) {
    return (
      <div className="view">
        <div className="card">
          Session not found.{" "}
          <Link to="/horses" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  const scale = phase?.scale ?? "tqa";

  const setScore = (qid: string, score: number) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

  // Restore drafts/notes to the last saved session state.
  const exitEdit = () => {
    const s = session.data;
    if (s) {
      const next: Record<string, DraftRating> = {};
      for (const r of s.ratings) {
        next[r.question_id] = { score: r.score, comment: r.comment ?? undefined };
      }
      setDrafts(next);
      setNotes(s.notes ?? "");
      setRider(s.rider ?? ""); setBit(s.bit ?? ""); setWhen(localDateTimeInput(new Date(s.occurred_at))); setTasks(s.task_completions ?? []);
    }
    setEditing(false);
    setConfirmDiscard(false);
  };

  const cancelEdit = () => {
    if (dirty) setConfirmDiscard(true);
    else exitEdit();
  };

  const save = async () => {
    if (questions.error || !questions.data?.length) { setSaveError("The score sheet is unavailable. Retry before saving."); return; }
    if (!when || Number.isNaN(new Date(when).getTime())) { setSaveError("Enter a valid ride date and time."); return; }
    setSaving(true); setSaveError("");
    try {
      const ratings = (questions.data ?? [])
        .filter((q) => typeof drafts[q.id]?.score === "number")
        .map((q) => ({
          question_id: q.id,
          axis: q.axis,
          question_text_snapshot: q.text,
          score: drafts[q.id]!.score!,
          comment: drafts[q.id]?.comment ?? null,
        }));
      await updateSession(session.data!.id, { notes, ratings, rider: rider || null, bit: bit || null, occurred_at: new Date(when).toISOString(), task_completions: tasks });
      setEditing(false);
      toast.success("Session updated");
    } catch (err) {
      setSaveError((err as Error).message); toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteSession(session.data!.id);
      navigate(`/horses/${session.data!.horse_id}`);
    } catch (err) {
      setSaveError((err as Error).message); toast.error((err as Error).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const fAvg = sessionAverage(session.data.ratings, "foundation");
  const tAvg = sessionAverage(session.data.ratings, "temperament");

  return (
    <div className="view">
      {unsavedDialog}
      <div className="eyebrow">Saved ride · {horse.data?.name ?? "Horse"}</div>
      <h1 className="h-display">{phase?.name ?? "Session"}</h1>
      <p className="muted" style={{ margin: "4px 0 4px", fontSize: 14 }}>
        {formatDateTime(session.data.occurred_at)}
      </p>
      <div className="horse-stats" style={{ margin: "6px 0 14px", borderTop: "none", paddingTop: 0 }}>
        <div className="stat">
          <span className="k">Foundation</span>
          <span className="v">{formatAvg(fAvg, scale)}</span>
        </div>
        <div className="stat">
          <span className="k">Temperament</span>
          <span className="v">{formatAvg(tAvg, scale)}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Link
          to={`/horses/${session.data.horse_id}`}
          className="btn btn-ghost btn-sm"
        >
          ← Back to horse
        </Link>
        {!editing ? (
          <button
            className="btn btn-leather btn-sm"
            onClick={() => setEditing(true)}
          >
            Edit ride
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
            Cancel edit
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => setConfirmDelete(true)}
        >
          Delete ride
        </button>
      </div>

      {editing ? <div className="card field-row">
        <div className="field"><label className="label" htmlFor="edit-ride-when">When</label><input id="edit-ride-when" className="input" type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="edit-ride-rider">Rider</label><input id="edit-ride-rider" className="input" value={rider} onChange={e=>setRider(e.target.value)} /></div>
        {phase?.scale === "five" && <div className="field"><label className="label" htmlFor="edit-ride-bit">Bit</label><select id="edit-ride-bit" className="input" value={bit} onChange={e=>setBit(e.target.value)}><option value="">Not recorded</option>{bitOptions(phase.program).map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></div>}
      </div> : <p className="muted">Rider: {session.data.rider || "Not recorded"}{session.data.bit && <> · {bitLabel(session.data.bit, phase?.program)}</>}</p>}
      {(phase?.scale === "five" || tasks.length > 0) && <TaskCompletionPicker value={editing ? tasks : session.data.task_completions} onChange={setTasks} readOnly={!editing} />}


      {questions.error ? <ErrorState error={questions.error} onRetry={questions.refresh} /> : questions.loading ? (
        <ScoreSheetSkeleton />
      ) : (
        <PhaseScoreSheet
          phaseCode={phase?.code}
          questions={questions.data ?? []}
          drafts={drafts}
          onScore={setScore}
          onComment={setComment}
          scale={scale}
          readOnly={!editing}
        />
      )}

      <div className="card">
        <label className="label" htmlFor="edit-ride-notes">Ride notes</label>
        {editing ? (
          <textarea
            id="edit-ride-notes"
            rows={3}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : session.data.notes ? (
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14 }}>
            {session.data.notes}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            No notes.
          </p>
        )}
      </div>

      {saveError && <p role="alert" className="alert-error">{saveError}</p>}
      {editing && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button className="btn btn-ghost" onClick={cancelEdit}>
            Cancel
          </button>
          <button
            className="btn btn-leather"
            disabled={saving || !!questions.error || questions.loading || !questions.data?.length}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        body="Your unsaved edits to this session will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={exitEdit}
        onCancel={() => setConfirmDiscard(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this ride?"
        body="This permanently removes the session and its scores. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        cancelLabel="Cancel"
        danger
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
