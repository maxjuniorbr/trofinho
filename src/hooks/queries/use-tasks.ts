import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAdminTasks,
  getTaskWithAssignments,
  listChildAssignments,
  getChildAssignment,
  countPendingValidations,
  createTask,
  updateTask,
  approveAssignment,
  rejectAssignment,
  cancelAssignmentSubmission,
  completeAssignment,
  deactivateTask,
  reactivateTask,
  renewDailyTasks,
  type NewTaskInput,
  type UpdateTaskInput,
} from '../../../lib/tasks';
import { queryFnAdapter, mutationFnAdapter, paginatedQueryFnAdapter, type PaginatedPage } from './query-fn-adapter';
import { queryKeys, STALE_TIMES, PAGE_SIZES } from './query-keys';

export const useAdminTasks = () =>
  useInfiniteQuery({
    queryKey: queryKeys.tasks.lists(),
    queryFn: paginatedQueryFnAdapter(listAdminTasks, PAGE_SIZES.tasks),
    initialPageParam: 0,
    getNextPageParam: (lastPage: PaginatedPage<unknown>, _allPages: unknown[], lastPageParam: number) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    staleTime: STALE_TIMES.tasks,
  });

export const useTaskDetail = (taskId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.tasks.detail(taskId!),
    queryFn: queryFnAdapter(() => getTaskWithAssignments(taskId!)),
    staleTime: STALE_TIMES.tasks,
    enabled: !!taskId,
  });

export const useChildAssignments = () =>
  useInfiniteQuery({
    queryKey: queryKeys.tasks.childAssignments(),
    queryFn: async ({ pageParam }) => {
      if (pageParam === 0) await renewDailyTasks();
      const result = await listChildAssignments(pageParam, PAGE_SIZES.tasks);
      if (result.error) throw new Error(result.error);
      return { data: result.data, hasMore: result.hasMore };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: PaginatedPage<unknown>, _allPages: unknown[], lastPageParam: number) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    staleTime: STALE_TIMES.tasks,
  });

export const useChildAssignment = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.tasks.childAssignment(id!),
    queryFn: queryFnAdapter(() => getChildAssignment(id!)),
    staleTime: STALE_TIMES.tasks,
    enabled: !!id,
  });

export const usePendingValidationCount = () =>
  useQuery({
    queryKey: queryKeys.tasks.pendingCount(),
    queryFn: queryFnAdapter(() => countPendingValidations()),
    staleTime: STALE_TIMES.tasks,
  });


export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, opts }: {
      input: NewTaskInput;
      opts?: { familiaId: string; filhoIds: string[] };
    }) => mutationFnAdapter(() => createTask(input, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      mutationFnAdapter(() => updateTask(taskId, input))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useApproveAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, opts }: {
      assignmentId: string;
      opts: { familiaId: string; userId?: string | null; taskTitle: string };
    }) =>
      mutationFnAdapter(() => approveAssignment(assignmentId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useRejectAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, note, opts }: {
      assignmentId: string;
      note: string;
      opts: { familiaId: string; userId?: string | null; taskTitle: string };
    }) =>
      mutationFnAdapter(() => rejectAssignment(assignmentId, note, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useCancelAssignmentSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string }) =>
      mutationFnAdapter(() => cancelAssignmentSubmission(assignmentId))(),
    onSuccess: () => {
      // All task-derived queries share the ['tasks'] prefix:
      // child/admin lists, detail screens, pending counters and home summaries.
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useCompleteAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, imageUri, opts }: {
      assignmentId: string;
      imageUri: string | null;
      opts: { familiaId: string; childName: string; taskTitle: string };
    }) =>
      mutationFnAdapter(() => completeAssignment(assignmentId, imageUri, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useDeactivateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deactivateTask(taskId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useReactivateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      mutationFnAdapter(() => reactivateTask(taskId))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};
