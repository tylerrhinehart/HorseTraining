import { useState } from "react";
import {
  createQuestion,
  reorderQuestions,
  softDeleteQuestion,
  updateQuestion,
  useAllQuestions,
} from "../db/queries";
import type { Question } from "../db/schema";

export default function Questions() {
  const questions = useAllQuestions(false) ?? [];
  const [newText, setNewText] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    await createQuestion(text);
    setNewText("");
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = questions.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const reordered = [...questions];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, item);
    await reorderQuestions(reordered.map((q) => q.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Evaluation Questions</h1>
        <p className="text-slate-400 mt-1 text-sm">
          These criteria are used in every daily evaluation. Changes only affect
          new entries — past evaluations keep the question text recorded at the
          time. New questions added mid-training only apply going forward.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card flex gap-2">
        <input
          className="input"
          placeholder="Add a new question (e.g. Trailer loading)"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Add
        </button>
      </form>

      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="card text-center text-slate-400">
            No questions yet. Add one above.
          </div>
        ) : (
          questions.map((q, idx) => (
            <QuestionRow
              key={q.id}
              question={q}
              isFirst={idx === 0}
              isLast={idx === questions.length - 1}
              onMoveUp={() => move(q.id, -1)}
              onMoveDown={() => move(q.id, 1)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  question: Question;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function QuestionRow({ question, isFirst, isLast, onMoveUp, onMoveDown }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await updateQuestion(question.id, { text: trimmed });
    setEditing(false);
  };

  const remove = async () => {
    if (
      !confirm(
        `Remove "${question.text}" from new evaluations? Past evaluations keep the original text.`,
      )
    ) {
      return;
    }
    await softDeleteQuestion(question.id);
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
      <button
        type="button"
        className={
          question.active
            ? "btn-secondary text-xs"
            : "btn-primary text-xs"
        }
        onClick={() =>
          updateQuestion(question.id, { active: !question.active })
        }
      >
        {question.active ? "Deactivate" : "Reactivate"}
      </button>
      <button
        type="button"
        className="btn-danger text-xs"
        onClick={remove}
      >
        Remove
      </button>
    </div>
  );
}
