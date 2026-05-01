import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyAverage } from "../utils/stats";

interface Props {
  data: DailyAverage[];
  durationDays: number;
}

export default function ProgressChart({ data, durationDays }: Props) {
  const padded = Array.from({ length: durationDays }, (_, i) => {
    const day = i + 1;
    const found = data.find((d) => d.day === day);
    return {
      day,
      average: found?.average ?? null,
    };
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={padded}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="day"
            stroke="#94a3b8"
            tickFormatter={(v) => `D${v}`}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            stroke="#94a3b8"
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
            formatter={(v) =>
              v === null || typeof v !== "number" ? "—" : v.toFixed(2)
            }
            labelFormatter={(v) => `Day ${v}`}
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
