import { useEffect, useMemo, useRef, useState } from "react";
import RatingInput from "./RatingInput";
import {
  TRIFECTA_AXIS_LABELS,
  TRIFECTA_ITEMS,
  type TrifectaItem,
} from "../content/trifecta";
import {
  getTrifectaForHorse,
  listSessionsForHorse,
  upsertTrifectaEvaluation,
  type TrifectaScoreInput,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type {
  SessionWithRatings,
  TqaScore,
  TrifectaEvaluationWithScores,
} from "../supabase/types";

interface Props {
  horseId: string;
  onSaved?: () => void;
}

interface DraftScore {
  score?: TqaScore;
  comment?: string;
}

/** Map per-session ratings into suggested Trifecta score defaults. */
function suggestionFromSessions(
  sessions: SessionWithRatings[],
): Record<string, TqaScore | undefined> {
  // No sessions → no suggestions; items render unscored so the trainer
  // explicitly scores each one rather than confirming a misleading default.
  if (sessions.length === 0) return {};
  const ratings = sessions.flatMap((s) => s.ratings ?? []);
  const tempByText = new Map<string, number[]>();
  const foundationScores: number[] = [];
  for (const r of ratings) {
    if (r.axis_snapshot === "temperament") {
      const key = r.question_text_snapshot.toLowerCase();
      const arr = tempByText.get(key) ?? [];
      arr.push(r.score);
      tempByText.set(key, arr);
    } else {
      foundationScores.push(r.score);
    }
  }
  const avg = (xs: number[]): TqaScore | undefined => {
    if (xs.length === 0) return undefined;
    const m = xs.reduce((s, n) => s + n, 0) / xs.length;
    return Math.max(-3, Math.min(3, Math.round(m))) as TqaScore;
  };
  const out: Record<string, TqaScore | undefined> = {};
  // Foundation + Task Completion items default to the same overall foundation avg.
  for (const item of TRIFECTA_ITEMS) {
    if (item.axis === "temperament") continue;
    out[item.code] = avg(foundationScores);
  }
  // Temperament dimensions match by case-insensitive prefix.
  for (const item of TRIFECTA_ITEMS) {
    if (item.axis !== "temperament") continue;
    let scores: number[] = [];
    for (const [text, arr] of tempByText) {
      if (text.startsWith(item.text.toLowerCase())) {
        scores = scores.concat(arr);
      }
    }
    out[item.code] = avg(scores);
  }
  return out;
}

export default function TrifectaEvaluation({ horseId, onSaved }: Props) {
  const trifecta = useQuery(() => getTrifectaForHorse(horseId), [horseId]);
  const sessions = useQuery(() => listSessionsForHorse(horseId), [horseId]);

  const evaluation: TrifectaEvaluationWithScores | null = useMemo(() => {
    if (!trifecta.data) return null;
    return { ...trifecta.data.evaluation, scores: trifecta.data.scores };
  }, [trifecta.data]);

  const [drafts, setDrafts] = useState<Record<string, DraftScore>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Holds the pending onSaved callback so the "Saved ✓" badge stays visible
  // for ~1.2s before the parent advances to the next step.
  const onSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  // Clean up any pending onSaved timer if the component unmounts mid-delay.
  useEffect(() => {
    return () => {
      if (onSavedTimerRef.current !== null) {
        clearTimeout(onSavedTimerRef.current);
        onSavedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const sessionList = sessions.data ?? [];
    const suggestion = suggestionFromSessions(sessionList);
    const next: Record<string, DraftScore> = {};
    for (const item of TRIFECTA_ITEMS) {
      const stored = evaluation?.scores.find(
        (s) => s.axis === item.axis && s.item_code === item.code,
      );
      next[item.code] = stored
        ? { score: stored.score, comment: stored.comment ?? undefined }
        : { score: suggestion[item.code] };
    }
    setDrafts(next);
    setNotes(evaluation?.notes ?? "");
  }, [trifecta.data, sessions.data]);

  const grouped = useMemo(() => {
    const map: Record<string, TrifectaItem[]> = {
      foundation: [],
      task_completion: [],
      temperament: [],
    };
    for (const item of TRIFECTA_ITEMS) {
      map[item.axis].push(item);
    }
    for (const axis of Object.keys(map)) {
      map[axis].sort((a, b) => a.position - b.position);
    }
    return map;
  }, []);

  const save = async () => {
    setError(null);
    const scores: TrifectaScoreInput[] = TRIFECTA_ITEMS.filter(
      (item) => typeof drafts[item.code]?.score === "number",
    ).map((item) => ({
      axis: item.axis,
      itemCode: item.code,
      itemTextSnapshot: item.text,
      score: drafts[item.code]!.score!,
      comment: drafts[item.code]?.comment,
    }));
    if (scores.length === 0) {
      setError("Score at least one item before saving.");
      return;
    }
    setSaving(true);
    try {
      await upsertTrifectaEvaluation({
        horse_id: horseId,
        notes,
        scores,
      });
      trifecta.refresh();
      setSavedAt(Date.now());
      // Delay onSaved so the "Saved ✓" badge is visible to the user before
      // the parent advances steps / unmounts this component.
      if (onSaved) {
        if (onSavedTimerRef.current !== null) {
          clearTimeout(onSavedTimerRef.current);
        }
        onSavedTimerRef.current = setTimeout(() => {
          onSavedTimerRef.current = null;
          onSaved();
        }, 1200);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sessionCount = (sessions.data ?? []).length;

  if (trifecta.loading || sessions.loading) {
    return (
      <div className="card">
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        {sessionCount === 0
          ? "No session data yet — score each item manually per the TQA Training Trifecta."
          : "Final evaluation per the TQA Training Trifecta. Initial suggestions come from this horse's session ratings — adjust as needed before sharing with the owner."}
      </p>
      {(["foundation", "task_completion", "temperament"] as const).map(
        (axis) => (
          <section key={axis} className="card">
            <h3
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--muted)",
                margin: "0 0 12px",
              }}
            >
              {TRIFECTA_AXIS_LABELS[axis]}
            </h3>
            <div className="space-y-2">
              {grouped[axis].map((item, i) => {
                const draft = drafts[item.code] ?? {};
                return (
                  <div
                    key={item.code}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 10,
                      background: "var(--paper-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
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
                        {item.text}
                        {item.detail && (
                          <p
                            className="muted"
                            style={{
                              fontSize: 12,
                              fontStyle: "italic",
                              marginTop: 4,
                              marginBottom: 0,
                            }}
                          >
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <RatingInput
                        name={`tri-${item.code}`}
                        value={draft.score ?? null}
                        onChange={(s) =>
                          setDrafts((d) => ({
                            ...d,
                            [item.code]: { ...d[item.code], score: s },
                          }))
                        }
                        label={item.text}
                        lowLabel={item.low_label}
                        highLabel={item.high_label}
                      />
                    </div>
                    <textarea
                      rows={1}
                      className="input"
                      style={{ fontSize: 12, marginTop: 8 }}
                      placeholder="Optional comment…"
                      value={draft.comment ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.code]: {
                            ...d[item.code],
                            comment: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}
      <div className="card">
        <label className="label" htmlFor="trifecta-notes">
          Evaluation notes
        </label>
        <textarea
          id="trifecta-notes"
          rows={3}
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && (
        <p style={{ color: "var(--bad)", fontSize: 13, margin: 0 }}>{error}</p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
        }}
      >
        {savedAt && (
          <span
            role="status"
            aria-live="polite"
            style={{ color: "var(--ok)", fontSize: 13 }}
          >
            Saved ✓
          </span>
        )}
        <button className="btn btn-leather" disabled={saving} onClick={save}>
          {saving ? "Saving…" : evaluation ? "Update evaluation" : "Save evaluation"}
        </button>
      </div>
    </div>
  );
}
