import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createQuestion,
  deleteResource,
  getPhase,
  listQuestionsForPhase,
  listResourcesForPhase,
  renamePhase,
  reorderQuestions,
  softDeleteQuestion,
  updateQuestion,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { Question, Resource } from "../supabase/types";
import ResourceForm from "../components/ResourceForm";

export default function PhaseDetail() {
  const { id } = useParams();
  const phase = useQuery(() => (id ? getPhase(id) : Promise.resolve(null)), [id]);
  const questions = useQuery(
    () => (id ? listQuestionsForPhase(id, false) : Promise.resolve([])),
    [id],
  );
  const resources = useQuery(
    () => (id ? listResourcesForPhase(id) : Promise.resolve([])),
    [id],
  );

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

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

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    await renamePhase(id, trimmed);
    phase.refresh();
    setEditingName(false);
  };

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    await createQuestion({ phaseId: id, text: newQuestion });
    setNewQuestion("");
    questions.refresh();
  };

  const move = async (qid: string, dir: -1 | 1) => {
    const list = questions.data ?? [];
    const idx = list.findIndex((q) => q.id === qid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const reordered = [...list];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, item);
    await reorderQuestions(reordered.map((q) => q.id));
    questions.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {editingName ? (
            <input
              autoFocus
              className="input w-72"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <h1
              className="text-2xl font-semibold cursor-pointer"
              onClick={() => {
                setName(phase.data!.name);
                setEditingName(true);
              }}
              title="Click to rename"
            >
              {phase.data.name}
            </h1>
          )}
          <p className="text-slate-400 text-sm mt-1">
            Manage TQA questions and resources for this phase.
          </p>
        </div>
        <Link to="/phases" className="btn-ghost text-sm">
          ← All phases
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">TQA questions</h2>
        <p className="text-xs text-slate-400">
          Editing question text doesn't change past TQAs — they keep the text
          as it was when the rating was recorded.
        </p>
        <form onSubmit={addQuestion} className="card flex gap-2">
          <input
            className="input"
            placeholder="Add a new question (e.g. Lateral suppleness)"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <button className="btn-primary" type="submit">Add</button>
        </form>
        <div className="space-y-2">
          {questions.loading && (
            <div className="card text-slate-400">Loading…</div>
          )}
          {!questions.loading &&
            (questions.data ?? []).length === 0 && (
              <div className="card text-center text-slate-400">
                No questions in this phase yet.
              </div>
            )}
          {(questions.data ?? []).map((q, idx, arr) => (
            <QuestionRow
              key={q.id}
              question={q}
              isFirst={idx === 0}
              isLast={idx === arr.length - 1}
              onMoveUp={() => move(q.id, -1)}
              onMoveDown={() => move(q.id, 1)}
              onChanged={questions.refresh}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Phase resources</h2>
        <p className="text-xs text-slate-400">
          Videos and links that apply to this whole phase.
        </p>
        <ResourceForm
          phaseId={id}
          onCreated={resources.refresh}
        />
        <ResourceListView
          resources={resources.data ?? []}
          onDeleted={resources.refresh}
        />
      </section>
    </div>
  );
}

interface RowProps {
  question: Question;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}

function QuestionRow({
  question,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onChanged,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await updateQuestion(question.id, { text: trimmed });
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (
      !confirm(
        `Remove "${question.text}" from new TQAs? Past TQAs keep the original text.`,
      )
    )
      return;
    await softDeleteQuestion(question.id);
    onChanged();
  };

  const toggleActive = async () => {
    await updateQuestion(question.id, { active: !question.active });
    onChanged();
  };

  return (
    <div className="card flex items-center gap-3">
      <div className="flex flex-col gap-1">
        <button
          className="btn-ghost px-2 py-0 text-xs disabled:opacity-30"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          className="btn-ghost px-2 py-0 text-xs disabled:opacity-30"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
        >
          ▼
        </button>
      </div>
      <div className="flex-1">
        {editing ? (
          <input
            autoFocus
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setText(question.text);
                setEditing(false);
              }
            }}
            onBlur={save}
          />
        ) : (
          <button
            type="button"
            className="text-left w-full"
            onClick={() => setEditing(true)}
          >
            <span className="text-slate-100">{question.text}</span>
            {!question.active && (
              <span className="ml-2 pill bg-slate-700 text-slate-300">
                inactive
              </span>
            )}
          </button>
        )}
      </div>
      <Link
        to={`/resources?question=${question.id}`}
        className="btn-ghost text-xs"
        title="Manage resources for this question"
      >
        Resources
      </Link>
      <button
        type="button"
        className={
          question.active
            ? "btn-secondary text-xs"
            : "btn-primary text-xs"
        }
        onClick={toggleActive}
      >
        {question.active ? "Deactivate" : "Reactivate"}
      </button>
      <button type="button" className="btn-danger text-xs" onClick={remove}>
        Remove
      </button>
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
