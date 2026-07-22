import { SCORE_LEGEND } from "../../content/tqa-template";
import {
  FIVE_FOUNDATION_LEGEND,
  FIVE_SCALE_VALUES,
  FIVE_TEMPERAMENT_LEGEND,
} from "../../content/programs";
import { PROGRAMS } from "../../content/programs";
import { IconHorseshoe, IconLayers, IconRibbon } from "../../components/Icons";
import { ScaleViz, foundationChip, frequencyChip, qualityChip } from "./shared";

const PROGRAM_ICONS = [IconHorseshoe, IconLayers, IconRibbon];

// What is TQA? — the elevator pitch, the three programs, and the two scoring
// scales rendered as visual ramps instead of text lists.
export default function OverviewTab() {
  return (
    <div className="ref-section">
      <div className="ref-hero">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Training Quality Assurance
        </div>
        <p className="ref-lede" style={{ fontSize: 16 }}>
          TQA is a peer-reviewed framework for measuring the quality of a
          horse's training. It is built on the Foundation for Perfection
          doctrine and the <strong>Training Trifecta</strong> — Foundation,
          Task Completion, and Temperament. Every score sheet in this app
          evaluates a horse against that standard, so a client knows exactly
          what they are paying for and what the horse can do.
        </p>
      </div>

      <div>
        <h3 className="h-section" style={{ marginTop: 4 }}>
          Three training programs
        </h3>
        <div className="pillar-grid">
          {PROGRAMS.map((p, i) => {
            const Icon = PROGRAM_ICONS[i] ?? IconHorseshoe;
            return (
              <div key={p.id} className="pillar">
                <div className="pillar-head">
                  <span className="acc-icon">
                    <Icon size={18} />
                  </span>
                  {p.label}
                </div>
                <div
                  className="mono muted"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  {p.tagline}
                </div>
                <p
                  className="muted"
                  style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}
                >
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="h-section">How scoring works</h3>
        <div className="scale-grid">
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Foundation scale</h2>
              <span className="card-meta">−3 to +3</span>
            </div>
            <ScaleViz
              values={[3, 2, 1, 0, -1, -2, -3]}
              legend={SCORE_LEGEND}
              chip={foundationChip}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
            />
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Performance scale</h2>
              <span className="card-meta">1 to 5 · quality</span>
            </div>
            <ScaleViz
              values={[...FIVE_SCALE_VALUES].reverse()}
              legend={FIVE_FOUNDATION_LEGEND}
              chip={qualityChip}
            />
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Temperament scale</h2>
              <span className="card-meta">1 to 5 · frequency</span>
            </div>
            <ScaleViz
              values={[...FIVE_SCALE_VALUES].reverse()}
              legend={FIVE_TEMPERAMENT_LEGEND}
              chip={frequencyChip}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
