import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createTQA,
  getHorse,
  listPhases,
  listQuestionsForPhase,
  listResourcesForPhase,
  listResourcesForQuestion,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import RatingInput from "../components/RatingInput";
import type { Score } from "../supabase/types";

interface DraftRating {
  score?: Score;
  comment?: string;
}

export default function NewTQA() {
  const { horseId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const horse = useQuery(
    () => (horseId ? getHorse(horseId) : Promise.resolve(null)),
    [horseId],
  );
  const phases = useQuery(() => listPhases(), []);

  const initialPhaseId =
    params.get("phase") ?? horse.data?.current_phase_id ?? phases.data?.[0]?.id ?? "";
  const [phaseId, setPhaseId] = useState<string>("");

  useEffect(() => {
    if (!phaseId && initialPhaseId) setPhaseId(initialPhaseId);
  }, [initialPhaseId, phaseId]);

  const questions = useQuery(
    () => (phaseId ? listQuestionsForPhase(phaseId, false) : Promise.resolve([])),
    [phaseId],
  );

  const phaseResources = useQuery(
    () =>
      phaseId ? listResourcesForPhase(phaseId) : Promise.resolve([]),
    [phaseId],
  );

  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset drafts when phase changes (different question set).
  useEffect(() => {
    setDrafts({});
  }, [phaseId]);

  const activeQuestions = useMemo(
    () => (questions.data ?? []).filter((q) => q.active),
    [questions.data],
  );

  const answered = activeQuestions.filter(
    (q) => typeof drafts[q.id]?.score === "number",
  ).length;

  if (!horseId) return null;
  if (horse.loading || phases.loading) {
    return <div className="card">Loading…</div>;
  }
  if (!horse.data) {
    return (
      <div className="card">
        Horse not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (!phaseId) {
      setError("Pick a phase first.");
      return;
    }
    const ratings = activeQuestions
      .filter((q) => typeof drafts[q.id]?.score === "number")
      .map((q) => ({
        questionId: q.id,
        questionTextSnapshot: q.text,
        score: drafts[q.id]!.score!,
        comment: drafts[q.id]?.comment,
      }));
    if (ratings.length === 0) {
      setError("Add at least one rating.");
      return;
    }
    setSaving(true);
    try {
      const tqa = await createTQA({
        horseId,
        phaseId,
        notes,
        ratings,
      });
      navigate(`/tqa/${tqa.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New TQA</h1>
          <p className="text-slate-400 text-sm mt-1">
            For{" "}
            <Link
              to={`/horses/${horse.data.id}`}
              className="text-brand-300 hover:underline"
            >
              {horse.data.name}
            </Link>
          </p>
        </div>
        <Link to={`/horses/${horse.data.id}`} className="btn-ghost text-sm">
          Cancel
        </Link>
      </div>

      <div className="card space-y-3">
        <label className="label">Phase</label>
        <select
          className="input"
          value={phaseId}
          onChange={(e) => setPhaseId(e.target.value)}
        >
          {phases.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === horse.data?.current_phase_id ? " (current)" : ""}
            </option>
          ))}
        </select>
        {(phaseResources.data ?? []).length > 0 && (
          <details className="text-sm text-slate-300">
            <summary className="cursor-pointer text-brand-300">
              Phase resources ({phaseResources.data!.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {phaseResources.data!.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {r.kind === "youtube" ? "▶︎" : "🔗"} {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="card flex items-center justify-between">
        <span className="text-sm text-slate-300">
          {answered} of {activeQuestions.length} questions answered
        </span>
        <div className="h-2 w-48 bg-slate-800 rounded overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{
              width: `${
                activeQuestions.length === 0
                  ? 0
                  : (answered / activeQuestions.length) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {questions.loading ? (
        <div className="card">Loading questions…</div>
      ) : activeQuestions.length === 0 ? (
        <div className="card text-center text-slate-400">
          This phase has no active questions yet.{" "}
          <Link
            to={`/phases/${phaseId}`}
            className="underline text-brand-500"
          >
            Add some
          </Link>{" "}
          first.
        </div>
      ) : (
        <div className="space-y-3">
          {activeQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              questionId={q.id}
              text={q.text}
              draft={drafts[q.id] ?? {}}
              onScore={(s) =>
                setDrafts((d) => ({
                  ...d,
                  [q.id]: { ...d[q.id], score: s },
                }))
              }
              onComment={(c) =>
                setDrafts((d) => ({
                  ...d,
                  [q.id]: { ...d[q.id], comment: c },
                }))
              }
            />
          ))}
        </div>
      )}

      <div className="card space-y-2">
        <label className="label" htmlFor="notes">
          Session notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <div className="card text-red-400">{error}</div>}

      <div className="flex justify-end gap-2">
        <Link to={`/horses/${horse.data.id}`} className="btn-ghost">
          Cancel
        </Link>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save TQA"}
        </button>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  questionId: string;
  text: string;
  draft: DraftRating;
  onScore: (s: Score) => void;
  onComment: (c: string) => void;
}

function QuestionCard({
  questionId,
  text,
  draft,
  onScore,
  onComment,
}: QuestionCardProps) {
  const resources = useQuery(
    () => listResourcesForQuestion(questionId),
    [questionId],
  );
  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-start gap-3">
        <label htmlFor={`q-${questionId}`} className="font-medium">
          {text}
        </label>
        <RatingInput
          name={`q-${questionId}`}
          value={draft.score ?? null}
          onChange={(s) => onScore(s as Score)}
          label={text}
        />
      </div>
      {(resources.data ?? []).length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer text-brand-300">
            Resources ({resources.data!.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {resources.data!.map((r) => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {r.kind === "youtube" ? "▶︎" : "🔗"} {r.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <textarea
        id={`q-${questionId}`}
        rows={2}
        className="input"
        placeholder="Optional comment…"
        value={draft.comment ?? ""}
        onChange={(e) => onComment(e.target.value)}
      />
    </div>
  );
}
