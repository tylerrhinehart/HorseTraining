import { describe, expect, it } from "vitest";
import originalParagraphs from "./ffp-handout.json";
import { FFP_SECTIONS } from "./ffp";

describe("Wade's original doctrine", () => {
  it("retains every source paragraph exactly once, in source order", () => {
    expect(FFP_SECTIONS.flatMap((section) => section.body)).toEqual(originalParagraphs);
    expect(originalParagraphs.join("\n")).toContain("LACK OF COMMUNICAITON");
  });
});
