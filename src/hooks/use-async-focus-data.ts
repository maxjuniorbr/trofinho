import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

type AsyncResult<T> = Readonly<{
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}>;

/**
 * Fetches data on screen focus and exposes loading/error state.
 *
 * The `fetcher` must be a stable reference (wrap with useCallback if it
 * captures component state). On error the hook stores a user-visible
 * message; on success it stores `data`.
 */
export function useAsyncFocusData<T>(fetcher: () => Promise<T>): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, loading, error, reload: load } as const;
}
