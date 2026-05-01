import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, STALE_TIMES } from '../query-keys';

import * as authLib from '../../../../lib/auth';
import * as notificationsLib from '../../../../lib/notifications';
import * as rq from '@tanstack/react-query';
import { getQueryHelpers } from '../../../../test/helpers/query-test-utils';

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMock } = await import('../../../../test/helpers/query-test-utils');
  return createReactQueryMock();
});

vi.mock('../../../../lib/auth', () => ({
  getProfile: vi
    .fn()
    .mockResolvedValue({ id: 'u1', familia_id: 'f1', papel: 'admin', nome: 'Test' }),
  getCurrentAuthUser: vi.fn().mockResolvedValue({ email: 'test@test.com', avatarUrl: null }),
  updateUserName: vi.fn().mockResolvedValue({ error: null }),
  updateUserAvatar: vi.fn().mockResolvedValue({ url: 'https://img.test/avatar.png', error: null }),
  deleteAccount: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('../../../../lib/notifications', () => ({
  getNotificationPrefs: vi.fn().mockResolvedValue({
    tarefasPendentes: true,
    tarefaAprovada: true,
    tarefaRejeitada: true,
    tarefaConcluida: true,
    resgatesSolicitado: true,
    resgateConfirmado: true,
    resgateCancelado: true,
    resgateCofrinhoSolicitado: true,
    resgateCofrinhoConfirmado: true,
    resgateCofrinhoCancelado: true,
  }),
  DEFAULT_NOTIFICATION_PREFS: {
    tarefasPendentes: true,
    tarefaAprovada: true,
    tarefaRejeitada: true,
    tarefaConcluida: true,
    resgatesSolicitado: true,
    resgateConfirmado: true,
    resgateCancelado: true,
    resgateCofrinhoSolicitado: true,
    resgateCofrinhoConfirmado: true,
    resgateCofrinhoCancelado: true,
  },
}));

const qh = getQueryHelpers(rq as unknown as Record<string, unknown>);
const lastQueryOpts = qh.lastQueryOpts;
const lastMutationOpts = qh.lastMutationOpts;
const mockInvalidateQueries = qh.mockInvalidateQueries;

beforeEach(() => qh.reset());

const loadHooks = () => import('../use-profile');

describe('use-profile query hooks', () => {
  // Feature: react-query-migration, Property 4: Query hooks delegate to the correct lib function
  describe('Property 4: Query hooks delegate to the correct lib function', () => {
    it('useProfile queryFn calls getProfile', async () => {
      const { useProfile } = await loadHooks();
      useProfile();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(authLib.getProfile).toHaveBeenCalled();
    });

    it('useCurrentAuthUser queryFn calls getCurrentAuthUser', async () => {
      const { useCurrentAuthUser } = await loadHooks();
      useCurrentAuthUser();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(authLib.getCurrentAuthUser).toHaveBeenCalled();
    });

    it('useNotificationPrefs queryFn calls getNotificationPrefs', async () => {
      const { useNotificationPrefs } = await loadHooks();
      useNotificationPrefs();
      const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
      await qf();
      expect(notificationsLib.getNotificationPrefs).toHaveBeenCalled();
    });

    it('useProfile uses correct query key and staleTime', async () => {
      const { useProfile } = await loadHooks();
      useProfile();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.profile.current());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.profile);
    });

    it('useCurrentAuthUser uses correct query key and staleTime', async () => {
      const { useCurrentAuthUser } = await loadHooks();
      useCurrentAuthUser();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.profile.authUser());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.profile);
    });

    it('useNotificationPrefs uses correct query key and staleTime', async () => {
      const { useNotificationPrefs } = await loadHooks();
      useNotificationPrefs();
      expect(lastQueryOpts().queryKey).toEqual(queryKeys.profile.notificationPrefs());
      expect(lastQueryOpts().staleTime).toBe(STALE_TIMES.profile);
    });
  });
});

describe('use-profile mutation hooks', () => {
  // Feature: react-query-migration, Property 5: Mutation hooks invalidate the correct query key prefixes on success
  describe('Property 5: Mutation hooks invalidate the correct query key prefixes on success', () => {
    it('useUpdateUserName invalidates profile.all', async () => {
      const { useUpdateUserName } = await loadHooks();
      useUpdateUserName();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.profile.all });
    });

    it('useUpdateUserAvatar invalidates profile.all', async () => {
      const { useUpdateUserAvatar } = await loadHooks();
      useUpdateUserAvatar();
      const onSuccess = lastMutationOpts().onSuccess as () => void;
      onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.profile.all });
    });

    it('useDeleteAccount does not invalidate any queries', async () => {
      const { useDeleteAccount } = await loadHooks();
      useDeleteAccount();
      const opts = lastMutationOpts();
      expect(opts.onSuccess).toBeUndefined();
    });
  });
});

describe('use-profile mutationFn execution', () => {
  it('useUpdateUserName mutationFn calls updateUserName with correct args', async () => {
    const { useUpdateUserName } = await loadHooks();
    useUpdateUserName();
    const mutationFn = lastMutationOpts().mutationFn as (name: string) => Promise<unknown>;
    await mutationFn('New Name');
    expect(authLib.updateUserName).toHaveBeenCalledWith('New Name');
  });

  it('useUpdateUserAvatar mutationFn calls updateUserAvatar and returns url', async () => {
    vi.mocked(authLib.updateUserAvatar).mockResolvedValueOnce({ url: 'https://img.test/new.png', error: null });
    const { useUpdateUserAvatar } = await loadHooks();
    useUpdateUserAvatar();
    const mutationFn = lastMutationOpts().mutationFn as (uri: string) => Promise<unknown>;
    const result = await mutationFn('file://photo.jpg');
    expect(authLib.updateUserAvatar).toHaveBeenCalledWith('file://photo.jpg');
    expect(result).toBe('https://img.test/new.png');
  });

  it('useUpdateUserAvatar mutationFn throws when lib returns error', async () => {
    vi.mocked(authLib.updateUserAvatar).mockResolvedValueOnce({ url: null, error: 'Upload falhou' });
    const { useUpdateUserAvatar } = await loadHooks();
    useUpdateUserAvatar();
    const mutationFn = lastMutationOpts().mutationFn as (uri: string) => Promise<unknown>;
    await expect(mutationFn('file://photo.jpg')).rejects.toThrow('Upload falhou');
  });

  it('useDeleteAccount mutationFn calls deleteAccount', async () => {
    const { useDeleteAccount } = await loadHooks();
    useDeleteAccount();
    const mutationFn = lastMutationOpts().mutationFn as () => Promise<unknown>;
    await mutationFn();
    expect(authLib.deleteAccount).toHaveBeenCalled();
  });

  it('useNotificationPrefs queryFn returns DEFAULT_NOTIFICATION_PREFS when getNotificationPrefs throws', async () => {
    vi.mocked(notificationsLib.getNotificationPrefs).mockRejectedValueOnce(new Error('Network error'));
    const { useNotificationPrefs } = await loadHooks();
    useNotificationPrefs();
    const qf = lastQueryOpts().queryFn as () => Promise<unknown>;
    const result = await qf();
    expect(result).toEqual({
      tarefasPendentes: true,
      tarefaAprovada: true,
      tarefaRejeitada: true,
      tarefaConcluida: true,
      resgatesSolicitado: true,
      resgateConfirmado: true,
      resgateCancelado: true,
      resgateCofrinhoSolicitado: true,
      resgateCofrinhoConfirmado: true,
      resgateCofrinhoCancelado: true,
    });
  });
});
