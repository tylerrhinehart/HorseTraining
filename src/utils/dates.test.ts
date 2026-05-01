import { describe, expect, it } from "vitest";
import {
  addDays,
  endDate,
  isTrainingComplete,
  trainingDates,
  trainingDayNumber,
} from "./dates";

describe("dates", () => {
  it("addDays handles forward and backward shifts", () => {
    expect(addDays("2025-01-10", 5)).toBe("2025-01-15");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
  });

  it("trainingDayNumber treats start as day 1", () => {
    expect(trainingDayNumber("2025-01-10", "2025-01-10")).toBe(1);
    expect(trainingDayNumber("2025-01-10", "2025-01-12")).toBe(3);
    expect(trainingDayNumber("2025-01-10", "2025-01-09")).toBe(0);
  });

  it("endDate is inclusive (start + duration - 1)", () => {
    expect(endDate("2025-01-10", 20)).toBe("2025-01-29");
    expect(endDate("2025-01-10", 1)).toBe("2025-01-10");
  });

  it("trainingDates returns one date per training day", () => {
    const dates = trainingDates("2025-01-10", 3);
    expect(dates).toEqual(["2025-01-10", "2025-01-11", "2025-01-12"]);
  });

  it("isTrainingComplete flips on the end date", () => {
    expect(isTrainingComplete("2025-01-10", 20, "2025-01-28")).toBe(false);
    expect(isTrainingComplete("2025-01-10", 20, "2025-01-29")).toBe(true);
    expect(isTrainingComplete("2025-01-10", 20, "2025-02-15")).toBe(true);
  });
});
