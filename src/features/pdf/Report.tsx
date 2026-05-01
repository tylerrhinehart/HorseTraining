import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Svg,
  Line,
  Circle,
  Path,
  G,
} from "@react-pdf/renderer";
import type { Evaluation, Horse, Question } from "../../db/schema";
import {
  endDate,
  formatHumanDate,
  trainingDayNumber,
} from "../../utils/dates";
import {
  dailyAverages,
  overallTrend,
  questionAverages,
  round1,
} from "../../utils/stats";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.5,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  h2: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1px solid #cbd5e1",
  },
  h3: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
  },
  muted: {
    color: "#64748b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    width: "31%",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: 8,
  },
  metaLabel: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
  },
  table: {
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: 4,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottom: "0.5px solid #e2e8f0",
  },
  cellGrow: { flex: 1 },
  cellNum: { width: 60, textAlign: "right" },
  comment: {
    marginTop: 2,
    fontSize: 10,
    color: "#334155",
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 9,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

interface ReportProps {
  horse: Horse;
  evaluations: Evaluation[];
  questions: Question[];
  generatedAt: string;
}

export function HorseReport({
  horse,
  evaluations,
  questions,
  generatedAt,
}: ReportProps) {
  const sortedEvals = [...evaluations].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const dailyAvg = dailyAverages(horse.startDate, sortedEvals);
  const trend = overallTrend(dailyAvg);
  const qAverages = questionAverages(questions, sortedEvals);
  const allScores = sortedEvals.flatMap((e) =>
    Object.values(e.ratings).map((r) => r.score),
  );
  const overall =
    allScores.length === 0
      ? null
      : allScores.reduce((s, n) => s + n, 0) / allScores.length;
  const trainingEnd = endDate(horse.startDate, horse.durationDays);

  return (
    <Document
      title={`${horse.name} — Training Report`}
      author="Horse Training Tracker"
    >
      <Page size="LETTER" style={styles.page}>
        <View>
          <Text style={styles.h1}>{horse.name}</Text>
          <Text style={styles.muted}>
            Training program report
            {horse.breed ? ` · ${horse.breed}` : ""}
          </Text>
          <Text style={styles.muted}>
            {formatHumanDate(horse.startDate)} →{" "}
            {formatHumanDate(trainingEnd)} ({horse.durationDays} days)
          </Text>
          {horse.ownerName && (
            <Text style={styles.muted}>
              Owner: {horse.ownerName}
              {horse.ownerEmail ? ` (${horse.ownerEmail})` : ""}
            </Text>
          )}
        </View>

        <Text style={styles.h2}>Summary</Text>
        <View style={styles.metaGrid}>
          <Meta
            label="Days completed"
            value={`${sortedEvals.length} / ${horse.durationDays}`}
          />
          <Meta label="Overall average" value={round1(overall)} />
          <Meta
            label="Trend"
            value={
              trend.direction === "n/a"
                ? "—"
                : `${
                    trend.direction === "up"
                      ? "Up"
                      : trend.direction === "down"
                        ? "Down"
                        : "Flat"
                  } ${trend.delta === null ? "" : trend.delta.toFixed(2)}`
            }
          />
        </View>

        {horse.notes && (
          <>
            <Text style={styles.h3}>Trainer notes</Text>
            <Text>{horse.notes}</Text>
          </>
        )}

        <Text style={styles.h2}>Overall progress</Text>
        <PdfLineChart
          data={dailyAvg.map((d) => ({ day: d.day, value: d.average }))}
          durationDays={horse.durationDays}
        />

        <Text style={styles.h2}>Question averages</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellGrow}>Criterion</Text>
            <Text style={styles.cellNum}>Entries</Text>
            <Text style={styles.cellNum}>Average</Text>
          </View>
          {qAverages.map((q) => (
            <View key={q.questionId} style={styles.tableRow}>
              <Text style={styles.cellGrow}>{q.text}</Text>
              <Text style={styles.cellNum}>{q.count}</Text>
              <Text style={styles.cellNum}>{round1(q.average)}</Text>
            </View>
          ))}
        </View>

        <Footer generatedAt={generatedAt} />
      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.h2}>Daily breakdown</Text>
        {sortedEvals.length === 0 ? (
          <Text style={styles.muted}>No evaluations recorded.</Text>
        ) : (
          sortedEvals.map((ev) => {
            const day = trainingDayNumber(horse.startDate, ev.date);
            const scores = Object.values(ev.ratings).map((r) => r.score);
            const avg =
              scores.length === 0
                ? null
                : scores.reduce((s, n) => s + n, 0) / scores.length;
            return (
              <View
                key={ev.id}
                wrap={false}
                style={{
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: "0.5px solid #e2e8f0",
                }}
              >
                <View style={styles.row}>
                  <Text style={styles.h3}>
                    Day {day} · {formatHumanDate(ev.date)}
                  </Text>
                  <Text style={styles.h3}>Avg {round1(avg)}</Text>
                </View>
                {Object.entries(ev.ratings).map(([qid, r]) => (
                  <View key={qid} style={{ marginTop: 2 }}>
                    <View style={styles.row}>
                      <Text style={styles.cellGrow}>
                        {r.questionTextSnapshot ||
                          questions.find((q) => q.id === qid)?.text ||
                          "(question)"}
                      </Text>
                      <Text style={{ fontWeight: 700 }}>{r.score}/5</Text>
                    </View>
                    {r.comment && (
                      <Text style={styles.comment}>“{r.comment}”</Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })
        )}
        <Footer generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Horse Training Tracker</Text>
      <Text>Generated {formatHumanDate(generatedAt.slice(0, 10))}</Text>
    </View>
  );
}

interface ChartProps {
  data: { day: number; value: number | null }[];
  durationDays: number;
}

function PdfLineChart({ data, durationDays }: ChartProps) {
  const width = 540;
  const height = 200;
  const padL = 36;
  const padR = 12;
  const padT = 8;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yMin = 1;
  const yMax = 5;
  const days = Math.max(durationDays, 1);

  const xFor = (day: number) =>
    padL + ((day - 1) / Math.max(days - 1, 1)) * innerW;
  const yFor = (value: number) =>
    padT + innerH - ((value - yMin) / (yMax - yMin)) * innerH;

  // Build path connecting non-null points.
  const segments: { d: string; points: { x: number; y: number }[] }[] = [];
  let current: { x: number; y: number }[] = [];
  for (let day = 1; day <= days; day++) {
    const point = data.find((d) => d.day === day);
    if (point && point.value !== null) {
      current.push({ x: xFor(day), y: yFor(point.value) });
    } else if (current.length > 0) {
      segments.push({
        d: current
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
          .join(" "),
        points: current,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push({
      d: current
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
        .join(" "),
      points: current,
    });
  }

  // X-axis ticks: show every ~5 days plus first and last.
  const tickStep = days <= 10 ? 1 : days <= 30 ? 5 : 10;
  const xTicks: number[] = [];
  for (let d = 1; d <= days; d += tickStep) xTicks.push(d);
  if (xTicks[xTicks.length - 1] !== days) xTicks.push(days);

  return (
    <Svg width={width} height={height}>
      <G>
        {[1, 2, 3, 4, 5].map((y) => (
          <G key={y}>
            <Line
              x1={padL}
              y1={yFor(y)}
              x2={padL + innerW}
              y2={yFor(y)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
            <Path
              d={`M${padL - 4},${yFor(y)} L${padL},${yFor(y)}`}
              stroke="#94a3b8"
              strokeWidth={0.5}
            />
          </G>
        ))}
        {xTicks.map((d) => (
          <Path
            key={d}
            d={`M${xFor(d)},${padT + innerH} L${xFor(d)},${padT + innerH + 4}`}
            stroke="#94a3b8"
            strokeWidth={0.5}
          />
        ))}
        <Line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {segments.map((seg, i) => (
          <Path
            key={i}
            d={seg.d}
            stroke="#7c3aed"
            strokeWidth={1.5}
            fill="none"
          />
        ))}
        {segments
          .flatMap((seg) => seg.points)
          .map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2} fill="#7c3aed" />
          ))}
      </G>
    </Svg>
  );
}
