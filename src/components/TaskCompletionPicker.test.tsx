import { useState } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TaskCompletionPicker from "./TaskCompletionPicker";
import type { TaskCompletion } from "../supabase/types";

afterEach(cleanup);

function Picker({ initial = [] }: { initial?: TaskCompletion[] }) {
  const [value, setValue] = useState(initial);
  return <><TaskCompletionPicker value={value} onChange={setValue} /><output data-testid="selection">{JSON.stringify(value)}</output></>;
}

describe("trainer task selection", () => {
  it("records Fence Work phase 2 and Heading phase 3 independently", () => {
    render(<Picker />);
    fireEvent.click(screen.getByRole("button", { name: "Fence Work, Phase 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading, Phase 3" }));
    expect(JSON.parse(screen.getByTestId("selection").textContent!)).toEqual([
      { job: "fence_work", phase: 2 }, { job: "heading", phase: 3 },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Heading, Phase 1" }));
    expect(screen.getByRole("button", { name: "Fence Work, Phase 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Heading, Phase 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("retains combined historical jobs when editing another task", () => {
    render(<Picker initial={[{ job: "rope_heading_heeling", phase: 2 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Breakaway, Phase 4" }));
    expect(JSON.parse(screen.getByTestId("selection").textContent!)).toEqual([
      { job: "rope_heading_heeling", phase: 2 }, { job: "breakaway", phase: 4 },
    ]);
  });
});
