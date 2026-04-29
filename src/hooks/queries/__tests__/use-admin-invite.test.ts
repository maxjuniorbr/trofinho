import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as adminInviteLib from '../../../../lib/admin-invite';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock();
});

vi.mock('../../../../lib/admin-invite', () => ({
  generateInvite: vi.fn().mockResolvedValue({ data: { codigo: 'ABC123', expires_at: '2026-05-01' }, error: null }),
  validateInvite: vi.fn().mockResolvedValue({ data: { familia_nome: 'Test', admin_nome: 'Admin' }, error: null }),
  acceptInvite: vi.fn().mockResolvedValue({ data: { familia_id: 'fam-1' }, error: null }),
  cancelInvite: vi.fn().mockResolvedValue({ error: null }),
  removeCoAdmin: vi.fn().mockResolvedValue({ error: null }),
  listFamilyAdmins: vi.fn().mockResolvedValue({ data: [], error: null }),
  getPendingInvite: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-admin-invite');

describe('use-admin-invite query hooks', () => {
  describe('useAdminInvite', () => {
    it('uses correct query key and staleTime', async () => {
      const { useAdminInvite } = await loadHooks();
      useAdminInvite('family-123');
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.adminInvite.pending('family-123'));
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.adminInvite);
    });

    it('disables query when familyId is undefined', async () => {
      const { useAdminInvite } = await loadHooks();
      useAdminInvite(undefined);
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('enables query when familyId is provided', async () => {
      const { useAdminInvite } = await loadHooks();
      useAdminInvite('family-123');
      expect(lastQueryOpts().enabled).toBe(true);
    });

    it('queryFn delegates to getPendingInvite', async () => {
      const { useAdminInvite } = await loadHooks();
      useAdminInvite('family-123');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(adminInviteLib.getPendingInvite).toHaveBeenCalled();
    });
  });

  describe('useFamilyAdmins', () => {
    it('uses correct query key and staleTime', async () => {
      const { useFamilyAdmins } = await loadHooks();
      useFamilyAdmins();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.adminInvite.admins());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.adminInvite);
    });

    it('queryFn delegates to listFamilyAdmins', async () => {
      const { useFamilyAdmins } = await loadHooks();
      useFamilyAdmins();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(adminInviteLib.listFamilyAdmins).toHaveBeenCalled();
    });
  });

  describe('useValidateInvite', () => {
    it('uses correct query key and staleTime', async () => {
      const { useValidateInvite } = await loadHooks();
      useValidateInvite('ABC123');
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.adminInvite.validate('ABC123'));
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.adminInvite);
    });

    it('enables query when code is 6 characters', async () => {
      const { useValidateInvite } = await loadHooks();
      useValidateInvite('ABCDEF');
      expect(lastQueryOpts().enabled).toBe(true);
    });

    it('disables query when code is shorter than 6 characters', async () => {
      const { useValidateInvite } = await loadHooks();
      useValidateInvite('ABC');
      expect(lastQueryOpts().enabled).toBe(false);
    });

    it('queryFn delegates to validateInvite', async () => {
      const { useValidateInvite } = await loadHooks();
      useValidateInvite('ABC123');
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(adminInviteLib.validateInvite).toHaveBeenCalled();
    });
  });
});

describe('use-admin-invite mutation hooks', () => {
  describe('useGenerateInvite', () => {
    it('mutationFn calls generateInvite and returns data on success', async () => {
      const { useGenerateInvite } = await loadHooks();
      useGenerateInvite();
      const mutationFn = lastMutationOpts().mutationFn as () => Promise<unknown>;
      const result = await mutationFn();
      expect(adminInviteLib.generateInvite).toHaveBeenCalled();
      expect(result).toEqual({ codigo: 'ABC123', expires_at: '2026-05-01' });
    });

    it('mutationFn throws when generateInvite returns error', async () => {
      vi.mocked(adminInviteLib.generateInvite).mockResolvedValueOnce({
        data: null,
        error: 'Invite generation failed',
      });
      const { useGenerateInvite } = await loadHooks();
      useGenerateInvite();
      const mutationFn = lastMutationOpts().mutationFn as () => Promise<unknown>;
      await expect(mutationFn()).rejects.toThrow('Invite generation failed');
    });

    it('invalidates adminInvite.all on success', async () => {
      const { useGenerateInvite } = await loadHooks();
      useGenerateInvite();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.adminInvite.all,
      });
    });
  });

  describe('useCancelInvite', () => {
    it('mutationFn calls cancelInvite', async () => {
      const { useCancelInvite } = await loadHooks();
      useCancelInvite();
      const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<void>;
      await mutationFn('invite-1');
      expect(adminInviteLib.cancelInvite).toHaveBeenCalledWith('invite-1');
    });

    it('mutationFn throws when cancelInvite returns error', async () => {
      vi.mocked(adminInviteLib.cancelInvite).mockResolvedValueOnce({
        error: 'Cancel failed',
      });
      const { useCancelInvite } = await loadHooks();
      useCancelInvite();
      const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<void>;
      await expect(mutationFn('invite-1')).rejects.toThrow('Cancel failed');
    });

    it('invalidates adminInvite.all on success', async () => {
      const { useCancelInvite } = await loadHooks();
      useCancelInvite();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.adminInvite.all,
      });
    });
  });

  describe('useAcceptInvite', () => {
    it('mutationFn calls acceptInvite and returns data on success', async () => {
      const { useAcceptInvite } = await loadHooks();
      useAcceptInvite();
      const mutationFn = lastMutationOpts().mutationFn as (
        args: { code: string; name: string },
      ) => Promise<unknown>;
      const result = await mutationFn({ code: 'ABC123', name: 'Maria' });
      expect(adminInviteLib.acceptInvite).toHaveBeenCalledWith('ABC123', 'Maria');
      expect(result).toEqual({ familia_id: 'fam-1' });
    });

    it('mutationFn throws when acceptInvite returns error', async () => {
      vi.mocked(adminInviteLib.acceptInvite).mockResolvedValueOnce({
        data: null,
        error: 'Accept failed',
      });
      const { useAcceptInvite } = await loadHooks();
      useAcceptInvite();
      const mutationFn = lastMutationOpts().mutationFn as (
        args: { code: string; name: string },
      ) => Promise<unknown>;
      await expect(mutationFn({ code: 'ABC123', name: 'Maria' })).rejects.toThrow('Accept failed');
    });

    it('invalidates profile.all and adminInvite.all on success', async () => {
      const { useAcceptInvite } = await loadHooks();
      useAcceptInvite();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.profile.all,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.adminInvite.all,
      });
    });
  });

  describe('useRemoveCoAdmin', () => {
    it('mutationFn calls removeCoAdmin', async () => {
      const { useRemoveCoAdmin } = await loadHooks();
      useRemoveCoAdmin();
      const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<void>;
      await mutationFn('user-1');
      expect(adminInviteLib.removeCoAdmin).toHaveBeenCalledWith('user-1');
    });

    it('mutationFn throws when removeCoAdmin returns error', async () => {
      vi.mocked(adminInviteLib.removeCoAdmin).mockResolvedValueOnce({
        error: 'Remove failed',
      });
      const { useRemoveCoAdmin } = await loadHooks();
      useRemoveCoAdmin();
      const mutationFn = lastMutationOpts().mutationFn as (id: string) => Promise<void>;
      await expect(mutationFn('user-1')).rejects.toThrow('Remove failed');
    });

    it('invalidates adminInvite.admins on success', async () => {
      const { useRemoveCoAdmin } = await loadHooks();
      useRemoveCoAdmin();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.adminInvite.admins(),
      });
    });
  });
});
