import type { UseQueryResult, UseInfiniteQueryResult } from '@tanstack/react-query';

type AnyQueryResult = UseQueryResult<unknown> | UseInfiniteQueryResult<unknown, Error>;

export const combineQueryStates = (...queries: AnyQueryResult[]) => ({
  isLoading: queries.some((q) => q.isLoading),
  isFetching: queries.some((q) => q.isFetching),
  error: queries.find((q) => q.error)?.error ?? null,
  refetchAll: () => Promise.all(queries.map((q) => q.refetch())),
});
