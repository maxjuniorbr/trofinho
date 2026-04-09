import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as balancesLib from '../../../../lib/balances';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock({ withInfiniteQuery: true });
});

const mockSyncAppreciation = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../lib/balances', () => ({
  getBalance: vi
    .fn()
    .mockResolvedValue({ data: { filho_id: 'x', saldo_livre: 0, cofrinho: 0 }, error: null }),
  listAdminBalances: vi.fn().mockResolvedValue({ data: [], error: null }),
  listTransactions: vi.fn().mockResolvedValue({ data: [], error: null }),
  applyPenalty: vi.fn().mockResolvedValue({ error: null }),
  configureAppreciation: vi.fn().mockResolvedValue({ error: null }),
  transferToPiggyBank: vi.fn().mockResolvedValue({ error: null }),
  syncAutomaticAppreciation: (...args: unknown[]) => mockSyncAppreciation(...args),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => {
  qh.reset();
  mockSyncAppreciation.mockClear();
});

const loadHooks = () => import('../use-balances');

describe('use-balances query hooks', () => {
  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useAdminBalances queryFn calls listAdminBalances', async () => {
      const { useAdminBalances } = await loadHooks();
      useAdminBalances();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(balancesLib.listAdminBalances).toHaveBeenCalled();
    });

    it('useBalance queryFn calls getBalance', async () => {
      const { useBalance } = await loadHooks();
      useBalance('child-1');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(balancesLib.getBalance).toHaveBeenCalledWith('child-1');
    });

    it('useAdminBalances uses correct query key and staleTime', async () => {
      const { useAdminBalances } = await loadHooks();
      useAdminBalances();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.balances.lists());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.balances);
    });
  });

  // Feature: react-query-migration, Property 7: Balance query hooks do not call syncAutomaticAppreciation
  describe('Property 7: Balance query hooks do not call syncAutomaticAppreciation', () => {
    it('useBalance queryFn does not call syncAutomaticAppreciation', async () => {
      const { useBalance } = await loadHooks();
      useBalance();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(mockSyncAppreciation).not.toHaveBeenCalled();
    });

    it('useAdminBalances queryFn does not call syncAutomaticAppreciation', async () => {
      const { useAdminBalances } = await loadHooks();
      useAdminBalances();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(mockSyncAppreciation).not.toHaveBeenCalled();
    });

    it('useTransactions queryFn does not call syncAutomaticAppreciation', async () => {
      const { useTransactions } = await loadHooks();
      useTransactions('child-1');
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(mockSyncAppreciation).not.toHaveBeenCalled();
    });
  });
});

describe('use-balances mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useApplyPenalty invalidates balances.all', async () => {
      const { useApplyPenalty } = await loadHooks();
      useApplyPenalty();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useConfigureAppreciation invalidates balances.all', async () => {
      const { useConfigureAppreciation } = await loadHooks();
      useConfigureAppreciation();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useTransferToPiggyBank invalidates balances.all', async () => {
      const { useTransferToPiggyBank } = await loadHooks();
      useTransferToPiggyBank();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });
  });

  // Feature: S27 — syncAutomaticAppreciation moved to pg_cron; only useConfigureAppreciation still syncs client-side
  describe('Property 6: Only config mutation calls syncAutomaticAppreciation before invalidating', () => {
    it('useApplyPenalty invalidates without syncing', async () => {
      const { useApplyPenalty } = await loadHooks();

      useApplyPenalty();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();

      expect(mockSyncAppreciation).not.toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useConfigureAppreciation calls syncAutomaticAppreciation before invalidating', async () => {
      const { useConfigureAppreciation } = await loadHooks();
      const callOrder: string[] = [];
      mockSyncAppreciation.mockImplementation(() => {
        callOrder.push('sync');
        return Promise.resolve();
      });
      mockInvalidateQueries.mockImplementation(() => {
        callOrder.push('invalidate');
      });

      useConfigureAppreciation();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();

      expect(callOrder).toEqual(['sync', 'invalidate']);
    });

    it('useTransferToPiggyBank invalidates without syncing', async () => {
      const { useTransferToPiggyBank } = await loadHooks();

      useTransferToPiggyBank();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();

      expect(mockSyncAppreciation).not.toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });
  });
});
