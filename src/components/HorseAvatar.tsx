interface Props {
  name: string;
  /** Hue 0–360 for the gradient; if absent, derived from name. */
  tone?: number;
  size?: number;
  className?: string;
}

export function hashTone(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function gradientFor(tone: number): string {
  return `linear-gradient(135deg, oklch(0.55 0.07 ${tone}), oklch(0.35 0.08 ${(tone + 30) % 360}))`;
}

export default function HorseAvatar({
  name,
  tone,
  size = 32,
  className,
}: Props) {
  const t = tone ?? hashTone(name);
  return (
    <span
      className={["brand-mark", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        background: gradientFor(t),
        borderColor: "transparent",
        color: "var(--paper)",
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
