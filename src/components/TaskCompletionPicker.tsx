import {
  TASK_COMPLETION_JOBS,
  TASK_PHASES,
  taskJobName,
} from "../content/programs";
import type { TaskCompletion } from "../supabase/types";

interface Props {
  value: TaskCompletion[];
  onChange: (next: TaskCompletion[]) => void;
  readOnly?: boolean;
}

/**
 * Task Completion picker for the performance warm-up (sheet row 8). The trainer
 * goes through the warm-up, then picks one or more jobs + the phase worked that
 * day — e.g. "Fence Work · Phase 2". Like ordering at Subway: pick the jobs the
 * horse is being trained for.
 */
export default function TaskCompletionPicker({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const toggle = (job: string, phase: number) => {
    const existing = value.find((t) => t.job === job);
    if (existing && existing.phase === phase) {
      onChange(value.filter((t) => t.job !== job)); // unselect
    } else if (existing) {
      onChange(value.map((t) => (t.job === job ? { job, phase } : t)));
    } else {
      onChange([...value, { job, phase }]);
    }
  };

  if (readOnly) {
    if (value.length === 0) return null;
    return (
      <div className="card">
        <div
          className="mono muted"
          style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}
        >
          Task completions
        </div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {value.map((t) => (
            <li key={t.job} style={{ fontSize: 14 }}>
              {taskJobName(t.job)} · Phase {t.phase}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="card-title">Task completion</h2>
        <span className="card-meta">pick the job(s) + phase worked today</span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
        Each job is worked through Phases 1–4 — tap the phase worked today
        (tap it again to unselect).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TASK_COMPLETION_JOBS.map((job) => {
          const selected = value.find((t) => t.job === job.code);
          return (
            <div
              key={job.code}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                borderTop: "1px solid var(--line)",
                paddingTop: 8,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: selected ? 600 : 400,
                  color: selected ? "var(--ink)" : "var(--ink-2)",
                  flex: "1 1 180px",
                  minWidth: 0,
                }}
              >
                {job.name}
              </span>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {TASK_PHASES.map((p) => {
                  const on = selected?.phase === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${on ? "btn-leather" : "btn-ghost"}`}
                      aria-pressed={on}
                      onClick={() => toggle(job.code, p)}
                      style={{ minWidth: 38 }}
                    >
                      P{p}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
