import { Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getEngagement,
  getHorse,
  getTrifectaForEngagement,
  listAllQuestions,
  listPhases,
  listRiders,
  listSessionsForEngagement,
  listWeeksForEngagement,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";

const ReportRenderer = lazy(() => import("../features/pdf/ReportRenderer"));

export default function Report() {
  const { id } = useParams();
  const engagement = useQuery(
    () => (id ? getEngagement(id) : Promise.resolve(null)),
    [id],
  );
  const horse = useQuery(
    () =>
      engagement.data
        ? getHorse(engagement.data.horse_id)
        : Promise.resolve(null),
    [engagement.data?.horse_id],
  );
  const sessions = useQuery(
    () => (id ? listSessionsForEngagement(id) : Promise.resolve([])),
    [id],
  );
  const weeks = useQuery(
    () => (id ? listWeeksForEngagement(id) : Promise.resolve([])),
    [id],
  );
  const questions = useQuery(() => listAllQuestions(), []);
  const phases = useQuery(() => listPhases(), []);
  const riders = useQuery(() => listRiders(true), []);
  const trifecta = useQuery(
    () => (id ? getTrifectaForEngagement(id) : Promise.resolve(null)),
    [id],
  );

  const generatedAt = useMemo(
    () => new Date().toISOString(),
    [engagement.data?.id, sessions.data?.length, trifecta.data?.id],
  );

  if (engagement.loading) return <div className="card">Loading…</div>;
  if (!engagement.data) {
    return (
      <div className="card">
        Engagement not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {horse.data?.name ?? "Engagement"} — TQA Report
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {engagement.data.arrival_date
              ? `Arrived ${formatHumanDate(engagement.data.arrival_date)} · `
              : ""}
            {(sessions.data ?? []).length} sessions recorded
          </p>
        </div>
        <Link
          to={`/engagements/${engagement.data.id}`}
          className="btn-ghost text-sm"
        >
          ← Back to engagement
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
          engagement={engagement.data}
          horse={horse.data ?? null}
          sessions={sessions.data ?? []}
          weeks={weeks.data ?? []}
          phases={phases.data ?? []}
          riders={riders.data ?? []}
          questions={questions.data ?? []}
          trifecta={trifecta.data ?? null}
          generatedAt={generatedAt}
        />
      </Suspense>
    </div>
  );
}
