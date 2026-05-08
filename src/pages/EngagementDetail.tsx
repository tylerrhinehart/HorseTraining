import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  appendWeek,
  archiveEngagement,
  deleteEngagement,
  getEngagement,
  getHorse,
  getTrifectaForEngagement,
  listAllQuestions,
  listPhases,
  listRiders,
  listSessionsForEngagement,
  listWeeksForEngagement,
  updateWeekComments,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { formatHumanDate } from "../utils/dates";
import {
  meetsCertificationThreshold,
  questionAverages,
  round1,
  sessionAverages,
  trend,
} from "../utils/stats";
import ProgressChart from "../components/ProgressChart";
import QuestionTrendChart from "../components/QuestionTrendChart";
import WeekScoreSheet from "../components/WeekScoreSheet";
import TrifectaEvaluation from "../components/TrifectaEvaluation";

type Tab = "weeks" | "progress" | "trifecta" | "details";

export default function EngagementDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState<Tab>("weeks");
  const [weekDrafts, setWeekDrafts] = useState<Record<string, string>>({});
  const [savingWeekId, setSavingWeekId] = useState<string | null>(null);

  const engagement = useQuery(
    () => (id ? getEngagement(id) : Promise.resolve(null)),
    [id],
  );
  const horse = useQuery(
    () =>
      engagement.data
        ? getHorse(engagement.data.horse_id)
        : Promise.resolve(null),
    [engagement.data?.horse_id],
  );
  const weeks = useQuery(
    () => (id ? listWeeksForEngagement(id) : Promise.resolve([])),
    [id],
  );
  const sessions = useQuery(
    () => (id ? listSessionsForEngagement(id) : Promise.resolve([])),
    [id],
  );
  const phases = useQuery(() => listPhases(), []);
  const riders = useQuery(() => listRiders(), []);
  const questions = useQuery(() => listAllQuestions(), []);
  const trifecta = useQuery(
    () => (id ? getTrifectaForEngagement(id) : Promise.resolve(null)),
    [id],
  );

  // Hydrate per-week comment drafts when weeks load.
  useEffect(() => {
    if (!weeks.data) return;
    setWeekDrafts((prev) => {
      const next = { ...prev };
      for (const w of weeks.data!) {
        if (!(w.id in next)) next[w.id] = w.comments ?? "";
      }
      return next;
    });
  }, [weeks.data]);

  const sessionsByWeek = useMemo(() => {
    const map = new Map<string, typeof sessions.data>();
    for (const s of sessions.data ?? []) {
      const arr = map.get(s.week_id) ?? [];
      arr.push(s);
      map.set(s.week_id, arr);
    }
    return map;
  }, [sessions.data]);

  if (!id) return null;
  if (engagement.loading) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }
  if (!engagement.data) {
    return (
      <div className="view">
        <div className="card">Engagement not found.</div>
      </div>
    );
  }

  const points = sessionAverages(sessions.data ?? []);
  const foundationTrend = trend(points, "foundation");
  const temperamentTrend = trend(points, "temperament");
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const certified = latest && meetsCertificationThreshold(latest);

  const referencedQuestionIds = new Set<string>();
  for (const s of sessions.data ?? []) {
    for (const r of s.ratings ?? []) referencedQuestionIds.add(r.question_id);
  }
  const referencedQuestions = (questions.data ?? [])
    .filter((q) => referencedQuestionIds.has(q.id))
    .sort((a, b) => a.position - b.position);

  const handleArchive = async () => {
    await archiveEngagement(id);
    engagement.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this engagement and all its sessions?")) return;
    await deleteEngagement(id);
    if (horse.data) window.location.assign(`/horses/${horse.data.id}`);
  };

  const handleAddWeek = async () => {
    await appendWeek(id);
    weeks.refresh();
  };

  const handleSaveComments = async (weekId: string) => {
    setSavingWeekId(weekId);
    try {
      await updateWeekComments(weekId, weekDrafts[weekId] ?? "");
      weeks.refresh();
    } finally {
      setSavingWeekId(null);
    }
  };

  return (
    <div className="view">
      <div className="eyebrow">Engagement</div>
      <h1 className="h-display">{horse.data?.name ?? "Engagement"}</h1>
      <p className="muted" style={{ margin: "4px 0 14px", fontSize: 14 }}>
        {engagement.data.owner_name && <>Owner: {engagement.data.owner_name} · </>}
        {engagement.data.arrival_date
          ? `Arrived ${formatHumanDate(engagement.data.arrival_date)}`
          : "No arrival date"}
        {engagement.data.departure_date
          ? ` · Departs ${formatHumanDate(engagement.data.departure_date)}`
          : ""}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Link
          to={`/engagements/${id}/report`}
          className="btn btn-leather btn-sm"
        >
          Generate report
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={handleArchive}>
          Archive
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="today-summary">
        <Stat label="Sessions" value={String((sessions.data ?? []).length)} />
        <Stat
          label="Foundation trend"
          value={
            foundationTrend.direction === "n/a"
              ? "—"
              : `${arrowFor(foundationTrend.direction)} ${
                  foundationTrend.delta?.toFixed(2) ?? ""
                }`
          }
        />
        <Stat
          label="Temperament trend"
          value={
            temperamentTrend.direction === "n/a"
              ? "—"
              : `${arrowFor(temperamentTrend.direction)} ${
                  temperamentTrend.delta?.toFixed(2) ?? ""
                }`
          }
        />
        <Stat
          label="Latest session"
          value={
            !latest
              ? "—"
              : `F ${round1(latest.foundationAverage)} · T ${round1(
                  latest.temperamentAverage,
                )}${certified ? " ✓" : ""}`
          }
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--line)",
          fontSize: 13,
          marginTop: "var(--gap)",
        }}
      >
        {(
          [
            ["weeks", "Weeks"],
            ["progress", "Progress"],
            ["trifecta", "Training Trifecta"],
            ["details", "Details"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="mono"
            style={{
              padding: "10px 14px",
              marginBottom: -1,
              background: "transparent",
              border: "none",
              borderBottom:
                tab === key
                  ? "2px solid var(--leather)"
                  : "2px solid transparent",
              color: tab === key ? "var(--ink)" : "var(--muted)",
              cursor: "pointer",
              letterSpacing: 1.1,
              textTransform: "uppercase",
              fontSize: 11,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "weeks" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 14,
          }}
        >
          {(weeks.data ?? []).map((w) => (
            <WeekScoreSheet
              key={w.id}
              week={w}
              sessions={sessionsByWeek.get(w.id) ?? []}
              phases={phases.data ?? []}
              riders={riders.data ?? []}
              engagementId={id}
              comments={weekDrafts[w.id] ?? ""}
              onCommentsChange={(next) =>
                setWeekDrafts((d) => ({ ...d, [w.id]: next }))
              }
              onSaveComments={() => handleSaveComments(w.id)}
              commentsSaving={savingWeekId === w.id}
            />
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-sm" onClick={handleAddWeek}>
              + Add week
            </button>
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 14,
          }}
        >
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Per-axis progress</h2>
              <span className="card-meta">foundation vs temperament</span>
            </div>
            {points.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                No sessions logged yet.
              </p>
            ) : (
              <ProgressChart points={points} />
            )}
          </div>
          {referencedQuestions.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2 className="card-title">Per-question trend</h2>
              </div>
              <QuestionTrendChart
                questions={referencedQuestions}
                sessions={sessions.data ?? []}
              />
            </div>
          )}
          {referencedQuestions.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2 className="card-title">Question averages</h2>
              </div>
              <QuestionAveragesTable
                questions={referencedQuestions}
                sessions={sessions.data ?? []}
              />
            </div>
          )}
        </div>
      )}

      {tab === "trifecta" && (
        <div style={{ marginTop: 14 }}>
          <TrifectaEvaluation
            engagementId={id}
            evaluation={trifecta.data ?? null}
            sessions={sessions.data ?? []}
            onSaved={trifecta.refresh}
          />
        </div>
      )}

      {tab === "details" && (
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, fontSize: 14 }}
        >
          {engagement.data.owner_email && (
            <Row label="Email" value={engagement.data.owner_email} />
          )}
          {engagement.data.owner_info && (
            <Row label="Address / info" value={engagement.data.owner_info} />
          )}
          {engagement.data.payment_amount !== null && (
            <Row
              label="Payment"
              value={`$${engagement.data.payment_amount.toFixed(2)}${
                engagement.data.payment_method
                  ? ` (${engagement.data.payment_method})`
                  : ""
              }`}
            />
          )}
          {engagement.data.notes && (
            <Row label="Notes" value={engagement.data.notes} />
          )}
        </div>
      )}
    </div>
  );
}

function arrowFor(dir: "up" | "down" | "flat" | "n/a"): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  if (dir === "flat") return "→";
  return "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-tile">
      <span className="lab">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span className="muted" style={{ width: 128 }}>
        {label}
      </span>
      <span style={{ whiteSpace: "pre-wrap", flex: 1 }}>{value}</span>
    </div>
  );
}

function QuestionAveragesTable({
  questions,
  sessions,
}: {
  questions: import("../supabase/types").Question[];
  sessions: import("../supabase/types").SessionWithRatings[];
}) {
  const all = questionAverages(questions, sessions);
  if (all.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
      {all.map((q, i) => (
        <div
          key={q.questionId}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderTop: i === 0 ? "none" : "1px solid var(--line)",
            padding: "6px 0",
          }}
        >
          <span style={{ flex: 1 }}>{q.text}</span>
          <span
            className="mono muted"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.1,
              width: 96,
            }}
          >
            {q.axis}
          </span>
          <span
            className="mono muted"
            style={{ width: 56, textAlign: "right", fontSize: 12 }}
          >
            {q.count}×
          </span>
          <span style={{ fontWeight: 600, width: 48, textAlign: "right" }}>
            {round1(q.average)}
          </span>
        </div>
      ))}
    </div>
  );
}
