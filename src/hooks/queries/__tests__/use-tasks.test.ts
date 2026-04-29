import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as tasksLib from '../../../../lib/tasks';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

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

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock({ withInfiniteQuery: true });
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
  renewRecurringTasks: vi.fn().mockResolvedValue(undefined),
  deactivateTask: vi.fn().mockResolvedValue({ data: { pendingValidationCount: 0 }, error: null }),
  deleteTask: vi.fn().mockResolvedValue({ data: { pendingValidationCount: 0 }, error: null }),
  reactivateTask: vi.fn().mockResolvedValue({ error: null }),
  archiveTask: vi.fn().mockResolvedValue({ error: null }),
  unarchiveTask: vi.fn().mockResolvedValue({ error: null }),
  discardRejection: vi.fn().mockResolvedValue({ error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const { getCapturedQuery, useQueryMock } = qh;
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

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

    it('useChildAssignments queryFn calls listChildAssignments without renewRecurringTasks', async () => {
      const { useChildAssignments } = await loadHooks();
      useChildAssignments();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(tasksLib.renewRecurringTasks).not.toHaveBeenCalled();
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

    it('useRenewRecurringTasks invalidates childAssignments when data is truthy', async () => {
      // Override useQuery to return data: true to trigger the useEffect invalidation
      useQueryMock.mockImplementationOnce((opts: Record<string, unknown>) => {
        getCapturedQuery().options.push(opts);
        return { data: true, isLoading: false, error: null };
      });
      const { useRenewRecurringTasks } = await loadHooks();
      useRenewRecurringTasks();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.tasks.childAssignments(),
      });
    });

    it('useRenewRecurringTasks does not invalidate when query has no data', async () => {
      mockInvalidateQueries.mockClear();
      useQueryMock.mockImplementationOnce((opts: Record<string, unknown>) => {
        getCapturedQuery().options.push(opts);
        return { data: undefined, isLoading: false, error: new Error('RPC failed') };
      });
      const { useRenewRecurringTasks } = await loadHooks();
      useRenewRecurringTasks();
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });

    it('useRenewRecurringTasks includes childId in query key for impersonation switching', async () => {
      const childA = 'child-aaa';
      const childB = 'child-bbb';
      const { useRenewRecurringTasks } = await loadHooks();

      useRenewRecurringTasks(childA);
      const keyA = lastQueryOpts().queryKey;
      expect(keyA).toEqual(queryKeys.tasks.renewRecurring(childA));

      useRenewRecurringTasks(childB);
      const keyB = lastQueryOpts().queryKey;
      expect(keyB).toEqual(queryKeys.tasks.renewRecurring(childB));

      // Keys must differ so React Query treats them as separate cache entries
      expect(keyA).not.toEqual(keyB);
    });

    it('useRenewRecurringTasks uses "self" sentinel when no childId is provided', async () => {
      const { useRenewRecurringTasks } = await loadHooks();
      useRenewRecurringTasks();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.tasks.renewRecurring(undefined));
      expect(lastQueryOpts().queryKey).toContain('self');
    });

    it('useDeleteTask invalidates tasks.all on success', async () => {
      const { useDeleteTask } = await loadHooks();
      useDeleteTask();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    });
  });
});

describe('use-tasks mutationFn execution', () => {
  it('useCreateTask mutationFn calls createTask with correct args', async () => {
    const { useCreateTask } = await loadHooks();
    useCreateTask();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const input = { titulo: 'Test', descricao: null, pontos: 10, dias_semana: 127, exige_evidencia: false, filhoIds: ['c1'] };
    const opts = { familiaId: 'f1', filhoIds: ['c1'] };
    await mutationFn({ input, opts });
    expect(tasksLib.createTask).toHaveBeenCalledWith(input, opts);
  });

  it('useUpdateTask mutationFn calls updateTask with correct args', async () => {
    const { useUpdateTask } = await loadHooks();
    useUpdateTask();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const input = { titulo: 'Updated', descricao: null, pontos: 20, exige_evidencia: true, dias_semana: 127 };
    await mutationFn({ taskId: 'task-1', input });
    expect(tasksLib.updateTask).toHaveBeenCalledWith('task-1', input);
  });

  it('useApproveAssignment mutationFn calls approveAssignment with correct args', async () => {
    const { useApproveAssignment } = await loadHooks();
    useApproveAssignment();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', userId: 'u1', taskTitle: 'Task' };
    await mutationFn({ assignmentId: 'a1', opts });
    expect(tasksLib.approveAssignment).toHaveBeenCalledWith('a1', opts);
  });

  it('useRejectAssignment mutationFn calls rejectAssignment with correct args', async () => {
    const { useRejectAssignment } = await loadHooks();
    useRejectAssignment();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', userId: 'u1', taskTitle: 'Task' };
    await mutationFn({ assignmentId: 'a1', note: 'bad', opts });
    expect(tasksLib.rejectAssignment).toHaveBeenCalledWith('a1', 'bad', opts);
  });

  it('useCancelAssignmentSubmission mutationFn calls cancelAssignmentSubmission', async () => {
    const { useCancelAssignmentSubmission } = await loadHooks();
    useCancelAssignmentSubmission();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    await mutationFn({ assignmentId: 'a1' });
    expect(tasksLib.cancelAssignmentSubmission).toHaveBeenCalledWith('a1');
  });

  it('useCompleteAssignment mutationFn calls completeAssignment with correct args', async () => {
    const { useCompleteAssignment } = await loadHooks();
    useCompleteAssignment();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', childName: 'Child', taskTitle: 'Task' };
    await mutationFn({ assignmentId: 'a1', imageUri: 'file://img.jpg', opts });
    expect(tasksLib.completeAssignment).toHaveBeenCalledWith('a1', 'file://img.jpg', opts);
  });

  it('useDeactivateTask mutationFn calls deactivateTask and returns data', async () => {
    vi.mocked(tasksLib.deactivateTask).mockResolvedValueOnce({ data: { pendingValidationCount: 2 }, error: null });
    const { useDeactivateTask } = await loadHooks();
    useDeactivateTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    const result = await mutationFn('task-1');
    expect(tasksLib.deactivateTask).toHaveBeenCalledWith('task-1');
    expect(result).toEqual({ pendingValidationCount: 2 });
  });

  it('useDeactivateTask mutationFn throws when lib returns error', async () => {
    vi.mocked(tasksLib.deactivateTask).mockResolvedValueOnce({ data: null, error: 'Tarefa não encontrada' });
    const { useDeactivateTask } = await loadHooks();
    useDeactivateTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await expect(mutationFn('task-1')).rejects.toThrow('Tarefa não encontrada');
  });

  it('useDeleteTask mutationFn calls deleteTask and returns data', async () => {
    vi.mocked(tasksLib.deleteTask).mockResolvedValueOnce({ data: { pendingValidationCount: 3 }, error: null });
    const { useDeleteTask } = await loadHooks();
    useDeleteTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    const result = await mutationFn('task-1');
    expect(tasksLib.deleteTask).toHaveBeenCalledWith('task-1');
    expect(result).toEqual({ pendingValidationCount: 3 });
  });

  it('useDeleteTask mutationFn throws when lib returns error', async () => {
    vi.mocked(tasksLib.deleteTask).mockResolvedValueOnce({ data: null, error: 'Tarefa não encontrada' });
    const { useDeleteTask } = await loadHooks();
    useDeleteTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await expect(mutationFn('task-1')).rejects.toThrow('Tarefa não encontrada');
  });

  it('useReactivateTask mutationFn calls reactivateTask', async () => {
    const { useReactivateTask } = await loadHooks();
    useReactivateTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('task-1');
    expect(tasksLib.reactivateTask).toHaveBeenCalledWith('task-1');
  });

  it('useArchiveTask mutationFn calls archiveTask', async () => {
    const { useArchiveTask } = await loadHooks();
    useArchiveTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('task-1');
    expect(tasksLib.archiveTask).toHaveBeenCalledWith('task-1');
  });

  it('useUnarchiveTask mutationFn calls unarchiveTask', async () => {
    const { useUnarchiveTask } = await loadHooks();
    useUnarchiveTask();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('task-1');
    expect(tasksLib.unarchiveTask).toHaveBeenCalledWith('task-1');
  });

  it('useDiscardRejection mutationFn calls discardRejection', async () => {
    const { useDiscardRejection } = await loadHooks();
    useDiscardRejection();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('a1');
    expect(tasksLib.discardRejection).toHaveBeenCalledWith('a1');
  });
});
