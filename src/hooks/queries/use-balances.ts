import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getBalance,
  listAdminBalances,
  listTransactions,
  listTransactionsByPeriod,
  applyPenalty,
  configureAppreciation,
  configurePiggyBank,
  transferToPiggyBank,
  syncAutomaticAppreciation,
} from '../../../lib/balances';
import {
  queryFnAdapter,
  nullableQueryFnAdapter,
  mutationFnAdapter,
  paginatedQueryFnAdapter,
  type PaginatedPage,
} from './query-fn-adapter';
import { queryKeys, STALE_TIMES, PAGE_SIZES } from './query-keys';

export const useBalance = (childId?: string) =>
  useQuery({
    queryKey: childId ? queryKeys.balances.byChild(childId) : queryKeys.balances.self(),
    queryFn: nullableQueryFnAdapter(() => getBalance(childId)),
    staleTime: STALE_TIMES.balances,
  });

export const useAdminBalances = () =>
  useQuery({
    queryKey: queryKeys.balances.lists(),
    queryFn: queryFnAdapter(() => listAdminBalances()),
    staleTime: STALE_TIMES.balances,
  });

export const useTransactions = (childId: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.balances.transactions(childId),
    queryFn: paginatedQueryFnAdapter(
      (page, pageSize) => listTransactions(childId, page, pageSize),
      PAGE_SIZES.transactions,
    ),
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: PaginatedPage<unknown>,
      _allPages: unknown[],
      lastPageParam: number,
    ) => (lastPage.hasMore ? lastPageParam + 1 : undefined),
    staleTime: STALE_TIMES.balances,
    enabled: !!childId,
  });

export const useTransactionsByPeriod = (childId: string, from: string, to: string) =>
  useQuery({
    queryKey: queryKeys.balances.transactionsByPeriod(childId, from, to),
    queryFn: queryFnAdapter(() => listTransactionsByPeriod(childId, from, to)),
    staleTime: STALE_TIMES.balances,
    enabled: !!childId,
    placeholderData: keepPreviousData,
  });

export const useApplyPenalty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { childId: string; amount: number; description: string }) => {
      const result = await applyPenalty(args.childId, args.amount, args.description);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useConfigureAppreciation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { childId: string; rate: number }) =>
      mutationFnAdapter(() => configureAppreciation(args.childId, args.rate))(),
    onSuccess: async () => {
      syncAutomaticAppreciation().catch(console.error);
      await queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useConfigurePiggyBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { childId: string; rate: number; withdrawalRate: number; prazo: number }) =>
      mutationFnAdapter(() =>
        configurePiggyBank(args.childId, {
          rate: args.rate,
          withdrawalRate: args.withdrawalRate,
          prazo: args.prazo,
        }),
      )(),
    onSuccess: async () => {
      syncAutomaticAppreciation().catch(console.error);
      await queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};

export const useTransferToPiggyBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { childId: string; amount: number }) =>
      mutationFnAdapter(() => transferToPiggyBank(args.childId, args.amount))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};
