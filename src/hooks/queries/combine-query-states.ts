import type { UseQueryResult } from '@tanstack/react-query';

export const combineQueryStates = (...queries: UseQueryResult<unknown>[]) => ({
  isLoading: queries.some((q) => q.isLoading),
  isFetching: queries.some((q) => q.isFetching),
  error: queries.find((q) => q.error)?.error ?? null,
  refetchAll: () => Promise.all(queries.map((q) => q.refetch())),
});
