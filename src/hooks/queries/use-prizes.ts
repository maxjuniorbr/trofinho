import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPrizes,
  getPrize,
  listActivePrizes,
  countPendingRedemptions,
  createPrize,
  updatePrize,
  deactivatePrize,
  reactivatePrize,
  type PrizeInput,
  type UpdatePrizeInput,
} from '../../../lib/prizes';
import { queryFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const usePrizes = () =>
  useQuery({
    queryKey: queryKeys.prizes.lists(),
    queryFn: queryFnAdapter(() => listPrizes()),
    staleTime: STALE_TIMES.prizes,
  });

export const usePrizeDetail = (prizeId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.prizes.detail(prizeId!),
    queryFn: queryFnAdapter(() => getPrize(prizeId!)),
    staleTime: STALE_TIMES.prizes,
    enabled: !!prizeId,
  });

export const useActivePrizes = () =>
  useQuery({
    queryKey: queryKeys.prizes.active(),
    queryFn: queryFnAdapter(() => listActivePrizes()),
    staleTime: STALE_TIMES.prizes,
  });

export const usePendingRedemptionCount = () =>
  useQuery({
    queryKey: queryKeys.prizes.pendingRedemptionCount(),
    queryFn: queryFnAdapter(() => countPendingRedemptions()),
    staleTime: STALE_TIMES.prizes,
  });

export const useCreatePrize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PrizeInput) => {
      const fn = async () => {
        const result = await createPrize(input);
        if (result.error) return { error: result.error };
        return { error: null };
      };
      return fn().then((r) => { if (r.error) throw new Error(r.error); });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};

export const useUpdatePrize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePrizeInput }) => {
      const fn = async () => {
        const result = await updatePrize(id, input);
        if (result.error) throw new Error(result.error);
        return result;
      };
      return fn();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};

export const useDeactivatePrize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deactivatePrize(id);
      if (result.error) throw new Error(result.error);
      return { data: result.data, warning: result.warning };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};

export const useReactivatePrize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await reactivatePrize(id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};
