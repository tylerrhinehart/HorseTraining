import { useMemo } from "react";
import RatingInput from "./RatingInput";
import { SCORE_LEGEND } from "../content/tqa-template";
import type { Question, TqaScore } from "../supabase/types";

export interface DraftRating {
  score?: TqaScore;
  comment?: string;
}

interface Props {
  questions: Question[];
  drafts: Record<string, DraftRating>;
  onScore: (questionId: string, score: TqaScore) => void;
  onComment: (questionId: string, comment: string) => void;
  readOnly?: boolean;
}

/**
 * Single-session score sheet. Two columns: Foundation (8) and Temperament (6).
 * Replicates the per-phase score sheet PDF layout published by TQA.
 */
export default function PhaseScoreSheet({
  questions,
  drafts,
  onScore,
  onComment,
  readOnly = false,
}: Props) {
  const { foundation, temperament } = useMemo(() => {
    const f = questions
      .filter((q) => q.axis === "foundation")
      .sort((a, b) => a.position - b.position);
    const t = questions
      .filter((q) => q.axis === "temperament")
      .sort((a, b) => a.position - b.position);
    return { foundation: f, temperament: t };
  }, [questions]);

  return (
    <div className="space-y-4">
      <ScoreLegend />
      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          title="Foundation / Task Completion"
          questions={foundation}
          drafts={drafts}
          onScore={onScore}
          onComment={onComment}
          readOnly={readOnly}
        />
        <Column
          title="Temperament / Driving Factors"
          questions={temperament}
          drafts={drafts}
          onScore={onScore}
          onComment={onComment}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

function ScoreLegend() {
  return (
    <details className="card text-xs text-slate-300">
      <summary className="cursor-pointer text-brand-300">Score legend</summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
          <li key={s} className="flex gap-2">
            <span className="font-mono w-8 text-right">
              {s > 0 ? `+${s}` : s}
            </span>
            <span>{SCORE_LEGEND[s]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface ColumnProps {
  title: string;
  questions: Question[];
  drafts: Record<string, DraftRating>;
  onScore: (questionId: string, score: TqaScore) => void;
  onComment: (questionId: string, comment: string) => void;
  readOnly: boolean;
}

function Column({
  title,
  questions,
  drafts,
  onScore,
  onComment,
  readOnly,
}: ColumnProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {questions.map((q, i) => {
        const draft = drafts[q.id] ?? {};
        return (
          <div key={q.id} className="card space-y-2">
            <div className="flex justify-between gap-3">
              <div className="flex-1 text-sm font-medium leading-snug">
                <span className="text-slate-500 mr-2">{i + 1}.</span>
                {q.text}
              </div>
              <RatingInput
                name={`q-${q.id}`}
                value={draft.score ?? null}
                onChange={(s) => onScore(q.id, s)}
                label={q.text}
                lowLabel={q.low_label}
                highLabel={q.high_label}
              />
            </div>
            {!readOnly && (
              <textarea
                rows={2}
                className="input text-xs"
                placeholder="Optional comment…"
                value={draft.comment ?? ""}
                onChange={(e) => onComment(q.id, e.target.value)}
              />
            )}
            {readOnly && draft.comment && (
              <p className="text-xs italic text-slate-300">"{draft.comment}"</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
