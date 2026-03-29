import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => {
  const capturedQuery: { options: Record<string, unknown>[] } = { options: [] };
  const capturedMutation: { options: Record<string, unknown>[] } = { options: [] };

  return {
    useQuery: vi.fn((opts: Record<string, unknown>) => {
      capturedQuery.options.push(opts);
      return { data: undefined, isLoading: false, error: null };
    }),
    useMutation: vi.fn((opts: Record<string, unknown>) => {
      capturedMutation.options.push(opts);
      return { mutate: vi.fn(), isLoading: false };
    }),
    useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: { children: unknown }) => children,
    _capturedQuery: capturedQuery,
    _capturedMutation: capturedMutation,
  };
});

const mockSyncAppreciation = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../lib/balances', () => ({
  getBalance: vi.fn().mockResolvedValue({ data: { filho_id: 'x', saldo_livre: 0, cofrinho: 0 }, error: null }),
  listAdminBalances: vi.fn().mockResolvedValue({ data: [], error: null }),
  listTransactions: vi.fn().mockResolvedValue({ data: [], error: null }),
  applyPenalty: vi.fn().mockResolvedValue({ error: null }),
  configureAppreciation: vi.fn().mockResolvedValue({ error: null }),
  transferToPiggyBank: vi.fn().mockResolvedValue({ error: null }),
  syncAutomaticAppreciation: (...args: unknown[]) => mockSyncAppreciation(...args),
}));

import * as balancesLib from '../../../../lib/balances';
import * as rq from '@tanstack/react-query';

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedQuery = () => (rq as unknown as { _capturedQuery: CapturedStore })._capturedQuery;
const getCapturedMutation = () => (rq as unknown as { _capturedMutation: CapturedStore })._capturedMutation;
const lastQueryOpts = () => { const o = getCapturedQuery().options; return o.at(-1)!; };
const lastMutationOpts = () => { const o = getCapturedMutation().options; return o.at(-1)!; };

beforeEach(() => {
  getCapturedQuery().options = [];
  getCapturedMutation().options = [];
  mockInvalidateQueries.mockClear();
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
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
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

  // Feature: react-query-migration, Property 6: Balance-affecting mutations call syncAutomaticAppreciation before invalidating
  describe('Property 6: Balance-affecting mutations call syncAutomaticAppreciation before invalidating', () => {
    it('useApplyPenalty calls syncAutomaticAppreciation before invalidating', async () => {
      const { useApplyPenalty } = await loadHooks();
      const callOrder: string[] = [];
      mockSyncAppreciation.mockImplementation(() => { callOrder.push('sync'); return Promise.resolve(); });
      mockInvalidateQueries.mockImplementation(() => { callOrder.push('invalidate'); });

      useApplyPenalty();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();

      expect(callOrder).toEqual(['sync', 'invalidate']);
    });

    it('useConfigureAppreciation calls syncAutomaticAppreciation before invalidating', async () => {
      const { useConfigureAppreciation } = await loadHooks();
      const callOrder: string[] = [];
      mockSyncAppreciation.mockImplementation(() => { callOrder.push('sync'); return Promise.resolve(); });
      mockInvalidateQueries.mockImplementation(() => { callOrder.push('invalidate'); });

      useConfigureAppreciation();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();

      expect(callOrder).toEqual(['sync', 'invalidate']);
    });

    it('useTransferToPiggyBank calls syncAutomaticAppreciation before invalidating', async () => {
      const { useTransferToPiggyBank } = await loadHooks();
      const callOrder: string[] = [];
      mockSyncAppreciation.mockImplementation(() => { callOrder.push('sync'); return Promise.resolve(); });
      mockInvalidateQueries.mockImplementation(() => { callOrder.push('invalidate'); });

      useTransferToPiggyBank();
      const onSuccess = lastMutationOpts().onSuccess as () => Promise<void>;
      await onSuccess();

      expect(callOrder).toEqual(['sync', 'invalidate']);
    });
  });
});
