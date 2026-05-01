import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Question, TQAWithRatings } from "../supabase/types";

interface Props {
  questions: Question[];
  tqas: TQAWithRatings[];
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

export default function QuestionTrendChart({ questions, tqas }: Props) {
  const ordered = [...tqas].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );

  const data = ordered.map((t, i) => {
    const row: Record<string, number | null | string> = {
      index: i + 1,
      occurredAt: t.occurred_at,
    };
    for (const q of questions) {
      const r = (t.ratings ?? []).find((rr) => rr.question_id === q.id);
      row[q.id] = r?.score ?? null;
    }
    return row;
  });

  return (
    <div className="h-80">
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
              fontSize: 12,
            }}
            labelFormatter={(v) => `TQA #${v}`}
            formatter={(v, name) => {
              const q = questions.find((qq) => qq.id === name);
              const display = v === null || typeof v !== "number" ? "—" : v;
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
