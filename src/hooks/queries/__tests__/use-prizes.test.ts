import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as prizesLib from '../../../../lib/prizes';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock({ withInfiniteQuery: true });
});

vi.mock('../../../../lib/prizes', () => ({
  listPrizes: vi.fn().mockResolvedValue({ data: [], error: null }),
  getPrize: vi.fn().mockResolvedValue({ data: { id: 'x', nome: 'Test' }, error: null }),
  listActivePrizes: vi.fn().mockResolvedValue({ data: [], hasMore: false, error: null }),
  createPrize: vi.fn().mockResolvedValue({ data: { id: 'new' }, error: null }),
  updatePrize: vi.fn().mockResolvedValue({ error: null, pointsMessage: null }),
  deactivatePrize: vi.fn().mockResolvedValue({ data: { pendingCount: 0 }, error: null, warning: null }),
  reactivatePrize: vi.fn().mockResolvedValue({ error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-prizes');

describe('use-prizes query hooks', () => {
  // Feature: react-query-migration, Property 3: Hooks with optional ID disable query when ID is undefined
  describe('Property 3: Hooks with optional ID disable query when ID is undefined', () => {
    it('usePrizeDetail sets enabled: false when prizeId is undefined', async () => {
      const { usePrizeDetail } = await loadHooks();
      usePrizeDetail(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('usePrizeDetail sets enabled: true for valid IDs', async () => {
      const { usePrizeDetail } = await loadHooks();
      usePrizeDetail('prize-1');
      expect(lastQueryOpts().enabled).toBe(true);
    });
  });

  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('usePrizes queryFn calls listPrizes', async () => {
      const { usePrizes } = await loadHooks();
      usePrizes();
      const qf = lastQueryOpts().queryFn as (ctx: { pageParam: number }) => Promise<unknown>;
      await qf({ pageParam: 0 });
      expect(prizesLib.listPrizes).toHaveBeenCalled();
    });

    it('usePrizeDetail queryFn calls getPrize', async () => {
      const { usePrizeDetail } = await loadHooks();
      usePrizeDetail('prize-1');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(prizesLib.getPrize).toHaveBeenCalledWith('prize-1');
    });

    it('usePrizes uses correct query key and staleTime', async () => {
      const { usePrizes } = await loadHooks();
      usePrizes();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.prizes.lists());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.prizes);
    });
  });
});

describe('use-prizes mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useCreatePrize invalidates prizes.all', async () => {
      const { useCreatePrize } = await loadHooks();
      useCreatePrize();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.prizes.all });
    });

    it('useUpdatePrize invalidates prizes.all', async () => {
      const { useUpdatePrize } = await loadHooks();
      useUpdatePrize();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.prizes.all });
    });

    it('useDeactivatePrize invalidates prizes.all', async () => {
      const { useDeactivatePrize } = await loadHooks();
      useDeactivatePrize();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.prizes.all });
    });

    it('useReactivatePrize invalidates prizes.all', async () => {
      const { useReactivatePrize } = await loadHooks();
      useReactivatePrize();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.prizes.all });
    });
  });
});

describe('use-prizes mutationFn execution', () => {
  it('useCreatePrize mutationFn calls createPrize with correct args', async () => {
    const { useCreatePrize } = await loadHooks();
    useCreatePrize();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const input = { nome: 'Ice cream', descricao: null, custo_pontos: 50, emoji: '🍦', estoque: 10 };
    await mutationFn({ input, familiaId: 'f1' });
    expect(prizesLib.createPrize).toHaveBeenCalledWith(input, 'f1');
  });

  it('useUpdatePrize mutationFn calls updatePrize and throws on error', async () => {
    vi.mocked(prizesLib.updatePrize).mockResolvedValueOnce({ error: 'Prêmio não encontrado', pointsMessage: null });
    const { useUpdatePrize } = await loadHooks();
    useUpdatePrize();
    const mutationFn = lastMutationOpts().mutationFn as (args: unknown) => Promise<unknown>;
    const input = { nome: 'Updated', descricao: null, custo_pontos: 100, emoji: '🎁', estoque: 5 };
    await expect(mutationFn({ id: 'p1', input })).rejects.toThrow('Prêmio não encontrado');
    expect(prizesLib.updatePrize).toHaveBeenCalledWith('p1', input);
  });

  it('useDeactivatePrize mutationFn calls deactivatePrize and returns data+warning', async () => {
    vi.mocked(prizesLib.deactivatePrize).mockResolvedValueOnce({
      data: { pendingCount: 2 },
      error: null,
      warning: 'Existem 2 resgates pendentes para este prêmio.',
    });
    const { useDeactivatePrize } = await loadHooks();
    useDeactivatePrize();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    const result = await mutationFn('p1');
    expect(prizesLib.deactivatePrize).toHaveBeenCalledWith('p1');
    expect(result).toEqual({
      data: { pendingCount: 2 },
      warning: 'Existem 2 resgates pendentes para este prêmio.',
    });
  });

  it('useDeactivatePrize mutationFn throws when lib returns error', async () => {
    vi.mocked(prizesLib.deactivatePrize).mockResolvedValueOnce({ data: null, error: 'Prêmio não encontrado', warning: null });
    const { useDeactivatePrize } = await loadHooks();
    useDeactivatePrize();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await expect(mutationFn('p1')).rejects.toThrow('Prêmio não encontrado');
  });

  it('useReactivatePrize mutationFn calls reactivatePrize', async () => {
    const { useReactivatePrize } = await loadHooks();
    useReactivatePrize();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('p1');
    expect(prizesLib.reactivatePrize).toHaveBeenCalledWith('p1');
  });
});
