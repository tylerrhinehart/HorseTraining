import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { Evaluation, Question } from "../db/schema";
import { trainingDayNumber } from "../utils/dates";

interface Props {
  questions: Question[];
  evaluations: Evaluation[];
  startDate: string;
  durationDays: number;
}

const PALETTE = [
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#fbbf24",
  "#f87171",
  "#22d3ee",
  "#c084fc",
  "#4ade80",
  "#fb923c",
];

export default function QuestionTrendChart({
  questions,
  evaluations,
  startDate,
  durationDays,
}: Props) {
  const data = Array.from({ length: durationDays }, (_, i) => {
    const day = i + 1;
    const row: Record<string, number | null | string> = { day };
    for (const q of questions) {
      const ev = evaluations.find(
        (e) => trainingDayNumber(startDate, e.date) === day,
      );
      row[q.id] = ev?.ratings[q.id]?.score ?? null;
    }
    return row;
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
              fontSize: 12,
            }}
            labelFormatter={(v) => `Day ${v}`}
            formatter={(v, name) => {
              const q = questions.find((qq) => qq.id === name);
              const display =
                v === null || typeof v !== "number" ? "—" : v;
              return [display, q?.text ?? String(name)];
            }}
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
            formatter={(value) =>
              questions.find((q) => q.id === value)?.text ?? String(value)
            }
          />
          {questions.map((q, idx) => (
            <Line
              key={q.id}
              type="monotone"
              dataKey={q.id}
              stroke={PALETTE[idx % PALETTE.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
