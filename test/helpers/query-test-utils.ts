/**
 * Shared vi.mock factory and helpers for React Query hook tests.
 *
 * Usage in each test file:
 *
 *   import * as rq from '@tanstack/react-query';
 *   import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';
 *
 *   vi.mock('@tanstack/react-query', async () => {
 *     const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
 *     return createReactQueryMock();
 *   });
 *
 *   const qh = getQueryHelpers(rq);
 *   beforeEach(() => qh.reset());
 */
import { vi } from 'vitest';

export interface CapturedStore {
  options: Record<string, unknown>[];
}

export function createReactQueryMock(opts?: { withInfiniteQuery?: boolean }) {
  const capturedQuery: CapturedStore = { options: [] };
  const capturedMutation: CapturedStore = { options: [] };
  const mockInvalidateQueries = vi.fn();

  const mock: Record<string, unknown> = {
    useQuery: vi.fn((o: Record<string, unknown>) => {
      capturedQuery.options.push(o);
      return { data: undefined, isLoading: false, error: null };
    }),
    useMutation: vi.fn((o: Record<string, unknown>) => {
      capturedMutation.options.push(o);
      return { mutate: vi.fn(), isLoading: false };
    }),
    useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: { children: unknown }) => children,
    _capturedQuery: capturedQuery,
    _capturedMutation: capturedMutation,
    _mockInvalidateQueries: mockInvalidateQueries,
  };

  if (opts?.withInfiniteQuery) {
    mock.useInfiniteQuery = vi.fn((o: Record<string, unknown>) => {
      capturedQuery.options.push(o);
      return {
        data: undefined,
        isLoading: false,
        error: null,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      };
    });
  }

  return mock;
}

type MockModule = Record<string, unknown>;
type MockFn = ReturnType<typeof vi.fn>;

export function getQueryHelpers(rqModule: MockModule) {
  const capturedQuery = rqModule._capturedQuery as CapturedStore;
  const capturedMutation = rqModule._capturedMutation as CapturedStore;
  const mockInvalidateQueries = rqModule._mockInvalidateQueries as MockFn;
  const useQueryMock = rqModule.useQuery as MockFn;

  const getCapturedQuery = () => capturedQuery;
  const getCapturedMutation = () => capturedMutation;
  const lastQueryOpts = () => capturedQuery.options.at(-1)!;
  const lastMutationOpts = () => capturedMutation.options.at(-1)!;

  const reset = () => {
    capturedQuery.options = [];
    capturedMutation.options = [];
    mockInvalidateQueries.mockClear();
  };

  return {
    getCapturedQuery,
    getCapturedMutation,
    lastQueryOpts,
    lastMutationOpts,
    mockInvalidateQueries,
    useQueryMock,
    reset,
  };
}
