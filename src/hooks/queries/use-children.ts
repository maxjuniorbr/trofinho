import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listChildren, getChild, getMyChildId, deactivateChild, reactivateChild } from '../../../lib/children';
import { queryFnAdapter, mutationFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

/**
 * Returns the filhos.id for the currently authenticated child user.
 * Accepts an optional userId (usuarios.id) to skip the auth.getUser() call
 * and avoid Supabase auth lock contention.
 */
export const useMyChildId = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.children.myId(),
    queryFn: async () => {
      const childId = await getMyChildId(userId);
      if (!childId) throw new Error('Perfil de filho não encontrado.');
      return childId;
    },
    staleTime: STALE_TIMES.children,
    enabled: !!userId,
  });

export const useChildrenList = () =>
  useQuery({
    queryKey: queryKeys.children.lists(),
    queryFn: queryFnAdapter(() => listChildren()),
    staleTime: STALE_TIMES.children,
  });

export const useChildDetail = (childId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.children.detail(childId!),
    queryFn: queryFnAdapter(() => getChild(childId!)),
    staleTime: STALE_TIMES.children,
    enabled: !!childId,
  });

export const useDeactivateChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => mutationFnAdapter(() => deactivateChild(childId))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.children.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useReactivateChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => mutationFnAdapter(() => reactivateChild(childId))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.children.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};
