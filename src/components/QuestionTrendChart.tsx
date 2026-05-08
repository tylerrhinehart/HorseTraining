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
import type { Question, SessionWithRatings } from "../supabase/types";

interface Props {
  questions: Question[];
  sessions: SessionWithRatings[];
}

const PALETTE = [
  "#8a4f2b", // leather
  "#6c7d52", // sage
  "#b25a3a", // rust
  "#b88a3a", // gold
  "#4e6e3c", // ok
  "#a84132", // bad
  "#6b3a1d", // leather-2
  "#7a6a52", // muted
  "#4a3d2c", // ink-2
  "#2a2118", // ink
];

const GRID = "#c4b698";
const AXIS = "#7a6a52";
const REFERENCE = "#b88a3a";

export default function QuestionTrendChart({ questions, sessions }: Props) {
  const ordered = [...sessions].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );

  const data = ordered.map((s, i) => {
    const row: Record<string, number | null | string> = {
      index: i + 1,
      occurredAt: s.occurred_at,
    };
    for (const q of questions) {
      const r = (s.ratings ?? []).find((rr) => rr.question_id === q.id);
      row[q.id] = r?.score ?? null;
    }
    return row;
  });

  return (
    <div style={{ height: 320 }}>
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
            labelFormatter={(v) => `Session #${v}`}
            formatter={(v, name) => {
              const q = questions.find((qq) => qq.id === name);
              const display = v === null || typeof v !== "number" ? "—" : v;
              return [display, q?.text ?? String(name)];
            }}
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }}
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
