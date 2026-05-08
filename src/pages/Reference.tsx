import { useEffect, useState } from "react";
import {
  listAllQuestions,
  listPhases,
  listResourcesForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { Phase, Question, Resource } from "../supabase/types";
import {
  FFP_SECTIONS,
  FRAMEWORK_QUESTIONS,
  TRAINER_EXPECTATIONS,
} from "../content/ffp";
import {
  PHASE_TIMELINE,
  RIDE_CADENCE_OPTIONS,
  TOTAL_WEEKS,
} from "../content/timeline";
import {
  FOUNDATION_ITEMS,
  TASK_COMPLETION_ITEMS,
  TEMPERAMENT_ITEMS,
} from "../content/trifecta";
import { SCORE_LEGEND } from "../content/tqa-template";

// ─── helpers ────────────────────────────────────────────────────────────────

function ResourceList({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {resources.map((r) => (
        <div
          key={r.id}
          style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
        >
          <span
            className={r.kind === "youtube" ? "pill pill-leather" : "pill pill-muted"}
            style={{ flexShrink: 0 }}
          >
            {r.kind === "youtube" ? "YouTube" : "Link"}
          </span>
          <div style={{ flex: 1 }}>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontWeight: 600,
                color: "var(--ink)",
                textDecoration: "none",
                fontFamily: "var(--font-display)",
              }}
            >
              {r.title}
            </a>
            {r.notes && (
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {r.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhaseAccordionItem({
  phase,
  questions,
  phaseResources,
}: {
  phase: Phase;
  questions: Question[];
  phaseResources: Resource[];
}) {
  const foundation = questions.filter((q) => q.axis === "foundation");
  const temperament = questions.filter((q) => q.axis === "temperament");

  return (
    <details className="card" style={{ padding: 0 }}>
      <summary
        style={{
          cursor: "pointer",
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          listStyle: "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {phase.name}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {foundation.length} foundation · {temperament.length} temperament
          {phaseResources.length > 0
            ? ` · ${phaseResources.length} resource${phaseResources.length !== 1 ? "s" : ""}`
            : ""}
        </span>
      </summary>

      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            marginBottom: phaseResources.length > 0 ? 14 : 0,
          }}
        >
          <QuestionColumn
            title="Foundation / Task Completion"
            questions={foundation}
            showPolars={false}
          />
          <QuestionColumn
            title="Temperament / Driving Factors"
            questions={temperament}
            showPolars
          />
        </div>

        {phaseResources.length > 0 && (
          <div>
            <h4
              className="mono muted"
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Phase resources
            </h4>
            <ResourceList resources={phaseResources} />
          </div>
        )}
      </div>
    </details>
  );
}

function QuestionColumn({
  title,
  questions,
  showPolars,
}: {
  title: string;
  questions: Question[];
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
        {questions.map((q, i) => (
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

function TrifectaCol({
  title,
  items,
}: {
  title: string;
  items: { code: string; text: string }[];
}) {
  return (
    <div
      style={{
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 12,
      }}
    >
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
          paddingLeft: 18,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
        }}
      >
        {items.map((it) => (
          <li key={it.code}>{it.text}</li>
        ))}
      </ol>
    </div>
  );
}

function DoctrineSection() {
  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Score scale</h2>
          <span className="card-meta">−3 to +3</span>
        </div>
        <ul
          style={{
            display: "grid",
            gap: 6,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            margin: 0,
            padding: 0,
            listStyle: "none",
            fontSize: 14,
          }}
        >
          {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
            <li
              key={s}
              style={{ display: "flex", gap: 10, alignItems: "baseline" }}
            >
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
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Four questions to ask a pro trainer</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FRAMEWORK_QUESTIONS.map((q) => (
            <div key={q.number}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {q.number}. {q.question}
              </p>
              <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {q.summary}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Recommended ride cadences</h2>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 14,
          }}
        >
          {RIDE_CADENCE_OPTIONS.map((o) => (
            <li key={o.label}>
              <span style={{ fontWeight: 600 }}>{o.label}:</span>{" "}
              {o.description}
              {" · "}
              <span className="muted" style={{ fontStyle: "italic" }}>
                {o.pattern}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Phase timeline</h2>
          <span className="card-meta">{TOTAL_WEEKS} weeks total</span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 14,
          }}
        >
          {PHASE_TIMELINE.map((b) => (
            <li key={b.label}>
              <span style={{ fontWeight: 600 }}>{b.label}:</span> {b.weeks} weeks
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Training Trifecta</h2>
          <span className="card-meta">end of engagement</span>
        </div>
        <p className="muted" style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>
          End-of-engagement evaluation. Foundation and Task Completion split
          from the website's 15-item checklist; Temperament uses 5 driving
          factors.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <TrifectaCol title="Foundation" items={FOUNDATION_ITEMS} />
          <TrifectaCol title="Task Completion" items={TASK_COMPLETION_ITEMS} />
          <TrifectaCol title="Temperament" items={TEMPERAMENT_ITEMS} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Trainer expectations at end of 2 months</h2>
        </div>
        <ol
          style={{
            margin: 0,
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 14,
          }}
        >
          {TRAINER_EXPECTATIONS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>

      {FFP_SECTIONS.map((s) => (
        <div key={s.heading} className="card">
          <div className="card-head">
            <h2 className="card-title">{s.heading}</h2>
          </div>
          {s.body.map((p, i) => (
            <p
              key={i}
              style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}
            >
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 14,
              }}
            >
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function Reference() {
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);

  // Fetch resources for each phase in parallel once we have the phase list
  const [allPhaseResources, setAllPhaseResources] = useState<
    Record<string, Resource[]>
  >({});

  useEffect(() => {
    if (!phases.data || phases.data.length === 0) return;
    Promise.all(
      phases.data.map((p) =>
        listResourcesForPhase(p.id).then((res) => ({ id: p.id, res })),
      ),
    ).then((results) => {
      const map: Record<string, Resource[]> = {};
      for (const { id, res } of results) {
        map[id] = res;
      }
      setAllPhaseResources(map);
    });
  }, [phases.data]);

  const questionsFor = (phaseId: string) =>
    (questions.data ?? [])
      .filter((q) => q.phase_id === phaseId)
      .sort((a, b) => a.position - b.position);

  // Aggregate all phase resources for the Videos & Resources section
  const allResources = Object.values(allPhaseResources).flat();

  return (
    <div className="view" style={{ maxWidth: 860 }}>
      <div className="eyebrow">TQA Reference</div>
      <h1 className="h-display">Reference</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        All TQA phases, score-sheet questions, attached resources, and
        framework doctrine in one place.
      </p>

      {/* Anchor nav */}
      <nav
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <a href="#phases" className="btn btn-ghost btn-sm">
          Phases &amp; Questions
        </a>
        <a href="#resources" className="btn btn-ghost btn-sm">
          Videos &amp; Resources
        </a>
        <a href="#doctrine" className="btn btn-ghost btn-sm">
          Foundation Doctrine
        </a>
      </nav>

      {/* ── Section 1: Phases & Questions ── */}
      <h2
        id="phases"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          margin: "0 0 12px",
          scrollMarginTop: 72,
        }}
      >
        Phases &amp; Questions
      </h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        The five canonical TQA phases. Expand a phase to see its score-sheet
        questions.
      </p>

      {phases.loading && <div className="card muted">Loading phases…</div>}
      {phases.error && (
        <div className="card" style={{ color: "var(--bad)" }}>
          {phases.error.message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {phases.data?.map((p) => (
          <PhaseAccordionItem
            key={p.id}
            phase={p}
            questions={questionsFor(p.id)}
            phaseResources={allPhaseResources[p.id] ?? []}
          />
        ))}
      </div>

      {/* ── Section 2: Videos & Resources ── */}
      <h2
        id="resources"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          margin: "0 0 12px",
          scrollMarginTop: 72,
        }}
      >
        Videos &amp; Resources
      </h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        All training videos and links attached to phases.
      </p>

      {allResources.length === 0 && !phases.loading && (
        <div className="card muted" style={{ textAlign: "center", marginBottom: 32 }}>
          No resources attached yet. Open a phase to add videos and links.
        </div>
      )}

      {allResources.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {phases.data?.map((p) => {
            const res = allPhaseResources[p.id] ?? [];
            if (res.length === 0) return null;
            return (
              <div key={p.id} className="card">
                <div className="card-head">
                  <h3 className="card-title">{p.name}</h3>
                  <span className="card-meta">
                    {res.length} resource{res.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ResourceList resources={res} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section 3: Foundation Doctrine ── */}
      <h2
        id="doctrine"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          margin: "0 0 12px",
          scrollMarginTop: 72,
        }}
      >
        Foundation Doctrine
      </h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        The TQA framework, score scale, and end-of-engagement Trifecta.
      </p>

      <DoctrineSection />
    </div>
  );
}
