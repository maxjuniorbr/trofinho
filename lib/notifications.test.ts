import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getNotificationRoute,
  notifyRedemptionRequested,
  notifyTaskCompleted,
  notifyTaskCreated,
  setNotificationPrefs,
} from './notifications';

const scheduleNotificationAsyncMock = vi.hoisted(() => vi.fn());
const deviceStorageGetMock = vi.hoisted(() => vi.fn());
const deviceStorageSetMock = vi.hoisted(() => vi.fn());

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
  supabase: { rpc: vi.fn() },
}));

describe('notifications', () => {
  beforeEach(() => {
    deviceStorageGetMock.mockReset();
    deviceStorageSetMock.mockReset();
    scheduleNotificationAsyncMock.mockReset();
    scheduleNotificationAsyncMock.mockResolvedValue(undefined);
  });

  describe('getNotificationRoute', () => {
    it('returns the admin tasks route', () => {
      expect(getNotificationRoute({ route: '/(admin)/tasks' })).toBe('/(admin)/tasks');
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
      const stored = { tarefasPendentes: false, tarefaConcluida: true, resgatesSolicitado: false };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(stored));
      await expect(getNotificationPrefs()).resolves.toEqual(stored);
    });

    it('normalizes legacy camelCase keys', async () => {
      const legacy = { pendingTasks: false, completedTask: true, requestedRedemption: false };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(legacy));
      const prefs = await getNotificationPrefs();
      expect(prefs.tarefasPendentes).toBe(false);
      expect(prefs.tarefaConcluida).toBe(true);
      expect(prefs.resgatesSolicitado).toBe(false);
    });

    it('normalizes legacy snake_case keys', async () => {
      const legacy = { tarefas_pendentes: true, tarefa_concluida: false, resgate_solicitado: true };
      deviceStorageGetMock.mockResolvedValue(JSON.stringify(legacy));
      const prefs = await getNotificationPrefs();
      expect(prefs.tarefasPendentes).toBe(true);
      expect(prefs.tarefaConcluida).toBe(false);
      expect(prefs.resgatesSolicitado).toBe(true);
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
      const prefs = { tarefasPendentes: false, tarefaConcluida: true, resgatesSolicitado: false };
      await setNotificationPrefs(prefs);
      expect(deviceStorageSetMock).toHaveBeenCalledWith('notification_prefs', JSON.stringify(prefs));
    });
  });

  describe('preference gating', () => {
    const storedPrefs = (overrides: Partial<typeof DEFAULT_NOTIFICATION_PREFS>): string =>
      JSON.stringify({ ...DEFAULT_NOTIFICATION_PREFS, ...overrides });

    describe('notifyTaskCompleted', () => {
      it('sends notification when tarefaConcluida is enabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ tarefaConcluida: true }));
        await notifyTaskCompleted();
        expect(scheduleNotificationAsyncMock).toHaveBeenCalledTimes(1);
        expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              title: 'Tarefa enviada',
              data: { route: '/(child)/tasks' },
            }),
          }),
        );
      });

      it('does not send notification when tarefaConcluida is disabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ tarefaConcluida: false }));
        await notifyTaskCompleted();
        expect(scheduleNotificationAsyncMock).not.toHaveBeenCalled();
      });
    });

    describe('notifyTaskCreated', () => {
      it('sends notification when tarefasPendentes is enabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ tarefasPendentes: true }));
        await notifyTaskCreated('Lavar a louça');
        expect(scheduleNotificationAsyncMock).toHaveBeenCalledTimes(1);
      });

      it('does not send notification when tarefasPendentes is disabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ tarefasPendentes: false }));
        await notifyTaskCreated('Lavar a louça');
        expect(scheduleNotificationAsyncMock).not.toHaveBeenCalled();
      });
    });

    describe('notifyRedemptionRequested', () => {
      it('sends notification when resgatesSolicitado is enabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ resgatesSolicitado: true }));
        await notifyRedemptionRequested();
        expect(scheduleNotificationAsyncMock).toHaveBeenCalledTimes(1);
      });

      it('does not send notification when resgatesSolicitado is disabled', async () => {
        deviceStorageGetMock.mockResolvedValue(storedPrefs({ resgatesSolicitado: false }));
        await notifyRedemptionRequested();
        expect(scheduleNotificationAsyncMock).not.toHaveBeenCalled();
      });
    });

    it('does not throw when notification fails', async () => {
      deviceStorageGetMock.mockResolvedValue(storedPrefs({ tarefaConcluida: true }));
      scheduleNotificationAsyncMock.mockRejectedValue(new Error('device error'));
      await expect(notifyTaskCompleted()).resolves.toBeUndefined();
    });
  });
});
