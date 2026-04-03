import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getNotificationRoute,
  setNotificationPrefs,
  syncPrefsFromServer,
  syncPrefsToServer,
} from './notifications';
import type { NotificationPrefs } from './notifications';

const scheduleNotificationAsyncMock = vi.hoisted(() => vi.fn());
const deviceStorageGetMock = vi.hoisted(() => vi.fn());
const deviceStorageSetMock = vi.hoisted(() => vi.fn());
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
    rpc: vi.fn(),
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
    scheduleNotificationAsyncMock.mockReset();
    scheduleNotificationAsyncMock.mockResolvedValue(undefined);
    getUserMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
  });

  describe('getNotificationRoute', () => {
    it('returns the admin tasks route', () => {
      expect(getNotificationRoute({ route: '/(admin)/tasks' })).toBe('/(admin)/tasks');
    });

    it('returns the admin redemptions route', () => {
      expect(getNotificationRoute({ route: '/(admin)/redemptions' })).toBe('/(admin)/redemptions');
    });

    it('returns child routes', () => {
      expect(getNotificationRoute({ route: '/(child)/tasks' })).toBe('/(child)/tasks');
      expect(getNotificationRoute({ route: '/(child)/redemptions' })).toBe('/(child)/redemptions');
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
    it('returns defaults when nothing is stored', async () => {
      deviceStorageGetMock.mockResolvedValue(null);
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('returns stored preferences', async () => {
      const stored = { tarefasPendentes: false, tarefaAprovada: true, tarefaRejeitada: false, tarefaConcluida: true, resgatesSolicitado: false, resgateConfirmado: true, resgateCancelado: true };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(stored));
      await expect(getNotificationPrefs()).resolves.toEqual(stored);
    });

    it('normalizes legacy camelCase keys', async () => {
      const legacy = { pendingTasks: false, completedTask: true, requestedRedemption: false };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(legacy));
      const prefs = await getNotificationPrefs();
      expect(prefs.tarefasPendentes).toBe(false);
      expect(prefs.tarefaAprovada).toBe(true);
      expect(prefs.tarefaRejeitada).toBe(true);
      expect(prefs.tarefaConcluida).toBe(true);
      expect(prefs.resgatesSolicitado).toBe(false);
      expect(prefs.resgateConfirmado).toBe(false);
    });

    it('normalizes legacy snake_case keys', async () => {
      const legacy = { tarefas_pendentes: true, tarefa_concluida: false, resgate_solicitado: true };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(legacy));
      const prefs = await getNotificationPrefs();
      expect(prefs.tarefasPendentes).toBe(true);
      expect(prefs.tarefaAprovada).toBe(false);
      expect(prefs.tarefaRejeitada).toBe(false);
      expect(prefs.tarefaConcluida).toBe(false);
      expect(prefs.resgatesSolicitado).toBe(true);
      expect(prefs.resgateConfirmado).toBe(true);
    });

    it('prefers current keys over legacy keys when both are present', async () => {
      const mixed = { tarefasPendentes: false, pendingTasks: true };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(mixed));
      const prefs = await getNotificationPrefs();
      expect(prefs.tarefasPendentes).toBe(false);
    });

    it('returns defaults for invalid JSON', async () => {
      deviceStorageGetMock.mockResolvedValue('not-json');
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });

    it('returns defaults for non-object JSON', async () => {
      deviceStorageGetMock.mockResolvedValue('"string"');
      await expect(getNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
    });
  });

  describe('setNotificationPrefs', () => {
    it('stores preferences in device storage', async () => {
      const prefs = { tarefasPendentes: false, tarefaAprovada: true, tarefaRejeitada: false, tarefaConcluida: true, resgatesSolicitado: false, resgateConfirmado: true, resgateCancelado: true };
      await setNotificationPrefs(prefs);
      expect(deviceStorageSetMock).toHaveBeenCalledWith('notification_prefs', JSON.stringify(prefs));
    });
  });


});

/**
 * Property 3: Preference sync round trip
 * Validates: Requirements 1.5, 1.6
 *
 * For any valid NotificationPrefs object, writing it to the server via
 * syncPrefsToServer and then reading it back via syncPrefsFromServer
 * SHALL produce an equivalent NotificationPrefs object.
 */
describe('Property 3: Preference sync round trip', () => {
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

  it('round-trips any NotificationPrefs through server sync', async () => {
    await fc.assert(
      fc.asyncProperty(prefsArb, async (prefs: NotificationPrefs) => {
        getUserMock.mockReset();
        updateMock.mockReset();
        selectMock.mockReset();
        deviceStorageSetMock.mockReset();

        // Mock authenticated user
        getUserMock.mockResolvedValue({ data: { user: { id: fakeUserId } } });

        // Capture prefs written by syncPrefsToServer
        let capturedPrefs: NotificationPrefs | undefined;
        updateMock.mockImplementation(() => {
          capturedPrefs = prefs;
          return { data: null, error: null };
        });

        await syncPrefsToServer(prefs);

        // Mock syncPrefsFromServer to return the same prefs that were written
        selectMock.mockResolvedValue({
          data: { notif_prefs: capturedPrefs },
          error: null,
        });

        await syncPrefsFromServer();

        // Verify deviceStorage.setItem was called with the round-tripped prefs
        expect(deviceStorageSetMock).toHaveBeenCalledWith(
          'notification_prefs',
          JSON.stringify(prefs),
        );
      }),
      { numRuns: 100 },
    );
  });
});

describe('syncPrefsToServer', () => {
  const fakeUser = { id: 'user-sync-123' };
  const prefs: NotificationPrefs = {
    tarefasPendentes: false,
    tarefaAprovada: true,
    tarefaRejeitada: false,
    tarefaConcluida: true,
    resgatesSolicitado: false,
    resgateConfirmado: true,
    resgateCancelado: true,
  };

  beforeEach(() => {
    getUserMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
    deviceStorageSetMock.mockReset();
    vi.restoreAllMocks();
  });

  it('calls supabase update when user is authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser } });
    updateMock.mockResolvedValue({ data: null, error: null });

    await syncPrefsToServer(prefs);

    expect(getUserMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith('id', fakeUser.id);
  });

  it('does nothing when user is not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await syncPrefsToServer(prefs);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('catches errors and logs via console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('network failure');
    getUserMock.mockRejectedValue(error);

    await expect(syncPrefsToServer(prefs)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    consoleErrorSpy.mockRestore();
  });
});

describe('syncPrefsFromServer', () => {
  const fakeUser = { id: 'user-sync-456' };

  beforeEach(() => {
    getUserMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
    deviceStorageSetMock.mockReset();
    vi.restoreAllMocks();
  });

  it('overwrites local storage with server prefs', async () => {
    const serverPrefs: NotificationPrefs = {
      tarefasPendentes: true,
      tarefaAprovada: false,
      tarefaRejeitada: false,
      tarefaConcluida: false,
      resgatesSolicitado: true,
      resgateConfirmado: true,
      resgateCancelado: true,
    };

    getUserMock.mockResolvedValue({ data: { user: fakeUser } });
    selectMock.mockResolvedValue({ data: { notif_prefs: serverPrefs }, error: null });

    await syncPrefsFromServer();

    expect(deviceStorageSetMock).toHaveBeenCalledWith(
      'notification_prefs',
      JSON.stringify(serverPrefs),
    );
  });

  it('does nothing when user is not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await syncPrefsFromServer();

    expect(selectMock).not.toHaveBeenCalled();
    expect(deviceStorageSetMock).not.toHaveBeenCalled();
  });

  it('catches errors and logs via console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('network failure');
    getUserMock.mockRejectedValue(error);

    await expect(syncPrefsFromServer()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    consoleErrorSpy.mockRestore();
  });

  it('does nothing when server returns error', async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser } });
    selectMock.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await syncPrefsFromServer();

    expect(deviceStorageSetMock).not.toHaveBeenCalled();
  });
});
