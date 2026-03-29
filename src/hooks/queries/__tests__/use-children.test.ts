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

vi.mock('../../../../lib/children', () => ({
  listChildren: vi.fn().mockResolvedValue({ data: [], error: null }),
  getChild: vi.fn().mockResolvedValue({ data: { id: 'x', nome: 'Test' }, error: null }),
}));

import * as childrenLib from '../../../../lib/children';
import * as rq from '@tanstack/react-query';

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedQuery = () => (rq as unknown as { _capturedQuery: CapturedStore })._capturedQuery;
const lastQueryOpts = () => { const o = getCapturedQuery().options; return o.at(-1)!; };

beforeEach(() => {
  getCapturedQuery().options = [];
  mockInvalidateQueries.mockClear();
});

const loadHooks = () => import('../use-children');

describe('use-children query hooks', () => {
  // Feature: react-query-migration, Property 3: Hooks with optional ID disable query when ID is undefined
  describe('Property 3: Hooks with optional ID disable query when ID is undefined', () => {
    it('useChildDetail sets enabled: false when childId is undefined', async () => {
      const { useChildDetail } = await loadHooks();
      useChildDetail(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('useChildDetail sets enabled: true for any non-empty string ID', async () => {
      const { useChildDetail } = await loadHooks();
      fc.assert(
        fc.property(fc.uuid(), (id) => {
          useChildDetail(id);
          expect(lastQueryOpts().enabled).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useChildrenList queryFn calls listChildren', async () => {
      const { useChildrenList } = await loadHooks();
      useChildrenList();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(childrenLib.listChildren).toHaveBeenCalled();
    });

    it('useChildDetail queryFn calls getChild', async () => {
      const { useChildDetail } = await loadHooks();
      useChildDetail('child-1');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(childrenLib.getChild).toHaveBeenCalledWith('child-1');
    });

    it('useChildrenList uses correct query key and staleTime', async () => {
      const { useChildrenList } = await loadHooks();
      useChildrenList();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.children.lists());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.children);
    });

    it('useChildDetail uses correct query key and staleTime', async () => {
      const { useChildDetail } = await loadHooks();
      useChildDetail('abc-123');
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.children.detail('abc-123'));
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.children);
    });
  });
});
