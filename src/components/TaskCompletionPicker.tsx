import type { TaskCompletion } from "../supabase/types";
import { TASK_COMPLETION_GROUPS, TASK_COMPLETION_JOBS, LEGACY_TASK_JOBS, TASK_PHASES, taskJobName, type TaskJob } from "../content/programs";
import { DISCIPLINE_MATERIALS, PERFORMANCE_STANDARDS } from "../content/disciplineResources";
import { lastWorkedLabel, type DisciplineHistory } from "../utils/disciplineHistory";

interface Props {
  history?: DisciplineHistory;
  value: TaskCompletion[];
  onChange: (next: TaskCompletion[]) => void;
  goals?: string[];
  readOnly?: boolean;
}

function TaskResources({ job, phase }: TaskCompletion) {
  const material = DISCIPLINE_MATERIALS[job];
  const name = taskJobName(job);
  const videos = material?.phaseVideos?.[phase] ?? [];
  return (
    <div className="task-resources">
      {material?.descriptions?.[phase - 1] && <span>{material.descriptions[phase - 1]}</span>}
      {videos.map((id, index) => (
        <a key={id} href={`https://youtu.be/${id}`} target="_blank" rel="noreferrer">
          {name} P{phase} · Judges Corner video{videos.length > 1 ? ` ${index + 1}` : ""} ↗
        </a>
      ))}
      {material?.disciplineVideo && <a href={`https://youtu.be/${material.disciplineVideo}`} target="_blank" rel="noreferrer">{name} · Judges Corner video ↗</a>}
      {material && <a href={material.sheet} target="_blank" rel="noreferrer">{name} · TQA judging sheet ↗</a>}
      {!material && <a href={PERFORMANCE_STANDARDS} target="_blank" rel="noreferrer">Browse TQA performance standards ↗</a>}
    </div>
  );
}

export default function TaskCompletionPicker({ value, onChange, goals = [], readOnly = false, history }: Props) {
  function toggle(job: string, phase: number) {
    const existing = value.find(task => task.job === job);
    if (!existing) onChange([...value, { job, phase }]);
    else if (existing.phase === phase) onChange(value.filter(task => task.job !== job));
    else onChange(value.map(task => task.job === job ? { job, phase } : task));
  }

  if (readOnly) {
    if (!value.length) return null;
    return <section className="card"><h2 className="card-title">Task completions</h2>
      {value.map(task => <div key={task.job} className="task-row"><strong>{taskJobName(task.job)} · Phase {task.phase}</strong><TaskResources {...task} /></div>)}
    </section>;
  }

  function group(title: string, jobs: TaskJob[]) {
    if (!jobs.length) return null;
    return <fieldset key={title} className="task-group"><legend>{title}</legend>
      {jobs.map(job => {
        const selected = value.find(task => task.job === job.code);
        return <div key={job.code} className="task-row">
          <strong>{job.name}</strong>
          {history && <p className="discipline-last">Last worked: {lastWorkedLabel(history.get(job.code))}</p>}
          <div className="task-choice">
            <span>Phase for this ride{selected ? `: Phase ${selected.phase}` : ""}</span>
            <div className="task-phases" role="group" aria-label={`${job.name} phase for this ride`}>
              {TASK_PHASES.map(phase => <button key={phase} type="button"
                className={`btn btn-sm ${selected?.phase === phase ? "btn-leather" : "btn-ghost"}`}
                aria-label={`${job.name}, Phase ${phase}`} aria-pressed={selected?.phase === phase}
                onClick={() => toggle(job.code, phase)}>Phase {phase}</button>)}
            </div>
          </div>
          {selected && <TaskResources {...selected} />}
        </div>;
      })}
    </fieldset>;
  }

  const agreed = TASK_COMPLETION_JOBS.filter(job => goals.includes(job.code));
  const others = TASK_COMPLETION_GROUPS.map(({ name, jobs }) => group(name, jobs.filter(job => !goals.includes(job.code))));
  return <section className="card"><h2 className="card-title">Task completion</h2>
    <p>Choose the phase you worked for each job on this ride. Each job has its own phases.</p>
    {group("Agreed training goals", agreed)}
    {agreed.length && agreed.length < TASK_COMPLETION_JOBS.length
      ? <details open={value.some(task => !goals.includes(task.job)) || undefined}><summary>Other disciplines</summary>{others}</details>
      : others}
    {history && LEGACY_TASK_JOBS.filter(job => history.has(job.code) && !value.some(task => task.job === job.code)).map(job =>
      <div className="task-row" key={job.code}><strong>{job.name}</strong><p className="discipline-last">Last worked: {lastWorkedLabel(history.get(job.code))}</p></div>
    )}
    {group("Previously recorded tasks", LEGACY_TASK_JOBS.filter(job => value.some(task => task.job === job.code)))}
  </section>;
}
