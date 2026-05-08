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
import ReportRenderer from "../features/pdf/ReportRenderer";
import type { TrifectaEvaluationWithScores } from "../supabase/types";

export default function HorseReport() {
  const { id } = useParams<{ id: string }>();

  const horse = useQuery(() => (id ? getHorse(id) : Promise.resolve(null)), [id]);
  const sessions = useQuery(
    () => (id ? listSessionsForHorse(id) : Promise.resolve([])),
    [id],
  );
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);
  const trifectaQ = useQuery(
    () => (id ? getTrifectaForHorse(id) : Promise.resolve(null)),
    [id],
  );

  const trifecta: TrifectaEvaluationWithScores | null = useMemo(() => {
    if (!trifectaQ.data) return null;
    return { ...trifectaQ.data.evaluation, scores: trifectaQ.data.scores };
  }, [trifectaQ.data]);

  if (!id) return null;
  if (
    horse.loading ||
    sessions.loading ||
    phases.loading ||
    questions.loading ||
    trifectaQ.loading
  ) {
    return (
      <div className="view">
        <div className="card">Generating report…</div>
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

  return (
    <div className="view" style={{ maxWidth: 1100 }}>
      <div className="eyebrow">TQA Report</div>
      <h1 className="h-display">{horse.data.name}</h1>
      <ReportRenderer
        horse={horse.data}
        sessions={sessions.data ?? []}
        phases={phases.data ?? []}
        questions={questions.data ?? []}
        trifecta={trifecta}
        generatedAt={new Date().toISOString()}
      />
    </div>
  );
}
