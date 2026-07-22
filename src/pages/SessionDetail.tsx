import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteSession,
  getSession,
  listPhases,
  listQuestionsForPhase,
  updateSession,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import TaskCompletionPicker from "../components/TaskCompletionPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { bitLabel } from "../content/programs";
import { formatAvg, sessionAverage } from "../utils/stats";
import { formatDateTime } from "../utils/dates";

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
  const phaseId = session.data?.phase_id;
  const phases = useQuery(qk.phases(), () => listPhases());
  const phase = phases.data?.find((p) => p.id === phaseId) ?? null;
  const questions = useQuery(
    phaseId ? qk.questions(phaseId) : null,
    () => listQuestionsForPhase(phaseId!),
  );

  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
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
  }, [session.data?.id]);

  // Dirty only matters while editing: compare local drafts/notes to the saved
  // session so we can guard against discarding unsaved changes.
  const dirty =
    editing &&
    !!session.data &&
    ((): boolean => {
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
        <div className="eyebrow">Session</div>
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
    }
    setEditing(false);
    setConfirmDiscard(false);
  };

  const cancelEdit = () => {
    if (dirty) setConfirmDiscard(true);
    else exitEdit();
  };

  const save = async () => {
    setSaving(true);
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
      await updateSession(session.data!.id, { notes, ratings });
      setEditing(false);
      toast.success("Session updated");
    } catch (err) {
      toast.error((err as Error).message);
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
      toast.error((err as Error).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const fAvg = sessionAverage(session.data.ratings, "foundation");
  const tAvg = sessionAverage(session.data.ratings, "temperament");

  return (
    <div className="view">
      <div className="eyebrow">Session</div>
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
            Edit
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
          Delete
        </button>
      </div>

      {(session.data.rider || session.data.bit) && (
        <p className="mono muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          {session.data.rider && <>Rider: {session.data.rider}</>}
          {session.data.rider && session.data.bit && " · "}
          {session.data.bit && <>Bit: {bitLabel(session.data.bit)}</>}
        </p>
      )}

      {session.data.task_completions?.length > 0 && (
        <TaskCompletionPicker
          value={session.data.task_completions}
          onChange={() => {}}
          readOnly
        />
      )}

      {questions.loading ? (
        <ScoreSheetSkeleton />
      ) : (
        <PhaseScoreSheet
          questions={questions.data ?? []}
          drafts={drafts}
          onScore={setScore}
          onComment={setComment}
          scale={scale}
          readOnly={!editing}
        />
      )}

      <div className="card">
        <div className="label">Session notes</div>
        {editing ? (
          <textarea
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
            disabled={saving}
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
        title="Delete this session?"
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
