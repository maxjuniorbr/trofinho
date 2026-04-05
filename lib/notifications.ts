import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import type { NotificationPermissionsStatus, NotificationTriggerInput } from 'expo-notifications';
import { deviceStorage } from './device-storage';
import { supabase } from './supabase';

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

  notificationsModulePromise ??= import('expo-notifications')
    .then((module) => module)
    .catch(() => null);

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
  | '/(child)/redemptions'
  | '/(child)/tasks';

export type NotificationPrefs = {
  tarefasPendentes: boolean;
  tarefaAprovada: boolean;
  tarefaRejeitada: boolean;
  tarefaConcluida: boolean;
  resgatesSolicitado: boolean;
  resgateConfirmado: boolean;
  resgateCancelado: boolean;
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

function hasGrantedNotificationPermission(
  status: NotificationPermissionsStatus,
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
    console.warn('[push-registration] Skipped: running in Expo Go (push not supported)');
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    console.warn('[push-registration] Skipped: expo-notifications module not available');
    return null;
  }

  await ensureNotificationHandler();
  await ensureNotificationChannel();

  let permissions = await Notifications.getPermissionsAsync();

  if (!hasGrantedNotificationPermission(permissions, Notifications)) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }

  if (!hasGrantedNotificationPermission(permissions, Notifications)) {
    console.warn('[push-registration] Skipped: notification permission denied');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[push-registration] Skipped: not a physical device (emulator/simulator)');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: getExpoProjectId(),
  });

  if (__DEV__) {
    console.log('[push-registration] Token obtained:', token.data);
  }

  return token.data;
}

const DEVICE_ID_STORAGE_KEY = 'device_id';

async function getOrCreateDeviceId(): Promise<string> {
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
    throw new Error('Não foi possível salvar o token de notificação.');
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
      const { data, error } = await supabase
        .from('usuarios')
        .select('notif_prefs')
        .eq('id', user.id)
        .single();

      if (!error && data?.notif_prefs) {
        const serverPrefs = data.notif_prefs as NotificationPrefs;
        await deviceStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(serverPrefs));
        return serverPrefs;
      }
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

  await deviceStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(preferences));
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

    const permissions = await Notifications.getPermissionsAsync();

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

export function getNotificationRoute(data: unknown): NotificationNavTarget | null {
  if (!isRecord(data)) return null;

  switch (data.route) {
    case '/(admin)/tasks':
    case '/(admin)/redemptions':
    case '/(child)/redemptions':
    case '/(child)/tasks': {
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
): Promise<() => void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => undefined;
  }

  function redirectFromNotificationData(data: unknown) {
    const target = getNotificationRoute(data);
    if (!target) return;

    onRoute(target);
  }

  const lastNotificationResponse = Notifications.getLastNotificationResponse();
  if (lastNotificationResponse?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    redirectFromNotificationData(lastNotificationResponse.notification.request.content.data);
    Notifications.clearLastNotificationResponse();
  }

  const receivedSubscription: NotificationSubscription =
    Notifications.addNotificationReceivedListener(() => undefined);

  const responseSubscription: NotificationSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        return;
      }

      redirectFromNotificationData(response.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
