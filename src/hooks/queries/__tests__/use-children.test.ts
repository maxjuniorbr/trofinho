import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as childrenLib from '../../../../lib/children';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock();
});

vi.mock('../../../../lib/children', () => ({
  listChildren: vi.fn().mockResolvedValue({ data: [], error: null }),
  getChild: vi.fn().mockResolvedValue({ data: { id: 'x', nome: 'Test' }, error: null }),
  getMyChildId: vi.fn().mockResolvedValue('child-id-1'),
  deactivateChild: vi.fn().mockResolvedValue({ error: null }),
  reactivateChild: vi.fn().mockResolvedValue({ error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

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

describe('use-children additional query hooks', () => {
  describe('Property 3: Hooks with optional ID disable query when ID is undefined', () => {
    it('useMyChildId sets enabled: false when userId is undefined', async () => {
      const { useMyChildId } = await loadHooks();
      useMyChildId(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('useMyChildId sets enabled: true when userId is provided', async () => {
      const { useMyChildId } = await loadHooks();
      useMyChildId('user-123');
      expect(lastQueryOpts().enabled).toBe(true);
    });
  });
});

describe('use-children mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useDeactivateChild invalidates children.all, balances.all, and tasks.all', async () => {
      const { useDeactivateChild } = await loadHooks();
      useDeactivateChild();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.children.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    });

    it('useReactivateChild invalidates children.all, balances.all, and tasks.all', async () => {
      const { useReactivateChild } = await loadHooks();
      useReactivateChild();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.children.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    });
  });
});

describe('use-children mutationFn execution', () => {
  it('useDeactivateChild mutationFn calls deactivateChild with correct args', async () => {
    const { useDeactivateChild } = await loadHooks();
    useDeactivateChild();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('child-1');
    expect(childrenLib.deactivateChild).toHaveBeenCalledWith('child-1');
  });

  it('useReactivateChild mutationFn calls reactivateChild with correct args', async () => {
    const { useReactivateChild } = await loadHooks();
    useReactivateChild();
    const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<unknown>;
    await mutationFn('child-1');
    expect(childrenLib.reactivateChild).toHaveBeenCalledWith('child-1');
  });

  it('useMyChildId queryFn calls getMyChildId and throws when result is null', async () => {
    vi.mocked(childrenLib.getMyChildId).mockResolvedValueOnce(null);
    const { useMyChildId } = await loadHooks();
    useMyChildId('user-1');
    const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
    await expect(qf()).rejects.toThrow('Perfil de filho não encontrado.');
  });
});
