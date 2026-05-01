import { Link, useNavigate, useParams } from "react-router-dom";
import {
  archiveHorse,
  deleteHorse,
  setActiveHorse,
  unarchiveHorse,
  useActiveHorse,
  useAllQuestions,
  useEvaluationsForHorse,
  useHorse,
} from "../db/queries";
import {
  endDate,
  formatHumanDate,
  formatShortDate,
  isTrainingComplete,
  todayLocal,
  trainingDayNumber,
} from "../utils/dates";
import {
  dailyAverages,
  overallTrend,
  questionAverages,
  round1,
} from "../utils/stats";
import ProgressChart from "../components/ProgressChart";
import QuestionTrendChart from "../components/QuestionTrendChart";

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const horse = useHorse(id);
  const evals = useEvaluationsForHorse(id) ?? [];
  const questions = useAllQuestions(true) ?? [];
  const active = useActiveHorse();

  if (!horse) {
    return (
      <div className="card">
        <p className="text-slate-400">Horse not found.</p>
        <Link to="/horses" className="underline">
          Back to horses
        </Link>
      </div>
    );
  }

  // Build the question list to show: any question referenced by an eval +
  // currently active questions, sorted by order.
  const questionIdsInUse = new Set<string>();
  for (const ev of evals) {
    Object.keys(ev.ratings).forEach((qid) => questionIdsInUse.add(qid));
  }
  questions
    .filter((q) => q.active && !q.deletedAt)
    .forEach((q) => questionIdsInUse.add(q.id));
  const visibleQuestions = questions
    .filter((q) => questionIdsInUse.has(q.id))
    .sort((a, b) => a.order - b.order);

  const dailyAvg = dailyAverages(horse.startDate, evals);
  const trend = overallTrend(dailyAvg);
  const qAverages = questionAverages(visibleQuestions, evals);
  const isActiveHorse = active?.id === horse.id;
  const complete = isTrainingComplete(horse.startDate, horse.durationDays);

  const overallAverage = (() => {
    const all = evals.flatMap((e) =>
      Object.values(e.ratings).map((r) => r.score),
    );
    if (all.length === 0) return null;
    return all.reduce((s, n) => s + n, 0) / all.length;
  })();

  const handleDelete = async () => {
    if (
      !confirm(
        `Permanently delete "${horse.name}" and all evaluations? This cannot be undone.`,
      )
    ) {
      return;
    }
    await deleteHorse(horse.id);
    navigate("/horses");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {horse.name}
            {isActiveHorse && (
              <span className="pill bg-brand-600 text-white">Active</span>
            )}
            {complete && !horse.archivedAt && (
              <span className="pill bg-emerald-600 text-white">
                Training complete
              </span>
            )}
            {horse.archivedAt && (
              <span className="pill bg-slate-700 text-slate-300">
                Archived
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {horse.breed && <>{horse.breed} · </>}
            {horse.ownerName && <>Owner: {horse.ownerName} · </>}
            {formatHumanDate(horse.startDate)} →{" "}
            {formatHumanDate(endDate(horse.startDate, horse.durationDays))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isActiveHorse && !horse.archivedAt && (
            <button
              className="btn-secondary text-sm"
              onClick={() => setActiveHorse(horse.id)}
            >
              Set active
            </button>
          )}
          <Link to={`/evaluate/${horse.id}`} className="btn-primary text-sm">
            Evaluate today
          </Link>
          <Link
            to={`/horses/${horse.id}/report`}
            className="btn-secondary text-sm"
          >
            Generate report
          </Link>
          {horse.archivedAt ? (
            <button
              className="btn-ghost text-sm"
              onClick={() => unarchiveHorse(horse.id)}
            >
              Unarchive
            </button>
          ) : (
            <button
              className="btn-ghost text-sm"
              onClick={() => archiveHorse(horse.id)}
            >
              Archive
            </button>
          )}
          <button className="btn-danger text-sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Days completed" value={`${evals.length} / ${horse.durationDays}`} />
        <Stat label="Overall average" value={round1(overallAverage)} />
        <Stat
          label="Trend"
          value={
            trend.direction === "n/a"
              ? "—"
              : `${trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} ${
                  trend.delta === null ? "" : trend.delta.toFixed(2)
                }`
          }
        />
        <Stat
          label="Today"
          value={
            evals.find((e) => e.date === todayLocal())
              ? "Logged"
              : "Not yet"
          }
        />
      </div>

      {horse.notes && (
        <div className="card">
          <h2 className="font-semibold mb-1">Notes</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {horse.notes}
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold">Overall progress</h2>
        <ProgressChart
          data={dailyAvg}
          durationDays={horse.durationDays}
        />
      </div>

      {visibleQuestions.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Per-question trend</h2>
          <QuestionTrendChart
            questions={visibleQuestions}
            evaluations={evals}
            startDate={horse.startDate}
            durationDays={horse.durationDays}
          />
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-3">Question averages</h2>
        <div className="space-y-2">
          {qAverages.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No questions yet. Add some on the Questions page.
            </p>
          ) : (
            qAverages.map((q) => (
              <div
                key={q.questionId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-slate-200 flex-1">{q.text}</span>
                <span className="text-slate-400 w-24 text-right">
                  {q.count} entries
                </span>
                <span className="text-slate-100 w-12 text-right font-medium">
                  {round1(q.average)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Evaluation history</h2>
        {evals.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No evaluations yet. Click{" "}
            <Link
              to={`/evaluate/${horse.id}`}
              className="underline text-brand-500"
            >
              Evaluate today
            </Link>{" "}
            to record the first one.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {[...evals]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((ev) => {
                const scores = Object.values(ev.ratings).map(
                  (r) => r.score,
                );
                const avg =
                  scores.length === 0
                    ? null
                    : scores.reduce((s, n) => s + n, 0) / scores.length;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="text-sm">
                      <span className="text-slate-300 mr-2">
                        Day{" "}
                        {trainingDayNumber(horse.startDate, ev.date)}
                      </span>
                      <span className="text-slate-400">
                        {formatShortDate(ev.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-100 font-medium">
                        {round1(avg)}
                      </span>
                      <Link
                        to={`/evaluate/${horse.id}/${ev.date}`}
                        className="btn-ghost text-xs"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
