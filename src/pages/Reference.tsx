import { useEffect, useRef, useState } from "react";
import {
  listAllQuestions,
  listPhases,
  listResourcesForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { Phase, Question, Resource, TrainingType } from "../supabase/types";
import {
  FFP_SECTIONS,
  FRAMEWORK_QUESTIONS,
  INDUSTRY_PRICING,
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
import {
  FIVE_FOUNDATION_LEGEND,
  FIVE_TEMPERAMENT_LEGEND,
  PROGRAMS,
  TASK_COMPLETION_JOBS,
  TASK_PHASES,
} from "../content/programs";
import { PERFORMANCE_NOTES } from "../content/performance-template";

// Wade Black's walkthrough of the Foundation for Perfection handout.
const FFP_WALKTHROUGH_URL = "https://youtu.be/teE3sm2T_9A";

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

function ScaleLegendList({
  values,
  legend,
}: {
  values: readonly number[];
  legend: Record<number, string>;
}) {
  return (
    <ul
      style={{
        display: "grid",
        gap: 6,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        margin: 0,
        padding: 0,
        listStyle: "none",
        fontSize: 14,
      }}
    >
      {values.map((s) => (
        <li key={s} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span
            className="mono"
            style={{
              width: 32,
              textAlign: "right",
              color: s > 0 ? "var(--ok)" : s < 0 ? "var(--bad)" : "var(--ink-2)",
            }}
          >
            {s > 0 ? `+${s}` : s}
          </span>
          <span>{legend[s]}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── section: What is TQA? ───────────────────────────────────────────────────

function WhatIsTqaSection() {
  return (
    <>
      <div className="card">
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Training Quality Assurance (TQA) is a peer-reviewed framework for
          measuring the quality of a horse's training. It is built on the
          Foundation for Perfection doctrine and the “Training Trifecta” —
          Foundation, Task Completion, and Temperament. Every score sheet in this
          app evaluates a horse against that standard so a client knows exactly
          what they are paying for and what the horse can do.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Foundation score scale</h2>
          <span className="card-meta">−3 to +3</span>
        </div>
        <ScaleLegendList values={[3, 2, 1, 0, -1, -2, -3]} legend={SCORE_LEGEND} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Performance score scale</h2>
          <span className="card-meta">1 to 5</span>
        </div>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <div>
            <h3
              className="mono muted"
              style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", margin: "0 0 6px" }}
            >
              Foundation / Task Completion
            </h3>
            <ScaleLegendList values={[1, 2, 3, 4, 5]} legend={FIVE_FOUNDATION_LEGEND} />
          </div>
          <div>
            <h3
              className="mono muted"
              style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", margin: "0 0 6px" }}
            >
              Temperament
            </h3>
            <ScaleLegendList values={[1, 2, 3, 4, 5]} legend={FIVE_TEMPERAMENT_LEGEND} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── section: TQA Industry Standards ─────────────────────────────────────────

function IndustryStandardsSection() {
  return (
    <>
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
          <h2 className="card-title">What to expect to pay</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {INDUSTRY_PRICING.map((tier) => (
            <div key={tier.label}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {tier.label}:{" "}
                <span style={{ color: "var(--leather)" }}>{tier.range}</span>
              </p>
              <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {tier.note}
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
              <span style={{ fontWeight: 600 }}>{o.label}:</span> {o.description}
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
    </>
  );
}

// ─── section: Horse Training Philosophy (Foundation Doctrine) ────────────────

function PhilosophySection() {
  return (
    <>
      <div
        className="card"
        style={{ borderColor: "var(--gold)", background: "var(--paper-2)" }}
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
          <strong>Pending verbatim handout.</strong> The doctrine below is a
          working summary. The final “Foundation for Perfection” wording is Wade
          Black's peer-reviewed master's work and will replace this text verbatim
          once supplied.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Foundation for Perfection — walkthrough</h2>
          <span className="card-meta">video</span>
        </div>
        <ResourceList
          resources={[
            {
              id: "ffp-walkthrough",
              user_id: "",
              phase_id: null,
              question_id: null,
              title: "Wade Black walks through the Foundation for Perfection",
              url: FFP_WALKTHROUGH_URL,
              kind: "youtube",
              notes: null,
              position: 0,
              created_at: "",
            },
          ]}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Training Trifecta</h2>
          <span className="card-meta">final evaluation</span>
        </div>
        <p className="muted" style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>
          Final evaluation at the end of training. Foundation and Task Completion
          split from the website's 15-item checklist; Temperament uses 5 driving
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

      {FFP_SECTIONS.map((s) => (
        <div key={s.heading} className="card">
          <div className="card-head">
            <h2 className="card-title">{s.heading}</h2>
          </div>
          {s.body.map((p, i) => (
            <p key={i} style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>
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

// Task Completion menu shown for the performance programs.
function TaskCompletionMenu() {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3 className="card-title">Task Completion menu</h3>
        <span className="card-meta">pick one job per day · phases 1–4</span>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        After the warm-up, the trainer picks a job from this menu for the day's
        task completion. Advancement through each job's phases is not tracked in
        the daily log.
      </p>
      <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
        {TASK_COMPLETION_JOBS.map((job) => (
          <li key={job.code}>
            {job.name}{" "}
            <span className="mono muted" style={{ fontSize: 11 }}>
              · Phase {TASK_PHASES.join("/")}
            </span>
          </li>
        ))}
      </ol>
      {PERFORMANCE_NOTES.map((n, i) => (
        <p key={i} className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: "10px 0 0" }}>
          {n}
        </p>
      ))}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

interface SectionDef {
  id: string;
  label: string;
}

const SECTIONS: SectionDef[] = [
  { id: "what-is-tqa", label: "What is TQA?" },
  { id: "standards", label: "Industry Standards" },
  { id: "phases", label: "Phases & Questions" },
  { id: "resources", label: "Videos & Resources" },
  { id: "philosophy", label: "Training Philosophy" },
];

function SectionHeading({
  id,
  refEl,
  children,
}: {
  id: string;
  refEl: (el: HTMLHeadingElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      ref={refEl}
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 20,
        margin: "0 0 12px",
        scrollMarginTop: 120,
      }}
    >
      {children}
    </h2>
  );
}

export default function Reference() {
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);

  const [program, setProgram] = useState<TrainingType>("foundation");

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
      for (const { id, res } of results) map[id] = res;
      setAllPhaseResources(map);
    });
  }, [phases.data]);

  const questionsFor = (phaseId: string) =>
    (questions.data ?? [])
      .filter((q) => q.phase_id === phaseId)
      .sort((a, b) => a.position - b.position);

  const programPhases = (phases.data ?? []).filter((p) => p.program === program);
  const allResources = Object.values(allPhaseResources).flat();

  // Scroll-spy across the five sections.
  const [activeSection, setActiveSection] = useState<string>("what-is-tqa");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observed = SECTIONS.map((s) => refs.current[s.id]).filter(
      (el): el is HTMLElement => el != null,
    );
    if (observed.length === 0) return;

    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          visibility.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId = activeSection;
        let bestRatio = -1;
        for (const s of SECTIONS) {
          const r = visibility.get(s.id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = s.id;
          }
        }
        if (bestRatio > 0) setActiveSection(bestId);
      },
      {
        rootMargin: "-120px 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    for (const el of observed) observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases.data]);

  const pillCls = (id: string) =>
    `btn btn-ghost btn-sm ref-pill${activeSection === id ? " is-active" : ""}`;

  const setRef = (id: string) => (el: HTMLHeadingElement | null) => {
    refs.current[id] = el;
  };

  return (
    <div className="view" style={{ maxWidth: 860 }}>
      <div className="eyebrow">TQA Reference</div>
      <h1 className="h-display">Reference</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        What TQA is, the industry standards, every phase and score-sheet
        question, attached videos and resources, and the training philosophy.
      </p>

      <nav className="ref-anchor-nav" aria-label="Reference sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={pillCls(s.id)}
            aria-current={activeSection === s.id ? "true" : undefined}
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── 1. What is TQA? ── */}
      <SectionHeading id="what-is-tqa" refEl={setRef("what-is-tqa")}>
        What is TQA?
      </SectionHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        <WhatIsTqaSection />
      </div>

      {/* ── 2. TQA Industry Standards ── */}
      <SectionHeading id="standards" refEl={setRef("standards")}>
        TQA Industry Standards
      </SectionHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        <IndustryStandardsSection />
      </div>

      {/* ── 3. Phases & Questions ── */}
      <SectionHeading id="phases" refEl={setRef("phases")}>
        Phases &amp; Questions
      </SectionHeading>
      <div
        className="ref-anchor-nav"
        role="tablist"
        aria-label="Program"
        style={{ marginBottom: 12 }}
      >
        {PROGRAMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={program === p.id}
            className={`btn btn-ghost btn-sm ref-pill${program === p.id ? " is-active" : ""}`}
            onClick={() => setProgram(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        {PROGRAMS.find((p) => p.id === program)?.description}
      </p>

      {phases.loading && <div className="card muted">Loading phases…</div>}
      {phases.error && (
        <div className="card" style={{ color: "var(--bad)" }}>
          {phases.error.message}
        </div>
      )}

      {program !== "foundation" && <TaskCompletionMenu />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {programPhases.map((p) => (
          <PhaseAccordionItem
            key={p.id}
            phase={p}
            questions={questionsFor(p.id)}
            phaseResources={allPhaseResources[p.id] ?? []}
          />
        ))}
      </div>

      {/* ── 4. Videos & Resources ── */}
      <SectionHeading id="resources" refEl={setRef("resources")}>
        Videos &amp; Resources
      </SectionHeading>
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

      {/* ── 5. Horse Training Philosophy ── */}
      <SectionHeading id="philosophy" refEl={setRef("philosophy")}>
        Horse Training Philosophy
      </SectionHeading>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        The Foundation for Perfection doctrine, the framework, and the final
        Trifecta evaluation.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PhilosophySection />
      </div>
    </div>
  );
}
