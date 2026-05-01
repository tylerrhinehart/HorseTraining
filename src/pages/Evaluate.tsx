import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  upsertEvaluation,
  useActiveQuestions,
  useAllQuestions,
  useEvaluationByDate,
  useHorse,
} from "../db/queries";
import type { Rating, Question, ID } from "../db/schema";
import RatingInput from "../components/RatingInput";
import {
  endDate,
  formatHumanDate,
  todayLocal,
  trainingDayNumber,
} from "../utils/dates";

export default function Evaluate() {
  const { horseId, date } = useParams();
  const navigate = useNavigate();
  const horse = useHorse(horseId);
  const activeQuestions = useActiveQuestions();
  const allQuestions = useAllQuestions(true);
  const targetDate = date ?? todayLocal();
  const isPast = targetDate !== todayLocal();
  const existing = useEvaluationByDate(horseId, targetDate);

  const [ratings, setRatings] = useState<Record<ID, Partial<Rating>>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Build the question list for this evaluation: active questions plus any
  // questions referenced in an existing evaluation (so historical ones still
  // render).
  const questions: Question[] = (() => {
    if (!allQuestions) return [];
    const visibleIds = new Set<ID>();
    activeQuestions?.forEach((q) => visibleIds.add(q.id));
    if (existing) {
      Object.keys(existing.ratings).forEach((id) => visibleIds.add(id));
    }
    return allQuestions
      .filter((q) => visibleIds.has(q.id))
      .sort((a, b) => a.order - b.order);
  })();

  useEffect(() => {
    if (existing) {
      setRatings(existing.ratings);
    } else {
      setRatings({});
    }
  }, [existing?.id]);

  if (!horse) {
    return (
      <div className="card text-slate-400">
        Horse not found.{" "}
        <Link to="/horses" className="underline">
          Back to horses
        </Link>
        .
      </div>
    );
  }

  if (!activeQuestions || !allQuestions) {
    return <div className="card">Loading…</div>;
  }

  const day = trainingDayNumber(horse.startDate, targetDate);
  const totalQuestions = questions.length;
  const answered = questions.filter((q) => ratings[q.id]?.score).length;

  const handleScore = (q: Question, score: number) => {
    setRatings((prev) => ({
      ...prev,
      [q.id]: {
        ...prev[q.id],
        score: score as Rating["score"],
        questionTextSnapshot:
          prev[q.id]?.questionTextSnapshot ?? q.text,
      },
    }));
  };

  const handleComment = (q: Question, comment: string) => {
    setRatings((prev) => ({
      ...prev,
      [q.id]: {
        ...prev[q.id],
        comment,
        questionTextSnapshot:
          prev[q.id]?.questionTextSnapshot ?? q.text,
      },
    }));
  };

  const submit = async () => {
    const cleaned: Record<ID, Rating> = {};
    for (const [qid, r] of Object.entries(ratings)) {
      if (!r || typeof r.score !== "number") continue;
      cleaned[qid] = {
        score: r.score,
        comment: r.comment?.trim() || undefined,
        questionTextSnapshot:
          r.questionTextSnapshot ??
          allQuestions.find((q) => q.id === qid)?.text ??
          "",
      };
    }
    await upsertEvaluation({
      horseId: horse.id,
      date: targetDate,
      ratings: cleaned,
    });
    setSavedAt(new Date().toISOString());
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{horse.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {formatHumanDate(targetDate)} ·{" "}
            {day >= 1 && day <= horse.durationDays
              ? `Day ${day} of ${horse.durationDays}`
              : "Outside training window"}
          </p>
        </div>
        <Link to={`/horses/${horse.id}`} className="btn-ghost text-sm">
          ← Back to horse
        </Link>
      </div>

      {isPast && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          You're editing a past entry from {formatHumanDate(targetDate)}.
        </div>
      )}

      {day < 1 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
          This date is before training started ({" "}
          {formatHumanDate(horse.startDate)}).
        </div>
      )}
      {day > horse.durationDays && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
          This date is after training ended ({" "}
          {formatHumanDate(endDate(horse.startDate, horse.durationDays))}).
        </div>
      )}

      <div className="card flex items-center justify-between">
        <span className="text-sm text-slate-300">
          {answered} of {totalQuestions} questions answered
        </span>
        <div className="h-2 w-48 bg-slate-800 rounded overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{
              width: `${
                totalQuestions === 0
                  ? 0
                  : (answered / totalQuestions) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {totalQuestions === 0 ? (
        <div className="card text-center text-slate-400">
          No active questions. Add some on the{" "}
          <Link to="/questions" className="underline text-brand-500">
            Questions page
          </Link>{" "}
          first.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const r = ratings[q.id];
            const isRetired = !q.active || q.deletedAt;
            return (
              <div key={q.id} className="card space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <label htmlFor={`q-${q.id}`} className="font-medium">
                    {q.text}
                    {isRetired && (
                      <span className="ml-2 pill bg-slate-700 text-slate-300">
                        retired
                      </span>
                    )}
                  </label>
                  <RatingInput
                    name={`q-${q.id}`}
                    value={r?.score ?? null}
                    onChange={(s) => handleScore(q, s)}
                    label={q.text}
                  />
                </div>
                <textarea
                  id={`q-${q.id}`}
                  rows={2}
                  className="input"
                  placeholder="Optional comment…"
                  value={r?.comment ?? ""}
                  onChange={(e) => handleComment(q, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end items-center gap-3">
        {savedAt && (
          <span className="text-xs text-emerald-400">
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          className="btn-ghost"
          onClick={() => navigate(`/horses/${horse.id}`)}
        >
          Done
        </button>
        <button className="btn-primary" onClick={submit}>
          Save evaluation
        </button>
      </div>
    </div>
  );
}
