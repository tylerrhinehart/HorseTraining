interface Props {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  dotLast?: boolean;
  baseline?: boolean;
  /** Inclusive min for the y axis. Defaults to the TQA scale. */
  min?: number;
  /** Inclusive max for the y axis. Defaults to the TQA scale. */
  max?: number;
  /** Y-value to draw the dashed reference line at. Defaults to 0. */
  baselineAt?: number;
  className?: string;
}

export default function Sparkline({
  values,
  width = 120,
  height = 32,
  stroke = "currentColor",
  fill = "none",
  dotLast = true,
  baseline = true,
  min = -3,
  max = 3,
  baselineAt = 0,
  className,
}: Props) {
  if (!values || values.length === 0) return null;
  const pad = 2;
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  const yFor = (v: number) =>
    pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
  const pts = values
    .map((v, i) => `${pad + i * stepX},${yFor(v)}`)
    .join(" ");
  const last = values[values.length - 1];
  const baseY = yFor(baselineAt);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: "block" }}
    >
      {baseline && (
        <line
          x1={pad}
          y1={baseY}
          x2={width - pad}
          y2={baseY}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeDasharray="2 3"
        />
      )}
      <polyline
        points={pts}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dotLast && (
        <circle
          cx={pad + (values.length - 1) * stepX}
          cy={yFor(last)}
          r="2.5"
          fill={stroke}
        />
      )}
    </svg>
  );
}
