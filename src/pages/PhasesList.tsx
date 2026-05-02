import { Link } from "react-router-dom";
import { listAllQuestions, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { SCORE_LEGEND } from "../content/tqa-template";
import type { Phase, Question } from "../supabase/types";

export default function PhasesList() {
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);

  const questionsFor = (phaseId: string) =>
    (questions.data ?? [])
      .filter((q) => q.phase_id === phaseId)
      .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Phases</h1>
        <p className="text-slate-400 text-sm mt-1">
          The five canonical TQA phases. Items are seeded from the published
          score sheets and are read-only — open a phase to attach training
          videos and links.
        </p>
      </div>

      <ScoreLegend />

      {phases.loading && <div className="card text-slate-400">Loading…</div>}
      {phases.error && (
        <div className="card text-red-400">{phases.error.message}</div>
      )}

      <div className="space-y-4">
        {phases.data?.map((p) => (
          <PhaseCard
            key={p.id}
            phase={p}
            questions={questionsFor(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreLegend() {
  return (
    <details className="card text-xs text-slate-300">
      <summary className="cursor-pointer text-brand-300">
        Score scale (-3 to +3)
      </summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
          <li key={s} className="flex gap-2">
            <span className="font-mono w-8 text-right">
              {s > 0 ? `+${s}` : s}
            </span>
            <span>{SCORE_LEGEND[s]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PhaseCard({
  phase,
  questions,
}: {
  phase: Phase;
  questions: Question[];
}) {
  const foundation = questions.filter((q) => q.axis === "foundation");
  const temperament = questions.filter((q) => q.axis === "temperament");

  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{phase.name}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {foundation.length} foundation · {temperament.length} temperament
          </p>
        </div>
        <Link to={`/phases/${phase.id}`} className="btn-secondary text-xs">
          Open / attach resources
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ItemColumn
          title="Foundation / Task Completion"
          items={foundation}
          showPolars={false}
        />
        <ItemColumn
          title="Temperament / Driving Factors"
          items={temperament}
          showPolars
        />
      </div>
    </section>
  );
}

function ItemColumn({
  title,
  items,
  showPolars,
}: {
  title: string;
  items: Question[];
  showPolars: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <ol className="border border-slate-800 rounded-lg divide-y divide-slate-800">
        {items.map((q) => (
          <li
            key={q.id}
            className="flex justify-between gap-3 text-sm px-3 py-2"
          >
            <span className="flex-1">
              <span className="text-slate-500 mr-2">{q.position + 1}.</span>
              {q.text}
            </span>
            {showPolars && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {q.low_label} / {q.high_label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
