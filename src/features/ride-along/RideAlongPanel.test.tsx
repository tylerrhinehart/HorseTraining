import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Question } from "../../supabase/types";
import RideAlongPanel from "./RideAlongPanel";
import { bindTurn, interpretTurn, type RideDraft } from "./draftClient";

vi.mock("./draftClient", () => ({ bindTurn: vi.fn(), interpretTurn: vi.fn() }));

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
  vi.mocked(interpretTurn).mockReset();
  vi.mocked(bindTurn).mockReset().mockImplementation(async (d,q,t) => ({ draft_id:d.id, question_id:q, version:d.version, turn_id:t }));
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

const draft: RideDraft = {
  id: "d", version: 1, guided_cursor: 0, guided_question_ids: [question.id], ratings: [],
  facility_id: "facility", horse_id: "horse", phase_id: "phase", status: "draft", session_id: null,
  occurred_at: "2026-01-01T12:00:00Z", notes: null, rider: null, bit: null, task_completions: [],
  stage_notes: {}, active_voice_turn: null,
};
const dialogProps = { horseName: "Synthetic horse", open: true, returnFocus: { current: null }, onReview: vi.fn() };

function mount(onConfirm = vi.fn(async () => {})) {
  const view = render(<RideAlongPanel {...dialogProps} draft={draft} questions={[question]} disabled={false}
    onBusy={vi.fn()} onConfirm={onConfirm} />);
  return { ...view, onConfirm };
}

async function record() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Speak" })); });
  const stop = await screen.findByRole("button", { name: "Done" });
  await act(async () => { fireEvent.click(stop); });
}

it("turns off the microphone before applying a score and requires explicit confirmation", async () => {
  vi.mocked(interpretTurn).mockResolvedValue({ transcript: "minus two", score: -2 });
  const { onConfirm } = mount();
  await record();
  const confirm = await screen.findByRole("button", { name: "Confirm score" });
  expect(trackStop).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByText(/I have −2 for this question/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(confirm); });
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ questionId: "q-doubling", score: -2 }), "utterance-1"));
});

it("ignores late transcription even when an upstream mock does not honor abort", async () => {
  let complete: (value: {transcript:string;score:number|null}) => void = () => {};
  vi.mocked(interpretTurn).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const { onConfirm } = mount();
  await record();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel answer" }));
  expect(vi.mocked(interpretTurn).mock.calls[0][2].aborted).toBe(true);
  await act(async () => complete({ transcript:"plus two",score:2 }));
  expect(screen.queryByRole("button", { name: "Confirm score" })).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("stops capture without uploading when the document goes into the background", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  await screen.findByRole("button", { name: "Done" });
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(trackStop).toHaveBeenCalled();
  expect(interpretTurn).not.toHaveBeenCalled();
});

it("binds the active question before opening the microphone", async () => {
  vi.mocked(bindTurn).mockRejectedValue(new Error("stale"));
  mount();
  fireEvent.click(screen.getByRole("button", {name:"Speak"}));
  await screen.findByText(/couldn.t check that answer/i);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(interpretTurn).not.toHaveBeenCalled();
});
it("clarification preserves the current question without confirming", async () => {
  vi.mocked(interpretTurn).mockResolvedValue({transcript:"two or minus one",score:null});
  const {onConfirm}=mount(); await record();
  await screen.findByText(/I need one signed score/);
  expect(screen.getByText(/Question 1 of 1/)).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"Confirm score"})).toBeNull();
});
it("discards an old response when the saved draft version changes", async () => {
  let complete: (v:{transcript:string;score:number|null}) => void = () => {};
  vi.mocked(interpretTurn).mockImplementation(() => new Promise(resolve => {complete=resolve;}));
  const {rerender,onConfirm}=mount(); await record();
  rerender(<RideAlongPanel {...dialogProps} draft={{...draft,version:2}} questions={[question]} disabled={false} onBusy={vi.fn()} onConfirm={onConfirm}/>);
  await act(async()=>complete({transcript:"plus two",score:2}));
  expect(screen.queryByRole("button",{name:"Confirm score"})).toBeNull();
});
it("keeps confirmation retry on the same turn until durable success", async () => {
  vi.mocked(interpretTurn).mockResolvedValue({transcript:"plus two",score:2});
  const onConfirm=vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
  mount(onConfirm); await record();
  fireEvent.click(await screen.findByRole("button",{name:"Confirm score"}));
  fireEvent.click(await screen.findByRole("button",{name:"Retry confirmation"}));
  await waitFor(()=>expect(onConfirm).toHaveBeenCalledTimes(2));
  expect(onConfirm.mock.calls[0]).toEqual(onConfirm.mock.calls[1]);
});
it("resumes the server cursor and advances only after parent receives a saved draft", async () => {
  const second={...question,id:"q2",position:6,text:"Second rubric item"};
  const onConfirm=vi.fn(async()=>{});
  const view=render(<RideAlongPanel {...dialogProps} draft={{...draft,guided_cursor:1,guided_question_ids:[question.id,second.id]}} questions={[question,second]} disabled={false} onBusy={vi.fn()} onConfirm={onConfirm}/>);
  expect(screen.getByText(/Second rubric item/)).toBeInTheDocument();
  vi.mocked(interpretTurn).mockResolvedValue({transcript:"zero",score:0}); await record();
  fireEvent.click(await screen.findByRole("button",{name:"Confirm score"}));
  await waitFor(()=>expect(onConfirm).toHaveBeenCalledTimes(1));
  expect(screen.getByText(/Question 2 of 2/)).toBeInTheDocument();
  view.rerender(<RideAlongPanel {...dialogProps} draft={{...draft,version:2,guided_cursor:2,guided_question_ids:[question.id,second.id]}} questions={[question,second]} disabled={false} onBusy={vi.fn()} onConfirm={onConfirm}/>);
  expect(screen.getByText(/That's the last question/)).toBeInTheDocument();
});
it("supports manual review and confirmation without calling a provider", async () => {
 const {onConfirm}=mount();
 fireEvent.click(screen.getByRole("button",{name:"Pick a score"}));
 fireEvent.click(screen.getByRole("button",{name:"−3"}));
 const confirm=await screen.findByRole("button",{name:"Confirm score"});
 expect(interpretTurn).not.toHaveBeenCalled();expect(onConfirm).not.toHaveBeenCalled();
 fireEvent.click(confirm);
 await waitFor(()=>expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({questionId:question.id,score:-3,binding:expect.objectContaining({version:1})}),"utterance-1"));
});
it("discards a proposal without persistence or cursor advance",async()=>{
 vi.mocked(interpretTurn).mockResolvedValue({transcript:"plus three",score:3});
 const {onConfirm}=mount();await record();
 fireEvent.click(await screen.findByRole("button",{name:"Try again"}));
 expect(onConfirm).not.toHaveBeenCalled();expect(screen.getByText(/Question 1 of 1/)).toBeInTheDocument();
});
it("allows only one in-flight confirmation even on repeated clicks",async()=>{
 vi.mocked(interpretTurn).mockResolvedValue({transcript:"zero",score:0});
 let finish!:()=>void;const onConfirm=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 mount(onConfirm);await record();const button=await screen.findByRole("button",{name:"Confirm score"});
 fireEvent.click(button);fireEvent.click(button);expect(onConfirm).toHaveBeenCalledTimes(1);
 await act(async()=>finish());
});

it("shows the question, typed reply and scorer response in one conversation", async () => {
  vi.mocked(interpretTurn)
    .mockResolvedValueOnce({ transcript: "two", score: null })
    .mockResolvedValueOnce({ transcript: "plus two", score: 2 });
  const { onConfirm } = mount();
  const log = screen.getByRole("log", { name: "Scoring conversation" });
  expect(log).toHaveTextContent(question.text);
  const answer = screen.getByRole("textbox", { name: "Your answer" });

  fireEvent.change(answer, { target: { value: "two" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(/I need one signed score/);
  expect(screen.getByText("two", { exact: true })).toBeVisible();
  expect(log).toHaveTextContent("Question 1 of 1");

  fireEvent.change(answer, { target: { value: "plus two" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("I have +2 for this question. Is that right?")).toBeInTheDocument();
  expect(interpretTurn).toHaveBeenLastCalledWith(expect.objectContaining({ question_id: question.id }), "plus two", expect.any(AbortSignal));
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});
