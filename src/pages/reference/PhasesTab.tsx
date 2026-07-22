import { useState } from "react";
import type { Phase, Question, Resource, TrainingType } from "../../supabase/types";
import {
  PERFORMANCE_WARMUP_VIDEOS,
  PROGRAMS,
  TASK_COMPLETION_JOBS,
  TASK_PHASES,
} from "../../content/programs";
import { PERFORMANCE_NOTES } from "../../content/performance-template";
import ErrorState from "../../components/ErrorState";
import { SkeletonCard } from "../../components/Skeleton";
import { IconPlay, IconTasks } from "../../components/Icons";
import { Accordion, LinkRow, VideoCard, youtubeId } from "./shared";

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
          background: "var(--paper)",
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
              <span className="mono muted" style={{ marginRight: 8, fontSize: 11 }}>
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

function PhaseAccordion({
  phase,
  index,
  questions,
  phaseResources,
}: {
  phase: Phase;
  index: number;
  questions: Question[];
  phaseResources: Resource[];
}) {
  const foundation = questions.filter((q) => q.axis === "foundation");
  const temperament = questions.filter((q) => q.axis === "temperament");
  const videos = phaseResources.filter((r) => youtubeId(r.url) != null);
  const links = phaseResources.filter((r) => youtubeId(r.url) == null);

  return (
    <Accordion
      icon={
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {index + 1}
        </span>
      }
      title={phase.name}
      meta={
        <>
          {foundation.length + temperament.length} questions
          {phaseResources.length > 0
            ? ` · ${phaseResources.length} resource${phaseResources.length !== 1 ? "s" : ""}`
            : ""}
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
        <div style={{ marginTop: 14 }}>
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
          {videos.length > 0 && (
            <div className="video-grid" style={{ marginBottom: links.length > 0 ? 10 : 0 }}>
              {videos.map((r) => (
                <VideoCard key={r.id} title={r.title} url={r.url} sub={r.notes} />
              ))}
            </div>
          )}
          {links.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((r) => (
                <LinkRow key={r.id} title={r.title} url={r.url} sub={r.notes} />
              ))}
            </div>
          )}
        </div>
      )}
    </Accordion>
  );
}

// Phases & Questions — program toggle plus per-phase accordions; performance
// programs additionally get the warm-up video segments and the task menu.
export default function PhasesTab({
  phases,
  questionsFor,
  resourcesFor,
  loading,
  error,
  onRetry,
}: {
  phases: Phase[];
  questionsFor: (phaseId: string) => Question[];
  resourcesFor: (phaseId: string) => Resource[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [program, setProgram] = useState<TrainingType>("foundation");
  const programPhases = phases.filter((p) => p.program === program);
  const def = PROGRAMS.find((p) => p.id === program);

  return (
    <div className="ref-section">
      <div
        className="pill-row"
        role="tablist"
        aria-label="Program"
        style={{ marginTop: 4 }}
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
      {def && (
        <p className="muted" style={{ fontSize: 14, margin: 0, maxWidth: 640 }}>
          {def.description}
        </p>
      )}

      {program !== "foundation" && (
        <>
          <Accordion
            icon={<IconPlay size={18} />}
            title="Performance Horse Warm-Up videos"
            meta="in the official document"
          >
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 14,
              }}
            >
              {PERFORMANCE_WARMUP_VIDEOS.map((v) => (
                <li key={v}>Performance Horse Warm-Up: {v}</li>
              ))}
            </ol>
          </Accordion>
          <Accordion
            icon={<IconTasks size={18} />}
            title="Task Completion menu"
            meta={`pick one job per day · phases ${TASK_PHASES.join("–")}`}
          >
            <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
              After the warm-up, the trainer picks a job from this menu for the
              day's task completion. Advancement through each job's phases is
              not tracked in the daily log.
            </p>
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 14,
              }}
            >
              {TASK_COMPLETION_JOBS.map((job) => (
                <li key={job.code}>{job.name}</li>
              ))}
            </ol>
            {PERFORMANCE_NOTES.map((n, i) => (
              <p
                key={i}
                className="muted"
                style={{ fontSize: 13, lineHeight: 1.5, margin: "10px 0 0" }}
              >
                {n}
              </p>
            ))}
          </Accordion>
        </>
      )}

      {error && phases.length === 0 ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : loading && phases.length === 0 ? (
        <>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </>
      ) : (
        programPhases.map((p, i) => (
          <PhaseAccordion
            key={p.id}
            phase={p}
            index={i}
            questions={questionsFor(p.id)}
            phaseResources={resourcesFor(p.id)}
          />
        ))
      )}
    </div>
  );
}
