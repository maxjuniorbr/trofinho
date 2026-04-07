/**
 * Time limit for any single query/mutation call (auth session + HTTP request).
 * Prevents infinite loading when Supabase auth lock or network hangs.
 * React Query retries (default 2) will recover from transient issues.
 */
const QUERY_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Tempo limite excedido. Tente novamente.')),
      QUERY_TIMEOUT_MS,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Wraps a lib/ function that returns { data, error } and converts it
 * to React Query's contract: returns data on success, throws on error.
 * Handles: error string → throw, data null with no error → throw "not found",
 * and propagates any exceptions thrown by the lib/ function itself.
 */
export function queryFnAdapter<T>(
  fn: () => Promise<{ data: T; error: string | null }>,
): () => Promise<NonNullable<T>> {
  return async () => {
    const result = await withTimeout(fn());
    if (result.error) throw new Error(result.error);
    if (result.data == null) throw new Error('Registro não encontrado.');
    return result.data;
  };
}

/**
 * Like queryFnAdapter but allows null data without throwing.
 * Use for queries where null is a valid state (e.g., balance for a new child).
 */
export function nullableQueryFnAdapter<T>(
  fn: () => Promise<{ data: T; error: string | null }>,
): () => Promise<T> {
  return async () => {
    const result = await withTimeout(fn());
    if (result.error) throw new Error(result.error);
    return result.data;
  };
}

/**
 * Wraps a lib/ mutation function that returns { error } and converts it
 * to React Query's contract: returns void on success, throws on error.
 */
export function mutationFnAdapter(
  fn: () => Promise<{ error: string | null }>,
): () => Promise<void> {
  return async () => {
    const result = await fn();
    if (result.error) throw new Error(result.error);
  };
}

export type PaginatedPage<T> = { data: T[]; hasMore: boolean };

/**
 * Wraps a paginated lib/ function for useInfiniteQuery.
 * The lib/ function must accept (page, pageSize) and return { data, hasMore, error }.
 */
export function paginatedQueryFnAdapter<T>(
  fn: (
    page: number,
    pageSize: number,
  ) => Promise<{ data: T[]; hasMore: boolean; error: string | null }>,
  pageSize: number,
): (ctx: { pageParam: number }) => Promise<PaginatedPage<T>> {
  return async ({ pageParam }) => {
    const result = await withTimeout(fn(pageParam, pageSize));
    if (result.error) throw new Error(result.error);
    return { data: result.data, hasMore: result.hasMore };
  };
}
