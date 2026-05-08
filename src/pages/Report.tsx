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

  if (engagement.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }
  if (!engagement.data) {
    return (
      <div className="view">
        <div className="card">
          Engagement not found.{" "}
          <Link to="/horses" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="eyebrow">TQA Report</div>
      <h1 className="h-display">{horse.data?.name ?? "Engagement"}</h1>
      <p className="muted" style={{ margin: "4px 0 14px", fontSize: 14 }}>
        {engagement.data.arrival_date
          ? `Arrived ${formatHumanDate(engagement.data.arrival_date)} · `
          : ""}
        {(sessions.data ?? []).length} sessions recorded
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Link
          to={`/engagements/${engagement.data.id}`}
          className="btn btn-ghost btn-sm"
        >
          ← Back to engagement
        </Link>
      </div>

      <Suspense
        fallback={
          <div
            className="card muted"
            style={{ padding: 40, textAlign: "center" }}
          >
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
