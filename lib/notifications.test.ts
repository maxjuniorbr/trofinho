import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getNotificationRoute,
  savePushToken,
  setNotificationPrefs,
} from './notifications';
import type { NotificationPrefs } from './notifications';

const scheduleNotificationAsyncMock = vi.hoisted(() => vi.fn());
const deviceStorageGetMock = vi.hoisted(() => vi.fn());
const deviceStorageSetMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('expo-constants', () => ({
  default: { executionEnvironment: 'standalone', expoConfig: null, easConfig: null },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-0000-0000-000000000000' }));

vi.mock('expo-device', () => ({ isDevice: true }));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: scheduleNotificationAsyncMock,
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { HIGH: 5 },
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  getLastNotificationResponse: vi.fn().mockReturnValue(null),
  clearLastNotificationResponse: vi.fn(),
  addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4, DENIED: 0 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));

vi.mock('./device-storage', () => ({
  deviceStorage: {
    getItem: deviceStorageGetMock,
    setItem: deviceStorageSetMock,
    removeItem: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: updateMock })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: selectMock })) })),
    })),
  },
}));

describe('notifications', () => {
  beforeEach(() => {
    deviceStorageGetMock.mockReset();
    deviceStorageSetMock.mockReset();
    rpcMock.mockReset();
    scheduleNotificationAsyncMock.mockReset();
    scheduleNotificationAsyncMock.mockResolvedValue(undefined);
    getUserMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
  });

  describe('getNotificationRoute', () => {
    it('returns the admin tasks route', () => {
      expect(getNotificationRoute({ route: '/(admin)/tasks' })).toEqual({ route: '/(admin)/tasks', entityId: undefined });
    });

    it('returns the admin redemptions route', () => {
      expect(getNotificationRoute({ route: '/(admin)/redemptions' })).toEqual({ route: '/(admin)/redemptions', entityId: undefined });
    });

    it('returns child routes', () => {
      expect(getNotificationRoute({ route: '/(child)/tasks' })).toEqual({ route: '/(child)/tasks', entityId: undefined });
      expect(getNotificationRoute({ route: '/(child)/redemptions' })).toEqual({ route: '/(child)/redemptions', entityId: undefined });
    });

    it('includes entityId when present', () => {
      expect(getNotificationRoute({ route: '/(child)/tasks', entityId: 'abc-123' })).toEqual({
        route: '/(child)/tasks',
        entityId: 'abc-123',
      });
      expect(getNotificationRoute({ route: '/(admin)/tasks', entityId: 'task-456' })).toEqual({
        route: '/(admin)/tasks',
        entityId: 'task-456',
      });
    });

    it('ignores empty or non-string entityId', () => {
      expect(getNotificationRoute({ route: '/(child)/tasks', entityId: '' })).toEqual({ route: '/(child)/tasks', entityId: undefined });
      expect(getNotificationRoute({ route: '/(child)/tasks', entityId: 42 })).toEqual({ route: '/(child)/tasks', entityId: undefined });
    });

    it('returns null for an unknown route', () => {
      expect(getNotificationRoute({ route: '/unknown' })).toBeNull();
    });

    it('returns null for non-record data', () => {
      expect(getNotificationRoute(null)).toBeNull();
      expect(getNotificationRoute('string')).toBeNull();
      expect(getNotificationRoute(42)).toBeNull();
    });

    it('returns null when route property is missing', () => {
      expect(getNotificationRoute({})).toBeNull();
    });
  });

  describe('getNotificationPrefs', () => {
    it('returns server prefs and caches locally when authenticated', async () => {
      const serverPrefs = { tarefasPendentes: false, tarefaAprovada: true, tarefaRejeitada: false, tarefaConcluida: true, resgatesSolicitado: false, resgateConfirmado: true, resgateCancelado: true };
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      selectMock.mockResolvedValue({ data: { notif_prefs: serverPrefs }, error: null });
      await expect(getNotificationPrefs()).resolves.toEqual(serverPrefs);
      expect(deviceStorageSetMock).toHaveBeenCalledWith('notification_prefs', JSON.stringify(serverPrefs));
    });

    it('falls back to local cache on network error', async () => {
      const stored = { tarefasPendentes: false, tarefaAprovada: true, tarefaRejeitada: false, tarefaConcluida: true, resgatesSolicitado: false, resgateConfirmado: true, resgateCancelado: true };
      getUserMock.mockRejectedValue(new Error('network'));
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(stored));
      await expect(getNotificationPrefs()).resolves.toEqual(stored);
    });

    it('falls back to local cache when user is not authenticated', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      deviceStorageGetMock.mockResolvedValue(null);
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('falls back to local cache when server returns error', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      selectMock.mockResolvedValue({ data: null, error: { message: 'db error' } });
      deviceStorageGetMock.mockResolvedValue(null);
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('returns defaults for unrecognized legacy keys in local cache', async () => {
      getUserMock.mockRejectedValue(new Error('offline'));
      const legacy = { pendingTasks: false, completedTask: true, requestedRedemption: false };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(legacy));
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('returns defaults for invalid JSON in local cache', async () => {
      getUserMock.mockRejectedValue(new Error('offline'));
      deviceStorageGetMock.mockResolvedValue('not-json');
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });
  });

  describe('setNotificationPrefs', () => {
    it('writes to server then caches locally', async () => {
      const prefs = { tarefasPendentes: false, tarefaAprovada: true, tarefaRejeitada: false, tarefaConcluida: true, resgatesSolicitado: false, resgateConfirmado: true, resgateCancelado: true };
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      updateMock.mockResolvedValue({ data: null, error: null });
      await setNotificationPrefs(prefs);
      expect(updateMock).toHaveBeenCalledWith('id', 'user-1');
      expect(deviceStorageSetMock).toHaveBeenCalledWith('notification_prefs', JSON.stringify(prefs));
    });

    it('throws when user is not authenticated', async () => {
      const prefs = DEFAULT_NOTIFICATION_PREFS;
      getUserMock.mockResolvedValue({ data: { user: null } });
      await expect(setNotificationPrefs(prefs)).rejects.toThrow('Usu\u00e1rio n\u00e3o autenticado.');
      expect(deviceStorageSetMock).not.toHaveBeenCalled();
    });

    it('throws when server update fails and does not cache locally', async () => {
      const prefs = DEFAULT_NOTIFICATION_PREFS;
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      updateMock.mockResolvedValue({ data: null, error: { message: 'db error' } });
      await expect(setNotificationPrefs(prefs)).rejects.toEqual({ message: 'db error' });
      expect(deviceStorageSetMock).not.toHaveBeenCalled();
    });
  });


});

/**
 * Property 3: Preference round trip (server-first)
 * Validates: Requirements 1.5, 1.6
 *
 * For any valid NotificationPrefs object, writing it via setNotificationPrefs
 * and then reading it back via getNotificationPrefs SHALL produce an
 * equivalent NotificationPrefs object.
 */
describe('savePushToken', () => {
  beforeEach(() => {
    deviceStorageGetMock.mockReset();
    deviceStorageSetMock.mockReset();
    rpcMock.mockReset();
  });

  it('reuses existing device_id from storage and calls rpc', async () => {
    deviceStorageGetMock.mockResolvedValue('existing-device-id');
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('ExponentPushToken[abc123]');

    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[abc123]',
      p_device_id: 'existing-device-id',
    });
    expect(deviceStorageSetMock).not.toHaveBeenCalled();
  });

  it('generates and persists a new device_id when storage is empty', async () => {
    deviceStorageGetMock.mockResolvedValue(null);
    deviceStorageSetMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('ExponentPushToken[xyz]');

    expect(deviceStorageSetMock).toHaveBeenCalledWith(
      'device_id',
      expect.any(String),
    );
    const savedId = deviceStorageSetMock.mock.calls[0][1] as string;
    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[xyz]',
      p_device_id: savedId,
    });
  });

  it('trims whitespace from the token before calling rpc', async () => {
    deviceStorageGetMock.mockResolvedValue('dev-id');
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('  ExponentPushToken[padded]  ');

    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[padded]',
      p_device_id: 'dev-id',
    });
  });

  it('throws a user-facing error when rpc fails', async () => {
    deviceStorageGetMock.mockResolvedValue('dev-id');
    rpcMock.mockResolvedValue({ error: { message: 'network error' } });

    await expect(savePushToken('ExponentPushToken[fail]')).rejects.toThrow(
      'Não foi possível salvar o token de notificação.',
    );
  });

  it('throws for an empty token', async () => {
    await expect(savePushToken('   ')).rejects.toThrow('Token de push inválido.');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('Property 3: Preference round trip (server-first)', () => {
  const prefsArb = fc.record({
    tarefasPendentes: fc.boolean(),
    tarefaAprovada: fc.boolean(),
    tarefaRejeitada: fc.boolean(),
    tarefaConcluida: fc.boolean(),
    resgatesSolicitado: fc.boolean(),
    resgateConfirmado: fc.boolean(),
    resgateCancelado: fc.boolean(),
  });

  const fakeUserId = 'user-abc-123';

  it('round-trips any NotificationPrefs through set then get', async () => {
    await fc.assert(
      fc.asyncProperty(prefsArb, async (prefs: NotificationPrefs) => {
        getUserMock.mockReset();
        updateMock.mockReset();
        selectMock.mockReset();
        deviceStorageSetMock.mockReset();

        getUserMock.mockResolvedValue({ data: { user: { id: fakeUserId } } });
        updateMock.mockResolvedValue({ data: null, error: null });

        await setNotificationPrefs(prefs);

        selectMock.mockResolvedValue({
          data: { notif_prefs: prefs },
          error: null,
        });

        const result = await getNotificationPrefs();
        expect(result).toEqual(prefs);
      }),
      { numRuns: 100 },
    );
  });
});


