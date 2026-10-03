import useUnsavedChanges from "../hooks/useUnsavedChanges";
import ErrorState from "./ErrorState";
import { useEffect, useMemo, useRef, useState } from "react";
import RatingInput from "./RatingInput";
import {
  TRIFECTA_AXIS_LABELS,
  TRIFECTA_ITEMS,
  type TrifectaItem,
} from "../content/trifecta";
import {
  getTrifectaForHorse,
  upsertTrifectaEvaluation,
  type TrifectaScoreInput,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import { useToast } from "./Toast";
import { SkeletonCard } from "./Skeleton";
import type {
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

export default function TrifectaEvaluation({ horseId, onSaved }: Props) {
  const trifecta = useQuery(qk.trifecta(horseId), () =>
    getTrifectaForHorse(horseId),
  );
  const toast = useToast();

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
    const next: Record<string, DraftScore> = {};
    for (const item of TRIFECTA_ITEMS) {
      const stored = evaluation?.scores.find(
        (s) => s.axis === item.axis && s.item_code === item.code,
      );
      next[item.code] = stored
        ? { score: stored.score, comment: stored.comment ?? undefined }
        : {};
    }
    setDrafts(next);
    setNotes(evaluation?.notes ?? "");
  }, [horseId, trifecta.data?.evaluation.id]);

  const dirty = notes !== (evaluation?.notes ?? "") || TRIFECTA_ITEMS.some(item => {
    const stored = evaluation?.scores.find(score => score.item_code === item.code && score.axis === item.axis);
    return drafts[item.code]?.score !== stored?.score || (drafts[item.code]?.comment ?? "") !== (stored?.comment ?? "");
  });
  const {dialog: unsavedDialog} = useUnsavedChanges(dirty && !saving && savedAt === null);

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
    if (trifecta.error || trifecta.data === undefined) { setError("The saved evaluation could not be loaded. Retry before saving."); return; }
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
      const message = (e as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (trifecta.error) return <ErrorState error={trifecta.error} onRetry={trifecta.refresh} />;
  if (trifecta.data === undefined) return <SkeletonCard lines={4} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {unsavedDialog}
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Score only the items you have evaluated. New scores start blank; saved scores remain available to review. Ride averages do not fill this evaluation.
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
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
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
                            [item.code]: { ...d[item.code], score: s as TqaScore },
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
                      aria-label={`Comment for ${item.text}`}
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
