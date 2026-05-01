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
import type {
  Horse,
  Phase,
  Question,
  TQAWithRatings,
} from "../../supabase/types";
import { formatDateTime, formatHumanDate } from "../../utils/dates";
import {
  overallTrend,
  questionAverages,
  round1,
  tqaAverage,
  tqaAverages,
} from "../../utils/stats";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.5,
  },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  h2: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1px solid #cbd5e1",
  },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  muted: { color: "#64748b" },
  row: { flexDirection: "row", justifyContent: "space-between" },
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
  metaLabel: { fontSize: 9, color: "#64748b", textTransform: "uppercase" },
  metaValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  table: { marginTop: 6 },
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
  phaseHeader: {
    backgroundColor: "#f1f5f9",
    padding: 6,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: 700,
  },
});

interface ReportProps {
  horse: Horse;
  tqas: TQAWithRatings[];
  questions: Question[];
  phases: Phase[];
  generatedAt: string;
}

export function HorseReport({
  horse,
  tqas,
  questions,
  phases,
  generatedAt,
}: ReportProps) {
  const sorted = [...tqas].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );
  const points = tqaAverages(sorted);
  const trend = overallTrend(points);
  const allScores = sorted.flatMap((t) =>
    (t.ratings ?? []).map((r) => r.score),
  );
  const overall =
    allScores.length === 0
      ? null
      : allScores.reduce((s, n) => s + n, 0) / allScores.length;
  const currentPhase = phases.find((p) => p.id === horse.current_phase_id);

  const tqasByPhase = new Map<string, TQAWithRatings[]>();
  for (const t of sorted) {
    if (!tqasByPhase.has(t.phase_id)) tqasByPhase.set(t.phase_id, []);
    tqasByPhase.get(t.phase_id)!.push(t);
  }

  return (
    <Document
      title={`${horse.name} — TQA Report`}
      author="TQA Tracker"
    >
      <Page size="LETTER" style={styles.page}>
        <View>
          <Text style={styles.h1}>{horse.name}</Text>
          <Text style={styles.muted}>
            Training Quality Assessment Report
            {horse.breed ? ` · ${horse.breed}` : ""}
          </Text>
          <Text style={styles.muted}>
            {horse.start_date
              ? `Started ${formatHumanDate(horse.start_date)} · `
              : ""}
            Current phase: {currentPhase?.name ?? "—"}
          </Text>
          {horse.owner_name && (
            <Text style={styles.muted}>
              Owner: {horse.owner_name}
              {horse.owner_email ? ` (${horse.owner_email})` : ""}
            </Text>
          )}
        </View>

        <Text style={styles.h2}>Summary</Text>
        <View style={styles.metaGrid}>
          <Meta label="TQAs recorded" value={String(sorted.length)} />
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
                  } ${trend.delta?.toFixed(2) ?? ""}`
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
          data={points.map((p, i) => ({ index: i + 1, value: p.average }))}
        />

        <Text style={styles.h2}>By phase</Text>
        {phases.map((phase) => {
          const phaseTqas = tqasByPhase.get(phase.id) ?? [];
          if (phaseTqas.length === 0) return null;
          const phaseScores = phaseTqas.flatMap((t) =>
            (t.ratings ?? []).map((r) => r.score),
          );
          const phaseAvg =
            phaseScores.length === 0
              ? null
              : phaseScores.reduce((s, n) => s + n, 0) / phaseScores.length;
          const phaseQuestionIds = new Set(
            phaseTqas.flatMap((t) =>
              (t.ratings ?? []).map((r) => r.question_id),
            ),
          );
          const phaseQuestions = questions
            .filter((q) => phaseQuestionIds.has(q.id))
            .sort((a, b) => a.position - b.position);
          const qAverages = questionAverages(phaseQuestions, phaseTqas);
          return (
            <View key={phase.id} wrap={false}>
              <Text style={styles.phaseHeader}>
                {phase.name} — {phaseTqas.length} TQA
                {phaseTqas.length === 1 ? "" : "s"} · Avg{" "}
                {round1(phaseAvg)}
              </Text>
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
            </View>
          );
        })}

        <Footer generatedAt={generatedAt} />
      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.h2}>TQA breakdown</Text>
        {sorted.length === 0 ? (
          <Text style={styles.muted}>No TQAs recorded.</Text>
        ) : (
          sorted.map((t) => {
            const avg = tqaAverage(t.ratings);
            const phase = phases.find((p) => p.id === t.phase_id);
            return (
              <View
                key={t.id}
                wrap={false}
                style={{
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: "0.5px solid #e2e8f0",
                }}
              >
                <View style={styles.row}>
                  <Text style={styles.h3}>
                    {phase?.name ?? "—"} ·{" "}
                    {formatDateTime(t.occurred_at)}
                  </Text>
                  <Text style={styles.h3}>Avg {round1(avg)}</Text>
                </View>
                {(t.ratings ?? []).map((r) => (
                  <View key={r.id} style={{ marginTop: 2 }}>
                    <View style={styles.row}>
                      <Text style={styles.cellGrow}>
                        {r.question_text_snapshot}
                      </Text>
                      <Text style={{ fontWeight: 700 }}>
                        {r.score}/5
                      </Text>
                    </View>
                    {r.comment && (
                      <Text style={styles.comment}>"{r.comment}"</Text>
                    )}
                  </View>
                ))}
                {t.notes && (
                  <Text style={[styles.comment, { marginTop: 4 }]}>
                    Notes: {t.notes}
                  </Text>
                )}
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
      <Text>TQA Tracker</Text>
      <Text>Generated {formatHumanDate(generatedAt.slice(0, 10))}</Text>
    </View>
  );
}

interface ChartProps {
  data: { index: number; value: number | null }[];
}

function PdfLineChart({ data }: ChartProps) {
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
  const n = Math.max(data.length, 1);

  const xFor = (idx: number) =>
    padL + ((idx - 1) / Math.max(n - 1, 1)) * innerW;
  const yFor = (value: number) =>
    padT + innerH - ((value - yMin) / (yMax - yMin)) * innerH;

  const segments: { d: string; points: { x: number; y: number }[] }[] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of data) {
    if (point.value !== null) {
      current.push({ x: xFor(point.index), y: yFor(point.value) });
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
