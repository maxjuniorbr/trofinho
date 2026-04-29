import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as redemptionsLib from '../../../../lib/redemptions';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock({ withInfiniteQuery: true });
});

vi.mock('../../../../lib/redemptions', () => ({
  listRedemptions: vi.fn().mockResolvedValue({ data: [], error: null }),
  listChildRedemptions: vi.fn().mockResolvedValue({ data: [], error: null }),
  confirmRedemption: vi.fn().mockResolvedValue({ error: null }),
  cancelRedemption: vi.fn().mockResolvedValue({ error: null }),
  requestRedemption: vi.fn().mockResolvedValue({ data: 'ok', error: null }),
  countPendingRedemptions: vi.fn().mockResolvedValue({ data: 0, error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-redemptions');

describe('use-redemptions query hooks', () => {
  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useAdminRedemptions queryFn calls listRedemptions', async () => {
      const { useAdminRedemptions } = await loadHooks();
      useAdminRedemptions();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(redemptionsLib.listRedemptions).toHaveBeenCalled();
    });

    it('useChildRedemptions queryFn calls listChildRedemptions', async () => {
      const { useChildRedemptions } = await loadHooks();
      useChildRedemptions();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(redemptionsLib.listChildRedemptions).toHaveBeenCalled();
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

describe('use-redemptions mutationFn execution', () => {
  it('useConfirmRedemption mutationFn calls confirmRedemption with correct args', async () => {
    const { useConfirmRedemption } = await loadHooks();
    useConfirmRedemption();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', userId: 'u1', prizeName: 'Ice cream' };
    await mutationFn({ redemptionId: 'r1', opts });
    expect(redemptionsLib.confirmRedemption).toHaveBeenCalledWith('r1', opts);
  });

  it('useCancelRedemption mutationFn calls cancelRedemption with correct args', async () => {
    const { useCancelRedemption } = await loadHooks();
    useCancelRedemption();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', userId: 'u1', prizeName: 'Ice cream' };
    await mutationFn({ redemptionId: 'r1', opts });
    expect(redemptionsLib.cancelRedemption).toHaveBeenCalledWith('r1', opts);
  });

  it('useRequestRedemption mutationFn calls requestRedemption with correct args', async () => {
    const { useRequestRedemption } = await loadHooks();
    useRequestRedemption();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const opts = { familiaId: 'f1', childName: 'Child', prizeName: 'Ice cream' };
    await mutationFn({ prizeId: 'p1', opts });
    expect(redemptionsLib.requestRedemption).toHaveBeenCalledWith('p1', opts);
  });
});
