import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import type { NotificationPermissionsStatus, NotificationTriggerInput } from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { deviceStorage } from './device-storage';
import { supabase } from './supabase';

// expo-modules-core is nested under expo/, so TS can't resolve the
// PermissionResponse base type that NotificationPermissionsStatus extends.
// Re-declare the inherited fields here so the compiler sees them.
type PermissionsStatus = NotificationPermissionsStatus & {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
};

const NOTIFICATION_PREFERENCES_KEY = 'notification_prefs';
const DEFAULT_NOTIFICATION_CHANNEL_ID = 'trofinho-default';

type NotificationsModule = typeof import('expo-notifications');
type NotificationSubscription = { remove: () => void };

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (isExpoGo()) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications').catch(() => {
    // Reset so the next call retries instead of caching the failure forever.
    notificationsModulePromise = null;
    return null;
  });

  return notificationsModulePromise;
}

async function ensureNotificationHandler(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications || notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  notificationHandlerConfigured = true;
}

export type NotificationRoute =
  | '/(admin)/tasks'
  | '/(admin)/redemptions'
  | '/(admin)/balances'
  | '/(child)/redemptions'
  | '/(child)/tasks'
  | '/(child)/balance';

export type NotificationPrefs = {
  tarefasPendentes: boolean;
  tarefaAprovada: boolean;
  tarefaRejeitada: boolean;
  tarefaConcluida: boolean;
  resgatesSolicitado: boolean;
  resgateConfirmado: boolean;
  resgateCancelado: boolean;
  resgateCofrinhoSolicitado: boolean;
  resgateCofrinhoConfirmado: boolean;
  resgateCofrinhoCancelado: boolean;
};

type NotificationData = Readonly<{
  route: NotificationRoute;
}>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeNotificationPrefs(rawPreferences: string | null): NotificationPrefs {
  if (!rawPreferences) return DEFAULT_NOTIFICATION_PREFS;

  try {
    const parsed = JSON.parse(rawPreferences) as unknown;
    if (!isRecord(parsed)) return DEFAULT_NOTIFICATION_PREFS;

    const asBoolean = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

    return {
      tarefasPendentes:
        asBoolean(parsed.tarefasPendentes) ?? DEFAULT_NOTIFICATION_PREFS.tarefasPendentes,
      tarefaAprovada: asBoolean(parsed.tarefaAprovada) ?? DEFAULT_NOTIFICATION_PREFS.tarefaAprovada,
      tarefaRejeitada:
        asBoolean(parsed.tarefaRejeitada) ?? DEFAULT_NOTIFICATION_PREFS.tarefaRejeitada,
      tarefaConcluida:
        asBoolean(parsed.tarefaConcluida) ?? DEFAULT_NOTIFICATION_PREFS.tarefaConcluida,
      resgatesSolicitado:
        asBoolean(parsed.resgatesSolicitado) ?? DEFAULT_NOTIFICATION_PREFS.resgatesSolicitado,
      resgateConfirmado:
        asBoolean(parsed.resgateConfirmado) ?? DEFAULT_NOTIFICATION_PREFS.resgateConfirmado,
      resgateCancelado:
        asBoolean(parsed.resgateCancelado) ?? DEFAULT_NOTIFICATION_PREFS.resgateCancelado,
      resgateCofrinhoSolicitado:
        asBoolean(parsed.resgateCofrinhoSolicitado) ??
        DEFAULT_NOTIFICATION_PREFS.resgateCofrinhoSolicitado,
      resgateCofrinhoConfirmado:
        asBoolean(parsed.resgateCofrinhoConfirmado) ??
        DEFAULT_NOTIFICATION_PREFS.resgateCofrinhoConfirmado,
      resgateCofrinhoCancelado:
        asBoolean(parsed.resgateCofrinhoCancelado) ??
        DEFAULT_NOTIFICATION_PREFS.resgateCofrinhoCancelado,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    name: 'Trofinho',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function registerNotificationCategories(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Promise.all([
    Notifications.setNotificationCategoryAsync('TASK_REVIEW', [
      {
        identifier: 'APPROVE_TASK',
        buttonTitle: 'Aprovar \u2705',
        options: { opensAppToForeground: false },
      },
    ]),
    Notifications.setNotificationCategoryAsync('REDEMPTION_REVIEW', [
      {
        identifier: 'CONFIRM_REDEMPTION',
        buttonTitle: 'Confirmar \u2705',
        options: { opensAppToForeground: false },
      },
    ]),
  ]);
}

function hasGrantedNotificationPermission(
  status: PermissionsStatus,
  Notifications: NotificationsModule,
): boolean {
  if (Platform.OS === 'ios') {
    const iosStatus = status.ios?.status;

    return (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }

  return status.granted || status.status === 'granted';
}

function getExpoProjectId(): string {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error('Project ID do Expo não encontrado para notificações.');
  }

  return projectId;
}

function getImmediateTrigger(): NotificationTriggerInput {
  if (Platform.OS === 'android') {
    return { channelId: DEFAULT_NOTIFICATION_CHANNEL_ID };
  }

  return null;
}

function withDefaultChannel(trigger: NotificationTriggerInput): NotificationTriggerInput {
  if (Platform.OS !== 'android' || trigger === null || !isRecord(trigger)) {
    return trigger;
  }

  if (typeof trigger.channelId === 'string' && trigger.channelId.length > 0) {
    return trigger;
  }

  return {
    ...trigger,
    channelId: DEFAULT_NOTIFICATION_CHANNEL_ID,
  };
}

async function scheduleNotification(
  title: string,
  body: string,
  trigger: NotificationTriggerInput,
  data?: NotificationData,
): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await ensureNotificationHandler();
  await ensureNotificationChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: withDefaultChannel(trigger),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo()) {
    Sentry.addBreadcrumb({
      category: 'push-registration',
      message: 'Skipped: running in Expo Go (push not supported)',
      level: 'info',
    });
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    Sentry.addBreadcrumb({
      category: 'push-registration',
      message: 'Skipped: expo-notifications module not available',
      level: 'warning',
    });
    return null;
  }

  await ensureNotificationHandler();
  await ensureNotificationChannel();

  let permissions = (await Notifications.getPermissionsAsync()) as PermissionsStatus;

  if (!hasGrantedNotificationPermission(permissions, Notifications)) {
    permissions = (await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    })) as PermissionsStatus;
  }

  if (!hasGrantedNotificationPermission(permissions, Notifications)) {
    Sentry.addBreadcrumb({
      category: 'push-registration',
      message: 'Skipped: notification permission denied',
      level: 'info',
    });
    return null;
  }

  if (!Device.isDevice) {
    Sentry.addBreadcrumb({
      category: 'push-registration',
      message: 'Skipped: not a physical device (emulator/simulator)',
      level: 'info',
    });
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: getExpoProjectId(),
  });

  Sentry.addBreadcrumb({
    category: 'push-registration',
    message: 'Token obtained',
    level: 'info',
  });

  return token.data;
}

const DEVICE_ID_STORAGE_KEY = 'device_id';

/**
 * Returns a stable device identifier that survives app reinstalls.
 *
 * - Android: `Application.getAndroidId()` — hardware-bound, stable per device+app signing key.
 * - iOS: `Application.getIosIdForVendorAsync()` — stable while any app from the same vendor is installed.
 * - Fallback: persist a random UUID in SecureStore (dev builds, simulators).
 */
async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (androidId) return androidId;
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) return iosId;
    }
  } catch {
    // Native API unavailable (e.g. Expo Go) — fall through to storage-based ID
  }

  const existing = await deviceStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = Crypto.randomUUID();
  await deviceStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

export async function savePushToken(token: string): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error('Token de push inválido.');
  }

  const deviceId = await getOrCreateDeviceId();

  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: normalizedToken,
    p_device_id: deviceId,
  });

  if (error) {
    throw new Error('Não foi possível salvar o token de notificação.', { cause: error });
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  await scheduleNotification(title, body, getImmediateTrigger());
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: NotificationTriggerInput,
): Promise<void> {
  await scheduleNotification(title, body, trigger);
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const storageKey = `${NOTIFICATION_PREFERENCES_KEY}_${user.id}`;
      const { data, error } = await supabase
        .from('usuarios')
        .select('notif_prefs')
        .eq('id', user.id)
        .single();

      if (!error && data?.notif_prefs) {
        const serverPrefs = data.notif_prefs as NotificationPrefs;
        await deviceStorage.setItem(storageKey, JSON.stringify(serverPrefs));
        return serverPrefs;
      }

      // Server had no prefs — try user-scoped local cache
      const rawPreferences = await deviceStorage.getItem(storageKey);
      return normalizeNotificationPrefs(rawPreferences);
    }
  } catch {
    // Network error — fall back to local cache
  }

  const rawPreferences = await deviceStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
  return normalizeNotificationPrefs(rawPreferences);
}

export async function setNotificationPrefs(preferences: NotificationPrefs): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const { error } = await supabase
    .from('usuarios')
    .update({ notif_prefs: preferences })
    .eq('id', user.id);

  if (error) throw error;

  await deviceStorage.setItem(
    `${NOTIFICATION_PREFERENCES_KEY}_${user.id}`,
    JSON.stringify(preferences),
  );
}

export async function isNotificationPermissionDenied(): Promise<boolean> {
  if (isExpoGo()) {
    return false;
  }

  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return false;
    }

    const permissions = (await Notifications.getPermissionsAsync()) as PermissionsStatus;

    if (Platform.OS === 'ios') {
      return permissions.ios?.status === Notifications.IosAuthorizationStatus.DENIED;
    }

    return permissions.status === 'denied';
  } catch {
    return false;
  }
}

export type NotificationNavTarget = {
  route: NotificationRoute;
  entityId?: string;
};

export type NotificationActionEvent = {
  actionId: string;
  data: Record<string, unknown>;
};

export function getNotificationRoute(data: unknown): NotificationNavTarget | null {
  if (!isRecord(data)) return null;

  switch (data.route) {
    case '/(admin)/tasks':
    case '/(admin)/redemptions':
    case '/(admin)/balances':
    case '/(child)/redemptions':
    case '/(child)/tasks':
    case '/(child)/balance': {
      const entityId =
        typeof data.entityId === 'string' && data.entityId ? data.entityId : undefined;
      return { route: data.route, entityId };
    }
    default:
      return null;
  }
}

export async function subscribeToNotificationNavigation(
  onRoute: (target: NotificationNavTarget) => void,
  onAction?: (action: NotificationActionEvent) => void,
): Promise<() => void> {
  const N = await getNotificationsModule();
  if (!N) {
    return () => undefined;
  }

  const handleResponse = (actionIdentifier: string, data: unknown) => {
    if (actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER) {
      const target = getNotificationRoute(data);
      if (target) onRoute(target);
    } else if (onAction) {
      onAction({
        actionId: actionIdentifier,
        data: isRecord(data) ? data : {},
      });
    }
    N.clearLastNotificationResponse();
  };

  const lastNotificationResponse = N.getLastNotificationResponse();
  if (lastNotificationResponse) {
    handleResponse(
      lastNotificationResponse.actionIdentifier,
      lastNotificationResponse.notification.request.content.data,
    );
  }

  const receivedSubscription: NotificationSubscription = N.addNotificationReceivedListener(
    () => undefined,
  );

  const responseSubscription: NotificationSubscription = N.addNotificationResponseReceivedListener(
    (response) => {
      handleResponse(response.actionIdentifier, response.notification.request.content.data);
    },
  );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
