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
import {
  MESSAGE_TEMPLATES,
  VALID_EVENTS,
  PREFERENCE_KEY_MAP,
  type PushEvent,
} from '../supabase/functions/send-push-notification/handler';

const scheduleNotificationAsyncMock = vi.hoisted(() => vi.fn());
const deviceStorageGetMock = vi.hoisted(() => vi.fn());
const deviceStorageSetMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    dismiss: vi.fn(),
  },
  Platform: { OS: 'ios' },
}));

vi.mock('expo-constants', () => ({
  default: { executionEnvironment: 'standalone', expoConfig: null, easConfig: null },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

vi.mock('expo-application', () => ({
  getAndroidId: () => null,
  getIosIdForVendorAsync: vi.fn().mockResolvedValue('ios-vendor-id-mock'),
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
      expect(getNotificationRoute({ route: '/(admin)/tasks' })).toEqual({
        route: '/(admin)/tasks',
        entityId: undefined,
      });
    });

    it('returns the admin redemptions route', () => {
      expect(getNotificationRoute({ route: '/(admin)/redemptions' })).toEqual({
        route: '/(admin)/redemptions',
        entityId: undefined,
      });
    });

    it('returns child routes', () => {
      expect(getNotificationRoute({ route: '/(child)/tasks' })).toEqual({
        route: '/(child)/tasks',
        entityId: undefined,
      });
      expect(getNotificationRoute({ route: '/(child)/redemptions' })).toEqual({
        route: '/(child)/redemptions',
        entityId: undefined,
      });
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
      expect(getNotificationRoute({ route: '/(child)/tasks', entityId: '' })).toEqual({
        route: '/(child)/tasks',
        entityId: undefined,
      });
      expect(getNotificationRoute({ route: '/(child)/tasks', entityId: 42 })).toEqual({
        route: '/(child)/tasks',
        entityId: undefined,
      });
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
      const serverPrefs = {
        tarefasPendentes: false,
        tarefaAprovada: true,
        tarefaRejeitada: false,
        tarefaConcluida: true,
        resgatesSolicitado: false,
        resgateConfirmado: true,
        resgateCancelado: true,
        resgateCofrinhoSolicitado: true,
        resgateCofrinhoConfirmado: true,
        resgateCofrinhoCancelado: true,
      };
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      selectMock.mockResolvedValue({ data: { notif_prefs: serverPrefs }, error: null });
      await expect(getNotificationPrefs()).resolves.toEqual(serverPrefs);
      expect(deviceStorageSetMock).toHaveBeenCalledWith(
        'notification_prefs_user-1',
        JSON.stringify(serverPrefs),
      );
    });

    it('falls back to local cache on network error', async () => {
      const stored = {
        tarefasPendentes: false,
        tarefaAprovada: true,
        tarefaRejeitada: false,
        tarefaConcluida: true,
        resgatesSolicitado: false,
        resgateConfirmado: true,
        resgateCancelado: true,
        resgateCofrinhoSolicitado: true,
        resgateCofrinhoConfirmado: true,
        resgateCofrinhoCancelado: true,
      };
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
      const prefs = {
        tarefasPendentes: false,
        tarefaAprovada: true,
        tarefaRejeitada: false,
        tarefaConcluida: true,
        resgatesSolicitado: false,
        resgateConfirmado: true,
        resgateCancelado: true,
        resgateCofrinhoSolicitado: true,
        resgateCofrinhoConfirmado: true,
        resgateCofrinhoCancelado: true,
      };
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      updateMock.mockResolvedValue({ data: null, error: null });
      await setNotificationPrefs(prefs);
      expect(updateMock).toHaveBeenCalledWith('id', 'user-1');
      expect(deviceStorageSetMock).toHaveBeenCalledWith(
        'notification_prefs_user-1',
        JSON.stringify(prefs),
      );
    });

    it('throws when user is not authenticated', async () => {
      const prefs = DEFAULT_NOTIFICATION_PREFS;
      getUserMock.mockResolvedValue({ data: { user: null } });
      await expect(setNotificationPrefs(prefs)).rejects.toThrow(
        'Usu\u00e1rio n\u00e3o autenticado.',
      );
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

  it('uses native iOS vendor ID as device_id', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('ExponentPushToken[abc123]');

    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[abc123]',
      p_device_id: 'ios-vendor-id-mock',
    });
    expect(deviceStorageGetMock).not.toHaveBeenCalled();
  });

  it('falls back to stored device_id when native API fails', async () => {
    const appModule = await import('expo-application');
    vi.mocked(appModule.getIosIdForVendorAsync).mockRejectedValueOnce(new Error('unavailable'));
    deviceStorageGetMock.mockResolvedValue('existing-device-id');
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('ExponentPushToken[abc123]');

    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[abc123]',
      p_device_id: 'existing-device-id',
    });
    expect(deviceStorageSetMock).not.toHaveBeenCalled();
  });

  it('generates and persists a new device_id when native and storage both empty', async () => {
    const appModule = await import('expo-application');
    vi.mocked(appModule.getIosIdForVendorAsync).mockResolvedValueOnce(null);
    deviceStorageGetMock.mockResolvedValue(null);
    deviceStorageSetMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('ExponentPushToken[xyz]');

    expect(deviceStorageSetMock).toHaveBeenCalledWith('device_id', expect.any(String));
    const savedId = deviceStorageSetMock.mock.calls[0][1] as string;
    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[xyz]',
      p_device_id: savedId,
    });
  });

  it('trims whitespace from the token before calling rpc', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await savePushToken('  ExponentPushToken[padded]  ');

    expect(rpcMock).toHaveBeenCalledWith('upsert_push_token', {
      p_token: 'ExponentPushToken[padded]',
      p_device_id: 'ios-vendor-id-mock',
    });
  });

  it('throws a user-facing error when rpc fails', async () => {
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
    resgateCofrinhoSolicitado: fc.boolean(),
    resgateCofrinhoConfirmado: fc.boolean(),
    resgateCofrinhoCancelado: fc.boolean(),
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

// ─── Contract parity: Edge Function ↔ Client ────────────────────────────────

describe('Contract parity: push events & notification prefs', () => {
  const handlerEvents = Object.keys(MESSAGE_TEMPLATES) as PushEvent[];
  const handlerPrefKeys = Object.values(PREFERENCE_KEY_MAP);
  const clientPrefKeys = Object.keys(DEFAULT_NOTIFICATION_PREFS);

  it('VALID_EVENTS matches MESSAGE_TEMPLATES keys', () => {
    const sorted = (arr: string[]) => [...arr].toSorted((a, b) => a.localeCompare(b));
    expect(sorted([...VALID_EVENTS])).toEqual(sorted(handlerEvents));
  });

  it('every handler event has a preference key mapping', () => {
    for (const event of handlerEvents) {
      expect(PREFERENCE_KEY_MAP).toHaveProperty(event);
    }
  });

  it('PREFERENCE_KEY_MAP values cover all client NotificationPrefs keys', () => {
    const sorted = (arr: string[]) => [...arr].toSorted((a, b) => a.localeCompare(b));
    expect(sorted(handlerPrefKeys)).toEqual(sorted(clientPrefKeys));
  });

  it('every MESSAGE_TEMPLATES route is handled by getNotificationRoute', () => {
    const routes = new Set(handlerEvents.map((e) => MESSAGE_TEMPLATES[e].route));
    for (const route of routes) {
      expect(getNotificationRoute({ route })).not.toBeNull();
    }
  });
});

describe('getNotificationRoute — edge cases', () => {
  it('returns null for primitive data types', () => {
    expect(getNotificationRoute(42)).toBeNull();
    expect(getNotificationRoute(true)).toBeNull();
    expect(getNotificationRoute('string')).toBeNull();
  });

  it('returns null for arrays (typeof object but not a record)', () => {
    expect(getNotificationRoute([])).toBeNull();
    expect(getNotificationRoute([{ route: '/(admin)/tasks' }])).toBeNull();
  });

  it('returns null when route key exists but value is not a known route', () => {
    expect(getNotificationRoute({ route: '/(admin)/unknown' })).toBeNull();
    expect(getNotificationRoute({ route: '/invalid' })).toBeNull();
    expect(getNotificationRoute({ route: '' })).toBeNull();
  });

  it('omits entityId when it is a non-string type', () => {
    const result = getNotificationRoute({ route: '/(child)/balance', entityId: 42 });
    expect(result).toEqual({ route: '/(child)/balance', entityId: undefined });
  });

  it('property: arbitrary non-route strings always return null', () => {
    const VALID_ROUTES = [
      '/(admin)/tasks',
      '/(admin)/redemptions',
      '/(admin)/balances',
      '/(child)/redemptions',
      '/(child)/tasks',
      '/(child)/balance',
    ];
    fc.assert(
      fc.property(
        fc.string().filter((s) => !VALID_ROUTES.includes(s)),
        (route) => {
          return getNotificationRoute({ route }) === null;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Additional coverage: registerForPushNotifications, local notifications,
//     permission checks, and subscription ─────────────────────────────────────

describe('registerForPushNotifications', () => {
  let registerForPushNotifications: typeof import('./notifications').registerForPushNotifications;

  beforeEach(async () => {
    deviceStorageGetMock.mockReset();
    deviceStorageSetMock.mockReset();
    rpcMock.mockReset();
    const mod = await import('./notifications');
    registerForPushNotifications = mod.registerForPushNotifications;
  });

  it('returns null when running in Expo Go', async () => {
    const constants = await import('expo-constants');
    const original = constants.default.executionEnvironment;
    (constants.default as any).executionEnvironment = 'storeClient';

    const result = await registerForPushNotifications();
    expect(result).toBeNull();

    (constants.default as any).executionEnvironment = original;
  });

  it('returns null when notifications module is not available', async () => {
    const constants = await import('expo-constants');
    (constants.default as any).executionEnvironment = 'standalone';

    // The module is mocked and available, so this test verifies the non-ExpoGo path
    // We need to test the permission denied path
    const N = await import('expo-notifications');
    vi.mocked(N.getPermissionsAsync).mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
      ios: { status: 0 }, // DENIED
    } as any);
    vi.mocked(N.requestPermissionsAsync).mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
      ios: { status: 0 },
    } as any);

    const result = await registerForPushNotifications();
    expect(result).toBeNull();
  });

  it('requests permissions when not already granted', async () => {
    const constants = await import('expo-constants');
    (constants.default as any).executionEnvironment = 'standalone';

    const N = await import('expo-notifications');
    // First call: not granted
    vi.mocked(N.getPermissionsAsync).mockResolvedValue({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
      ios: { status: 1 }, // NOT_DETERMINED
    } as any);
    // After request: granted
    vi.mocked(N.requestPermissionsAsync).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
      ios: { status: 2 }, // AUTHORIZED
    } as any);
    vi.mocked(N.getExpoPushTokenAsync).mockResolvedValue({
      data: 'ExponentPushToken[test-token]',
      type: 'expo',
    } as any);

    // Need a project ID
    (constants.default as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };

    const result = await registerForPushNotifications();
    expect(N.requestPermissionsAsync).toHaveBeenCalled();
    expect(result).toBe('ExponentPushToken[test-token]');

    (constants.default as any).expoConfig = null;
  });
});

describe('sendLocalNotification', () => {
  it('schedules a notification with immediate trigger', async () => {
    const { sendLocalNotification } = await import('./notifications');
    scheduleNotificationAsyncMock.mockResolvedValue(undefined);

    await sendLocalNotification('Test Title', 'Test Body');

    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Test Title',
          body: 'Test Body',
          sound: true,
        }),
      }),
    );
  });
});

describe('scheduleLocalNotification', () => {
  it('schedules a notification with custom trigger', async () => {
    const { scheduleLocalNotification } = await import('./notifications');
    scheduleNotificationAsyncMock.mockResolvedValue(undefined);

    const trigger = { seconds: 60 };
    await scheduleLocalNotification('Reminder', 'Do something', trigger as any);

    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Reminder',
          body: 'Do something',
        }),
      }),
    );
  });
});

describe('isNotificationPermissionDenied', () => {
  it('returns false when running in Expo Go', async () => {
    const constants = await import('expo-constants');
    const original = constants.default.executionEnvironment;
    (constants.default as any).executionEnvironment = 'storeClient';

    const { isNotificationPermissionDenied } = await import('./notifications');
    const result = await isNotificationPermissionDenied();
    expect(result).toBe(false);

    (constants.default as any).executionEnvironment = original;
  });

  it('returns true when iOS permission is denied', async () => {
    const constants = await import('expo-constants');
    (constants.default as any).executionEnvironment = 'standalone';

    const N = await import('expo-notifications');
    vi.mocked(N.getPermissionsAsync).mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
      ios: { status: 0 }, // DENIED
    } as any);

    const { isNotificationPermissionDenied } = await import('./notifications');
    const result = await isNotificationPermissionDenied();
    expect(result).toBe(true);
  });

  it('returns false when iOS permission is authorized', async () => {
    const constants = await import('expo-constants');
    (constants.default as any).executionEnvironment = 'standalone';

    const N = await import('expo-notifications');
    vi.mocked(N.getPermissionsAsync).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
      ios: { status: 2 }, // AUTHORIZED
    } as any);

    const { isNotificationPermissionDenied } = await import('./notifications');
    const result = await isNotificationPermissionDenied();
    expect(result).toBe(false);
  });

  it('returns false when getPermissionsAsync throws', async () => {
    const constants = await import('expo-constants');
    (constants.default as any).executionEnvironment = 'standalone';

    const N = await import('expo-notifications');
    vi.mocked(N.getPermissionsAsync).mockRejectedValue(new Error('unavailable'));

    const { isNotificationPermissionDenied } = await import('./notifications');
    const result = await isNotificationPermissionDenied();
    expect(result).toBe(false);
  });
});

describe('subscribeToNotificationNavigation', () => {
  it('returns a cleanup function that removes subscriptions', async () => {
    const removeMock1 = vi.fn();
    const removeMock2 = vi.fn();
    const N = await import('expo-notifications');
    vi.mocked(N.addNotificationReceivedListener).mockReturnValue({ remove: removeMock1 });
    vi.mocked(N.addNotificationResponseReceivedListener).mockReturnValue({ remove: removeMock2 });
    vi.mocked(N.getLastNotificationResponse).mockReturnValue(null);

    const { subscribeToNotificationNavigation } = await import('./notifications');
    const onRoute = vi.fn();
    const cleanup = await subscribeToNotificationNavigation(onRoute);

    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(removeMock1).toHaveBeenCalled();
    expect(removeMock2).toHaveBeenCalled();
  });

  it('processes last notification response on subscribe', async () => {
    const N = await import('expo-notifications');
    vi.mocked(N.getLastNotificationResponse).mockReturnValue({
      actionIdentifier: 'default',
      notification: {
        request: {
          content: {
            data: { route: '/(admin)/tasks' },
          },
        },
      },
    } as any);

    const { subscribeToNotificationNavigation } = await import('./notifications');
    const onRoute = vi.fn();
    await subscribeToNotificationNavigation(onRoute);

    expect(onRoute).toHaveBeenCalledWith({
      route: '/(admin)/tasks',
      entityId: undefined,
    });
    expect(N.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('calls onAction for non-default action identifiers', async () => {
    const N = await import('expo-notifications');
    vi.mocked(N.getLastNotificationResponse).mockReturnValue({
      actionIdentifier: 'APPROVE_TASK',
      notification: {
        request: {
          content: {
            data: { taskId: '123' },
          },
        },
      },
    } as any);

    const { subscribeToNotificationNavigation } = await import('./notifications');
    const onRoute = vi.fn();
    const onAction = vi.fn();
    await subscribeToNotificationNavigation(onRoute, onAction);

    expect(onRoute).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith({
      actionId: 'APPROVE_TASK',
      data: { taskId: '123' },
    });
  });

  it('handles response listener callback', async () => {
    const N = await import('expo-notifications');
    vi.mocked(N.getLastNotificationResponse).mockReturnValue(null);

    let responseCallback: (response: any) => void = () => {};
    vi.mocked(N.addNotificationResponseReceivedListener).mockImplementation((cb: any) => {
      responseCallback = cb;
      return { remove: vi.fn() };
    });

    const { subscribeToNotificationNavigation } = await import('./notifications');
    const onRoute = vi.fn();
    await subscribeToNotificationNavigation(onRoute);

    // Simulate a notification response
    responseCallback({
      actionIdentifier: 'default',
      notification: {
        request: {
          content: {
            data: { route: '/(child)/balance' },
          },
        },
      },
    });

    expect(onRoute).toHaveBeenCalledWith({
      route: '/(child)/balance',
      entityId: undefined,
    });
  });
});

describe('registerNotificationCategories', () => {
  it('registers TASK_REVIEW and REDEMPTION_REVIEW categories', async () => {
    const N = await import('expo-notifications');
    const setNotificationCategoryAsyncMock = vi.fn().mockResolvedValue(undefined);
    (N as any).setNotificationCategoryAsync = setNotificationCategoryAsyncMock;

    const { registerNotificationCategories } = await import('./notifications');
    await registerNotificationCategories();

    expect(setNotificationCategoryAsyncMock).toHaveBeenCalledWith(
      'TASK_REVIEW',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'APPROVE_TASK' }),
      ]),
    );
    expect(setNotificationCategoryAsyncMock).toHaveBeenCalledWith(
      'REDEMPTION_REVIEW',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'CONFIRM_REDEMPTION' }),
      ]),
    );
  });
});
