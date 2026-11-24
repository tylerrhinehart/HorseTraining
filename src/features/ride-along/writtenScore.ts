const MAGNITUDES = ["zero", "one", "two", "three"];
const SCORE = /^(?:score(?:\s*:\s*|\s+))?(?:([+-])\s*|(plus|minus|positive|negative)\s+)?([0-3]|zero|one|two|three)$/;

/** Parses one complete written score. A bare magnitude is positive, and zero has no sign. */
export function parseWrittenRideScore(input: string): number | null {
  const answer = input
    .trim()
    .toLowerCase()
    .replace(/[＋﹢]/g, "+")
    .replace(/[−‐‑‒–—﹣－]/g, "-")
    .replace(/[０-３]/g, digit => String("０１２３".indexOf(digit)))
    .replace(/[.!。！]+$/, "")
    .trimEnd();
  const match = SCORE.exec(answer);
  if (!match) return null;

  const [, symbol, sign, magnitude] = match;
  const score = magnitude.length === 1 ? Number(magnitude) : MAGNITUDES.indexOf(magnitude);
  const negative = symbol === "-" || sign === "minus" || sign === "negative";
  return negative && score !== 0 ? -score : score;
}
