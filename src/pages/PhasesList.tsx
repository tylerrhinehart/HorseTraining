import { Link } from "react-router-dom";
import { listAllQuestions, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";

export default function PhasesList() {
  const phases = useQuery(() => listPhases(), []);
  const questions = useQuery(() => listAllQuestions(), []);

  const counts = (phaseId: string) => {
    const all = (questions.data ?? []).filter((q) => q.phase_id === phaseId);
    return {
      foundation: all.filter((q) => q.axis === "foundation").length,
      temperament: all.filter((q) => q.axis === "temperament").length,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Phases</h1>
        <p className="text-slate-400 text-sm mt-1">
          The five canonical TQA phases: Groundwork → Phase 1 → Phase 2 →
          Phase 3 → Phase 4. Items are seeded from the published TQA score
          sheets and are read-only — open a phase to attach training videos
          and links.
        </p>
      </div>
      {phases.loading && <div className="card text-slate-400">Loading…</div>}
      {phases.error && (
        <div className="card text-red-400">{phases.error.message}</div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {phases.data?.map((p) => {
          const c = counts(p.id);
          return (
            <Link
              key={p.id}
              to={`/phases/${p.id}`}
              className="card flex items-center justify-between hover:ring-2 hover:ring-brand-500 transition"
            >
              <div>
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {c.foundation} foundation · {c.temperament} temperament
                </div>
              </div>
              <span className="text-slate-500">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
