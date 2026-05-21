import type { Question, Resource } from "../supabase/types";
import { organizeSessionResources } from "../utils/sessionResources";

interface Props {
  questions: Question[];
  phaseResources: Resource[];
  questionResources: Resource[];
  phaseName?: string;
  compact?: boolean;
}

export default function SessionResourcesPanel({
  questions,
  phaseResources,
  questionResources,
  phaseName,
  compact = false,
}: Props) {
  const resourcesByQuestionId = questionResources.reduce<Record<string, Resource[]>>(
    (acc, resource) => {
      if (!resource.question_id) return acc;
      acc[resource.question_id] = [...(acc[resource.question_id] ?? []), resource];
      return acc;
    },
    {},
  );

  const plan = organizeSessionResources({
    questions,
    phaseResources,
    resourcesByQuestionId,
  });

  if (plan.totalCount === 0) {
    return (
      <section className="card" aria-label="Session resources">
        <div className="card-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Session resources</p>
            <h2 className="card-title">Training media for this session</h2>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          No videos or links are attached to this phase or its training tasks yet.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Session resources">
      <div className="card-head" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Session resources</p>
          <h2 className="card-title">Training media for this session</h2>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            {phaseName ? `${phaseName} resources` : "Phase resources"} are shown first,
            followed by videos and links attached directly to scored tasks.
          </p>
        </div>
        <span className="card-meta" style={{ whiteSpace: "nowrap" }}>
          {plan.videoCount} video{plan.videoCount === 1 ? "" : "s"} · {plan.linkCount} link
          {plan.linkCount === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "grid", gap: compact ? 10 : 14 }}>
        {plan.phaseResources.length > 0 && (
          <ResourceBucket
            label="Phase-wide"
            description="General prep for the whole session phase"
            resources={plan.phaseResources}
          />
        )}

        {plan.questionGroups.map((group) => (
          <ResourceBucket
            key={group.question.id}
            label={`Task ${group.question.position + 1}`}
            description={group.question.text}
            resources={group.resources}
          />
        ))}
      </div>
    </section>
  );
}

function ResourceBucket({
  label,
  description,
  resources,
}: {
  label: string;
  description: string;
  resources: Resource[];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(78px, auto) 1fr",
          gap: 12,
          padding: "12px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span className="pill pill-muted" style={{ alignSelf: "start" }}>{label}</span>
        <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.35 }}>{description}</p>
      </div>
      <div
        style={{
          display: "grid",
          gap: 8,
          padding: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const isVideo = resource.kind === "youtube";
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 112,
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: isVideo
          ? "linear-gradient(135deg, rgba(113,112,255,0.22), rgba(255,155,110,0.09))"
          : "var(--paper-2)",
        color: "var(--ink)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className={isVideo ? "pill pill-leather" : "pill pill-muted"}>
          {isVideo ? "▶ Video" : "↗ Link"}
        </span>
        <span className="mono muted" style={{ fontSize: 11 }}>Open</span>
      </div>
      <strong style={{ fontFamily: "var(--font-display)", lineHeight: 1.25 }}>
        {resource.title}
      </strong>
      {resource.notes && (
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.35 }}>
          {resource.notes}
        </p>
      )}
    </a>
  );
}
