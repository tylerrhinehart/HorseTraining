import type { RatingScaleKind } from "../supabase/types";

// Inline SVG sparkline of session averages. Fixed y-domain per scale so shape
// is comparable across horses (−3…+3 TQA, 1…5 performance).
export default function Sparkline({
  values,
  scale,
  width = 240,
  height = 56,
}: {
  values: number[];
  scale: RatingScaleKind;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const [lo, hi] = scale === "five" ? [1, 5] : [-3, 3];
  const pad = 5;
  const x = (i: number) =>
    pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => {
    const clamped = Math.min(hi, Math.max(lo, v));
    return pad + (1 - (clamped - lo) / (hi - lo)) * (height - pad * 2);
  };
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values[values.length - 1];
  // Reference line: the "good" threshold (+2.0 TQA standard, 4.0 performance).
  const ref = scale === "five" ? 4 : 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", maxWidth: width }}
      role="img"
      aria-label={`Score trend across ${values.length} sessions, latest ${last.toFixed(1)}`}
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={y(ref)}
        y2={y(ref)}
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--leather)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(last)}
        r="3.5"
        fill={last >= ref ? "var(--ok)" : "var(--leather)"}
        stroke="var(--paper-2)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
