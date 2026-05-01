import {
  addDays as fnsAddDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";

/** Returns today's date as a YYYY-MM-DD string in the user's local timezone. */
export function todayLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Adds (or subtracts) `days` from a YYYY-MM-DD string and returns YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return format(fnsAddDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Inclusive day index relative to startDate (day 1 = startDate itself). */
export function trainingDayNumber(startDate: string, date: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(startDate)) + 1;
}

/** Computes the end (last) date of training given start + duration days. */
export function endDate(startDate: string, durationDays: number): string {
  return addDays(startDate, durationDays - 1);
}

/** Returns true if today is on or after the end date. */
export function isTrainingComplete(
  startDate: string,
  durationDays: number,
  today = todayLocal(),
): boolean {
  return today.localeCompare(endDate(startDate, durationDays)) >= 0;
}

export function formatHumanDate(date: string): string {
  return format(parseISO(date), "EEE, MMM d, yyyy");
}

export function formatShortDate(date: string): string {
  return format(parseISO(date), "MMM d");
}

/** Returns array of YYYY-MM-DD for each day of the training window. */
export function trainingDates(
  startDate: string,
  durationDays: number,
): string[] {
  return Array.from({ length: durationDays }, (_, i) => addDays(startDate, i));
}
