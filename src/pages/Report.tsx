import { Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getHorse,
  listAllQuestions,
  listPhases,
  listTQAsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";

const ReportRenderer = lazy(() => import("../features/pdf/ReportRenderer"));

export default function Report() {
  const { id } = useParams();
  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const tqas = useQuery(
    () => (id ? listTQAsForHorse(id) : Promise.resolve([])),
    [id],
  );
  const questions = useQuery(() => listAllQuestions(true), []);
  const phases = useQuery(() => listPhases(), []);

  const generatedAt = useMemo(
    () => new Date().toISOString(),
    [horse.data?.id, tqas.data?.length],
  );

  if (horse.loading) return <div className="card">Loading…</div>;
  if (!horse.data) {
    return (
      <div className="card">
        Horse not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {horse.data.name} — TQA Report
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {horse.data.start_date
              ? `Started ${formatHumanDate(horse.data.start_date)} · `
              : ""}
            {(tqas.data ?? []).length} TQAs recorded
          </p>
        </div>
        <Link to={`/horses/${horse.data.id}`} className="btn-ghost text-sm">
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
          horse={horse.data}
          tqas={tqas.data ?? []}
          questions={questions.data ?? []}
          phases={phases.data ?? []}
          generatedAt={generatedAt}
        />
      </Suspense>
    </div>
  );
}
