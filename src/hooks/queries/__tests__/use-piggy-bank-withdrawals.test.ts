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
  listPendingPiggyBankWithdrawals: vi.fn().mockResolvedValue({ data: [], error: null }),
  getChildPendingWithdrawal: vi.fn().mockResolvedValue({ data: null, error: null }),
  requestPiggyBankWithdrawal: vi.fn().mockResolvedValue({ data: 'withdrawal-id-1', error: null }),
  confirmPiggyBankWithdrawal: vi.fn().mockResolvedValue({ error: null }),
  cancelPiggyBankWithdrawal: vi.fn().mockResolvedValue({ error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-piggy-bank-withdrawals');

describe('use-piggy-bank-withdrawals query hooks', () => {
  describe('queryFn delegates to the correct lib function', () => {
    it('usePendingPiggyBankWithdrawals calls listPendingPiggyBankWithdrawals', async () => {
      const { usePendingPiggyBankWithdrawals } = await loadHooks();
      usePendingPiggyBankWithdrawals();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(piggyBankLib.listPendingPiggyBankWithdrawals).toHaveBeenCalled();
    });

    it('useChildPendingWithdrawal calls getChildPendingWithdrawal with scoped child id', async () => {
      const { useChildPendingWithdrawal } = await loadHooks();
      useChildPendingWithdrawal('child-1');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(piggyBankLib.getChildPendingWithdrawal).toHaveBeenCalledWith('child-1');
    });
  });

  describe('query keys and staleTime', () => {
    it('usePendingPiggyBankWithdrawals uses pending key', async () => {
      const { usePendingPiggyBankWithdrawals } = await loadHooks();
      usePendingPiggyBankWithdrawals();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.piggyBankWithdrawals.pending());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.piggyBankWithdrawals);
    });

    it('useChildPendingWithdrawal uses scoped childPending key', async () => {
      const { useChildPendingWithdrawal } = await loadHooks();
      useChildPendingWithdrawal('child-1');
      expect(lastQueryOpts().queryKey).toEqual(
        queryKeys.piggyBankWithdrawals.childPending('child-1'),
      );
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
  });
});
