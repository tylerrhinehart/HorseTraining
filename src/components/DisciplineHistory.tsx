import { TASK_COMPLETION_JOBS, taskJobName } from "../content/programs";
import { lastWorkedLabel, type DisciplineHistory } from "../utils/disciplineHistory";

import DisciplineGuide from "./DisciplineGuide";

export default function DisciplineHistoryCard({ history, goals }: { history: DisciplineHistory; goals: string[] }) {
  const active = new Set([...goals, ...history.keys()]);
  const other = TASK_COMPLETION_JOBS.filter(job => !active.has(job.code));
  function rows(codes: string[]) {
    return <dl className="discipline-history">{codes.map(code => <div key={code}>
      <dt>{taskJobName(code)}</dt><dd>{lastWorkedLabel(history.get(code))}</dd><dd><DisciplineGuide job={code} /></dd>
    </div>)}</dl>;
  }
  return <section aria-label="Last phase worked by discipline">
    <h2 className="card-title">Last phase worked by discipline</h2>
    {active.size > 0 ? rows([...active]) : <p className="muted">No disciplines logged yet.</p>}
    {other.length > 0 && <details><summary>Other disciplines</summary>{rows(other.map(job => job.code))}</details>}
  </section>;
}
