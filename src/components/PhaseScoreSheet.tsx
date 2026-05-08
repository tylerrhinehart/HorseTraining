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
    <details className="card" style={{ fontSize: 12 }}>
      <summary
        style={{
          cursor: "pointer",
          color: "var(--leather)",
          fontFamily: "var(--font-display)",
        }}
      >
        Score legend
      </summary>
      <ul
        style={{
          marginTop: 8,
          display: "grid",
          gap: 4,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
          <li key={s} style={{ display: "flex", gap: 8 }}>
            <span
              className="mono"
              style={{
                width: 32,
                textAlign: "right",
                color:
                  s > 0
                    ? "var(--ok)"
                    : s < 0
                      ? "var(--bad)"
                      : "var(--ink-2)",
              }}
            >
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
      {questions.map((q, i) => {
        const draft = drafts[q.id] ?? {};
        return (
          <div key={q.id} className="card space-y-2">
            <div className="flex justify-between gap-3">
              <div
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.45,
                }}
              >
                <span
                  className="mono muted"
                  style={{ marginRight: 8, fontSize: 12 }}
                >
                  {i + 1}.
                </span>
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
              <p
                style={{
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "var(--ink-2)",
                  margin: 0,
                }}
              >
                "{draft.comment}"
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
