import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCache,
  fetchQuery,
  getCached,
  invalidate,
  isStale,
  mutateCache,
  prefetchQuery,
  subscribe,
} from "./cache";

// 0-delay retry override so tests don't wait on backoff timers.
const noDelay = { retries: 2, delays: [0, 0] };

beforeEach(() => {
  clearCache();
});

describe("fetchQuery dedupe", () => {
  it("shares one promise for concurrent callers", async () => {
    const fn = vi.fn(async () => "v");
    const [a, b] = await Promise.all([
      fetchQuery(["k"], fn),
      fetchQuery(["k"], fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toBe("v");
    expect(b).toBe("v");
  });
});

describe("fetchQuery retry", () => {
  it("resolves after two failures then success", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls <= 2) throw new Error("boom");
      return "ok";
    });
    await expect(fetchQuery(["r"], fn, noDelay)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rejects after exhausting retries", async () => {
    const fn = vi.fn(async () => {
      throw new Error("always");
    });
    await expect(fetchQuery(["r2"], fn, noDelay)).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe("invalidate prefix boundary", () => {
  it("stales only true array-prefix matches", () => {
    mutateCache(["horse", "a"], 1);
    mutateCache(["horses", "all"], 2);
    mutateCache(["horseshoe"], 3);

    expect(isStale(["horse", "a"])).toBe(false);
    expect(isStale(["horses", "all"])).toBe(false);
    expect(isStale(["horseshoe"])).toBe(false);

    invalidate(["horse"]);

    expect(isStale(["horse", "a"])).toBe(true); // matched
    expect(isStale(["horses", "all"])).toBe(false); // not matched
    expect(isStale(["horseshoe"])).toBe(false); // not matched
  });
});

describe("prefetchQuery freshness", () => {
  it("skips fetching a fresh entry", () => {
    mutateCache(["p"], 42);
    const fn = vi.fn(async () => 99);
    prefetchQuery(["p"], fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("fetches when no entry exists", async () => {
    const fn = vi.fn(async () => 7);
    prefetchQuery(["p2"], fn);
    // allow the fire-and-forget fetch to settle
    await vi.waitFor(() => expect(getCached(["p2"])).toBe(7));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("mutateCache", () => {
  it("writes through and notifies listeners", () => {
    const onChange = vi.fn();
    subscribe(["m"], async () => 0, onChange);
    mutateCache(["m"], 5);
    expect(getCached(["m"])).toBe(5);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
