import { useState } from "react";
import { taskJobName } from "../content/programs";
import { DISCIPLINE_MATERIALS, PERFORMANCE_STANDARDS } from "../content/disciplineResources";
import GuideDialog from "./GuideDialog";

export default function DisciplineGuide({ job }: { job: string }) {
  const [open, setOpen] = useState(false);
  const material = DISCIPLINE_MATERIALS[job];
  const name = taskJobName(job);
  return <>
    <button type="button" className="workflow-link" aria-label={`Phase guide for ${name}`} onClick={() => setOpen(true)}>Phase guide</button>
    {open && <GuideDialog title={`${name} · Phase guide`} onClose={() => setOpen(false)}>
      {material?.descriptions && <ol>{material.descriptions.map((description, i) => <li key={i}><strong>Phase {i + 1}</strong> · {description}</li>)}</ol>}
      <div className="task-resources">
        {Object.entries(material?.phaseVideos ?? {}).flatMap(([phase, videos]) => videos.map((id, i) =>
          <a key={id} href={`https://youtu.be/${id}`} target="_blank" rel="noreferrer">Phase {phase} · Judges Corner video{videos.length > 1 ? ` ${i + 1}` : ""} ↗</a>))}
        {material?.disciplineVideo && <a href={`https://youtu.be/${material.disciplineVideo}`} target="_blank" rel="noreferrer">Judges Corner video ↗</a>}
        <a href={material?.sheet ?? PERFORMANCE_STANDARDS} target="_blank" rel="noreferrer">{material ? `${name} judging sheet` : "TQA performance standards"} ↗</a>
      </div>
    </GuideDialog>}
  </>;
}
