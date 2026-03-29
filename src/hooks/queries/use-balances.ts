import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBalance,
  listAdminBalances,
  listTransactions,
  applyPenalty,
  configureAppreciation,
  transferToPiggyBank,
  syncAutomaticAppreciation,
  type AppreciationPeriod,
} from '../../../lib/balances';
import { queryFnAdapter, mutationFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useBalance = (childId?: string) =>
  useQuery({
    queryKey: childId ? queryKeys.balances.byChild(childId) : queryKeys.balances.self(),
    queryFn: queryFnAdapter(() => getBalance(childId)),
    staleTime: STALE_TIMES.balances,
  });

export const useAdminBalances = () =>
  useQuery({
    queryKey: queryKeys.balances.lists(),
    queryFn: queryFnAdapter(() => listAdminBalances()),
    staleTime: STALE_TIMES.balances,
  });

export const useTransactions = (childId: string) =>
  useQuery({
    queryKey: queryKeys.balances.transactions(childId),
    queryFn: queryFnAdapter(() => listTransactions(childId)),
    staleTime: STALE_TIMES.balances,
  });

export const useApplyPenalty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { childId: string; amount: number; description: string }) => {
      const result = await applyPenalty(args.childId, args.amount, args.description);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: async () => {
      await syncAutomaticAppreciation();
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useConfigureAppreciation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { childId: string; rate: number; period: AppreciationPeriod }) =>
      mutationFnAdapter(() => configureAppreciation(args.childId, args.rate, args.period))(),
    onSuccess: async () => {
      await syncAutomaticAppreciation();
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useTransferToPiggyBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { childId: string; amount: number }) =>
      mutationFnAdapter(() => transferToPiggyBank(args.childId, args.amount))(),
    onSuccess: async () => {
      await syncAutomaticAppreciation();
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};
