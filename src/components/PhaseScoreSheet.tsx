import { useMemo, useState } from "react";
import RatingInput from "./RatingInput";
import { SCORE_LEGEND } from "../content/tqa-template";
import { listResourcesForQuestion } from "../supabase/queries";
import type { Question, Resource, TqaScore } from "../supabase/types";

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
          <QuestionRow
            key={q.id}
            question={q}
            index={i}
            draft={draft}
            onScore={onScore}
            onComment={onComment}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

interface QuestionRowProps {
  question: Question;
  index: number;
  draft: DraftRating;
  onScore: (questionId: string, score: TqaScore) => void;
  onComment: (questionId: string, comment: string) => void;
  readOnly: boolean;
}

function QuestionRow({
  question: q,
  index: i,
  draft,
  onScore,
  onComment,
  readOnly,
}: QuestionRowProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);

  const toggleHelp = async () => {
    const next = !helpOpen;
    setHelpOpen(next);
    // Lazy-load resources the first time the panel is opened.
    if (next && resources === null && !loadingResources) {
      setLoadingResources(true);
      try {
        const res = await listResourcesForQuestion(q.id);
        setResources(res);
      } catch {
        setResources([]);
      } finally {
        setLoadingResources(false);
      }
    }
  };

  return (
    <div className="card space-y-2">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
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
          <button
            type="button"
            onClick={toggleHelp}
            aria-label={helpOpen ? "Hide help" : "Show help"}
            style={{
              marginLeft: 6,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid var(--ink-3, #ccc)",
              background: helpOpen ? "var(--leather)" : "transparent",
              color: helpOpen ? "#fff" : "var(--ink-2)",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
              cursor: "pointer",
              verticalAlign: "middle",
              flexShrink: 0,
            }}
          >
            i
          </button>
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

      {helpOpen && (
        <div
          style={{
            background: "var(--surface-2, #f7f5f2)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            color: "var(--ink-2)",
          }}
        >
          <div style={{ display: "flex", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
            <span>
              <span style={{ color: "var(--bad)", fontWeight: 600 }}>Low: </span>
              {q.low_label}
            </span>
            <span>
              <span style={{ color: "var(--ok)", fontWeight: 600 }}>High: </span>
              {q.high_label}
            </span>
          </div>
          {loadingResources && (
            <p style={{ margin: 0, fontStyle: "italic" }}>Loading resources…</p>
          )}
          {!loadingResources && resources && resources.length > 0 && (
            <div>
              <p style={{ margin: "4px 0 4px", fontWeight: 600, color: "var(--ink-1)" }}>
                Resources
              </p>
              <ul style={{ margin: 0, paddingLeft: 14 }}>
                {resources.map((r) => (
                  <li key={r.id} style={{ marginBottom: 2 }}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--leather)" }}
                    >
                      {r.kind === "youtube" ? `Watch on YouTube: ${r.title}` : r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
}
