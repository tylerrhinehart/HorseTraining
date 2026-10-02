import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { fetchQuery, getCached, isStale, subscribe, type QueryKey } from "./cache";

interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * SWR-backed query hook. Reads from the module cache so navigations serve
 * stale data instantly; revalidates in the background. `loading` is true only
 * while fetching with no cached data — that kills navigation "Loading…"
 * flashes. A null key or an unauthenticated user yields a skipped state.
 */
export function useQuery<T>(
  key: QueryKey | null,
  fn: () => Promise<T>,
): QueryState<T> {
  const { user } = useAuth();

  // Keep the registered fetcher pointing at the latest `fn`.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const active = !!user && key !== null;
  const keyStr = active ? JSON.stringify(key) : null;
  const scope = `${user?.id ?? ""}:${keyStr}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => (t + 1) | 0), []);
  const [error, setError] = useState<Error | null>(null);
  const [fetching, setFetching] = useState(false);

  const doFetch = useCallback((k: QueryKey) => {
    setFetching(true);
    const requestScope = scopeRef.current;
    // Capture the fetcher: a retry for horse A must not call horse B's newer fn.
    fetchQuery(k, fnRef.current)
      .then(() => { if (scopeRef.current === requestScope) setError(null); })
      .catch((e) => { if (scopeRef.current === requestScope) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (scopeRef.current === requestScope) setFetching(false); });
  }, []);

  useEffect(() => {
    if (!active || key === null) {
      setError(null);
      setFetching(false);
      return;
    }
    setError(null);
    const unsub = subscribe(key, fnRef.current, rerender);
    if (isStale(key)) doFetch(key);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, active]);

  const refresh = useCallback(() => {
    if (!active || key === null) return;
    doFetch(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, active, doFetch]);

  const data = active && key !== null ? getCached<T>(key) : undefined;
  const loading =
    active &&
    key !== null &&
    data === undefined &&
    error === null &&
    (fetching || isStale(key));

  return { data, error, loading, refresh };
}
