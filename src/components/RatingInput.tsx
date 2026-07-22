import { TQA_SCORES } from "../supabase/types";
import { FIVE_SCALE_VALUES } from "../content/programs";
import type { RatingScaleKind } from "../supabase/types";

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  name: string;
  label?: string;
  lowLabel?: string;
  highLabel?: string;
  /** "tqa" = −3…+3 (default), "five" = 1…5 (performance score sheets). */
  scale?: RatingScaleKind;
  density?: "compact" | "default" | "cozy";
  /** kept for back-compat with `size` callers */
  size?: "sm" | "md";
}

// On the −3…+3 scale the midpoint is 0; on the 1…5 scale it is 3.
function tone(score: number, scale: RatingScaleKind): "neg" | "neutral" | "pos" {
  const mid = scale === "five" ? 3 : 0;
  if (score < mid) return "neg";
  if (score === mid) return "neutral";
  return "pos";
}

function formatScore(score: number, scale: RatingScaleKind): string {
  if (scale === "five") return String(score);
  return score > 0 ? `+${score}` : String(score);
}

export default function RatingInput({
  value,
  onChange,
  name,
  label,
  lowLabel,
  highLabel,
  scale = "tqa",
  density,
  size,
}: Props) {
  const resolvedDensity =
    density ?? (size === "sm" ? "compact" : "default");
  const values: readonly number[] =
    scale === "five" ? FIVE_SCALE_VALUES : TQA_SCORES;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      {(lowLabel || highLabel) && (
        <div
          className="mono muted"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          <span>{lowLabel ?? ""}</span>
          <span>{highLabel ?? ""}</span>
        </div>
      )}
      <div
        role="group"
        aria-label={label ?? name ?? (scale === "five" ? "Rate 1 to 5" : "Rate -3 to +3")}
        className={`rating rating--dots ${resolvedDensity}`}
        style={{ justifyContent: "space-between" }}
      >
        {values.map((score) => {
          const selected = value === score;
          const t = tone(score, scale);
          return (
            <button
              key={score}
              type="button"
              className={[
                "dot",
                `dot--${t}`,
                selected ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(score)}
              aria-pressed={selected}
              aria-label={`Rate ${formatScore(score, scale)}`}
            >
              {formatScore(score, scale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { tone as scoreTone, formatScore };
