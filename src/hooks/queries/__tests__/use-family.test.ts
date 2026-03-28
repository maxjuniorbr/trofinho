import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
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

vi.mock('../../../../lib/family', () => ({
  getFamily: vi.fn().mockResolvedValue({ nome: 'Test' }),
}));

import * as familyLib from '../../../../lib/family';
import * as rq from '@tanstack/react-query';

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedQuery = () => (rq as unknown as { _capturedQuery: CapturedStore })._capturedQuery;
const lastQueryOpts = () => { const o = getCapturedQuery().options; return o[o.length - 1]; };

beforeEach(() => {
  getCapturedQuery().options = [];
  mockInvalidateQueries.mockClear();
});

const loadHooks = () => import('../use-family');

describe('use-family query hooks', () => {
  // Feature: react-query-migration, Property 3: Hooks with optional ID disable query when ID is undefined
  describe('Property 3: Hooks with optional ID disable query when ID is undefined', () => {
    it('useFamily sets enabled: false when familiaId is undefined', async () => {
      const { useFamily } = await loadHooks();
      useFamily(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('useFamily sets enabled: true for any non-empty string ID', async () => {
      const { useFamily } = await loadHooks();
      fc.assert(
        fc.property(fc.uuid(), (id) => {
          useFamily(id);
          expect(lastQueryOpts().enabled).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useFamily queryFn calls getFamily', async () => {
      const { useFamily } = await loadHooks();
      useFamily('family-1');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(familyLib.getFamily).toHaveBeenCalledWith('family-1');
    });

    it('useFamily uses correct query key and staleTime', async () => {
      const { useFamily } = await loadHooks();
      useFamily('fam-abc');
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.family.detail('fam-abc'));
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.family);
    });
  });
});
