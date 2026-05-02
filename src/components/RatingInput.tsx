import { TQA_SCORES, type TqaScore } from "../supabase/types";

interface Props {
  value: TqaScore | null;
  onChange: (value: TqaScore) => void;
  name: string;
  label?: string;
  lowLabel?: string;
  highLabel?: string;
  size?: "sm" | "md";
}

const colorFor = (score: TqaScore, selected: boolean): string => {
  if (!selected) {
    return "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500";
  }
  if (score < 0) return "bg-red-600 border-red-600 text-white";
  if (score === 0) return "bg-slate-500 border-slate-500 text-white";
  return "bg-emerald-600 border-emerald-600 text-white";
};

export default function RatingInput({
  value,
  onChange,
  name,
  label,
  lowLabel,
  highLabel,
  size = "md",
}: Props) {
  const cell =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : "h-9 w-9 text-sm";
  return (
    <div className="inline-flex flex-col gap-1">
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
          <span>{lowLabel ?? ""}</span>
          <span>{highLabel ?? ""}</span>
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={label ?? name}
        className="inline-flex gap-1"
      >
        {TQA_SCORES.map((score) => {
          const selected = value === score;
          return (
            <label
              key={score}
              className={[
                cell,
                "rounded-lg border flex items-center justify-center cursor-pointer font-medium transition-colors",
                colorFor(score, selected),
              ].join(" ")}
              title={`Score ${score > 0 ? `+${score}` : score}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={score}
                checked={selected}
                onChange={() => onChange(score)}
              />
              {score > 0 ? `+${score}` : score}
            </label>
          );
        })}
      </div>
    </div>
  );
}
