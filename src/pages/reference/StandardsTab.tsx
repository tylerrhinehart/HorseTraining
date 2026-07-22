import {
  FRAMEWORK_QUESTIONS,
  INDUSTRY_PRICING,
  TRAINER_EXPECTATIONS,
} from "../../content/ffp";
import {
  PHASE_TIMELINE,
  RIDE_CADENCE_OPTIONS,
  TOTAL_WEEKS,
} from "../../content/timeline";
import { IconCheck, IconQuestion } from "../../components/Icons";
import { Accordion } from "./shared";

// TQA Industry Standards — pricing as stat cards, cadences as option cards,
// the phase timeline as proportional bars, expectations as a checklist.
export default function StandardsTab() {
  const maxCadenceDays = Math.max(...RIDE_CADENCE_OPTIONS.map((o) => o.total_days));
  return (
    <div className="ref-section">
      <div>
        <h3 className="h-section" style={{ marginTop: 4 }}>
          What to expect to pay
        </h3>
        <div className="stat-grid">
          {INDUSTRY_PRICING.map((tier) => (
            <div key={tier.label} className="stat-card">
              <span className="k">{tier.label}</span>
              <span className="v">{tier.range}</span>
              <span className="n">{tier.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="h-section">Recommended ride cadences</h3>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          Foundation program · three published options for setting a foundation.
        </p>
        <div className="stat-grid stat-grid-3">
          {RIDE_CADENCE_OPTIONS.map((o) => (
            <div key={o.label} className="stat-card">
              <span className="k">{o.label}</span>
              <span className="v">
                {o.total_days} rides
                <span
                  className="muted"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 400,
                  }}
                >
                  {" "}
                  / {o.span_days} days
                </span>
              </span>
              <div className="tl-track" style={{ marginTop: 2 }}>
                <div
                  className="tl-fill"
                  style={{ width: `${(o.total_days / maxCadenceDays) * 100}%` }}
                />
              </div>
              <span className="n">{o.pattern}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Phase timeline</h2>
          <span className="card-meta">
            Foundation program · {TOTAL_WEEKS} weeks
          </span>
        </div>
        <div className="tl">
          {PHASE_TIMELINE.map((b) => (
            <div key={b.label} className="tl-row">
              <span className="tl-name">{b.label}</span>
              <div className="tl-track">
                <div
                  className="tl-fill"
                  style={{ width: `${(b.weeks / TOTAL_WEEKS) * 100}%` }}
                />
              </div>
              <span className="tl-weeks">
                {b.weeks} wk{b.weeks !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">
            What to expect from the trainer at 2 months
          </h2>
        </div>
        <ul className="check-list">
          {TRAINER_EXPECTATIONS.map((t, i) => (
            <li key={i}>
              <span className="ck">
                <IconCheck size={16} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="h-section">Four questions to ask a pro trainer</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FRAMEWORK_QUESTIONS.map((q) => (
            <Accordion
              key={q.number}
              icon={<IconQuestion size={18} />}
              title={q.question}
              defaultOpen={q.number === 1}
            >
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                {q.summary}
              </p>
            </Accordion>
          ))}
        </div>
      </div>
    </div>
  );
}
