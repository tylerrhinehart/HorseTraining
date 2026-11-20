import type { Question } from "../../supabase/types";

export const VOICE_PHASE = "phase_1";
const aliases = [
  ["Good to Catch", ["good to catch", "catching"]],
  ["Stand to Saddle and Accept Bridle", ["stand to saddle", "accept bridle"]],
  ["Horizontal Direction & Stage 1 (on the ground", ["horizontal direction on the ground", "ground horizontal direction"]],
  ["Horizontal Direction & Stage 1 (on their side", ["horizontal direction on their back", "mounted horizontal direction"]],
  ["Stand to Get On", ["stand to get on", "stand for mounting"]],
  ["Doubling Walking", ["doubling", "doubling walking trotting and loping"]],
  ["Move Out Soft In a Lope", ["move out soft in a lope", "soft lope"]],
  ["Stage 2 w/ Willing Submission (standing)", ["stage two standing", "stage 2 standing"]],
] as const;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[−–—]/g, "-").replace(/[^\p{L}\p{N}\s+-]/gu, " ").trim().replace(/\s+/g, " ");

const scores: Record<string, number> = {
  "minus three": -3, "minus two": -2, "minus one": -1,
  "negative three": -3, "negative two": -2, "negative one": -1,
  "-3": -3, "-2": -2, "-1": -1, "minus 3": -3, "minus 2": -2, "minus 1": -1,
  "negative 3": -3, "negative 2": -2, "negative 1": -1,
  "zero": 0, "0": 0,
  "plus one": 1, "plus two": 2, "plus three": 3,
  "positive one": 1, "positive two": 2, "positive three": 3,
  "+1": 1, "+2": 2, "+3": 3, "plus 1": 1, "plus 2": 2, "plus 3": 3,
  "positive 1": 1, "positive 2": 2, "positive 3": 3,
};

export interface VoiceScore { questionId: string; label: string; score: number }

export function parseVoiceScore(transcript: string, questions: Question[]): VoiceScore | null {
  // Preserve decimal separators as invalid input rather than changing their meaning.
  if (transcript.length > 200 || /\d[.,]\d/.test(transcript)) return null;
  const phrase = normalize(transcript).replace(/^score /, "");
  const matches: VoiceScore[] = [];
  for (const q of questions) {
    if (q.axis !== "foundation") continue;
    const entry = aliases[q.position];
    if (!entry || !normalize(q.text).startsWith(normalize(entry[0]))) continue;
    for (const name of new Set([...entry[1], normalize(q.text)])) {
      if (!phrase.startsWith(name + " ")) continue;
      const tail = phrase.slice(name.length + 1).replace(/^score /, "").replace(/^([+-]) /, "$1");
      if (Object.hasOwn(scores, tail)) matches.push({ questionId: q.id, label: q.text, score: scores[tail] });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

export function scoreReadback(proposal: VoiceScore) {
  const value = ["zero", "one", "two", "three"][Math.abs(proposal.score)];
  const sign = proposal.score === 0 ? "" : proposal.score < 0 ? "minus " : "plus ";
  return `${proposal.label}, ${sign}${value}. Confirm or discard.`;
}
