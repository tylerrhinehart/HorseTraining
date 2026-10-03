import { describe, expect, it } from "vitest";
import { programFormDefaults, programMetaFromForm } from "./HorseProgramFields";

describe("horse log metadata", () => {
  it("round trips goals and original form fields while retaining weekly notes and dormant sale data", () => {
    const existing = { training_goals: ["heading", "fence_work"], weekly_comments: { "2026-09-28": "Progress" }, purchase_price: 1200, sale_date: "2026-12-01", estimated_rides: 30, payment_amount: 0, foundation_subtype: "colt_starting" };
    const values = { ...programFormDefaults(existing), training_type: "foundation" as const };
    expect(programMetaFromForm(values, existing)).toEqual(existing);
  });
  it("does not silently normalize zero, historical scores or unknown metadata", () => {
    const existing = { weekly_comments: { "2026-09-28": "Keep" }, future_field: "retained" };
    const result = programMetaFromForm({ training_type: "sale_horse", purchase_price: "0", estimated_rides: "0", training_goals: ["heading", "heading", "heeling"] }, existing);
    expect(result).toEqual({ ...existing, purchase_price: 0, estimated_rides: 0, training_goals: ["heading", "heeling"] });
  });
  it("accepts an untouched checkbox group with no optional goals", () => {
    const values = { training_type: "sale_horse", training_goals: false } as unknown as import("./HorseProgramFields").HorseProgramForm;
    expect(programMetaFromForm(values).training_goals).toEqual([]);
  });
  it("rejects inverted prices and invalid quantities before a write", () => {
    expect(() => programMetaFromForm({ training_type: "sale_horse", price_low: "100", price_high: "50" })).toThrow("low target price");
    expect(() => programMetaFromForm({ training_type: "sale_horse", estimated_rides: "2.5" })).toThrow("whole number");
    expect(() => programMetaFromForm({ training_type: "foundation", payment_amount: "-1" })).toThrow("non-negative");
  });
});
