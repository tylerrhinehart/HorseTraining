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
    <div className="view" style={{ maxWidth: 820 }}>
      <div className="eyebrow">Doctrine</div>
      <h1 className="h-display">Foundation</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        The TQA framework, score scale, and end-of-engagement Trifecta —
        mirrored from the public Foundation page so trainers can show clients
        the same standards used in this app.
      </p>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Score scale</h2>
          <span className="card-meta">−3 to +3</span>
        </div>
        <ul
          style={{
            display: "grid",
            gap: 6,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            margin: 0,
            padding: 0,
            listStyle: "none",
            fontSize: 14,
          }}
        >
          {([3, 2, 1, 0, -1, -2, -3] as const).map((s) => (
            <li
              key={s}
              style={{ display: "flex", gap: 10, alignItems: "baseline" }}
            >
              <span
                className="mono"
                style={{
                  width: 32,
                  textAlign: "right",
                  color:
                    s > 0
                      ? "var(--ok)"
                      : s < 0
                        ? "var(--bad)"
                        : "var(--ink-2)",
                }}
              >
                {s > 0 ? `+${s}` : s}
              </span>
              <span>{SCORE_LEGEND[s]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Four questions to ask a pro trainer</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FRAMEWORK_QUESTIONS.map((q) => (
            <div key={q.number}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {q.number}. {q.question}
              </p>
              <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {q.summary}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Recommended ride cadences</h2>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 14,
          }}
        >
          {RIDE_CADENCE_OPTIONS.map((o) => (
            <li key={o.label}>
              <span style={{ fontWeight: 600 }}>{o.label}:</span> {o.description}
              {" · "}
              <span className="muted" style={{ fontStyle: "italic" }}>
                {o.pattern}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Phase timeline</h2>
          <span className="card-meta">{TOTAL_WEEKS} weeks total</span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 14,
          }}
        >
          {PHASE_TIMELINE.map((b) => (
            <li key={b.label}>
              <span style={{ fontWeight: 600 }}>{b.label}:</span> {b.weeks} weeks
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Training Trifecta</h2>
          <span className="card-meta">end of engagement</span>
        </div>
        <p className="muted" style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>
          End-of-engagement evaluation. Foundation and Task Completion split
          from the website's 15-item checklist; Temperament uses 5 driving
          factors.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <TrifectaCol title="Foundation" items={FOUNDATION_ITEMS} />
          <TrifectaCol title="Task Completion" items={TASK_COMPLETION_ITEMS} />
          <TrifectaCol title="Temperament" items={TEMPERAMENT_ITEMS} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Trainer expectations at end of 2 months</h2>
        </div>
        <ol
          style={{
            margin: 0,
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 14,
          }}
        >
          {TRAINER_EXPECTATIONS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>

      {FFP_SECTIONS.map((s) => (
        <div key={s.heading} className="card">
          <div className="card-head">
            <h2 className="card-title">{s.heading}</h2>
          </div>
          {s.body.map((p, i) => (
            <p
              key={i}
              style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}
            >
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 14,
              }}
            >
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <p className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>
        Reference:{" "}
        <Link to="/phases" style={{ color: "var(--leather)" }}>
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
    <div
      style={{
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <h3
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--muted)",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      <ol
        style={{
          margin: 0,
          paddingLeft: 18,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
        }}
      >
        {items.map((it) => (
          <li key={it.code}>{it.text}</li>
        ))}
      </ol>
    </div>
  );
}
