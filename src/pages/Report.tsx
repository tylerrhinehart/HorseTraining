import { Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAllQuestions,
  useEvaluationsForHorse,
  useHorse,
} from "../db/queries";
import { endDate, formatHumanDate } from "../utils/dates";

const ReportRenderer = lazy(() => import("../features/pdf/ReportRenderer"));

export default function Report() {
  const { id } = useParams();
  const horse = useHorse(id);
  const evals = useEvaluationsForHorse(id) ?? [];
  const allQuestions = useAllQuestions(true) ?? [];

  const generatedAt = useMemo(
    () => new Date().toISOString(),
    [horse?.id, evals.length],
  );

  if (!horse) {
    return (
      <div className="card">
        <p className="text-slate-400">Horse not found.</p>
        <Link to="/horses" className="underline">
          Back to horses
        </Link>
      </div>
    );
  }

  const relevantQuestionIds = new Set<string>();
  evals.forEach((e) =>
    Object.keys(e.ratings).forEach((qid) => relevantQuestionIds.add(qid)),
  );
  allQuestions
    .filter((q) => q.active && !q.deletedAt)
    .forEach((q) => relevantQuestionIds.add(q.id));
  const questions = allQuestions
    .filter((q) => relevantQuestionIds.has(q.id))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{horse.name} — Report</h1>
          <p className="text-slate-400 text-sm mt-1">
            {formatHumanDate(horse.startDate)} →{" "}
            {formatHumanDate(endDate(horse.startDate, horse.durationDays))} ·{" "}
            {evals.length} evaluations
          </p>
        </div>
        <Link to={`/horses/${horse.id}`} className="btn-ghost text-sm">
          ← Back to horse
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="card p-10 text-center text-slate-400">
            Loading PDF preview…
          </div>
        }
      >
        <ReportRenderer
          horse={horse}
          evaluations={evals}
          questions={questions}
          generatedAt={generatedAt}
        />
      </Suspense>
    </div>
  );
}
