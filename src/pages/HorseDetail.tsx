import { Link, useNavigate, useParams } from "react-router-dom";
import {
  archiveHorse,
  deleteHorse,
  getHorse,
  listAllQuestions,
  listPhases,
  listTQAsForHorse,
  setHorsePhase,
  unarchiveHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import {
  overallTrend,
  questionAverages,
  round1,
  tqaAverage,
  tqaAverages,
} from "../utils/stats";
import { formatDateTime, formatHumanDate } from "../utils/dates";
import ProgressChart from "../components/ProgressChart";
import QuestionTrendChart from "../components/QuestionTrendChart";

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const phases = useQuery(() => listPhases(), []);
  const tqas = useQuery(
    () => (id ? listTQAsForHorse(id) : Promise.resolve([])),
    [id],
  );
  const questions = useQuery(() => listAllQuestions(true), []);

  if (!id) return null;
  if (horse.loading) return <div className="card">Loading…</div>;
  if (!horse.data) {
    return (
      <div className="card">
        Horse not found.{" "}
        <Link to="/horses" className="underline">Back</Link>
      </div>
    );
  }

  const orderedPhases = phases.data ?? [];
  const currentPhase = orderedPhases.find(
    (p) => p.id === horse.data!.current_phase_id,
  );
  const currentIdx = orderedPhases.findIndex(
    (p) => p.id === horse.data!.current_phase_id,
  );
  const nextPhase =
    currentIdx >= 0 && currentIdx < orderedPhases.length - 1
      ? orderedPhases[currentIdx + 1]
      : null;
  const prevPhase = currentIdx > 0 ? orderedPhases[currentIdx - 1] : null;

  const tqaList = tqas.data ?? [];
  const points = tqaAverages(tqaList);
  const trend = overallTrend(points);
  const overallAvg = (() => {
    const all = tqaList.flatMap((t) => (t.ratings ?? []).map((r) => r.score));
    return all.length === 0
      ? null
      : all.reduce((s, n) => s + n, 0) / all.length;
  })();

  const phaseFor = (phaseId: string) =>
    orderedPhases.find((p) => p.id === phaseId)?.name ?? "—";

  // Question averages restricted to questions referenced in any TQA.
  const referencedQuestionIds = new Set<string>();
  for (const t of tqaList) {
    for (const r of t.ratings ?? []) referencedQuestionIds.add(r.question_id);
  }
  const referencedQuestions = (questions.data ?? [])
    .filter((q) => referencedQuestionIds.has(q.id))
    .sort((a, b) => a.position - b.position);
  const qAverages = questionAverages(referencedQuestions, tqaList);

  const handleAdvance = async () => {
    if (!nextPhase) return;
    await setHorsePhase(id, nextPhase.id);
    horse.refresh();
  };

  const handleBack = async () => {
    if (!prevPhase) return;
    await setHorsePhase(id, prevPhase.id);
    horse.refresh();
  };

  const handleArchive = async () => {
    if (horse.data!.archived_at) {
      await unarchiveHorse(id);
    } else {
      await archiveHorse(id);
    }
    horse.refresh();
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Permanently delete "${horse.data!.name}" and all TQAs? This cannot be undone.`,
      )
    )
      return;
    await deleteHorse(id);
    navigate("/horses");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {horse.data.name}
            {horse.data.archived_at && (
              <span className="pill bg-slate-700 text-slate-300">
                Archived
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {horse.data.breed && <>{horse.data.breed} · </>}
            {horse.data.owner_name && <>Owner: {horse.data.owner_name} · </>}
            {horse.data.start_date
              ? `Started ${formatHumanDate(horse.data.start_date)}`
              : `Added ${formatHumanDate(horse.data.created_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/horses/${id}/tqa/new`}
            className="btn-primary text-sm"
          >
            + New TQA
          </Link>
          <Link
            to={`/horses/${id}/report`}
            className="btn-secondary text-sm"
          >
            Generate report
          </Link>
          <button className="btn-ghost text-sm" onClick={handleArchive}>
            {horse.data.archived_at ? "Unarchive" : "Archive"}
          </button>
          <button className="btn-danger text-sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Current phase
          </div>
          <div className="text-xl font-semibold mt-1">
            {currentPhase?.name ?? "—"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={handleBack}
            disabled={!prevPhase}
          >
            ← {prevPhase?.name ?? "Earlier"}
          </button>
          <button
            className="btn-primary text-sm"
            onClick={handleAdvance}
            disabled={!nextPhase}
          >
            Advance to {nextPhase?.name ?? "—"} →
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="TQAs recorded" value={String(tqaList.length)} />
        <Stat label="Overall average" value={round1(overallAvg)} />
        <Stat
          label="Trend"
          value={
            trend.direction === "n/a"
              ? "—"
              : `${
                  trend.direction === "up"
                    ? "↑"
                    : trend.direction === "down"
                      ? "↓"
                      : "→"
                } ${trend.delta?.toFixed(2) ?? ""}`
          }
        />
        <Stat
          label="Latest"
          value={
            tqaList.length === 0
              ? "—"
              : formatHumanDate(
                  [...tqaList].sort((a, b) =>
                    b.occurred_at.localeCompare(a.occurred_at),
                  )[0].occurred_at,
                )
          }
        />
      </div>

      {horse.data.notes && (
        <div className="card">
          <h2 className="font-semibold mb-1">Notes</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {horse.data.notes}
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold">Overall progress</h2>
        {points.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No TQAs yet. Record one to see progress charts.
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
            tqas={tqaList}
          />
        </div>
      )}

      {qAverages.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">Question averages</h2>
          <div className="space-y-2">
            {qAverages.map((q) => (
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
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-3">TQA history</h2>
        {tqaList.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No TQAs yet.{" "}
            <Link
              to={`/horses/${id}/tqa/new`}
              className="underline text-brand-500"
            >
              Record the first one
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {[...tqaList]
              .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
              .map((t) => {
                const avg = tqaAverage(t.ratings);
                return (
                  <Link
                    key={t.id}
                    to={`/tqa/${t.id}`}
                    className="flex items-center justify-between py-2 hover:bg-slate-900 -mx-3 px-3 rounded"
                  >
                    <div className="text-sm">
                      <span className="pill bg-brand-600/20 text-brand-100 mr-2">
                        {phaseFor(t.phase_id)}
                      </span>
                      <span className="text-slate-300">
                        {formatDateTime(t.occurred_at)}
                      </span>
                    </div>
                    <div className="text-slate-100 font-medium">
                      {round1(avg)}
                    </div>
                  </Link>
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
