import { Link, useSearchParams } from "react-router-dom";
import {
  deleteResource,
  listAllQuestions,
  listPhases,
  listResourcesForPhase,
  listResourcesForQuestion,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import ResourceForm from "../components/ResourceForm";
import type { Resource } from "../supabase/types";

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const phaseId = params.get("phase") ?? undefined;
  const questionId = params.get("question") ?? undefined;

  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);
  const resources = useQuery(
    () =>
      questionId
        ? listResourcesForQuestion(questionId)
        : phaseId
          ? listResourcesForPhase(phaseId)
          : Promise.resolve([] as Resource[]),
    [phaseId, questionId],
  );

  const phaseTarget = phaseId
    ? phases.data?.find((p) => p.id === phaseId)
    : undefined;
  const questionTarget = questionId
    ? questions.data?.find((q) => q.id === questionId)
    : undefined;
  const targetLabel = questionTarget
    ? questionTarget.text
    : phaseTarget
      ? phaseTarget.name
      : "Pick a target below";

  const setTarget = (kind: "phase" | "question", id: string) => {
    const next = new URLSearchParams();
    next.set(kind, id);
    setParams(next);
  };

  return (
    <div className="view">
      <div className="eyebrow">Library</div>
      <h1 className="h-display">Resources</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        Attach YouTube videos and links to phases and individual score-sheet
        items.
      </p>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">
            {questionId ? "Question" : phaseId ? "Phase" : "Target"}
          </h2>
          <span className="card-meta">{targetLabel}</span>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label">By phase</label>
            <select
              className="input"
              value={phaseId ?? ""}
              onChange={(e) => {
                if (e.target.value) setTarget("phase", e.target.value);
                else setParams(new URLSearchParams());
              }}
            >
              <option value="">— Pick a phase —</option>
              {phases.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">By question</label>
            <select
              className="input"
              value={questionId ?? ""}
              onChange={(e) => {
                if (e.target.value) setTarget("question", e.target.value);
                else setParams(new URLSearchParams());
              }}
            >
              <option value="">— Pick a question —</option>
              {(questions.data ?? []).map((q) => {
                const phase = phases.data?.find((p) => p.id === q.phase_id);
                return (
                  <option key={q.id} value={q.id}>
                    {phase ? `[${phase.name}] ` : ""}
                    [{q.axis}] {q.text}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {(phaseId || questionId) && (
        <ResourceForm
          phaseId={phaseId}
          questionId={questionId}
          onCreated={resources.refresh}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resources.loading && <div className="card muted">Loading…</div>}
        {!resources.loading &&
          (resources.data ?? []).length === 0 &&
          (phaseId || questionId) && (
            <div className="card muted" style={{ textAlign: "center" }}>
              No resources yet for this target.
            </div>
          )}
        {(resources.data ?? []).map((r) => (
          <ResourceRow
            key={r.id}
            resource={r}
            onDeleted={resources.refresh}
          />
        ))}
      </div>

      {!phaseId && !questionId && (
        <div className="card muted" style={{ textAlign: "center" }}>
          Pick a phase or a question above to view and add resources, or{" "}
          <Link to="/phases" style={{ color: "var(--leather)" }}>
            browse phases
          </Link>
          .
        </div>
      )}
    </div>
  );
}

function ResourceRow({
  resource,
  onDeleted,
}: {
  resource: Resource;
  onDeleted: () => void;
}) {
  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
    >
      <span
        className={resource.kind === "youtube" ? "pill pill-leather" : "pill pill-muted"}
      >
        {resource.kind === "youtube" ? "YouTube" : "Link"}
      </span>
      <div style={{ flex: 1 }}>
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontWeight: 600,
            color: "var(--ink)",
            textDecoration: "none",
            fontFamily: "var(--font-display)",
          }}
        >
          {resource.title}
        </a>
        {resource.notes && (
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {resource.notes}
          </p>
        )}
      </div>
      <button
        className="btn btn-danger btn-sm"
        onClick={async () => {
          if (!confirm(`Delete "${resource.title}"?`)) return;
          await deleteResource(resource.id);
          onDeleted();
        }}
      >
        Delete
      </button>
    </div>
  );
}
