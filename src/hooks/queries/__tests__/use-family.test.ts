import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as familyLib from '../../../../lib/family';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock();
});

vi.mock('../../../../lib/family', () => ({
  getFamily: vi.fn().mockResolvedValue({ nome: 'Test' }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;

beforeEach(() => qh.reset());

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
