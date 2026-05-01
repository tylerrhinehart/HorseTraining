import { Link } from "react-router-dom";
import {
  useActiveHorse,
  useActiveQuestions,
  useEvaluationsForHorse,
  useHorses,
} from "../db/queries";
import {
  endDate,
  formatHumanDate,
  isTrainingComplete,
  todayLocal,
  trainingDayNumber,
} from "../utils/dates";
import { dailyAverages, overallTrend, round1 } from "../utils/stats";
import ProgressChart from "../components/ProgressChart";

export default function Dashboard() {
  const horses = useHorses(false) ?? [];
  const active = useActiveHorse();
  const questions = useActiveQuestions() ?? [];
  const evals = useEvaluationsForHorse(active?.id) ?? [];

  if (!active) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <div className="card space-y-3">
          <p className="text-slate-300">
            {horses.length === 0
              ? "Get started by registering your first horse."
              : "Select an active horse from the horses page."}
          </p>
          <div className="flex gap-2">
            <Link to="/horses/new" className="btn-primary">
              Register horse
            </Link>
            {horses.length > 0 && (
              <Link to="/horses" className="btn-secondary">
                View horses
              </Link>
            )}
            {questions.length === 0 && (
              <Link to="/questions" className="btn-secondary">
                Configure questions
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const today = todayLocal();
  const todayEval = evals.find((e) => e.date === today);
  const day = trainingDayNumber(active.startDate, today);
  const dayInWindow = day >= 1 && day <= active.durationDays;
  const complete = isTrainingComplete(active.startDate, active.durationDays);
  const dailyAvg = dailyAverages(active.startDate, evals);
  const trend = overallTrend(dailyAvg);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{active.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {dayInWindow
              ? `Day ${day} of ${active.durationDays}`
              : day < 1
                ? `Training starts ${formatHumanDate(active.startDate)}`
                : `Training ended ${formatHumanDate(endDate(active.startDate, active.durationDays))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/evaluate/${active.id}`} className="btn-primary text-sm">
            {todayEval ? "Edit today's evaluation" : "Evaluate today"}
          </Link>
          <Link to={`/horses/${active.id}`} className="btn-secondary text-sm">
            View horse
          </Link>
          <Link to="/horses" className="btn-ghost text-sm">
            Switch horse
          </Link>
        </div>
      </div>

      {complete && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-emerald-200 mb-2">
            Training is complete. Generate a report to send to{" "}
            {active.ownerName ?? "the owner"}.
          </p>
          <Link
            to={`/horses/${active.id}/report`}
            className="btn-primary text-sm"
          >
            Generate PDF report
          </Link>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Days logged"
          value={`${evals.length} / ${active.durationDays}`}
        />
        <Stat
          label="Today's average"
          value={
            todayEval
              ? round1(
                  Object.values(todayEval.ratings).reduce(
                    (s, r) => s + r.score,
                    0,
                  ) / (Object.values(todayEval.ratings).length || 1),
                )
              : "—"
          }
        />
        <Stat
          label="Overall trend"
          value={
            trend.direction === "n/a"
              ? "—"
              : `${trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} ${
                  trend.delta === null ? "" : trend.delta.toFixed(2)
                }`
          }
        />
        <Stat label="Active questions" value={String(questions.length)} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Progress so far</h2>
        <ProgressChart
          data={dailyAvg}
          durationDays={active.durationDays}
        />
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
