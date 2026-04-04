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
    useInfiniteQuery: vi.fn((opts: Record<string, unknown>) => {
      capturedQuery.options.push(opts);
      return { data: undefined, isLoading: false, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false };
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
  listPrizes: vi.fn().mockResolvedValue({ data: [], error: null }),
  getPrize: vi.fn().mockResolvedValue({ data: { id: 'x', nome: 'Test' }, error: null }),
  listActivePrizes: vi.fn().mockResolvedValue({ data: [], error: null }),
  countPendingRedemptions: vi.fn().mockResolvedValue({ data: 0, error: null }),
  createPrize: vi.fn().mockResolvedValue({ data: { id: 'new' }, error: null }),
  updatePrize: vi.fn().mockResolvedValue({ error: null, imageUrl: null, pointsMessage: null }),
  deactivatePrize: vi.fn().mockResolvedValue({ error: null }),
  reactivatePrize: vi.fn().mockResolvedValue({ error: null }),
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
