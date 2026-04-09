import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as piggyBankLib from '../../../../lib/piggy-bank-withdrawal';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock();
});

vi.mock('../../../../lib/piggy-bank-withdrawal', () => ({
  countPendingPiggyBankWithdrawals: vi.fn().mockResolvedValue({ data: 0, error: null }),
  listPendingPiggyBankWithdrawals: vi.fn().mockResolvedValue({ data: [], error: null }),
  getChildPendingWithdrawal: vi.fn().mockResolvedValue({ data: null, error: null }),
  requestPiggyBankWithdrawal: vi.fn().mockResolvedValue({ data: 'withdrawal-id-1', error: null }),
  confirmPiggyBankWithdrawal: vi.fn().mockResolvedValue({ error: null }),
  cancelPiggyBankWithdrawal: vi.fn().mockResolvedValue({ error: null }),
  configureWithdrawalRate: vi.fn().mockResolvedValue({ error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-piggy-bank-withdrawals');

describe('use-piggy-bank-withdrawals query hooks', () => {
  describe('queryFn delegates to the correct lib function', () => {
    it('usePendingPiggyBankWithdrawalCount calls countPendingPiggyBankWithdrawals', async () => {
      const { usePendingPiggyBankWithdrawalCount } = await loadHooks();
      usePendingPiggyBankWithdrawalCount();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(piggyBankLib.countPendingPiggyBankWithdrawals).toHaveBeenCalled();
    });

    it('usePendingPiggyBankWithdrawals calls listPendingPiggyBankWithdrawals', async () => {
      const { usePendingPiggyBankWithdrawals } = await loadHooks();
      usePendingPiggyBankWithdrawals();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(piggyBankLib.listPendingPiggyBankWithdrawals).toHaveBeenCalled();
    });

    it('useChildPendingWithdrawal calls getChildPendingWithdrawal', async () => {
      const { useChildPendingWithdrawal } = await loadHooks();
      useChildPendingWithdrawal();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(piggyBankLib.getChildPendingWithdrawal).toHaveBeenCalled();
    });
  });

  describe('query keys and staleTime', () => {
    it('usePendingPiggyBankWithdrawalCount uses pendingCount key', async () => {
      const { usePendingPiggyBankWithdrawalCount } = await loadHooks();
      usePendingPiggyBankWithdrawalCount();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.piggyBankWithdrawals.pendingCount());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.piggyBankWithdrawals);
    });

    it('usePendingPiggyBankWithdrawals uses pending key', async () => {
      const { usePendingPiggyBankWithdrawals } = await loadHooks();
      usePendingPiggyBankWithdrawals();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.piggyBankWithdrawals.pending());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.piggyBankWithdrawals);
    });

    it('useChildPendingWithdrawal uses childPending key', async () => {
      const { useChildPendingWithdrawal } = await loadHooks();
      useChildPendingWithdrawal();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.piggyBankWithdrawals.childPending());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.piggyBankWithdrawals);
    });
  });
});

describe('use-piggy-bank-withdrawals mutation hooks', () => {
  describe('mutations invalidate the correct query keys on success', () => {
    it('useRequestPiggyBankWithdrawal invalidates withdrawals.all and balances.all', async () => {
      const { useRequestPiggyBankWithdrawal } = await loadHooks();
      useRequestPiggyBankWithdrawal();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.piggyBankWithdrawals.all,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useConfirmPiggyBankWithdrawal invalidates withdrawals.all and balances.all', async () => {
      const { useConfirmPiggyBankWithdrawal } = await loadHooks();
      useConfirmPiggyBankWithdrawal();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.piggyBankWithdrawals.all,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useCancelPiggyBankWithdrawal invalidates withdrawals.all and balances.all', async () => {
      const { useCancelPiggyBankWithdrawal } = await loadHooks();
      useCancelPiggyBankWithdrawal();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.piggyBankWithdrawals.all,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useConfigureWithdrawalRate invalidates only balances.all', async () => {
      const { useConfigureWithdrawalRate } = await loadHooks();
      useConfigureWithdrawalRate();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutation functions delegate to the correct lib function', () => {
    it('useRequestPiggyBankWithdrawal mutationFn calls requestPiggyBankWithdrawal', async () => {
      const { useRequestPiggyBankWithdrawal } = await loadHooks();
      useRequestPiggyBankWithdrawal();
      const mutationFn = lastMutationOpts().mutationFn as (args: {
        amount: number;
      }) => Promise<unknown>;
      await mutationFn({ amount: 50 });
      expect(piggyBankLib.requestPiggyBankWithdrawal).toHaveBeenCalledWith(50, undefined);
    });

    it('useConfigureWithdrawalRate mutationFn calls configureWithdrawalRate', async () => {
      const { useConfigureWithdrawalRate } = await loadHooks();
      useConfigureWithdrawalRate();
      const mutationFn = lastMutationOpts().mutationFn as (args: {
        childId: string;
        rate: number;
      }) => Promise<unknown>;
      await mutationFn({ childId: 'child-1', rate: 0.1 });
      expect(piggyBankLib.configureWithdrawalRate).toHaveBeenCalledWith('child-1', 0.1);
    });
  });
});
