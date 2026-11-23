import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SessionNew from "./SessionNew";
import HorseDetail from "./HorseDetail";
import Today from "./Today";

const fixtures = vi.hoisted(() => ({
  enabled: true,
  program: "foundation",
  open: vi.fn(),
  refreshed: vi.fn(),
  queryError: null as Error | null,
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: "trainer" } }) }));
vi.mock("../auth/FacilityProvider", () => ({
  useFacility: () => ({ facility: { id: "facility", voice_enabled: fixtures.enabled } }),
}));
vi.mock("../components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("../features/ride-along/draftClient", () => ({
  closeDraft: vi.fn(), confirmGuidedScore: vi.fn(), getDraft: vi.fn(), openDraft: fixtures.open,
  saveDraft: vi.fn(), bindTurn: vi.fn(), transcribeTurn: vi.fn(),
}));
const phases = [
  { id: "ground", program: "foundation", code: "groundwork", name: "Groundwork", scale: "tqa", position: 0 },
  { id: "one", program: "foundation", code: "phase_1", name: "Phase 1", scale: "tqa", position: 1 },
  { id: "sale", program: "sale_horse", code: "performance_warmup", name: "Warm-up", scale: "five", position: 0 },
];
const foundationHorse = {
  id: "horse", name: "Synthetic mare", owner_name: "Trainer", status: "in_training",
  current_phase_id: "ground", training_type: "foundation", program_meta: {},
};
const saleHorse = { ...foundationHorse, current_phase_id: "sale", training_type: "sale_horse" };
const saleHorseWithOwnId = { ...saleHorse, id: "sale-horse", name: "Synthetic sale horse" };
const rides: unknown[] = [];
vi.mock("../supabase/useQuery", () => ({
  useQuery: (key: readonly string[] | null) => {
    let data;
    let error: Error | null = null;
    if (key?.[0] === "horse") data = fixtures.program === "foundation" ? foundationHorse : saleHorse;
    if (key?.[0] === "horses") data = [foundationHorse, saleHorseWithOwnId];
    if (key?.[0] === "phases") data = phases;
    if (key?.[0] === "sessions") data = rides;
    if (key?.[0] === "questions") {
      error = key[1] === "one" ? fixtures.queryError : null;
      if (!error) data = [{ id: key[1] + "-q", phase_id: key[1], axis: "foundation",
        position: 0, text: "Foundation question", low_label: "Low", high_label: "High" }];
    }
    return { data, loading: false, error, refresh: fixtures.refreshed };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.enabled = true;
  fixtures.program = "foundation";
  fixtures.queryError = null;
  fixtures.open.mockResolvedValue({
    id: "draft", facility_id: "facility", horse_id: "horse", phase_id: "one", status: "draft",
    occurred_at: new Date().toISOString(), notes: "", rider: "", ratings: [], version: 1,
    guided_cursor: 0, guided_question_ids: null,
  });
});
afterEach(cleanup);
const root = "/horses/horse";
function mount(path = root + "/sessions/new") {
  const router = createMemoryRouter([
    { path: "/", element: <Today /> },
    { path: "/horses/:id", element: <HorseDetail /> },
    { path: "/horses/:id/sessions/new", element: <SessionNew /> },
  ], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

it("takes a trainer from Today directly to Phase 1 voice scoring for the eligible horse", async () => {
  mount("/");
  expect(screen.getAllByRole("link", { name: "Start Ride" })).toHaveLength(2);
  const voice = await screen.findByRole("link", { name: "Score with voice" });
  expect(voice).toHaveAttribute("href", root + "/sessions/new?mode=voice");
  fireEvent.click(voice);
  expect(await screen.findByRole("button", { name: "Start or resume voice scoring" })).toBeEnabled();
  expect(screen.getByLabelText("Phase worked on this ride")).toHaveValue("one");
  expect(fixtures.open).not.toHaveBeenCalled();
});

it("keeps manual ride shortcuts on Today when the facility disables voice scoring", () => {
  fixtures.enabled = false;
  mount("/");
  expect(screen.getAllByRole("link", { name: "Start Ride" })).toHaveLength(2);
  expect(screen.queryByRole("link", { name: "Score with voice" })).toBeNull();
});

it("opens the scorer from the horse page even when the horse is on Groundwork", async () => {
  mount(root);
  fireEvent.click(await screen.findByRole("link", { name: "Score with voice" }));
  const start = await screen.findByRole("button", { name: "Start or resume voice scoring" });
  expect(screen.getByLabelText("Phase worked on this ride")).toHaveValue("one");
  expect(fixtures.open).not.toHaveBeenCalled();
  fireEvent.click(start);
  expect(await screen.findByRole("button", { name: "Record a score" })).toBeEnabled();
  expect(fixtures.open).toHaveBeenCalledWith("facility", "horse", "one", expect.any(String));
  expect(screen.getByRole("heading", { name: "Ride-along scorer" })).toHaveFocus();
});

it("lets a trainer choose Phase 1 for a normal ride and start scoring without treating the phase as an edit", async () => {
  mount();
  expect(screen.getByLabelText("Phase worked on this ride")).toHaveValue("ground");
  fireEvent.click(screen.getByRole("button", { name: "Set up Phase 1 voice scoring" }));
  fireEvent.click(screen.getByRole("button", { name: "Start or resume voice scoring" }));
  await waitFor(() => expect(fixtures.open).toHaveBeenCalledWith("facility", "horse", "one", expect.any(String)));
});

it("keeps unsaved notes intact and explains why a saved voice draft cannot be opened over them", () => {
  mount();
  fireEvent.change(screen.getByLabelText("Ride notes"), { target: { value: "Keep these notes" } });
  expect(screen.getByRole("button", { name: "Set up Phase 1 voice scoring" })).toBeDisabled();
  expect(screen.getByText(/Finish this ride manually to keep your edits/)).toBeInTheDocument();
  expect(screen.getByLabelText("Ride notes")).toHaveValue("Keep these notes");
  expect(fixtures.open).not.toHaveBeenCalled();
});

it("explains unavailable voice on an explicit link when the facility has disabled it", () => {
  fixtures.enabled = false;
  mount(root + "/sessions/new?mode=voice");
  expect(screen.getByText(/Ask your platform administrator/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start or resume voice scoring" })).toBeNull();
});

it("explains the supported program and leaves another program on its own sheet", () => {
  fixtures.program = "sale_horse";
  mount(root + "/sessions/new?mode=voice");
  expect(screen.getByText(/Use the manual score sheet for this horse/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start or resume voice scoring" })).toBeNull();
});

it("shows a draft startup error beside the entry point", async () => {
  fixtures.open.mockRejectedValueOnce(new Error("Draft unavailable."));
  mount(root + "/sessions/new?mode=voice");
  fireEvent.click(await screen.findByRole("button", { name: "Start or resume voice scoring" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Draft unavailable.");
});
