import { describe, expect, it } from "vitest";
import { parseWrittenRideScore } from "./writtenScore";

describe("parseWrittenRideScore", () => {
  it.each([
    ["0", 0],
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["zero", 0],
    ["one", 1],
    ["two", 2],
    ["THREE", 3],
    ["+1", 1],
    ["+ 2", 2],
    ["+three", 3],
    ["-1", -1],
    ["- two", -2],
    ["−3", -3],
    ["－３", -3],
    ["＋２", 2],
    ["—1", -1],
    ["– 3", -3],
    ["plus one", 1],
    ["plus 2", 2],
    ["positive three", 3],
    ["  PoSiTiVe 2!  ", 2],
    ["negative 1.", -1],
    ["negative TWO", -2],
    ["\tminus\nthree .! ", -3],
    ["2。", 2],
    ["-0", 0],
    ["− zero", 0],
    ["+ 0", 0],
    ["positive zero", 0],
    ["negative zero", 0],
    ["score +3", 3],
    ["score: +3", 3],
    ["score:3", 3],
    [" \tSCORE :\nnegative TWO ! ", -2],
    ["score zero.", 0],
  ])("records the exact score %j as %s", (input, expected) => {
    expect(parseWrittenRideScore(input)).toBe(expected);
  });

  it.each([
    "", "   ", "positive", "negative", "+", "−", "?", "2?", "minus one?",
    "4", "+4", "-4", "negative four", "30", "03", "2.0", "2,5", "1/2", "2½", "2e0",
    "1–3", "2 to 3", "2 or 3", "2, 3", "two\nthree", "+2 -1", "+-1", "plus -1",
    "negative +1", "negative minus one", "3 out of 5", "not 3", "probably minus two",
    "it felt negative", "pleased with three steps", "great ride", "I'd give -2",
    "score", "score:", "score3", "score = 3", "score: +3?", "score: +3 or +2",
    "score: 3.0", "score: score: 3", "final score: 3",
  ])("leaves non-exact input %j for interpretation", input => {
    expect(parseWrittenRideScore(input)).toBeNull();
  });
});
