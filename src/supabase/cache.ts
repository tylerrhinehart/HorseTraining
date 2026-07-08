// Module-level SWR cache for Supabase queries: stale-while-revalidate reads,
// request dedupe, retry/backoff, prefix invalidation, and focus/online
// revalidation. No React here — useQuery.ts binds this to components.

export type QueryKey = readonly unknown[];

const keyOf = (k: QueryKey) => JSON.stringify(k);

interface Entry {
  data: unknown;
  updatedAt: number;
} // updatedAt=0 ⇒ stale

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const fetchers = new Map<string, () => Promise<unknown>>(); // last registered fetcher per key
const listeners = new Map<string, Set<() => void>>(); // per-key change notifiers

const STALE_MS = 30_000;
const RETRY_DELAYS = [500, 1500]; // backoff between attempts; test-overridable via opts.delays

function notify(k: string): void {
  const set = listeners.get(k);
  if (set) set.forEach((fn) => fn());
}

export function getCached<T>(key: QueryKey): T | undefined {
  const e = cache.get(keyOf(key));
  return e ? (e.data as T) : undefined;
}

/** True when there is no entry or the entry is older than `maxAge`. */
export function isStale(key: QueryKey, maxAge = STALE_MS): boolean {
  const e = cache.get(keyOf(key));
  if (!e) return true;
  return Date.now() - e.updatedAt > maxAge;
}

/** Registers fetcher + listener; returns unsubscribe that removes both. */
export function subscribe(
  key: QueryKey,
  fetcher: () => Promise<unknown>,
  onChange: () => void,
): () => void {
  const k = keyOf(key);
  fetchers.set(k, fetcher);
  let set = listeners.get(k);
  if (!set) {
    set = new Set();
    listeners.set(k, set);
  }
  set.add(onChange);
  return () => {
    const s = listeners.get(k);
    if (s) {
      s.delete(onChange);
      if (s.size === 0) {
        listeners.delete(k);
        // Only drop the fetcher when no subscribers remain, so remaining
        // hooks on the same key keep a valid revalidation fetcher.
        fetchers.delete(k);
      }
    }
  };
}

/**
 * Dedupes concurrent callers via `inflight`, retries on rejection with backoff
 * (default 2 retries, 500ms then 1500ms). On success: populates the cache and
 * notifies listeners. Always clears inflight.
 */
export function fetchQuery<T>(
  key: QueryKey,
  fn: () => Promise<T>,
  opts?: { retries?: number; delays?: number[] },
): Promise<T> {
  const k = keyOf(key);
  const existing = inflight.get(k);
  if (existing) return existing as Promise<T>;

  const retries = opts?.retries ?? 2;
  const delays = opts?.delays ?? RETRY_DELAYS;

  const p = (async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await fn();
        cache.set(k, { data, updatedAt: Date.now() });
        notify(k);
        return data;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          const d = delays[Math.min(attempt, delays.length - 1)] ?? 0;
          if (d > 0) await new Promise((res) => setTimeout(res, d));
        }
      }
    }
    throw lastErr;
  })();

  inflight.set(k, p);
  const cleanup = () => inflight.delete(k);
  p.then(cleanup, cleanup);
  return p as Promise<T>;
}

/**
 * Mark stale + background-revalidate every cached key whose array starts with
 * `prefix`. Prefix match uses a `,`/`]` boundary check so `["horse"]` matches
 * `["horse","a"]` but not `["horses","all"]` or `["horseshoe"]`.
 */
export function invalidate(prefix: QueryKey): void {
  const p = keyOf(prefix).slice(0, -1);
  for (const k of Array.from(cache.keys())) {
    if (!(k.startsWith(p) && (k[p.length] === "," || k[p.length] === "]"))) continue;
    const entry = cache.get(k);
    if (entry) entry.updatedAt = 0;
    const ls = listeners.get(k);
    const fetcher = fetchers.get(k);
    if (ls && ls.size > 0 && fetcher) {
      // Fire-and-forget revalidate; surface errors to hooks via notify.
      fetchQuery(JSON.parse(k) as QueryKey, fetcher).catch(() => notify(k));
    }
  }
}

/** Write-through + notify (for optimistic updates). */
export function mutateCache<T>(key: QueryKey, data: T): void {
  const k = keyOf(key);
  cache.set(k, { data, updatedAt: Date.now() });
  notify(k);
}

/** No-op if a fresh (<30s) entry exists; otherwise fetch and swallow errors. */
export function prefetchQuery<T>(key: QueryKey, fn: () => Promise<T>): void {
  const e = cache.get(keyOf(key));
  if (e && Date.now() - e.updatedAt < STALE_MS) return;
  fetchQuery(key, fn).catch(() => {});
}

/** Wipe all four maps (called on sign-out). */
export function clearCache(): void {
  cache.clear();
  inflight.clear();
  fetchers.clear();
  listeners.clear();
}

// Revalidate stale, subscribed keys when the tab regains focus or the network
// comes back online.
if (typeof window !== "undefined") {
  const revalidateStaleSubscribed = () => {
    const now = Date.now();
    for (const [k, ls] of listeners) {
      if (ls.size === 0) continue;
      const entry = cache.get(k);
      const fetcher = fetchers.get(k);
      if (fetcher && entry && now - entry.updatedAt > STALE_MS) {
        fetchQuery(JSON.parse(k) as QueryKey, fetcher).catch(() => notify(k));
      }
    }
  };
  window.addEventListener("focus", revalidateStaleSubscribed);
  window.addEventListener("online", revalidateStaleSubscribed);
}
