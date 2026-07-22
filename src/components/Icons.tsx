// Small inline SVG icon set. One stroke style (1.8, round caps) so icons read
// as a single family anywhere they appear.

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconCompass({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

export function IconScale({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M12 3v18M5 7l7-4 7 4" />
      <path d="M3 13a2.5 2.5 0 0 0 5 0L5.5 8zM16 13a2.5 2.5 0 0 0 5 0L18.5 8z" />
    </svg>
  );
}

export function IconCoins({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  );
}

export function IconLayers({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function IconPlay({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5 3.5-5 3.5z" />
    </svg>
  );
}

export function IconBook({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
    </svg>
  );
}

export function IconCheck({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function IconClock({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconLink({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M10 14a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 1 0-7.07-7.07L11 5.9" />
      <path d="M14 10a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 1 0 7.07 7.07L13 18.1" />
    </svg>
  );
}

export function IconQuestion({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2A2.8 2.8 0 0 1 12 7.2c1.55 0 2.8 1.1 2.8 2.5 0 1.9-2.8 2.1-2.8 4" />
      <circle cx="12" cy="16.9" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChevron({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function IconHorseshoe({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M5 20v-8a7 7 0 0 1 14 0v8" />
      <path d="M3.5 17.5h3M17.5 17.5h3" />
    </svg>
  );
}

export function IconRibbon({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.8 13.5-2 7 5.2-3 5.2 3-2-7" />
    </svg>
  );
}

export function IconHeart({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M12 20.5S3.5 15.5 3.5 9.6A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.6c0 5.9-8.5 10.9-8.5 10.9z" />
    </svg>
  );
}

export function IconTasks({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5" />
      <path d="M11.5 6H21M11.5 12H21M11.5 18H21" />
    </svg>
  );
}
