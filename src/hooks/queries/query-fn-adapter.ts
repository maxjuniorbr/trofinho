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
    const result = await fn();
    if (result.error) throw new Error(result.error);
    if (result.data == null) throw new Error('Registro não encontrado.');
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
