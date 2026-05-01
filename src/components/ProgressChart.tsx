import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TQAPoint } from "../utils/stats";

interface Props {
  points: TQAPoint[];
}

export default function ProgressChart({ points }: Props) {
  const data = points.map((p, i) => ({
    index: i + 1,
    average: p.average,
    occurredAt: p.occurredAt,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="index"
            stroke="#94a3b8"
            tickFormatter={(v) => `#${v}`}
          />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
            formatter={(v) =>
              v === null || typeof v !== "number" ? "—" : v.toFixed(2)
            }
            labelFormatter={(v) => `TQA #${v}`}
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
