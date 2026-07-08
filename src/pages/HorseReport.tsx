import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getHorse,
  getTrifectaForHorse,
  listAllQuestions,
  listPhases,
  listSessionsForHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/Skeleton";
import ReportRenderer from "../features/pdf/ReportRenderer";
import type { TrifectaEvaluationWithScores } from "../supabase/types";
import { formatHumanDate } from "../utils/dates";

export default function HorseReport() {
  const { id } = useParams<{ id: string }>();
  const generatedAt = useMemo(() => new Date().toISOString(), []);

  const horse = useQuery(id ? qk.horse(id) : null, () => getHorse(id!));
  const sessions = useQuery(id ? qk.sessions(id) : null, () =>
    listSessionsForHorse(id!),
  );
  const phases = useQuery(qk.phases(), () => listPhases());
  const questions = useQuery(["questions", "all"], () => listAllQuestions());
  const trifectaQ = useQuery(id ? qk.trifecta(id) : null, () =>
    getTrifectaForHorse(id!),
  );

  const trifecta: TrifectaEvaluationWithScores | null = useMemo(() => {
    if (!trifectaQ.data) return null;
    return { ...trifectaQ.data.evaluation, scores: trifectaQ.data.scores };
  }, [trifectaQ.data]);

  if (!id) return null;

  // A real query failure surfaces the retry UI instead of masquerading as
  // "Horse not found" (that branch is reserved for a genuine null result).
  const queries = [horse, sessions, phases, questions, trifectaQ];
  const failed = queries.find((q) => q.error && q.data === undefined);
  if (failed) {
    return (
      <div className="view">
        <ErrorState
          error={failed.error}
          onRetry={() => queries.forEach((q) => q.refresh())}
        />
      </div>
    );
  }

  if (
    horse.loading ||
    sessions.loading ||
    phases.loading ||
    questions.loading ||
    trifectaQ.loading
  ) {
    return (
      <div className="view" style={{ maxWidth: 1100 }}>
        <p
          className="muted"
          role="status"
          aria-live="polite"
          style={{ marginTop: 0, marginBottom: 12 }}
        >
          Generating report…
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  }
  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">
          Horse not found.{" "}
          <Link to="/" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  const sessionCount = sessions.data?.length ?? 0;

  return (
    <div className="view" style={{ maxWidth: 1100 }}>
      <Link
        to={`/horses/${id}`}
        className="btn btn-ghost"
        style={{ marginBottom: 8, alignSelf: "flex-start" }}
      >
        ← Back to {horse.data.name}
      </Link>
      <div className="eyebrow">TQA Report</div>
      <h1 className="h-display">{horse.data.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Generated {formatHumanDate(generatedAt.slice(0, 10))} · based on{" "}
        {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
      </p>
      <ReportRenderer
        horse={horse.data}
        sessions={sessions.data ?? []}
        phases={phases.data ?? []}
        questions={questions.data ?? []}
        trifecta={trifecta}
        generatedAt={generatedAt}
      />
    </div>
  );
}
