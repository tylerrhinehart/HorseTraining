export type TemperamentChoice = "now" | "later";

export function parseTemperamentChoice(text: string): TemperamentChoice | null {
  const answer = text.trim().toLowerCase().replace(/[.!]+$/, "").trimEnd().replace(/\s+/g, " ");
  if (/^(yes|yes,? please|now|score (them|temperament)( now)?)$/.test(answer)) return "now";
  if (/^(no|no,? thanks|later|not now|score (them|temperament) later)$/.test(answer)) return "later";
  return null;
}
