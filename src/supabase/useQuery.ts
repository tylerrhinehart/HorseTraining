import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../auth/AuthProvider";

interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Tiny query hook for Supabase calls. Re-runs whenever `deps` changes or
 * `refresh()` is called. Skips while the user is unauthenticated.
 */
export function useQuery<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
): QueryState<T> {
  const { user } = useAuth();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const cancelled = useRef(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setData(undefined);
      setLoading(false);
      return;
    }
    cancelled.current = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (!cancelled.current) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      });
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tick, ...deps]);

  return { data, error, loading, refresh };
}
