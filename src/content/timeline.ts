// Recommended ride cadences and the 8-week phase timeline, taken from the
// public Foundation page on trainingqualityassurance.org.

export interface RideCadenceOption {
  label: string;
  total_days: number;
  span_days: number;
  pattern: string;
  description: string;
}

export const RIDE_CADENCE_OPTIONS: RideCadenceOption[] = [
  {
    label: "Option 1",
    total_days: 40,
    span_days: 60,
    pattern: "Ridden 5 days in a row, given 2 days off",
    description: "40 days training in two months (60 days)",
  },
  {
    label: "Option 2",
    total_days: 52,
    span_days: 60,
    pattern: "Ridden 6 days in a row, given 1 day off",
    description: "52 days training in two months (60 days)",
  },
  {
    label: "Option 3",
    total_days: 46,
    span_days: 90,
    pattern: "Ridden 4 days in a row, given 3 days off",
    description: "40–52 days training in three months (90 days)",
  },
];

export interface PhaseTimelineBlock {
  label: string;
  weeks: number;
}

export const PHASE_TIMELINE: PhaseTimelineBlock[] = [
  { label: "Groundwork + Phase 1", weeks: 2 },
  { label: "Phase 2", weeks: 2 },
  { label: "Phase 3", weeks: 2 },
  { label: "Phase 4", weeks: 2 },
];

export const TOTAL_WEEKS = PHASE_TIMELINE.reduce((s, b) => s + b.weeks, 0);
