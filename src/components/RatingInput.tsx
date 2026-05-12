import { TQA_SCORES, type TqaScore } from "../supabase/types";

interface Props {
  value: TqaScore | null;
  onChange: (value: TqaScore) => void;
  name: string;
  label?: string;
  lowLabel?: string;
  highLabel?: string;
  density?: "compact" | "default" | "cozy";
  /** kept for back-compat with `size` callers */
  size?: "sm" | "md";
}

function tone(score: number): "neg" | "neutral" | "pos" {
  if (score < 0) return "neg";
  if (score === 0) return "neutral";
  return "pos";
}

function magnitude(score: number): 1 | 2 | 3 {
  const a = Math.abs(score);
  if (a >= 3) return 3;
  if (a === 2) return 2;
  return 1;
}

function formatScore(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

export default function RatingInput({
  value,
  onChange,
  name,
  label,
  lowLabel,
  highLabel,
  density,
  size,
}: Props) {
  const resolvedDensity =
    density ?? (size === "sm" ? "compact" : "default");
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
        aria-label={label ?? name ?? "Rate -3 to +3"}
        className={`rating rating--dots ${resolvedDensity}`}
        style={{ justifyContent: "space-between" }}
      >
        {TQA_SCORES.map((score) => {
          const selected = value === score;
          const t = tone(score);
          const mag = magnitude(score);
          return (
            <button
              key={score}
              type="button"
              className={[
                "dot",
                `dot--${t}`,
                `mag-${mag}`,
                selected ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(score)}
              aria-pressed={selected}
              aria-label={`Rate ${formatScore(score)}`}
            >
              {formatScore(score)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { tone as scoreTone, formatScore };
