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

vi.mock('../../../../lib/prizes', () => ({
  listRedemptions: vi.fn().mockResolvedValue({ data: [], error: null }),
  listChildRedemptions: vi.fn().mockResolvedValue({ data: [], error: null }),
  confirmRedemption: vi.fn().mockResolvedValue({ error: null }),
  cancelRedemption: vi.fn().mockResolvedValue({ error: null }),
  requestRedemption: vi.fn().mockResolvedValue({ data: 'ok', error: null }),
}));

import * as prizesLib from '../../../../lib/prizes';
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
});

const loadHooks = () => import('../use-redemptions');

describe('use-redemptions query hooks', () => {
  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useAdminRedemptions queryFn calls listRedemptions', async () => {
      const { useAdminRedemptions } = await loadHooks();
      useAdminRedemptions();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(prizesLib.listRedemptions).toHaveBeenCalled();
    });

    it('useChildRedemptions queryFn calls listChildRedemptions', async () => {
      const { useChildRedemptions } = await loadHooks();
      useChildRedemptions();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(prizesLib.listChildRedemptions).toHaveBeenCalled();
    });

    it('useAdminRedemptions uses correct query key and staleTime', async () => {
      const { useAdminRedemptions } = await loadHooks();
      useAdminRedemptions();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.redemptions.admin());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.redemptions);
    });
  });
});

describe('use-redemptions mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useConfirmRedemption invalidates redemptions.all and balances.all', async () => {
      const { useConfirmRedemption } = await loadHooks();
      useConfirmRedemption();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.redemptions.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useCancelRedemption invalidates redemptions.all and balances.all', async () => {
      const { useCancelRedemption } = await loadHooks();
      useCancelRedemption();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.redemptions.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    });

    it('useRequestRedemption invalidates redemptions.all, balances.all, and prizes.all', async () => {
      const { useRequestRedemption } = await loadHooks();
      useRequestRedemption();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.redemptions.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.prizes.all });
    });
  });
});
