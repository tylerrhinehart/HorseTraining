import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteSession,
  getPhase,
  getSession,
  listQuestionsForPhase,
  updateSession,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import { round1, sessionAverage } from "../utils/stats";
import { formatDateTime } from "../utils/dates";
import type { TqaScore } from "../supabase/types";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useQuery(
    () => (id ? getSession(id) : Promise.resolve(null)),
    [id],
  );
  const phase = useQuery(
    () =>
      session.data ? getPhase(session.data.phase_id) : Promise.resolve(null),
    [session.data?.phase_id],
  );
  const questions = useQuery(
    () =>
      session.data
        ? listQuestionsForPhase(session.data.phase_id)
        : Promise.resolve([]),
    [session.data?.phase_id],
  );
  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  if (session.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
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

  const setScore = (qid: string, score: TqaScore) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

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
      session.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    await deleteSession(session.data!.id);
    navigate(`/horses/${session.data!.horse_id}`);
  };

  const fAvg = sessionAverage(session.data.ratings, "foundation");
  const tAvg = sessionAverage(session.data.ratings, "temperament");

  return (
    <div className="view">
      <div className="eyebrow">Session</div>
      <h1 className="h-display">{phase.data?.name ?? "Session"}</h1>
      <p className="muted" style={{ margin: "4px 0 4px", fontSize: 14 }}>
        {formatDateTime(session.data.occurred_at)}
      </p>
      <p className="mono" style={{ margin: "0 0 14px", fontSize: 13 }}>
        Foundation {round1(fAvg)} · Temperament {round1(tAvg)}
      </p>

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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setEditing(false);
              session.refresh();
            }}
          >
            Cancel edit
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={remove}
          style={{
            color: "var(--bad)",
            borderColor: "var(--bad)",
            background: "transparent",
          }}
        >
          Delete
        </button>
      </div>

      <PhaseScoreSheet
        questions={questions.data ?? []}
        drafts={drafts}
        onScore={setScore}
        onComment={setComment}
        readOnly={!editing}
      />

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
          <button
            className="btn btn-ghost"
            onClick={() => {
              setEditing(false);
              session.refresh();
            }}
          >
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
    </div>
  );
}
