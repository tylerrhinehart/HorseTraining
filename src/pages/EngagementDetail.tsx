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
  if (engagement.loading) return <div className="card">Loading…</div>;
  if (!engagement.data) return <div className="card">Engagement not found.</div>;

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
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {horse.data?.name ?? "Engagement"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {engagement.data.owner_name && <>Owner: {engagement.data.owner_name} · </>}
            {engagement.data.arrival_date
              ? `Arrived ${formatHumanDate(engagement.data.arrival_date)}`
              : "No arrival date"}
            {engagement.data.departure_date
              ? ` · Departs ${formatHumanDate(engagement.data.departure_date)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/engagements/${id}/report`}
            className="btn-secondary text-sm"
          >
            Generate report
          </Link>
          <button className="btn-ghost text-sm" onClick={handleArchive}>
            Archive
          </button>
          <button className="btn-danger text-sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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

      <div className="flex gap-2 border-b border-slate-800 text-sm">
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
            className={[
              "px-3 py-2 -mb-px border-b-2 transition-colors",
              tab === key
                ? "border-brand-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "weeks" && (
        <div className="space-y-3">
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
          <div className="flex justify-end">
            <button className="btn-secondary text-sm" onClick={handleAddWeek}>
              + Add week
            </button>
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-semibold">Per-axis progress</h2>
            {points.length === 0 ? (
              <p className="text-sm text-slate-400">
                No sessions logged yet.
              </p>
            ) : (
              <ProgressChart points={points} />
            )}
          </div>
          {referencedQuestions.length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-semibold">Per-question trend</h2>
              <QuestionTrendChart
                questions={referencedQuestions}
                sessions={sessions.data ?? []}
              />
            </div>
          )}
          {referencedQuestions.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-3">Question averages</h2>
              <QuestionAveragesTable
                questions={referencedQuestions}
                sessions={sessions.data ?? []}
              />
            </div>
          )}
        </div>
      )}

      {tab === "trifecta" && (
        <TrifectaEvaluation
          engagementId={id}
          evaluation={trifecta.data ?? null}
          sessions={sessions.data ?? []}
          onSaved={trifecta.refresh}
        />
      )}

      {tab === "details" && (
        <div className="card space-y-2 text-sm">
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
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 w-32">{label}</span>
      <span className="text-slate-100 whitespace-pre-wrap">{value}</span>
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
    <div className="space-y-1 text-sm">
      {all.map((q) => (
        <div
          key={q.questionId}
          className="flex items-center justify-between gap-3 border-b border-slate-800 py-1"
        >
          <span className="text-slate-200 flex-1">{q.text}</span>
          <span className="text-slate-400 text-xs uppercase w-24">{q.axis}</span>
          <span className="text-slate-400 w-16 text-right text-xs">
            {q.count}×
          </span>
          <span className="font-medium w-12 text-right">{round1(q.average)}</span>
        </div>
      ))}
    </div>
  );
}
