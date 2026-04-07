import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as tasksLib from '../../../../lib/tasks';
import * as rq from '@tanstack/react-query';

const mockInvalidateQueries = vi.fn();

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: (fn: () => void) => fn(),
  };
});

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => {
  const capturedQuery: { options: Record<string, unknown>[] } = { options: [] };
  const capturedMutation: { options: Record<string, unknown>[] } = { options: [] };

  return {
    useQuery: vi.fn((opts: Record<string, unknown>) => {
      capturedQuery.options.push(opts);
      return { data: undefined, isLoading: false, error: null };
    }),
    useInfiniteQuery: vi.fn((opts: Record<string, unknown>) => {
      capturedQuery.options.push(opts);
      return {
        data: undefined,
        isLoading: false,
        error: null,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      };
    }),
    useMutation: vi.fn((opts: Record<string, unknown>) => {
      capturedMutation.options.push(opts);
      return { mutate: vi.fn(), isLoading: false };
    }),
    useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: { children: unknown }) => children,
    _capturedQuery: capturedQuery,
    _capturedMutation: capturedMutation,
  };
});

vi.mock('../../../../lib/tasks', () => ({
  listAdminTasks: vi.fn().mockResolvedValue({ data: [], error: null }),
  getTaskWithAssignments: vi.fn().mockResolvedValue({ data: null, error: null }),
  listChildAssignments: vi.fn().mockResolvedValue({ data: [], error: null }),
  getChildAssignment: vi.fn().mockResolvedValue({ data: null, error: null }),
  countPendingValidations: vi.fn().mockResolvedValue({ data: 0, error: null }),
  createTask: vi.fn().mockResolvedValue({ error: null }),
  updateTask: vi.fn().mockResolvedValue({ error: null }),
  approveAssignment: vi.fn().mockResolvedValue({ error: null }),
  rejectAssignment: vi.fn().mockResolvedValue({ error: null }),
  cancelAssignmentSubmission: vi.fn().mockResolvedValue({ error: null }),
  completeAssignment: vi.fn().mockResolvedValue({ error: null }),
  renewDailyTasks: vi.fn().mockResolvedValue(undefined),
}));

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedQuery = () => (rq as unknown as { _capturedQuery: CapturedStore })._capturedQuery;
const getCapturedMutation = () =>
  (rq as unknown as { _capturedMutation: CapturedStore })._capturedMutation;

const lastQueryOpts = () => {
  const opts = getCapturedQuery().options;
  return opts.at(-1)!;
};

const lastMutationOpts = () => {
  const opts = getCapturedMutation().options;
  return opts.at(-1)!;
};

beforeEach(() => {
  getCapturedQuery().options = [];
  getCapturedMutation().options = [];
  mockInvalidateQueries.mockClear();
});

// Lazy import so mocks are in place
const loadHooks = () => import('../use-tasks');

describe('use-tasks query hooks', () => {
  // Feature: react-query-migration, Property 3: Hooks with optional ID disable query when ID is undefined
  describe('Property 3: Hooks with optional ID disable query when ID is undefined', () => {
    it('useTaskDetail sets enabled: false when taskId is undefined', async () => {
      const { useTaskDetail } = await loadHooks();
      useTaskDetail(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('useChildAssignment sets enabled: false when id is undefined', async () => {
      const { useChildAssignment } = await loadHooks();
      useChildAssignment(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('useTaskDetail sets enabled: true for any non-empty string ID', async () => {
      const { useTaskDetail } = await loadHooks();
      fc.assert(
        fc.property(fc.uuid(), (id) => {
          useTaskDetail(id);
          expect(lastQueryOpts().enabled).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useAdminTasks queryFn calls listAdminTasks', async () => {
      const { useAdminTasks } = await loadHooks();
      useAdminTasks();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(tasksLib.listAdminTasks).toHaveBeenCalled();
    });

    it('useChildAssignments queryFn calls listChildAssignments without renewDailyTasks', async () => {
      const { useChildAssignments } = await loadHooks();
      useChildAssignments();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(tasksLib.renewDailyTasks).not.toHaveBeenCalled();
      expect(tasksLib.listChildAssignments).toHaveBeenCalled();
    });

    it('usePendingValidationCount queryFn calls countPendingValidations', async () => {
      const { usePendingValidationCount } = await loadHooks();
      usePendingValidationCount();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(tasksLib.countPendingValidations).toHaveBeenCalled();
    });

    it('useAdminTasks uses correct query key and staleTime', async () => {
      const { useAdminTasks } = await loadHooks();
      useAdminTasks();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.tasks.lists());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.tasks);
    });
  });
});

describe('use-tasks mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useApproveAssignment invalidates tasks.all and balances.all', async () => {
      const { useApproveAssignment } = await loadHooks();
      useApproveAssignment();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useCreateTask invalidates tasks.all', async () => {
      const { useCreateTask } = await loadHooks();
      useCreateTask();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    });

    it('useRejectAssignment invalidates tasks.all only', async () => {
      const { useRejectAssignment } = await loadHooks();
      useRejectAssignment();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
      expect(mockInvalidateQueries).not.toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useCancelAssignmentSubmission invalidates tasks.all only', async () => {
      const { useCancelAssignmentSubmission } = await loadHooks();
      useCancelAssignmentSubmission();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
      expect(mockInvalidateQueries).not.toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useCompleteAssignment invalidates tasks.all', async () => {
      const { useCompleteAssignment } = await loadHooks();
      useCompleteAssignment();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    });

    it('useRenewDailyTasks invalidates childAssignments when data is truthy', async () => {
      // Override useQuery to return data: true to trigger the useEffect invalidation
      const origUseQuery = rq.useQuery as ReturnType<typeof vi.fn>;
      origUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
        getCapturedQuery().options.push(opts);
        return { data: true, isLoading: false, error: null };
      });
      const { useRenewDailyTasks } = await loadHooks();
      useRenewDailyTasks();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.tasks.childAssignments(),
      });
    });

    it('useRenewDailyTasks does not invalidate when query has no data', async () => {
      mockInvalidateQueries.mockClear();
      const origUseQuery = rq.useQuery as ReturnType<typeof vi.fn>;
      origUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
        getCapturedQuery().options.push(opts);
        return { data: undefined, isLoading: false, error: new Error('RPC failed') };
      });
      const { useRenewDailyTasks } = await loadHooks();
      useRenewDailyTasks();
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });
});
