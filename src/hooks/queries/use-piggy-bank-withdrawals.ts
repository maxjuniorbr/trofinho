import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  requestPiggyBankWithdrawal,
  confirmPiggyBankWithdrawal,
  cancelPiggyBankWithdrawal,
  listPendingPiggyBankWithdrawals,
  getChildPendingWithdrawal,
  configureWithdrawalRate,
  countPendingPiggyBankWithdrawals,
} from '../../../lib/piggy-bank-withdrawal';
import { queryFnAdapter, mutationFnAdapter, nullableQueryFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const usePendingPiggyBankWithdrawalCount = () =>
  useQuery({
    queryKey: queryKeys.piggyBankWithdrawals.pendingCount(),
    queryFn: queryFnAdapter(() => countPendingPiggyBankWithdrawals()),
    staleTime: STALE_TIMES.piggyBankWithdrawals,
  });

export const usePendingPiggyBankWithdrawals = () =>
  useQuery({
    queryKey: queryKeys.piggyBankWithdrawals.pending(),
    queryFn: queryFnAdapter(() => listPendingPiggyBankWithdrawals()),
    staleTime: STALE_TIMES.piggyBankWithdrawals,
  });

export const useChildPendingWithdrawal = () =>
  useQuery({
    queryKey: queryKeys.piggyBankWithdrawals.childPending(),
    queryFn: nullableQueryFnAdapter(() => getChildPendingWithdrawal()),
    staleTime: STALE_TIMES.piggyBankWithdrawals,
  });

export const useRequestPiggyBankWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      amount,
      opts,
    }: {
      amount: number;
      opts?: { familiaId: string; childName: string; childUserId?: string };
    }) => queryFnAdapter(() => requestPiggyBankWithdrawal(amount, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.piggyBankWithdrawals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useConfirmPiggyBankWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      withdrawalId,
      opts,
    }: {
      withdrawalId: string;
      opts: { familiaId: string; userId?: string | null; amount: number };
    }) => mutationFnAdapter(() => confirmPiggyBankWithdrawal(withdrawalId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.piggyBankWithdrawals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useCancelPiggyBankWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      withdrawalId,
      opts,
    }: {
      withdrawalId: string;
      opts?: { familiaId: string; userId?: string | null; amount: number };
    }) => mutationFnAdapter(() => cancelPiggyBankWithdrawal(withdrawalId, opts))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.piggyBankWithdrawals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useConfigureWithdrawalRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, rate }: { childId: string; rate: number }) =>
      mutationFnAdapter(() => configureWithdrawalRate(childId, rate))(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};
