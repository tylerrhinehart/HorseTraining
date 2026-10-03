import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ userId: "trainer", fetchQuery: vi.fn(), subscribe: vi.fn((_key: unknown, _fn: unknown, _rerender: unknown) => () => {}) }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock("./cache", () => ({ userId: "trainer", fetchQuery: mocks.fetchQuery, subscribe: mocks.subscribe, getCached: () => undefined, isStale: () => true }));
import { useQuery } from "./useQuery";

afterEach(() => { cleanup(); mocks.userId = "trainer"; vi.clearAllMocks(); });

describe("horse query isolation", () => {
  it("captures the original horse fetcher for retries and revalidation", () => {
    mocks.fetchQuery.mockReturnValue(new Promise(() => {}));
    const a = vi.fn(async () => "horse A");
    const b = vi.fn(async () => "horse B");
    const hook = renderHook(({ horse, fn }) => useQuery(["horse", horse], fn), { initialProps: { horse: "A", fn: a } });
    hook.rerender({ horse: "B", fn: b });
    expect(mocks.fetchQuery.mock.calls[0][1]).toBe(a);
    expect(mocks.subscribe.mock.calls[0][1]).toBe(a);
    expect(mocks.fetchQuery.mock.calls[1][1]).toBe(b);
  });

  it("ignores an old horse's late error after navigating to another horse", async () => {
    let rejectA!: (error: Error) => void;
    mocks.fetchQuery.mockImplementation((key: string[]) => key[1] === "A" ? new Promise((_, reject) => { rejectA = reject; }) : Promise.resolve("horse B"));
    const hook = renderHook(({ horse }) => useQuery(["horse", horse], async () => horse), { initialProps: { horse: "A" } });
    hook.rerender({ horse: "B" });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { rejectA(new Error("A failed")); await Promise.resolve(); });
    expect(hook.result.current.error).toBeNull();
  });
});

it("resubscribes and fetches when account changes with the same query key", () => {
 mocks.fetchQuery.mockReturnValue(new Promise(() => {}));
 const hook = renderHook(() => useQuery(["horses"], async () => []));
 mocks.userId = "other-trainer"; hook.rerender();
 expect(mocks.fetchQuery).toHaveBeenCalledTimes(2);
 expect(mocks.subscribe).toHaveBeenCalledTimes(2);
});
