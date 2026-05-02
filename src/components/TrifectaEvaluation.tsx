import { useEffect, useMemo, useState } from "react";
import RatingInput from "./RatingInput";
import {
  TRIFECTA_AXIS_LABELS,
  TRIFECTA_ITEMS,
  type TrifectaItem,
} from "../content/trifecta";
import {
  upsertTrifectaEvaluation,
  type TrifectaScoreInput,
} from "../supabase/queries";
import type {
  SessionWithRatings,
  TqaScore,
  TrifectaEvaluationWithScores,
} from "../supabase/types";

interface Props {
  engagementId: string;
  evaluation: TrifectaEvaluationWithScores | null;
  sessions: SessionWithRatings[];
  onSaved: () => void;
}

interface DraftScore {
  score?: TqaScore;
  comment?: string;
}

/** Map per-session ratings into suggested Trifecta score defaults. */
function suggestionFromSessions(
  sessions: SessionWithRatings[],
): Record<string, TqaScore | undefined> {
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

export default function TrifectaEvaluation({
  engagementId,
  evaluation,
  sessions,
  onSaved,
}: Props) {
  const suggestion = useMemo(() => suggestionFromSessions(sessions), [sessions]);
  const [drafts, setDrafts] = useState<Record<string, DraftScore>>({});
  const [notes, setNotes] = useState(evaluation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [evaluation?.id, suggestion]);

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
        engagementId,
        notes,
        scores,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        End-of-engagement evaluation per the TQA Training Trifecta. Initial
        suggestions come from this engagement's session ratings — adjust as
        needed before sharing with the owner.
      </p>
      {(["foundation", "task_completion", "temperament"] as const).map(
        (axis) => (
          <section key={axis} className="card space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {TRIFECTA_AXIS_LABELS[axis]}
            </h3>
            <div className="space-y-2">
              {grouped[axis].map((item, i) => {
                const draft = drafts[item.code] ?? {};
                return (
                  <div
                    key={item.code}
                    className="border border-slate-800 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="flex-1 text-sm font-medium leading-snug">
                        <span className="text-slate-500 mr-2">{i + 1}.</span>
                        {item.text}
                        {item.detail && (
                          <p className="text-xs italic text-slate-400 mt-1">
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
                      className="input text-xs"
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
      <div className="card space-y-2">
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : evaluation ? "Update evaluation" : "Save evaluation"}
        </button>
      </div>
    </div>
  );
}
