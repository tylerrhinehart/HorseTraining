import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SessionPoint } from "../utils/stats";

interface Props {
  points: SessionPoint[];
}

const FOUNDATION_COLOR = "#8a4f2b";
const TEMPERAMENT_COLOR = "#6c7d52";
const GRID = "#c4b698";
const AXIS = "#7a6a52";
const REFERENCE = "#b88a3a";

export default function ProgressChart({ points }: Props) {
  const data = points.map((p, i) => ({
    index: i + 1,
    foundation: p.foundationAverage,
    temperament: p.temperamentAverage,
    occurredAt: p.occurredAt,
  }));

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis
            dataKey="index"
            stroke={AXIS}
            tickFormatter={(v) => `#${v}`}
          />
          <YAxis
            domain={[-3, 3]}
            ticks={[-3, -2, -1, 0, 1, 2, 3]}
            stroke={AXIS}
          />
          <ReferenceLine y={0} stroke={REFERENCE} strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--ink)",
              fontSize: 12,
            }}
            formatter={(v) =>
              v === null || typeof v !== "number" ? "—" : v.toFixed(2)
            }
            labelFormatter={(v) => `Session #${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
          <Line
            name="Foundation"
            type="monotone"
            dataKey="foundation"
            stroke={FOUNDATION_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            name="Temperament"
            type="monotone"
            dataKey="temperament"
            stroke={TEMPERAMENT_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
