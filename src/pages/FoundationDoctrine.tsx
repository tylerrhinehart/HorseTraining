import { Link } from "react-router-dom";
import { FFP_SECTIONS, FRAMEWORK_QUESTIONS, TRAINER_EXPECTATIONS } from "../content/ffp";
import {
  PHASE_TIMELINE,
  RIDE_CADENCE_OPTIONS,
  TOTAL_WEEKS,
} from "../content/timeline";
import {
  FOUNDATION_ITEMS,
  TASK_COMPLETION_ITEMS,
  TEMPERAMENT_ITEMS,
} from "../content/trifecta";
import { SCORE_LEGEND } from "../content/tqa-template";

export default function FoundationDoctrine() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Foundation Doctrine</h1>
        <p className="text-slate-400 text-sm mt-1">
          The TQA framework, score scale, and end-of-engagement Trifecta —
          mirrored from the public Foundation page so trainers can show clients
          the same standards used in this app.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Score scale: -3 to +3</h2>
        <ul className="text-sm grid gap-1 sm:grid-cols-2">
          {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
            <li key={s} className="flex gap-2">
              <span className="font-mono w-8 text-right">
                {s > 0 ? `+${s}` : s}
              </span>
              <span>{SCORE_LEGEND[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Four Questions to Ask a Pro Trainer</h2>
        <div className="space-y-3">
          {FRAMEWORK_QUESTIONS.map((q) => (
            <div key={q.number} className="card">
              <p className="font-medium">
                {q.number}. {q.question}
              </p>
              <p className="text-sm text-slate-300 mt-1">{q.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Recommended ride cadences</h2>
        <ul className="text-sm space-y-2">
          {RIDE_CADENCE_OPTIONS.map((o) => (
            <li key={o.label}>
              <span className="font-medium">{o.label}:</span> {o.description} ·{" "}
              <span className="italic text-slate-300">{o.pattern}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">
          Phase timeline ({TOTAL_WEEKS} weeks total)
        </h2>
        <ul className="text-sm space-y-1">
          {PHASE_TIMELINE.map((b) => (
            <li key={b.label}>
              <span className="font-medium">{b.label}:</span> {b.weeks} weeks
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Training Trifecta</h2>
        <p className="text-sm text-slate-400">
          End-of-engagement evaluation. Foundation and Task Completion split
          from the website's 15-item checklist; Temperament uses 5 driving
          factors.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <TrifectaCol title="Foundation" items={FOUNDATION_ITEMS} />
          <TrifectaCol title="Task Completion" items={TASK_COMPLETION_ITEMS} />
          <TrifectaCol title="Temperament" items={TEMPERAMENT_ITEMS} />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Trainer expectations at end of 2 months</h2>
        <ol className="list-decimal list-inside text-sm space-y-1">
          {TRAINER_EXPECTATIONS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </section>

      {FFP_SECTIONS.map((s) => (
        <section key={s.heading} className="card space-y-2">
          <h2 className="font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-sm text-slate-300">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="text-xs text-slate-500">
        Reference:{" "}
        <Link to="/phases" className="underline">
          per-phase score sheets
        </Link>{" "}
        for the 8 Foundation + 6 Temperament rows used in weekly sessions.
      </p>
    </div>
  );
}

function TrifectaCol({
  title,
  items,
}: {
  title: string;
  items: { code: string; text: string }[];
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">
        {title}
      </h3>
      <ol className="list-decimal list-inside text-sm space-y-1">
        {items.map((it) => (
          <li key={it.code}>{it.text}</li>
        ))}
      </ol>
    </div>
  );
}
