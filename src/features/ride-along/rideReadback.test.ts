import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setFacilityScope } from "../../supabase/facilityScope";
import { playInAudioContext, useRideReadback, type RideAudioPlayer, type RideReadbackRequest } from "./rideReadback";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("../../supabase/client", () => ({ requireSupabase: () => ({ functions: { invoke } }) }));

const question = { draftId: "draft", questionId: "question", version: 3, kind: "question" } satisfies RideReadbackRequest;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}

function edgeAudio() {
  const data = new Blob(["MP3 fixture"], { type: "application/octet-stream" });
  const bytes = new ArrayBuffer(data.size);
  Object.defineProperty(data, "arrayBuffer", { value: async () => bytes });
  return { data, bytes, error: null };
}

class TestUtterance {
  voice?: { localService: boolean; lang: string };
  onstart?: () => void;
  onend?: () => void;
  constructor(readonly text: string) {}
}

function browserVoices() {
  const voices = [{ localService: true, lang: "fr-FR" }, { localService: false, lang: "en-US" }, { localService: true, lang: "en-GB" }];
  const speak = vi.fn((utterance: TestUtterance) => utterance.onstart?.());
  const cancel = vi.fn();
  vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
  vi.stubGlobal("speechSynthesis", { getVoices: () => voices, speak, cancel });
  return { voices, speak, cancel };
}

beforeEach(() => {
  invoke.mockReset();
  setFacilityScope(null);
  setFacilityScope("facility");
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("requests only authorized prompt references and keeps the microphone guarded until the readback tail ends", async () => {
  vi.useFakeTimers();
  const audio = edgeAudio();
  const ending = deferred<void>();
  const player = vi.fn<RideAudioPlayer>((_bytes, _signal, started) => {
    started();
    return ending.promise;
  });
  invoke.mockResolvedValue(audio);
  const { result } = renderHook(() => useRideReadback(true, player));
  let pending!: Promise<void>;
  act(() => { pending = result.current.speak(question, "Private local fallback text"); });
  expect(result.current.isActive()).toBe(true);
  expect(result.current.state).toBe("requesting");
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(result.current.state).toBe("playing");
  expect(invoke).toHaveBeenCalledWith("speak-ride-prompt", {
    body: question, signal: expect.any(AbortSignal), timeout: 12_000,
  });
  expect(player).toHaveBeenCalledWith(audio.bytes, expect.any(AbortSignal), expect.any(Function));
  await act(async () => { ending.resolve(); await vi.advanceTimersByTimeAsync(249); });
  expect(result.current.isActive()).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); await pending; });
  expect(result.current.state).toBe("idle");
  expect(result.current.isActive()).toBe(false);
});

it("ignores an old response after muting or changing facility", async () => {
  const voice = browserVoices();
  const opening = deferred<unknown>();
  const player = vi.fn<RideAudioPlayer>();
  invoke.mockReturnValue(opening.promise);
  const { result, rerender } = renderHook(({ enabled }) => useRideReadback(enabled, player), { initialProps: { enabled: true } });

  let pending!: Promise<void>;
  act(() => { pending = result.current.speak(question, "Private prompt"); });
  const { signal } = invoke.mock.calls[0][1];
  rerender({ enabled: false });
  expect(signal.aborted).toBe(true);
  expect(result.current.state).toBe("idle");
  await act(async () => { opening.resolve(edgeAudio()); await pending; });
  await act(async () => { await result.current.speak(question, "No speech while muted"); });
  expect(player).not.toHaveBeenCalled();
  expect(voice.speak).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledTimes(1);

  const late = deferred<unknown>();
  invoke.mockReturnValue(late.promise);
  rerender({ enabled: true });
  act(() => { pending = result.current.speak(question, "Old facility prompt"); });
  setFacilityScope("new-facility");
  expect(invoke.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => { late.resolve({ data: null, error: new Error() }); await pending; });
  expect(voice.speak).not.toHaveBeenCalled();
});

it("only plays through an installed English voice when the Edge Function is unavailable", async () => {
  const { voices, speak, cancel } = browserVoices();
  invoke.mockResolvedValue({ data: null, error: new Error("not configured") });
  const player = vi.fn<RideAudioPlayer>();
  const { result } = renderHook(() => useRideReadback(true, player));
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.speak(question, "Private local question"); });
  expect(result.current.state).toBe("playing");
  expect(player).not.toHaveBeenCalled();
  expect(speak.mock.calls[0][0]).toMatchObject({ text: "Private local question", voice: voices[2] });
  await act(async () => { result.current.stop(); await pending; });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(result.current.state).toBe("idle");
});

it("does not request ElevenLabs for a local-only prompt and skips a remote browser voice", async () => {
  const { voices, speak } = browserVoices();
  voices.pop();
  const { result } = renderHook(() => useRideReadback(true, vi.fn<RideAudioPlayer>()));
  await act(async () => { await result.current.speak(null, "Custom local question"); });
  expect(invoke).not.toHaveBeenCalled();
  expect(speak).not.toHaveBeenCalled();
  expect(result.current.state).toBe("idle");
});

it.each([401, 403, 409])("does not read an obsolete or unauthorized prompt aloud after HTTP %s", async status => {
  const { speak } = browserVoices();
  invoke.mockResolvedValue({ data: null, error: new Error(), response: { status } });
  const player = vi.fn<RideAudioPlayer>();
  const { result } = renderHook(() => useRideReadback(true, player));
  await act(async () => { await result.current.speak(question, "Obsolete question"); });
  expect(speak).not.toHaveBeenCalled();
  expect(player).not.toHaveBeenCalled();
  expect(result.current.state).toBe("idle");
});

it("does not replay a prompt locally if cloud playback started before an error", async () => {
  vi.useFakeTimers();
  const { speak } = browserVoices();
  invoke.mockResolvedValue(edgeAudio());
  const player: RideAudioPlayer = async (_bytes, _signal, started) => {
    started();
    throw new Error("Audio output interrupted");
  };
  const { result } = renderHook(() => useRideReadback(true, player));
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.speak(question, "Don't repeat this"); await vi.advanceTimersByTimeAsync(300); });
  await act(async () => { await pending; });
  expect(speak).not.toHaveBeenCalled();
  expect(result.current.state).toBe("idle");
});

it("aborts old readback on replacement and stops the new call when the app is hidden", async () => {
  const old = deferred<unknown>();
  const current = deferred<unknown>();
  invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const player = vi.fn<RideAudioPlayer>();
  const { result } = renderHook(() => useRideReadback(true, player));
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.speak(question, "Previous question");
    second = result.current.speak({ ...question, questionId: "next", version: 4 }, "Current question");
  });
  expect(invoke.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { old.resolve(edgeAudio()); await first; });
  expect(result.current.state).toBe("requesting");
  vi.mocked(Object.getOwnPropertyDescriptor(document, "hidden")!.get!).mockReturnValue(true);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(result.current.state).toBe("idle");
  expect(invoke.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => { current.resolve(edgeAudio()); await second; });
  expect(player).not.toHaveBeenCalled();
});

function mockAudioContext() {
  const buffer = {} as AudioBuffer;
  const source = { onended: null as (() => void) | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const decodeAudioData = vi.fn().mockResolvedValue(buffer);
  const createBufferSource = vi.fn().mockReturnValue(source);
  const context = { state: "running", destination: {}, decodeAudioData, createBufferSource } as unknown as AudioContext;
  return { context, buffer, source, decodeAudioData, createBufferSource };
}

it("plays MP3 bytes on the already-running capture AudioContext and stops the source on abort", async () => {
  const { context, source, decodeAudioData } = mockAudioContext();
  const controller = new AbortController();
  const playbackStarted = deferred<void>();
  const started = vi.fn(() => playbackStarted.resolve());
  const bytes = new ArrayBuffer(4);
  const playback = playInAudioContext(context, bytes, controller.signal, started);
  const rejection = expect(playback).rejects.toMatchObject({ name: "AbortError" });
  await playbackStarted.promise;
  expect(decodeAudioData).toHaveBeenCalledWith(bytes);
  expect(source.start).toHaveBeenCalledOnce();
  expect(started).toHaveBeenCalledOnce();
  controller.abort();
  await rejection;
  expect(source.stop).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalledOnce();
});

it("never starts old audio if the player was canceled while decoding it", async () => {
  const { context, buffer, decodeAudioData, createBufferSource } = mockAudioContext();
  const decoding = deferred<AudioBuffer>();
  const controller = new AbortController();
  decodeAudioData.mockReturnValue(decoding.promise);
  const playback = playInAudioContext(context, new ArrayBuffer(4), controller.signal, vi.fn());
  const rejection = expect(playback).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejection;
  decoding.resolve(buffer);
  await Promise.resolve();
  expect(createBufferSource).not.toHaveBeenCalled();
});
