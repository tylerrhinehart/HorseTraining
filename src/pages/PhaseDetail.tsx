import { Link, useParams } from "react-router-dom";
import {
  deleteResource,
  getPhase,
  listQuestionsForPhase,
  listResourcesForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { Question, Resource } from "../supabase/types";
import ResourceForm from "../components/ResourceForm";

export default function PhaseDetail() {
  const { id } = useParams();
  const phase = useQuery(() => (id ? getPhase(id) : Promise.resolve(null)), [id]);
  const questions = useQuery(
    () => (id ? listQuestionsForPhase(id) : Promise.resolve([])),
    [id],
  );
  const resources = useQuery(
    () => (id ? listResourcesForPhase(id) : Promise.resolve([])),
    [id],
  );

  if (!id) return null;
  if (phase.loading) return <div className="card">Loading…</div>;
  if (!phase.data) {
    return (
      <div className="card">
        Phase not found.{" "}
        <Link to="/phases" className="underline">Back</Link>
      </div>
    );
  }

  const foundation = (questions.data ?? []).filter((q) => q.axis === "foundation");
  const temperament = (questions.data ?? []).filter((q) => q.axis === "temperament");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{phase.data.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            Canonical TQA score-sheet items (read-only). Attach training videos
            or links below.
          </p>
        </div>
        <Link to="/phases" className="btn-ghost text-sm">
          ← All phases
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ItemColumn title="Foundation / Task Completion" questions={foundation} />
        <ItemColumn title="Temperament / Driving Factors" questions={temperament} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Phase resources</h2>
        <p className="text-xs text-slate-400">
          Videos and links that apply to this phase.
        </p>
        <ResourceForm phaseId={id} onCreated={resources.refresh} />
        <ResourceListView
          resources={resources.data ?? []}
          onDeleted={resources.refresh}
        />
      </section>
    </div>
  );
}

function ItemColumn({
  title,
  questions,
}: {
  title: string;
  questions: Question[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <ol className="card space-y-2">
        {questions.map((q) => (
          <li
            key={q.id}
            className="flex justify-between gap-3 text-sm border-b border-slate-800 pb-2 last:border-b-0 last:pb-0"
          >
            <span>
              <span className="text-slate-500 mr-2">{q.position + 1}.</span>
              {q.text}
            </span>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {q.low_label} / {q.high_label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ResourceListView({
  resources,
  onDeleted,
}: {
  resources: Resource[];
  onDeleted: () => void;
}) {
  if (resources.length === 0) {
    return (
      <div className="card text-center text-slate-400">
        No resources yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {resources.map((r) => (
        <div key={r.id} className="card flex items-center gap-3">
          <span
            className={
              r.kind === "youtube"
                ? "pill bg-red-600/20 text-red-200"
                : "pill bg-slate-700 text-slate-300"
            }
          >
            {r.kind === "youtube" ? "YouTube" : "Link"}
          </span>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-slate-100 hover:underline"
          >
            {r.title}
          </a>
          <button
            className="btn-danger text-xs"
            onClick={async () => {
              if (!confirm(`Delete "${r.title}"?`)) return;
              await deleteResource(r.id);
              onDeleted();
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
