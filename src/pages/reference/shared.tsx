import type { ReactNode } from "react";
import { IconChevron, IconLink, IconPlay } from "../../components/Icons";

// ─── YouTube helpers ─────────────────────────────────────────────────────────

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{6,})/,
  );
  return m ? m[1] : null;
}

export function VideoCard({
  title,
  url,
  sub,
}: {
  title: string;
  url: string;
  sub?: string | null;
}) {
  const id = youtubeId(url);
  return (
    <a className="video-card" href={url} target="_blank" rel="noreferrer">
      <div className="video-thumb">
        {id && (
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <span className="play-badge">
          <span>
            <IconPlay size={24} />
          </span>
        </span>
      </div>
      <div className="video-body">
        <span className="video-title">{title}</span>
        {sub && <span className="video-sub">{sub}</span>}
      </div>
    </a>
  );
}

export function LinkRow({
  title,
  url,
  sub,
}: {
  title: string;
  url: string;
  sub?: string | null;
}) {
  return (
    <a className="link-row" href={url} target="_blank" rel="noreferrer">
      <span style={{ color: "var(--leather)", flexShrink: 0, display: "flex" }}>
        <IconLink size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, display: "block" }}>{title}</span>
        {sub && (
          <span className="muted" style={{ fontSize: 12, display: "block" }}>
            {sub}
          </span>
        )}
      </span>
    </a>
  );
}

// ─── Accordion ───────────────────────────────────────────────────────────────

export function Accordion({
  icon,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="acc" open={defaultOpen}>
      <summary>
        {icon && <span className="acc-icon">{icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="acc-title">{title}</span>
          {meta && <span className="acc-meta">{meta}</span>}
        </span>
        <span className="acc-chev">
          <IconChevron size={18} />
        </span>
      </summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

// ─── Score-scale visualization ───────────────────────────────────────────────

type ChipColor = { bg: string; fg: string };

// Foundation −3…+3: green/red saturation ramps with magnitude.
export function foundationChip(v: number): ChipColor {
  if (v === 0) return { bg: "var(--neutral)", fg: "var(--paper)" };
  const tone = v > 0 ? "var(--ok)" : "var(--bad)";
  const mix = Math.abs(v) === 3 ? 100 : Math.abs(v) === 2 ? 78 : 56;
  return {
    bg: `color-mix(in oklab, ${tone} ${mix}%, var(--paper))`,
    fg: mix >= 78 ? "var(--paper)" : "var(--ink)",
  };
}

// Performance quality 1…5: poor→excellent ramp.
export function qualityChip(v: number): ChipColor {
  switch (v) {
    case 1:
      return { bg: "var(--bad)", fg: "var(--paper)" };
    case 2:
      return {
        bg: "color-mix(in oklab, var(--bad) 55%, var(--paper))",
        fg: "var(--ink)",
      };
    case 3:
      return { bg: "var(--gold)", fg: "var(--paper)" };
    case 4:
      return {
        bg: "color-mix(in oklab, var(--ok) 72%, var(--paper))",
        fg: "var(--paper)",
      };
    default:
      return { bg: "var(--ok)", fg: "var(--paper)" };
  }
}

// Temperament frequency 1…5: intensity ramp (frequency, not good/bad).
export function frequencyChip(v: number): ChipColor {
  const mix = Math.min(100, 25 + (v - 1) * 19); // 25 → 100
  return {
    bg: `color-mix(in oklab, var(--leather) ${mix}%, var(--paper))`,
    fg: mix >= 63 ? "var(--paper)" : "var(--ink)",
  };
}

export function ScaleViz({
  values,
  legend,
  chip,
  format,
}: {
  values: readonly number[];
  legend: Record<number, string>;
  chip: (v: number) => ChipColor;
  format?: (v: number) => string;
}) {
  return (
    <div className="scale-viz">
      {values.map((v) => {
        const c = chip(v);
        return (
          <div key={v} className="scale-viz-row">
            <span
              className="scale-chip"
              style={{ background: c.bg, color: c.fg }}
            >
              {format ? format(v) : v}
            </span>
            <span className="scale-viz-label">{legend[v]}</span>
          </div>
        );
      })}
    </div>
  );
}
