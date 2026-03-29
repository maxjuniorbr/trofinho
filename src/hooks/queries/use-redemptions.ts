import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRedemptions,
  listChildRedemptions,
  confirmRedemption,
  cancelRedemption,
  requestRedemption,
} from '../../../lib/prizes';
import { queryFnAdapter, mutationFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useAdminRedemptions = () =>
  useQuery({
    queryKey: queryKeys.redemptions.admin(),
    queryFn: queryFnAdapter(() => listRedemptions()),
    staleTime: STALE_TIMES.redemptions,
  });

export const useChildRedemptions = () =>
  useQuery({
    queryKey: queryKeys.redemptions.child(),
    queryFn: queryFnAdapter(() => listChildRedemptions()),
    staleTime: STALE_TIMES.redemptions,
  });

export const useConfirmRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ redemptionId, opts }: {
      redemptionId: string;
      opts?: { familiaId: string; userId: string; prizeName: string };
    }) =>
      mutationFnAdapter(() => confirmRedemption(redemptionId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useCancelRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (redemptionId: string) =>
      mutationFnAdapter(() => cancelRedemption(redemptionId))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useRequestRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prizeId, opts }: {
      prizeId: string;
      opts?: { familiaId: string; childName: string; prizeName: string };
    }) =>
      queryFnAdapter(() => requestRedemption(prizeId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.prizes.all });
    },
  });
};
