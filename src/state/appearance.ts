import { useSyncExternalStore } from "react";

// Theme + density preferences. The CSS variants already exist in index.css
// ([data-theme], [data-density]); this module owns persistence + application.

export type ThemeId = "ranch" | "dust" | "midnight" | "bone";
export type DensityId = "comfortable" | "cozy" | "compact";

export const THEMES: { id: ThemeId; label: string; note: string }[] = [
  { id: "ranch", label: "Ranch", note: "Warm paper & leather (default)" },
  { id: "dust", label: "Dust", note: "Deeper earth tones" },
  { id: "midnight", label: "Midnight", note: "Dark — easy on night checks" },
  { id: "bone", label: "Bone", note: "Bright, near-white" },
];

export const DENSITIES: { id: DensityId; label: string; note: string }[] = [
  { id: "comfortable", label: "Comfortable", note: "Default spacing" },
  { id: "cozy", label: "Cozy", note: "A little more air" },
  { id: "compact", label: "Compact", note: "Fit more on screen" },
];

const THEME_KEY = "tqa.theme";
const DENSITY_KEY = "tqa.density";

let listeners: (() => void)[] = [];
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
};

function readTheme(): ThemeId {
  const v = localStorage.getItem(THEME_KEY);
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : "ranch";
}

function readDensity(): DensityId {
  const v = localStorage.getItem(DENSITY_KEY);
  return DENSITIES.some((d) => d.id === v) ? (v as DensityId) : "comfortable";
}

function apply() {
  const root = document.documentElement;
  const theme = readTheme();
  const density = readDensity();
  if (theme === "ranch") delete root.dataset.theme;
  else root.dataset.theme = theme;
  if (density === "comfortable") delete root.dataset.density;
  else root.dataset.density = density;
}

/** Call once at startup, before first paint. */
export function initAppearance() {
  try {
    apply();
  } catch {
    // localStorage unavailable (private mode etc.) — defaults apply.
  }
}

export function setTheme(id: ThemeId) {
  localStorage.setItem(THEME_KEY, id);
  apply();
  emit();
}

export function setDensity(id: DensityId) {
  localStorage.setItem(DENSITY_KEY, id);
  apply();
  emit();
}

export function useAppearance(): { theme: ThemeId; density: DensityId } {
  const theme = useSyncExternalStore(subscribe, readTheme);
  const density = useSyncExternalStore(subscribe, readDensity);
  return { theme, density };
}
