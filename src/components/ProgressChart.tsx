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

export default function ProgressChart({ points }: Props) {
  const data = points.map((p, i) => ({
    index: i + 1,
    foundation: p.foundationAverage,
    temperament: p.temperamentAverage,
    occurredAt: p.occurredAt,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="index"
            stroke="#94a3b8"
            tickFormatter={(v) => `#${v}`}
          />
          <YAxis
            domain={[-3, 3]}
            ticks={[-3, -2, -1, 0, 1, 2, 3]}
            stroke="#94a3b8"
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
            formatter={(v) =>
              v === null || typeof v !== "number" ? "—" : v.toFixed(2)
            }
            labelFormatter={(v) => `Session #${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
          <Line
            name="Foundation"
            type="monotone"
            dataKey="foundation"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            name="Temperament"
            type="monotone"
            dataKey="temperament"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
