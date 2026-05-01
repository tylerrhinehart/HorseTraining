import { format, parseISO } from "date-fns";

export function todayLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatHumanDate(input: string): string {
  return format(parseDateLike(input), "EEE, MMM d, yyyy");
}

export function formatShortDate(input: string): string {
  return format(parseDateLike(input), "MMM d");
}

export function formatDateTime(input: string): string {
  return format(parseDateLike(input), "MMM d, yyyy h:mm a");
}

function parseDateLike(input: string): Date {
  // Accept either YYYY-MM-DD or full ISO strings.
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? parseISO(input) : new Date(input);
}
