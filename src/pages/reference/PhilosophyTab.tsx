import { FFP_SECTIONS } from "../../content/ffp";
import {
  FOUNDATION_ITEMS,
  TASK_COMPLETION_ITEMS,
  TEMPERAMENT_ITEMS,
} from "../../content/trifecta";
import {
  IconBook,
  IconHeart,
  IconHorseshoe,
  IconTasks,
} from "../../components/Icons";
import { Accordion, VideoCard } from "./shared";
import { FFP_WALKTHROUGH_URL } from "./content";

function Pillar({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { code: string; text: string }[];
}) {
  return (
    <div className="pillar">
      <div className="pillar-head">
        <span className="acc-icon">{icon}</span>
        {title}
      </div>
      <ol>
        {items.map((it) => (
          <li key={it.code}>{it.text}</li>
        ))}
      </ol>
    </div>
  );
}

// Horse Training Philosophy — the walkthrough video, the Trifecta pillars, and
// the doctrine as collapsed accordions so it never reads as an essay.
export default function PhilosophyTab() {
  return (
    <div className="ref-section">
      <div className="banner" style={{ marginTop: 4 }}>
        <span>
          <strong>Pending verbatim handout.</strong> The doctrine below is a
          working summary — Wade Black's peer-reviewed "Foundation for
          Perfection" wording will replace it verbatim once supplied.
        </span>
      </div>

      <div className="video-grid">
        <VideoCard
          title="Wade Black walks through the Foundation for Perfection"
          url={FFP_WALKTHROUGH_URL}
          sub="Watch the doctrine explained in Wade's own words"
        />
      </div>

      <div>
        <h3 className="h-section">The Training Trifecta</h3>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px", maxWidth: 640 }}>
          The final evaluation at the end of training. Foundation and Task
          Completion split from the website's 15-item checklist; Temperament
          uses 5 driving factors.
        </p>
        <div className="pillar-grid">
          <Pillar
            icon={<IconHorseshoe size={18} />}
            title="Foundation"
            items={FOUNDATION_ITEMS}
          />
          <Pillar
            icon={<IconTasks size={18} />}
            title="Task Completion"
            items={TASK_COMPLETION_ITEMS}
          />
          <Pillar
            icon={<IconHeart size={18} />}
            title="Temperament"
            items={TEMPERAMENT_ITEMS}
          />
        </div>
      </div>

      <div>
        <h3 className="h-section">Foundation for Perfection doctrine</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FFP_SECTIONS.map((s, idx) => (
            <Accordion
              key={s.heading}
              icon={<IconBook size={18} />}
              title={s.heading}
              defaultOpen={idx === 0}
            >
              {s.body.map((p, i) => (
                <p
                  key={i}
                  style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}
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
                    gap: 5,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </Accordion>
          ))}
        </div>
      </div>
    </div>
  );
}
