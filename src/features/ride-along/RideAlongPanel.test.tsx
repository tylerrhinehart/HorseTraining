import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Question } from "../../supabase/types";
import RideAlongPanel from "./RideAlongPanel";
import { useVoiceCall } from "./useVoiceCall";
import { bindTurn, interpretTurn, type RideDraft } from "./draftClient";
import { openVoiceCapture } from "./voiceCapture";
import type { TurnBinding } from "./voiceCommand";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../supabase/facilityScope", () => ({
  captureFacilityScope: () => ({ signal: new AbortController().signal, client: () => ({ functions: { invoke } }) }),
}));
vi.mock("./draftClient", () => ({ bindTurn: vi.fn(), interpretTurn: vi.fn() }));
vi.mock("./voiceCapture", () => ({ openVoiceCapture: vi.fn() }));

const first: Question = {
  id: "q1", facility_id: "facility", user_id: "trainer", phase_id: "phase", position: 1,
  axis: "foundation", text: "Good to Catch (Review Groundwork)", low_label: "", high_label: "", created_at: "",
};
const second = { ...first, id: "q2", position: 2, text: "Stand to Saddle and Accept Bridle" };
const draft: RideDraft = {
  id: "d", version: 1, guided_cursor: 0, guided_question_ids: [first.id, second.id], ratings: [],
  facility_id: "facility", horse_id: "horse", phase_id: "phase", status: "draft", session_id: null,
  occurred_at: "2026-01-01T12:00:00Z", notes: null, rider: null, bit: null, task_completions: [],
  stage_notes: {}, active_voice_turn: null,
};
let deliver: ((audio: Blob) => void) | undefined;
const listen = vi.fn((callback: (audio: Blob) => void) => { deliver = callback; });
const pause = vi.fn(() => { deliver = undefined; });
const close = vi.fn(() => { deliver = undefined; });
const playReadback = vi.fn(async (_audio: ArrayBuffer, _signal: AbortSignal, onPlaying: () => void) => { onPlaying(); });

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ error: new Error("No readback in fixture") });
  vi.mocked(interpretTurn).mockReset();
  vi.mocked(bindTurn).mockReset().mockImplementation(async (d, q, t) => ({
    draft_id: d.id, question_id: q, version: d.version, turn_id: t,
  }));
  vi.mocked(openVoiceCapture).mockReset().mockImplementation(async signal => {
    signal.addEventListener("abort", close, { once: true });
    return { listen, pause, close, playReadback };
  });
  listen.mockClear();
  pause.mockClear();
  close.mockClear();
  playReadback.mockClear();
  deliver = undefined;
  let turn = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `utterance-${++turn}` });
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "hidden");
});

function CallPanel(props: Omit<ComponentProps<typeof RideAlongPanel>, "microphone">) {
  const microphone = useVoiceCall();
  return <RideAlongPanel {...props} microphone={microphone} />;
}
type PanelProps = ComponentProps<typeof CallPanel>;

function mount(overrides: Partial<PanelProps> = {}) {
  const onRecord = vi.fn<PanelProps["onRecord"]>().mockResolvedValue(undefined);
  const props: PanelProps = {
    draft, questions: [first, second], horseName: "Synthetic horse", open: true, disabled: false,
    returnFocus: { current: null }, onReview: vi.fn(), onBusy: vi.fn(), onRecord, ...overrides,
  };
  const view = render(<CallPanel {...props} />);
  return { ...view, onRecord, props };
}

const mic = () => screen.getByRole("button", { name: "Microphone and readback" });
const log = () => within(screen.getByRole("log", { name: "Scoring conversation" }));
const textbox = () => screen.getByRole("textbox", { name: "Type a message" });

function enter(text: string) {
  fireEvent.change(textbox(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
async function unmute() {
  fireEvent.click(mic());
  await screen.findByText("Listening for a score");
}
async function record() {
  await unmute();
  await act(async () => { deliver?.(new Blob(["synthetic"], { type: "audio/wav" })); });
}
function nextDraft(score: number): RideDraft {
  return { ...draft, version: 2, guided_cursor: 1, ratings: [{
    question_id: first.id, score, axis: first.axis, question_text_snapshot: first.text,
  }] };
}

it.each([["3", 3], ["positive three", 3], ["negative TWO", -2], ["－１", -1], ["-0", 0], ["zero", 0]])(
  "records typed %s without a provider or confirmation",
  async (text, score) => {
    const { onRecord } = mount();
    expect(textbox()).toBeVisible();
    enter(text);
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ questionId: first.id, score }), "utterance-1"));
    expect(interpretTurn).not.toHaveBeenCalled();
    expect(openVoiceCapture).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  },
);

it.each(["two or three", "negative", "4", "2.5", "+2?", "3" + " ".repeat(200) + "−2"])(
  "keeps invalid written input %s on the same question without an inference or write",
  text => {
    const { onRecord } = mount();
    enter(text);
    expect(log().getByText("Give me one score, like 3, −1, or 0.")).toBeVisible();
    expect(bindTurn).not.toHaveBeenCalled();
    expect(interpretTurn).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
  },
);

it("records a tapped score once and advances only when the durable draft changes", async () => {
  const { rerender, props, onRecord } = mount();
  const button = screen.getByRole("button", { name: "Record minus three" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1));
  expect(log().getByText("−3", { selector: ".ride-chat-score-value" })).toBeVisible();
  expect(log().queryByText("✓ Recorded")).not.toBeInTheDocument();
  expect(screen.getByText("Question 1 of 2")).toBeVisible();
  expect(interpretTurn).not.toHaveBeenCalled();

  rerender(<CallPanel {...props} draft={nextDraft(-3)} />);
  expect(screen.getByText("Question 2 of 2")).toBeVisible();
  expect(log().getByText("✓ Recorded")).toBeVisible();
  expect(log().getAllByRole("heading")).toHaveLength(1);
  expect(log().queryByText(/from −3 to \+3/)).not.toBeInTheDocument();
});

it("binds before listening and records a clear voice response on its bound turn without confirmation", async () => {
  vi.mocked(interpretTurn).mockResolvedValue({ transcript: "minus two", score: -2 });
  const { onRecord } = mount();
  await record();
  await waitFor(() => expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
    questionId: first.id, score: -2, binding: expect.objectContaining({ turn_id: "utterance-1" }),
  }), "utterance-1"));
  expect(vi.mocked(bindTurn).mock.invocationCallOrder[0]).toBeLessThan(listen.mock.invocationCallOrder[0]);
  expect(pause).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
});

it("clarifies an uncertain voice result, rebinds for a new clip, and resumes the same mic after saving", async () => {
  vi.mocked(interpretTurn)
    .mockResolvedValueOnce({ transcript: "plus one or minus two", score: null })
    .mockResolvedValueOnce({ transcript: "plus two", score: 2 });
  const { onRecord, props, rerender } = mount();
  await record();
  expect(await log().findByText(/couldn’t tell which score/)).toBeVisible();
  expect(onRecord).not.toHaveBeenCalled();
  expect(screen.getByText("Question 1 of 2")).toBeVisible();
  await screen.findByText("Listening for a score");
  await act(async () => { deliver?.(new Blob(["another clip"])); });
  await waitFor(() => expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ score: 2 }), "utterance-2"));
  rerender(<CallPanel {...props} draft={nextDraft(2)} />);
  await screen.findByText("Listening for a score");
  expect(openVoiceCapture).toHaveBeenCalledTimes(1);
  expect(bindTurn).toHaveBeenLastCalledWith(expect.objectContaining({ version: 2 }), second.id, "utterance-3");
});

it("shares an in-flight microphone binding with a typed answer and never arms that recording", async () => {
  let bound!: (value: TurnBinding) => void;
  vi.mocked(bindTurn).mockImplementationOnce(() => new Promise(resolve => { bound = resolve; }));
  const { onRecord } = mount();
  fireEvent.click(mic());
  await waitFor(() => expect(bindTurn).toHaveBeenCalledTimes(1));
  enter("positive two");
  expect(bindTurn).toHaveBeenCalledTimes(1);
  await act(async () => bound({ draft_id: draft.id, question_id: first.id, version: 1, turn_id: "utterance-1" }));
  expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ score: 2 }), "utterance-1");
  expect(listen).not.toHaveBeenCalled();
});

it("lets typed scoring supersede a late provider response", async () => {
  let deliverResult!: (value: { transcript: string; score: number }) => void;
  vi.mocked(interpretTurn).mockImplementationOnce(() => new Promise(resolve => { deliverResult = resolve; }));
  const { onRecord } = mount();
  await record();
  enter("one");
  expect(vi.mocked(interpretTurn).mock.calls[0][2].aborted).toBe(true);
  await act(async () => deliverResult({ transcript: "minus two", score: -2 }));
  expect(onRecord).toHaveBeenCalledTimes(1);
  expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ score: 1 }), "utterance-2");
});

it("retries an unacknowledged save with its original score and turn", async () => {
  const onRecord = vi.fn<PanelProps["onRecord"]>()
    .mockRejectedValueOnce(new Error("lost acknowledgment")).mockResolvedValue(undefined);
  mount({ onRecord });
  enter("-2");
  const retry = await screen.findByRole("button", { name: "Retry save" });
  expect(log().getByText("Save pending")).toBeVisible();
  expect(screen.getByText("Question 1 of 2")).toBeVisible();
  expect(textbox()).not.toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Record plus three" })).toBeDisabled();
  fireEvent.click(retry);
  expect(onRecord).toHaveBeenCalledTimes(2);
  expect(onRecord.mock.calls[0]).toEqual(onRecord.mock.calls[1]);
  expect(bindTurn).toHaveBeenCalledTimes(1);
});

it("ignores an old recording reply after the saved draft version changes", async () => {
  let deliverResult!: (value: { transcript: string; score: number }) => void;
  vi.mocked(interpretTurn).mockImplementationOnce(() => new Promise(resolve => { deliverResult = resolve; }));
  const { onRecord, props, rerender } = mount();
  await record();
  rerender(<CallPanel {...props} draft={nextDraft(1)} />);
  await act(async () => deliverResult({ transcript: "minus two", score: -2 }));
  expect(onRecord).not.toHaveBeenCalled();
  expect(screen.getByText("Question 2 of 2")).toBeVisible();
});

it("releases the mic on mute or background and ignores queued input", async () => {
  mount();
  await unmute();
  const queued = deliver;
  fireEvent.click(mic());
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => queued?.(new Blob(["stale"])));
  expect(interpretTurn).not.toHaveBeenCalled();
  await unmute();
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(close).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Voice off")).toBeVisible();
});

it("cancels pending ElevenLabs readback on mute and keeps the composer editable", async () => {
  invoke.mockImplementationOnce(() => new Promise(() => {}));
  const { onRecord } = mount();
  fireEvent.click(mic());
  expect(await screen.findByText("Loading readback…")).toBeVisible();
  expect(listen).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledWith("speak-ride-prompt", expect.objectContaining({
    body: { draftId: draft.id, questionId: first.id, version: 1, kind: "question" },
  }));
  fireEvent.click(mic());
  expect(invoke.mock.calls[0][1].signal.aborted).toBe(true);
  enter("positive three");
  await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1));
});

it("resumes the stored question and leaves the completed ride behind explicit review", () => {
  const { props, rerender } = mount({ draft: nextDraft(2) });
  expect(screen.getByText("Question 2 of 2")).toBeVisible();
  expect(log().getByText("+2", { selector: ".ride-chat-score-value" })).toBeVisible();
  rerender(<CallPanel {...props} draft={{ ...nextDraft(2), version: 3, guided_cursor: 2 }} />);
  expect(log().getByText("All scores are recorded. Your ride is ready to review.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Review scores and save" }));
  expect(props.onReview).toHaveBeenCalledTimes(1);
});

it("releases the microphone on an external dialog close", async () => {
  const { props, rerender } = mount();
  await unmute();
  rerender(<CallPanel {...props} open={false} />);
  expect(close).toHaveBeenCalledTimes(1);
});

it("keeps the typed answer when the question cannot be bound", async () => {
  vi.mocked(bindTurn).mockRejectedValueOnce(new Error("disconnected"));
  const { onRecord } = mount();
  enter("score: negative two");
  expect(await log().findByText(/couldn't prepare this question/)).toBeVisible();
  expect(textbox()).toHaveValue("score: negative two");
  expect(onRecord).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ score: -2 }), "utterance-2"));
});
