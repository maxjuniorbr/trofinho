import { describe, expect, it, vi } from 'vitest';
import { combineQueryStates } from '../combine-query-states';

const makeQuery = (overrides: Record<string, unknown> = {}) =>
  ({
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Parameters<typeof combineQueryStates>[0];

describe('combineQueryStates', () => {
  it('returns idle state when all queries are settled', () => {
    const result = combineQueryStates(makeQuery(), makeQuery());

    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(false);
    expect(result.error).toBeNull();
  });

  it('returns isLoading true when any query is loading', () => {
    const result = combineQueryStates(makeQuery(), makeQuery({ isLoading: true }));

    expect(result.isLoading).toBe(true);
  });

  it('returns isFetching true when any query is fetching', () => {
    const result = combineQueryStates(makeQuery({ isFetching: true }), makeQuery());

    expect(result.isFetching).toBe(true);
  });

  it('returns the first error found', () => {
    const err1 = new Error('first');
    const err2 = new Error('second');

    const result = combineQueryStates(makeQuery({ error: err1 }), makeQuery({ error: err2 }));

    expect(result.error).toBe(err1);
  });

  it('returns null error when no query has error', () => {
    const result = combineQueryStates(makeQuery(), makeQuery());

    expect(result.error).toBeNull();
  });

  it('refetchAll calls refetch on all queries', async () => {
    const q1 = makeQuery();
    const q2 = makeQuery();

    const result = combineQueryStates(q1, q2);
    await result.refetchAll();

    expect(q1.refetch).toHaveBeenCalledOnce();
    expect(q2.refetch).toHaveBeenCalledOnce();
  });

  it('handles a single query', () => {
    const result = combineQueryStates(makeQuery({ isLoading: true, isFetching: true }));

    expect(result.isLoading).toBe(true);
    expect(result.isFetching).toBe(true);
  });
});
