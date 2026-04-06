import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRedemptions,
  listChildRedemptions,
  confirmRedemption,
  cancelRedemption,
  requestRedemption,
} from '../../../lib/redemptions';
import {
  queryFnAdapter,
  mutationFnAdapter,
  paginatedQueryFnAdapter,
  type PaginatedPage,
} from './query-fn-adapter';
import { queryKeys, STALE_TIMES, PAGE_SIZES } from './query-keys';

export const useAdminRedemptions = () =>
  useInfiniteQuery({
    queryKey: queryKeys.redemptions.admin(),
    queryFn: paginatedQueryFnAdapter(listRedemptions, PAGE_SIZES.redemptions),
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: PaginatedPage<unknown>,
      _allPages: unknown[],
      lastPageParam: number,
    ) => (lastPage.hasMore ? lastPageParam + 1 : undefined),
    staleTime: STALE_TIMES.redemptions,
  });

export const useChildRedemptions = () =>
  useInfiniteQuery({
    queryKey: queryKeys.redemptions.child(),
    queryFn: paginatedQueryFnAdapter(listChildRedemptions, PAGE_SIZES.redemptions),
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: PaginatedPage<unknown>,
      _allPages: unknown[],
      lastPageParam: number,
    ) => (lastPage.hasMore ? lastPageParam + 1 : undefined),
    staleTime: STALE_TIMES.redemptions,
  });

export const useConfirmRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      redemptionId,
      opts,
    }: {
      redemptionId: string;
      opts: { familiaId: string; userId?: string | null; prizeName: string };
    }) => mutationFnAdapter(() => confirmRedemption(redemptionId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useCancelRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      redemptionId,
      opts,
    }: {
      redemptionId: string;
      opts?: { familiaId: string; userId?: string | null; prizeName: string };
    }) => mutationFnAdapter(() => cancelRedemption(redemptionId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useRequestRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      prizeId,
      opts,
    }: {
      prizeId: string;
      opts?: { familiaId: string; childName: string; prizeName: string; childUserId?: string };
    }) => queryFnAdapter(() => requestRedemption(prizeId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};
