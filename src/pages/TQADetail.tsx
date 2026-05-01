import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteTQA,
  getPhase,
  getTQA,
  listQuestionsForPhase,
  updateTQA,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import RatingInput from "../components/RatingInput";
import type { Score } from "../supabase/types";
import { formatDateTime } from "../utils/dates";

interface DraftRating {
  score?: Score;
  comment?: string;
}

export default function TQADetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tqa = useQuery(() => (id ? getTQA(id) : Promise.resolve(null)), [id]);
  const phase = useQuery(
    () => (tqa.data ? getPhase(tqa.data.phase_id) : Promise.resolve(null)),
    [tqa.data?.phase_id],
  );
  const questions = useQuery(
    () =>
      tqa.data
        ? listQuestionsForPhase(tqa.data.phase_id, true)
        : Promise.resolve([]),
    [tqa.data?.phase_id],
  );

  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tqa.data) return;
    const next: Record<string, DraftRating> = {};
    for (const r of tqa.data.ratings) {
      next[r.question_id] = {
        score: r.score,
        comment: r.comment ?? undefined,
      };
    }
    setDrafts(next);
    setNotes(tqa.data.notes ?? "");
  }, [tqa.data?.id]);

  if (tqa.loading) return <div className="card">Loading…</div>;
  if (!tqa.data) {
    return (
      <div className="card">
        TQA not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  const visibleQuestionIds = new Set<string>();
  (questions.data ?? []).filter((q) => q.active && !q.deleted_at).forEach((q) =>
    visibleQuestionIds.add(q.id),
  );
  for (const r of tqa.data.ratings) visibleQuestionIds.add(r.question_id);
  const orderedQuestions = (questions.data ?? [])
    .filter((q) => visibleQuestionIds.has(q.id))
    .sort((a, b) => a.position - b.position);

  const save = async () => {
    setSaving(true);
    try {
      const ratings = orderedQuestions
        .filter((q) => typeof drafts[q.id]?.score === "number")
        .map((q) => ({
          questionId: q.id,
          questionTextSnapshot: q.text,
          score: drafts[q.id]!.score!,
          comment: drafts[q.id]?.comment,
        }));
      await updateTQA(tqa.data!.id, { notes, ratings });
      setEditing(false);
      tqa.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this TQA? This cannot be undone.")) return;
    await deleteTQA(tqa.data!.id);
    navigate(`/horses/${tqa.data!.horse_id}`);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">TQA</h1>
          <p className="text-slate-400 text-sm mt-1">
            {phase.data?.name ?? "—"} · {formatDateTime(tqa.data.occurred_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/horses/${tqa.data.horse_id}`}
            className="btn-ghost text-sm"
          >
            ← Back to horse
          </Link>
          {!editing && (
            <button
              className="btn-secondary text-sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
          <button className="btn-danger text-sm" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      {orderedQuestions.length === 0 ? (
        <div className="card text-slate-400">No ratings recorded.</div>
      ) : (
        <div className="space-y-3">
          {orderedQuestions.map((q) => {
            const original = tqa.data!.ratings.find(
              (r) => r.question_id === q.id,
            );
            const draft = drafts[q.id] ?? {};
            return (
              <div key={q.id} className="card space-y-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="font-medium">
                    {original?.question_text_snapshot ?? q.text}
                    {(!q.active || q.deleted_at) && (
                      <span className="ml-2 pill bg-slate-700 text-slate-300">
                        retired
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <RatingInput
                      name={`q-${q.id}`}
                      value={draft.score ?? null}
                      onChange={(s) =>
                        setDrafts((d) => ({
                          ...d,
                          [q.id]: { ...d[q.id], score: s as Score },
                        }))
                      }
                      label={q.text}
                    />
                  ) : (
                    <span className="text-xl font-semibold">
                      {original?.score ?? "—"}
                      <span className="text-sm text-slate-400">/5</span>
                    </span>
                  )}
                </div>
                {editing ? (
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="Optional comment…"
                    value={draft.comment ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [q.id]: { ...d[q.id], comment: e.target.value },
                      }))
                    }
                  />
                ) : (
                  original?.comment && (
                    <p className="text-sm text-slate-300 italic">
                      "{original.comment}"
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card space-y-2">
        <div className="label">Session notes</div>
        {editing ? (
          <textarea
            rows={3}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : tqa.data.notes ? (
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {tqa.data.notes}
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
              tqa.refresh();
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
