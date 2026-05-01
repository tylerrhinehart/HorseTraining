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
  const questions = useQuery(() => listAllQuestions(false), []);
  const resources = useQuery(
    () =>
      questionId
        ? listResourcesForQuestion(questionId)
        : phaseId
          ? listResourcesForPhase(phaseId)
          : Promise.resolve([] as Resource[]),
    [phaseId, questionId],
  );

  const target =
    questionId
      ? questions.data?.find((q) => q.id === questionId)
      : phaseId
        ? phases.data?.find((p) => p.id === phaseId)
        : undefined;

  const setTarget = (kind: "phase" | "question", id: string) => {
    const next = new URLSearchParams();
    next.set(kind, id);
    setParams(next);
  };

  const targetLabel = target
    ? "name" in target
      ? target.name
      : target.text
    : "Pick a target below";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="text-slate-400 text-sm mt-1">
          Attach YouTube videos and links to phases and individual questions.
        </p>
      </div>

      <section className="card space-y-3">
        <div className="text-sm font-medium text-slate-200">
          {questionId ? "Question:" : phaseId ? "Phase:" : "Select a target:"}{" "}
          <span className="text-brand-200">{targetLabel}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="label">By phase</div>
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
          <div>
            <div className="label">By question</div>
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
                    {q.text}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </section>

      {(phaseId || questionId) && (
        <ResourceForm
          phaseId={phaseId}
          questionId={questionId}
          onCreated={resources.refresh}
        />
      )}

      <section className="space-y-2">
        {resources.loading && (
          <div className="card text-slate-400">Loading…</div>
        )}
        {!resources.loading &&
          (resources.data ?? []).length === 0 &&
          (phaseId || questionId) && (
            <div className="card text-center text-slate-400">
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
      </section>

      {!phaseId && !questionId && (
        <div className="card text-center text-slate-400">
          Pick a phase or a question above to view and add resources, or{" "}
          <Link to="/phases" className="underline text-brand-500">
            manage phases
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
    <div className="card flex items-start gap-3">
      <span
        className={
          resource.kind === "youtube"
            ? "pill bg-red-600/20 text-red-200"
            : "pill bg-slate-700 text-slate-300"
        }
      >
        {resource.kind === "youtube" ? "YouTube" : "Link"}
      </span>
      <div className="flex-1">
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="text-slate-100 hover:underline font-medium"
        >
          {resource.title}
        </a>
        {resource.notes && (
          <p className="text-sm text-slate-400 mt-1">{resource.notes}</p>
        )}
      </div>
      <button
        className="btn-danger text-xs"
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
