import { describe, expect, it } from "vitest";
import { formatHumanDate, formatShortDate } from "./dates";

describe("dates", () => {
  it("formats short YYYY-MM-DD as a human date", () => {
    expect(formatHumanDate("2025-01-10")).toMatch(/Jan 10, 2025/);
  });

  it("formats short YYYY-MM-DD as a short date", () => {
    expect(formatShortDate("2025-01-10")).toBe("Jan 10");
  });
});
