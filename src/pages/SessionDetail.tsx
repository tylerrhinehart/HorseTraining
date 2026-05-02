import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteSession,
  getPhase,
  getSession,
  listQuestionsForPhase,
  listRiders,
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
  const riders = useQuery(() => listRiders(true), []);

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

  if (session.loading) return <div className="card">Loading…</div>;
  if (!session.data) {
    return (
      <div className="card">
        Session not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
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
          questionId: q.id,
          axis: q.axis,
          questionTextSnapshot: q.text,
          score: drafts[q.id]!.score!,
          comment: drafts[q.id]?.comment,
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
    navigate(`/engagements/${session.data!.engagement_id}`);
  };

  const rider = riders.data?.find((r) => r.id === session.data!.rider_id);
  const fAvg = sessionAverage(session.data.ratings, "foundation");
  const tAvg = sessionAverage(session.data.ratings, "temperament");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Session</h1>
          <p className="text-slate-400 text-sm mt-1">
            {phase.data?.name ?? "—"} ·{" "}
            {formatDateTime(session.data.occurred_at)}
            {rider ? ` · ${rider.name}` : ""}
          </p>
          <p className="text-sm text-slate-300 mt-1">
            Foundation {round1(fAvg)} · Temperament {round1(tAvg)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/engagements/${session.data.engagement_id}`}
            className="btn-ghost text-sm"
          >
            ← Back to engagement
          </Link>
          {!editing ? (
            <button
              className="btn-secondary text-sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : (
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                setEditing(false);
                session.refresh();
              }}
            >
              Cancel edit
            </button>
          )}
          <button className="btn-danger text-sm" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <PhaseScoreSheet
        questions={questions.data ?? []}
        drafts={drafts}
        onScore={setScore}
        onComment={setComment}
        readOnly={!editing}
      />

      <div className="card space-y-2">
        <div className="label">Session notes</div>
        {editing ? (
          <textarea
            rows={3}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : session.data.notes ? (
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {session.data.notes}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No notes.</p>
        )}
      </div>

      {editing && (
        <div className="flex justify-end gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              setEditing(false);
              session.refresh();
            }}
          >
            Cancel
          </button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
