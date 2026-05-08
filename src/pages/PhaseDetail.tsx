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
  if (phase.loading) return <div className="view"><div className="card">Loading…</div></div>;
  if (!phase.data) {
    return (
      <div className="view">
        <div className="card">
          Phase not found.{" "}
          <Link to="/phases" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  const foundation = (questions.data ?? []).filter((q) => q.axis === "foundation");
  const temperament = (questions.data ?? []).filter((q) => q.axis === "temperament");

  return (
    <div className="view">
      <div className="eyebrow">Phase detail</div>
      <h1 className="h-display">{phase.data.name}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        Canonical TQA score-sheet items (read-only). Attach training videos
        or links below.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Link to="/phases" className="btn btn-ghost btn-sm">
          ← All phases
        </Link>
      </div>

      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          marginBottom: 14,
        }}
      >
        <ItemColumn title="Foundation / Task Completion" questions={foundation} />
        <ItemColumn title="Temperament / Driving Factors" questions={temperament} />
      </section>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Phase resources</h2>
          <span className="card-meta">videos &amp; links</span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Videos and links that apply to this phase.
        </p>
      </div>
      <ResourceForm phaseId={id} onCreated={resources.refresh} />
      <ResourceListView
        resources={resources.data ?? []}
        onDeleted={resources.refresh}
      />
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
        className="card"
        style={{
          margin: 0,
          listStyle: "none",
          padding: 14,
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
              paddingTop: i === 0 ? 0 : 8,
              paddingBottom: i === questions.length - 1 ? 0 : 8,
              borderBottom:
                i === questions.length - 1
                  ? "none"
                  : "1px solid var(--line)",
            }}
          >
            <span>
              <span
                className="mono muted"
                style={{ marginRight: 8, fontSize: 11 }}
              >
                {q.position + 1}.
              </span>
              {q.text}
            </span>
            <span
              className="mono muted"
              style={{ fontSize: 11, whiteSpace: "nowrap" }}
            >
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
      <div className="card muted" style={{ textAlign: "center" }}>
        No resources yet.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {resources.map((r) => (
        <div
          key={r.id}
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <span
            className={r.kind === "youtube" ? "pill pill-leather" : "pill pill-muted"}
          >
            {r.kind === "youtube" ? "YouTube" : "Link"}
          </span>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1,
              color: "var(--ink)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {r.title}
          </a>
          <button
            className="btn btn-danger btn-sm"
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
