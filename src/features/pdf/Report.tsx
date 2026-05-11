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
  SessionWithRatings,
  TrifectaEvaluationWithScores,
} from "../../supabase/types";
import { formatDateTime, formatHumanDate } from "../../utils/dates";
import {
  meetsCertificationThreshold,
  questionAverages,
  round1,
  sessionAverage,
  sessionAverages,
  trend,
} from "../../utils/stats";
import {
  TRIFECTA_AXIS_LABELS,
  TRIFECTA_ITEMS,
  type TrifectaAxis,
} from "../../content/trifecta";
import { SCORE_LEGEND } from "../../content/tqa-template";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.4,
  },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  h2: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1px solid #cbd5e1",
  },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 6, marginBottom: 4 },
  muted: { color: "#64748b", fontSize: 10 },
  row: { flexDirection: "row" },
  col: { flexDirection: "column" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  metaItem: {
    width: "31%",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    padding: 6,
  },
  metaLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
  metaValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  scoreLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 9,
    color: "#475569",
    marginBottom: 8,
  },
  legendChip: {
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    padding: "2 4",
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  colHalf: { flex: 1 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    borderBottom: "0.5px solid #e2e8f0",
  },
  itemNum: { width: 14, color: "#94a3b8" },
  itemText: { flex: 1, fontSize: 9 },
  itemPolars: { width: 70, fontSize: 8, color: "#64748b" },
  itemScore: { width: 28, textAlign: "right", fontWeight: 700 },
  comment: {
    marginTop: 1,
    marginLeft: 14,
    fontSize: 8,
    color: "#475569",
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
  // Training log layout — table-like with day cells.
  logHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 4,
    fontWeight: 700,
    fontSize: 9,
  },
  logRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #cbd5e1",
    padding: 3,
    fontSize: 9,
  },
  weekBlock: {
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    marginTop: 8,
    padding: 6,
  },
});

// =============================================================================
// Horse Report PDF — main report.
// =============================================================================

interface HorseReportProps {
  horse: Horse;
  sessions: SessionWithRatings[];
  phases: Phase[];
  questions: Question[];
  trifecta: TrifectaEvaluationWithScores | null;
  generatedAt: string;
}

export function HorseReport({
  horse,
  sessions,
  phases,
  questions,
  trifecta,
  generatedAt,
}: HorseReportProps) {
  const sorted = [...sessions].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );
  const points = sessionAverages(sorted);
  const fTrend = trend(points, "foundation");
  const tTrend = trend(points, "temperament");
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const certified = latest && meetsCertificationThreshold(latest);

  const phaseFor = (id: string) => phases.find((p) => p.id === id)?.name ?? "—";

  const referencedQuestionIds = new Set<string>();
  for (const s of sorted) {
    for (const r of s.ratings ?? []) referencedQuestionIds.add(r.question_id);
  }
  const referencedQuestions = questions
    .filter((q) => referencedQuestionIds.has(q.id))
    .sort((a, b) => a.position - b.position);

  return (
    <Document title={`${horse.name} — TQA Report`} author="TQA Tracker">
      {/* ----- Page 1: Horse summary ----- */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>{horse.name}</Text>
        <Text style={styles.muted}>
          Training Quality Assurance Report — {horse.name}
          {horse.breed ? ` · ${horse.breed}` : ""}
        </Text>
        <Text style={styles.muted}>
          {horse.owner_name ? `Owner: ${horse.owner_name}` : ""}
          {horse.owner_contact ? ` (${horse.owner_contact})` : ""}
        </Text>
        <Text style={styles.muted}>
          {horse.arrival_date
            ? `Arrived ${formatHumanDate(horse.arrival_date)}`
            : "No arrival date"}
        </Text>

        <ScoreLegendBlock />

        <Text style={styles.h2}>Summary</Text>
        <View style={styles.metaGrid}>
          <Meta label="Sessions" value={String(sorted.length)} />
          <Meta
            label="Foundation trend"
            value={
              fTrend.direction === "n/a"
                ? "—"
                : `${arrowFor(fTrend.direction)} ${fTrend.delta?.toFixed(2) ?? ""}`
            }
          />
          <Meta
            label="Temperament trend"
            value={
              tTrend.direction === "n/a"
                ? "—"
                : `${arrowFor(tTrend.direction)} ${tTrend.delta?.toFixed(2) ?? ""}`
            }
          />
          <Meta
            label="Latest Foundation"
            value={round1(latest?.foundationAverage ?? null)}
          />
          <Meta
            label="Latest Temperament"
            value={round1(latest?.temperamentAverage ?? null)}
          />
          <Meta
            label="Cert threshold"
            value={certified ? "Met (≥ +2.7 both axes)" : "Not met"}
          />
        </View>

        <Text style={styles.h2}>Per-axis progress</Text>
        <DualLineChart
          data={points.map((p, i) => ({
            index: i + 1,
            foundation: p.foundationAverage,
            temperament: p.temperamentAverage,
          }))}
        />

        <Text style={styles.h2}>Question averages</Text>
        {referencedQuestions.length === 0 ? (
          <Text style={styles.muted}>No sessions recorded.</Text>
        ) : (
          <QuestionAveragesTable
            questions={referencedQuestions}
            sessions={sorted}
            phaseFor={phaseFor}
          />
        )}

        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ----- Page 2: Training log (grouped by phase) ----- */}
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.h1}>Training Log</Text>
        <Text style={styles.muted}>
          {horse.name}
          {horse.owner_name ? ` · Owner: ${horse.owner_name}` : ""}
        </Text>
        {phases.length === 0 ? (
          <Text style={styles.muted}>No phases defined.</Text>
        ) : (
          [...phases]
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((phase) => {
              const phaseSessions = sorted
                .filter((s) => s.phase_id === phase.id)
                .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
              return (
                <View key={phase.id} style={styles.weekBlock} wrap={false}>
                  <Text style={styles.h3}>{phase.name}</Text>
                  <View style={styles.logHeader}>
                    <Text style={{ width: 18 }}>#</Text>
                    <Text style={{ width: 70 }}>Date</Text>
                    <Text style={{ width: 160 }}>Phase</Text>
                    <Text style={{ width: 60, textAlign: "right" }}>Foundation</Text>
                    <Text style={{ width: 70, textAlign: "right" }}>
                      Temperament
                    </Text>
                  </View>
                  {phaseSessions.length === 0 ? (
                    <Text style={[styles.muted, { padding: 4 }]}>
                      (no sessions)
                    </Text>
                  ) : (
                    phaseSessions.map((s, i) => {
                      const f = sessionAverage(s.ratings, "foundation");
                      const t = sessionAverage(s.ratings, "temperament");
                      return (
                        <View key={s.id} style={styles.logRow}>
                          <Text style={{ width: 18 }}>{i + 1}</Text>
                          <Text style={{ width: 70 }}>
                            {formatHumanDate(s.occurred_at)}
                          </Text>
                          <Text style={{ width: 160 }}>{phaseFor(s.phase_id)}</Text>
                          <Text style={{ width: 60, textAlign: "right" }}>
                            {round1(f)}
                          </Text>
                          <Text style={{ width: 70, textAlign: "right" }}>
                            {round1(t)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })
        )}
        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ----- Page 3: Per-session score sheets ----- */}
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.h1}>Session Score Sheets</Text>
        {sorted.length === 0 ? (
          <Text style={styles.muted}>No sessions recorded.</Text>
        ) : (
          sorted.map((s) => (
            <SessionScoreSheetBlock
              key={s.id}
              session={s}
              questions={questions}
              phaseFor={phaseFor}
            />
          ))
        )}
        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ----- Page 4: Training Trifecta evaluation ----- */}
      {trifecta && (
        <Page size="LETTER" style={styles.page} wrap>
          <Text style={styles.h1}>Training Trifecta Evaluation</Text>
          <Text style={styles.muted}>
            Trifecta evaluation — final evaluation per the TQA Training Trifecta.
            {" "}
            Evaluated {formatDateTime(trifecta.evaluated_at)}
          </Text>
          {(["foundation", "task_completion", "temperament"] as TrifectaAxis[]).map(
            (axis) => {
              const items = TRIFECTA_ITEMS.filter((i) => i.axis === axis);
              return (
                <View key={axis} wrap={false}>
                  <Text style={styles.h2}>{TRIFECTA_AXIS_LABELS[axis]}</Text>
                  {items.map((item, i) => {
                    const stored = trifecta.scores.find(
                      (s) => s.axis === axis && s.item_code === item.code,
                    );
                    return (
                      <View key={item.code}>
                        <View style={styles.itemRow}>
                          <Text style={styles.itemNum}>{i + 1}.</Text>
                          <Text style={styles.itemText}>{item.text}</Text>
                          <Text style={styles.itemPolars}>
                            {item.low_label
                              ? `${item.low_label} / ${item.high_label}`
                              : ""}
                          </Text>
                          <Text style={styles.itemScore}>
                            {stored ? formatScore(stored.score) : "—"}
                          </Text>
                        </View>
                        {stored?.comment && (
                          <Text style={styles.comment}>"{stored.comment}"</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            },
          )}
          {trifecta.notes && (
            <View>
              <Text style={styles.h3}>Notes</Text>
              <Text>{trifecta.notes}</Text>
            </View>
          )}
          <Footer generatedAt={generatedAt} />
        </Page>
      )}
    </Document>
  );
}

// =============================================================================
// Pieces
// =============================================================================

function arrowFor(dir: "up" | "down" | "flat" | "n/a"): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  if (dir === "flat") return "→";
  return "—";
}

function formatScore(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function ScoreLegendBlock() {
  return (
    <View style={styles.scoreLegend}>
      {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
        <Text key={s} style={styles.legendChip}>
          {formatScore(s)} = {SCORE_LEGEND[s]}
        </Text>
      ))}
    </View>
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

interface SessionScoreSheetBlockProps {
  session: SessionWithRatings;
  questions: Question[];
  phaseFor: (id: string) => string;
}

function SessionScoreSheetBlock({
  session,
  questions,
  phaseFor,
}: SessionScoreSheetBlockProps) {
  const phaseQuestions = questions
    .filter((q) => q.phase_id === session.phase_id)
    .sort((a, b) => a.position - b.position);
  const foundation = phaseQuestions.filter((q) => q.axis === "foundation");
  const temperament = phaseQuestions.filter((q) => q.axis === "temperament");
  const ratingFor = (qid: string) =>
    session.ratings.find((r) => r.question_id === qid);
  const fAvg = sessionAverage(session.ratings, "foundation");
  const tAvg = sessionAverage(session.ratings, "temperament");

  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <Text style={styles.h3}>
        {phaseFor(session.phase_id)} · {formatDateTime(session.occurred_at)}
      </Text>
      <Text style={styles.muted}>
        Foundation {round1(fAvg)} · Temperament {round1(tAvg)}
      </Text>
      <View style={styles.twoCol}>
        <View style={styles.colHalf}>
          <Text style={styles.muted}>Foundation / Task Completion</Text>
          {foundation.map((q, i) => {
            const r = ratingFor(q.id);
            return (
              <View key={q.id}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemNum}>{i + 1}.</Text>
                  <Text style={styles.itemText}>{q.text}</Text>
                  <Text style={styles.itemScore}>
                    {r ? formatScore(r.score) : "—"}
                  </Text>
                </View>
                {r?.comment && (
                  <Text style={styles.comment}>"{r.comment}"</Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.colHalf}>
          <Text style={styles.muted}>Temperament / Driving Factors</Text>
          {temperament.map((q, i) => {
            const r = ratingFor(q.id);
            return (
              <View key={q.id}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemNum}>{i + 1}.</Text>
                  <Text style={styles.itemText}>{q.text}</Text>
                  <Text style={styles.itemPolars}>
                    {q.low_label} / {q.high_label}
                  </Text>
                  <Text style={styles.itemScore}>
                    {r ? formatScore(r.score) : "—"}
                  </Text>
                </View>
                {r?.comment && (
                  <Text style={styles.comment}>"{r.comment}"</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
      {session.notes && (
        <Text style={[styles.comment, { marginLeft: 0 }]}>
          Notes: {session.notes}
        </Text>
      )}
    </View>
  );
}

function QuestionAveragesTable({
  questions,
  sessions,
  phaseFor,
}: {
  questions: Question[];
  sessions: SessionWithRatings[];
  phaseFor: (id: string) => string;
}) {
  const grouped = new Map<string, Question[]>();
  for (const q of questions) {
    const arr = grouped.get(q.phase_id) ?? [];
    arr.push(q);
    grouped.set(q.phase_id, arr);
  }
  return (
    <View>
      {[...grouped.entries()].map(([phaseId, qs]) => {
        const averages = questionAverages(qs, sessions);
        return (
          <View key={phaseId} wrap={false}>
            <Text style={styles.h3}>{phaseFor(phaseId)}</Text>
            {averages.map((q) => (
              <View key={q.questionId} style={styles.itemRow}>
                <Text style={styles.itemText}>{q.text}</Text>
                <Text style={{ width: 70, fontSize: 8, color: "#64748b" }}>
                  {q.axis}
                </Text>
                <Text style={{ width: 40, textAlign: "right", fontSize: 8 }}>
                  {q.count}×
                </Text>
                <Text style={styles.itemScore}>{round1(q.average)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

interface DualChartProps {
  data: { index: number; foundation: number | null; temperament: number | null }[];
}

function DualLineChart({ data }: DualChartProps) {
  const width = 540;
  const height = 200;
  const padL = 36;
  const padR = 12;
  const padT = 8;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yMin = -3;
  const yMax = 3;
  const n = Math.max(data.length, 1);
  const xFor = (idx: number) =>
    padL + ((idx - 1) / Math.max(n - 1, 1)) * innerW;
  const yFor = (value: number) =>
    padT + innerH - ((value - yMin) / (yMax - yMin)) * innerH;

  const seriesPath = (key: "foundation" | "temperament"): string => {
    const segments: string[] = [];
    let current: string[] = [];
    for (const point of data) {
      const v = point[key];
      if (v !== null) {
        current.push(
          `${current.length === 0 ? "M" : "L"}${xFor(point.index)},${yFor(v)}`,
        );
      } else if (current.length > 0) {
        segments.push(current.join(" "));
        current = [];
      }
    }
    if (current.length > 0) segments.push(current.join(" "));
    return segments.join(" ");
  };

  const fPath = seriesPath("foundation");
  const tPath = seriesPath("temperament");

  return (
    <Svg width={width} height={height}>
      <G>
        {[-3, -2, -1, 0, 1, 2, 3].map((y) => (
          <G key={y}>
            <Line
              x1={padL}
              y1={yFor(y)}
              x2={padL + innerW}
              y2={yFor(y)}
              stroke={y === 0 ? "#94a3b8" : "#e2e8f0"}
              strokeWidth={y === 0 ? 0.8 : 0.5}
              strokeDasharray={y === 0 ? undefined : "2,2"}
            />
            <Path
              d={`M${padL - 16},${yFor(y)} L${padL},${yFor(y)}`}
              stroke="transparent"
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
        {fPath && (
          <Path d={fPath} stroke="#7c3aed" strokeWidth={1.5} fill="none" />
        )}
        {tPath && (
          <Path d={tPath} stroke="#0d9488" strokeWidth={1.5} fill="none" />
        )}
        {data.map((p) =>
          p.foundation !== null ? (
            <Circle
              key={`f-${p.index}`}
              cx={xFor(p.index)}
              cy={yFor(p.foundation)}
              r={2}
              fill="#7c3aed"
            />
          ) : null,
        )}
        {data.map((p) =>
          p.temperament !== null ? (
            <Circle
              key={`t-${p.index}`}
              cx={xFor(p.index)}
              cy={yFor(p.temperament)}
              r={2}
              fill="#0d9488"
            />
          ) : null,
        )}
      </G>
    </Svg>
  );
}
