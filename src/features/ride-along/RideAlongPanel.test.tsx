import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Question } from "../../supabase/types";
import RideAlongPanel from "./RideAlongPanel";
import { transcribeTurn } from "./draftClient";

vi.mock("./draftClient", () => ({ transcribeTurn: vi.fn() }));

const question: Question = {
  id: "q-doubling", facility_id: "facility", user_id: "trainer", phase_id: "phase", position: 5,
  axis: "foundation", text: "Doubling Walking, Trotting and Loping", low_label: "", high_label: "", created_at: "",
};
const trackStop = vi.fn();
class Recorder {
  static isTypeSupported = () => true;
  state = "inactive";
  ondataavailable?: (e: { data: Blob }) => void;
  onstop?: () => void;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["sample"]) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.mocked(transcribeTurn).mockReset();
  trackStop.mockClear();
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("crypto", { randomUUID: () => "utterance-1" });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) },
    configurable: true,
  });
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
  Reflect.deleteProperty(document, "hidden");
});

function mount(onConfirm = vi.fn(async () => {})) {
  const view = render(<RideAlongPanel draftId="d" questions={[question]} disabled={false}
    onBusy={vi.fn()} onConfirm={onConfirm} />);
  return { ...view, onConfirm };
}

async function record() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record a score" })); });
  const stop = await screen.findByRole("button", { name: "Stop and transcribe" });
  await act(async () => { fireEvent.click(stop); });
}

it("turns off the microphone before applying a score and requires explicit confirmation", async () => {
  vi.mocked(transcribeTurn).mockResolvedValue("Doubling minus two");
  const { onConfirm } = mount();
  await record();
  const confirm = await screen.findByRole("button", { name: "Confirm score" });
  expect(trackStop).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByText(/minus two. Confirm or discard/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(confirm); });
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ questionId: "q-doubling", score: -2 }), "utterance-1"));
});

it("ignores late transcription even when an upstream mock does not honor abort", async () => {
  let complete: (value: string) => void = () => {};
  vi.mocked(transcribeTurn).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const { onConfirm } = mount();
  await record();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel transcription" }));
  expect(vi.mocked(transcribeTurn).mock.calls[0][3].aborted).toBe(true);
  await act(async () => complete("Doubling plus two"));
  expect(screen.queryByRole("button", { name: "Confirm score" })).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("stops capture without uploading when the document goes into the background", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Record a score" }));
  await screen.findByRole("button", { name: "Stop and transcribe" });
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(trackStop).toHaveBeenCalled();
  expect(transcribeTurn).not.toHaveBeenCalled();
});
