import type { Phase } from "../supabase/types";

export const ADVANCE_THRESHOLD = 2; // TQA "industry standard" baseline.
export const WINDOW_SIZE = 7;       // 7-session rolling average.

export function computePhaseAverage(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

export function computeRollingAverage(sessionAverages: number[]): number | null {
  const window = sessionAverages.slice(-WINDOW_SIZE);
  return computePhaseAverage(window);
}

export function isAtOrAboveStandard(avg: number | null): boolean {
  return avg != null && avg >= ADVANCE_THRESHOLD;
}

export function nextPhase(current: Phase, phases: Phase[]): Phase | null {
  const ordered = [...phases].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((p) => p.id === current.id);
  return idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
}

export function prevPhase(current: Phase, phases: Phase[]): Phase | null {
  const ordered = [...phases].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((p) => p.id === current.id);
  return idx > 0 ? ordered[idx - 1] : null;
}
