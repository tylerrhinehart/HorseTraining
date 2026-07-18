import type { CSSProperties } from "react";

export function Skeleton({
  w,
  h,
  round,
  style,
}: {
  w?: number | string;
  h?: number | string;
  round?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={round ? "skeleton skeleton-avatar" : "skeleton"}
      aria-hidden="true"
      style={{ width: w, height: h, ...style }}
    />
  );
}

export function SkeletonText({
  lines = 2,
  w = "100%",
}: {
  lines?: number;
  w?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          h={12}
          w={i === lines - 1 && lines > 1 ? "60%" : w}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" aria-hidden="true">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Skeleton w={44} h={44} round />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton h={14} w="50%" />
          <Skeleton h={12} w="30%" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}
