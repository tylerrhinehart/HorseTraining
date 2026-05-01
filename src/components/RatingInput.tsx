interface Props {
  value: number | null;
  onChange: (value: number) => void;
  name: string;
  label?: string;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export default function RatingInput({ value, onChange, name, label }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={label ?? name}
      className="inline-flex gap-1"
    >
      {SCORES.map((score) => {
        const selected = value === score;
        return (
          <label
            key={score}
            className={[
              "h-9 w-9 rounded-lg border flex items-center justify-center cursor-pointer text-sm font-medium transition-colors",
              selected
                ? "bg-brand-600 border-brand-600 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500",
            ].join(" ")}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={score}
              checked={selected}
              onChange={() => onChange(score)}
            />
            {score}
          </label>
        );
      })}
    </div>
  );
}
