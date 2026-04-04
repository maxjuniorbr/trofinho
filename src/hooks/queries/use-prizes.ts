import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { queryFnAdapter, mutationFnAdapter, paginatedQueryFnAdapter, type PaginatedPage } from './query-fn-adapter';
import { queryKeys, STALE_TIMES, PAGE_SIZES } from './query-keys';

export const usePrizes = () =>
  useInfiniteQuery({
    queryKey: queryKeys.prizes.lists(),
    queryFn: paginatedQueryFnAdapter(listPrizes, PAGE_SIZES.prizes),
    initialPageParam: 0,
    getNextPageParam: (lastPage: PaginatedPage<unknown>, _allPages: unknown[], lastPageParam: number) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    staleTime: STALE_TIMES.prizes,
  });

export const usePrizeDetail = (prizeId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.prizes.detail(prizeId ?? ''),
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
    mutationFn: (input: PrizeInput) =>
      mutationFnAdapter(() => createPrize(input))(),
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
    mutationFn: (id: string) =>
      mutationFnAdapter(() => reactivatePrize(id))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};
