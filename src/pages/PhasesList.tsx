import { Link } from "react-router-dom";
import { listAllQuestions, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";

export default function PhasesList() {
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(false), []);

  const counts = (phaseId: string) =>
    (questions.data ?? []).filter((q) => q.phase_id === phaseId).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Phases</h1>
        <p className="text-slate-400 text-sm mt-1">
          The five training phases. Each phase has its own list of TQA
          questions and resources. Tap a phase to manage them.
        </p>
      </div>
      {phases.loading && (
        <div className="card text-slate-400">Loading…</div>
      )}
      {phases.error && (
        <div className="card text-red-400">{phases.error.message}</div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {phases.data?.map((p) => (
          <Link
            key={p.id}
            to={`/phases/${p.id}`}
            className="card flex items-center justify-between hover:ring-2 hover:ring-brand-500 transition"
          >
            <div>
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                {counts(p.id)} questions
              </div>
            </div>
            <span className="text-slate-500">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
