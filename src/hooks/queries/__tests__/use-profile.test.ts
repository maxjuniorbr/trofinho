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

vi.mock('../../../../lib/auth', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 'u1', familia_id: 'f1', papel: 'admin', nome: 'Test' }),
  getCurrentAuthUser: vi.fn().mockResolvedValue({ email: 'test@test.com', avatarUrl: null }),
  updateUserName: vi.fn().mockResolvedValue({ error: null }),
  updateUserPassword: vi.fn().mockResolvedValue({ error: null }),
  updateUserAvatar: vi.fn().mockResolvedValue({ url: 'https://img.test/avatar.png', error: null }),
}));

vi.mock('../../../../lib/notifications', () => ({
  getNotificationPrefs: vi.fn().mockResolvedValue({
    tarefasPendentes: true,
    tarefaConcluida: true,
    resgatesSolicitado: true,
  }),
}));

import * as authLib from '../../../../lib/auth';
import * as notificationsLib from '../../../../lib/notifications';
import * as rq from '@tanstack/react-query';

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedQuery = () => (rq as unknown as { _capturedQuery: CapturedStore })._capturedQuery;
const getCapturedMutation = () => (rq as unknown as { _capturedMutation: CapturedStore })._capturedMutation;
const lastQueryOpts = () => { const o = getCapturedQuery().options; return o[o.length - 1]; };
const lastMutationOpts = () => { const o = getCapturedMutation().options; return o[o.length - 1]; };

beforeEach(() => {
  getCapturedQuery().options = [];
  getCapturedMutation().options = [];
  mockInvalidateQueries.mockClear();
});

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

    it('useUpdateUserPassword does not invalidate any queries', async () => {
      const { useUpdateUserPassword } = await loadHooks();
      useUpdateUserPassword();
      const opts = lastMutationOpts();
      expect(opts.onSuccess).toBeUndefined();
    });
  });
});
