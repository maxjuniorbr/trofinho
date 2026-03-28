import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  completeAssignment,
  type NewTaskInput,
  type UpdateTaskInput,
} from '../../../lib/tasks';
import { queryFnAdapter, mutationFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useAdminTasks = () =>
  useQuery({
    queryKey: queryKeys.tasks.lists(),
    queryFn: queryFnAdapter(() => listAdminTasks()),
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
  useQuery({
    queryKey: queryKeys.tasks.childAssignments(),
    queryFn: queryFnAdapter(() => listChildAssignments()),
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
    mutationFn: (input: NewTaskInput) => mutationFnAdapter(() => createTask(input))(),
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
    mutationFn: (assignmentId: string) =>
      mutationFnAdapter(() => approveAssignment(assignmentId))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useRejectAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, note }: { assignmentId: string; note: string }) =>
      mutationFnAdapter(() => rejectAssignment(assignmentId, note))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useCompleteAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, imageUri }: { assignmentId: string; imageUri: string | null }) =>
      mutationFnAdapter(() => completeAssignment(assignmentId, imageUri))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};
