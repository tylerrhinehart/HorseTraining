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
    <div className="view">
      <div className="eyebrow">Curriculum</div>
      <h1 className="h-display">Phases</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        The five canonical TQA phases. Items are seeded from the published
        score sheets and are read-only — open a phase to attach training
        videos and links.
      </p>

      <ScoreLegend />

      {phases.loading && <div className="card muted">Loading…</div>}
      {phases.error && (
        <div className="card" style={{ color: "var(--bad)" }}>
          {phases.error.message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
    <details className="card" style={{ fontSize: 12 }}>
      <summary
        style={{
          cursor: "pointer",
          color: "var(--leather)",
          fontFamily: "var(--font-display)",
        }}
      >
        Score scale (−3 to +3)
      </summary>
      <ul
        style={{
          marginTop: 8,
          display: "grid",
          gap: 4,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
          <li key={s} style={{ display: "flex", gap: 8 }}>
            <span
              className="mono"
              style={{
                width: 32,
                textAlign: "right",
                color:
                  s > 0
                    ? "var(--ok)"
                    : s < 0
                      ? "var(--bad)"
                      : "var(--ink-2)",
              }}
            >
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
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{phase.name}</h2>
        <span className="card-meta">
          {foundation.length} foundation · {temperament.length} temperament
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Link to={`/phases/${phase.id}`} className="btn btn-sm">
          Open · attach resources
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
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
    <div>
      <h3
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--muted)",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--paper-2)",
        }}
      >
        {items.map((q, i) => (
          <li
            key={q.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 13,
              padding: "8px 12px",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <span style={{ flex: 1 }}>
              <span
                className="mono muted"
                style={{ marginRight: 8, fontSize: 11 }}
              >
                {q.position + 1}.
              </span>
              {q.text}
            </span>
            {showPolars && (
              <span
                className="mono muted"
                style={{ fontSize: 11, whiteSpace: "nowrap" }}
              >
                {q.low_label} / {q.high_label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
