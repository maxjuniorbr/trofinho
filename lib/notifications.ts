import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type {
  NotificationPermissionsStatus,
  NotificationTriggerInput,
} from 'expo-notifications';
import { deviceStorage } from './device-storage';
import { captureException } from './sentry';
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
  | '/(child)/redemptions'
  | '/(child)/tasks';

export type NotificationPrefs = {
  tarefasPendentes: boolean;
  tarefaConcluida: boolean;
  resgatesSolicitado: boolean;
};

type NotificationData = Readonly<{
  route: NotificationRoute;
}>;

type LegacyNotificationPrefs = Partial<{
  pendingTasks: boolean;
  completedTask: boolean;
  requestedRedemption: boolean;
  tarefas_pendentes: boolean;
  tarefa_concluida: boolean;
  resgate_solicitado: boolean;
}>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  tarefasPendentes: true,
  tarefaConcluida: true,
  resgatesSolicitado: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBooleanValue(...values: unknown[]): boolean | undefined {
  return values.find((value): value is boolean => typeof value === 'boolean');
}

function normalizeNotificationPrefs(rawPreferences: string | null): NotificationPrefs {
  if (!rawPreferences) return DEFAULT_NOTIFICATION_PREFS;

  try {
    const parsed = JSON.parse(rawPreferences) as unknown;
    if (!isRecord(parsed)) return DEFAULT_NOTIFICATION_PREFS;

    const legacyPreferences = parsed as LegacyNotificationPrefs & Partial<NotificationPrefs>;

    return {
      tarefasPendentes:
        getBooleanValue(
          legacyPreferences.tarefasPendentes,
          legacyPreferences.pendingTasks,
          legacyPreferences.tarefas_pendentes,
        ) ?? DEFAULT_NOTIFICATION_PREFS.tarefasPendentes,
      tarefaConcluida:
        getBooleanValue(
          legacyPreferences.tarefaConcluida,
          legacyPreferences.completedTask,
          legacyPreferences.tarefa_concluida,
        ) ?? DEFAULT_NOTIFICATION_PREFS.tarefaConcluida,
      resgatesSolicitado:
        getBooleanValue(
          legacyPreferences.resgatesSolicitado,
          legacyPreferences.requestedRedemption,
          legacyPreferences.resgate_solicitado,
        ) ?? DEFAULT_NOTIFICATION_PREFS.resgatesSolicitado,
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

    return iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
      || iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
      || iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
  }

  return status.granted || status.status === 'granted';
}

function getExpoProjectId(): string {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

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

function withDefaultChannel(
  trigger: NotificationTriggerInput,
): NotificationTriggerInput {
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

async function notifyIfEnabled(
  key: keyof NotificationPrefs,
  title: string,
  body: string,
  route: NotificationRoute,
): Promise<void> {
  try {
    const preferences = await getNotificationPrefs();
    if (!preferences[key]) return;

    await sendLocalNotificationWithData(title, body, { route });
  } catch {
    // Notificações locais não podem interromper o fluxo principal do app.
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo()) {
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
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

  if (!hasGrantedNotificationPermission(permissions, Notifications) || !Device.isDevice) {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: getExpoProjectId(),
  });

  return token.data;
}

export async function savePushToken(token: string): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error('Token de push inválido.');
  }

  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: normalizedToken,
  });

  if (error) {
    throw new Error('Não foi possível salvar o token de notificação.');
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  await scheduleNotification(title, body, getImmediateTrigger());
}

export async function sendLocalNotificationWithData(
  title: string,
  body: string,
  data: NotificationData,
): Promise<void> {
  await scheduleNotification(title, body, getImmediateTrigger(), data);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: NotificationTriggerInput,
): Promise<void> {
  await scheduleNotification(title, body, trigger);
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const rawPreferences = await deviceStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
  return normalizeNotificationPrefs(rawPreferences);
}

export async function syncPrefsToServer(prefs: NotificationPrefs): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('usuarios')
      .update({ notif_prefs: prefs })
      .eq('id', user.id);
  } catch (error) {
    captureException(error);
  }
}

export async function syncPrefsFromServer(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('notif_prefs')
      .eq('id', user.id)
      .single();

    if (error || !data?.notif_prefs) return;

    const serverPrefs = data.notif_prefs as NotificationPrefs;
    await deviceStorage.setItem(
      NOTIFICATION_PREFERENCES_KEY,
      JSON.stringify(serverPrefs),
    );
  } catch (error) {
    captureException(error);
  }
}

export async function setNotificationPrefs(
  preferences: NotificationPrefs,
): Promise<void> {
  await deviceStorage.setItem(
    NOTIFICATION_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
  // Fire-and-forget: sync to server, errors logged to Sentry
  syncPrefsToServer(preferences);
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

export function getNotificationRoute(data: unknown): NotificationRoute | null {
  if (!isRecord(data)) return null;

  switch (data.route) {
    case '/(admin)/tasks':
    case '/(child)/redemptions':
    case '/(child)/tasks':
      return data.route;
    default:
      return null;
  }
}

export async function subscribeToNotificationNavigation(
  onRoute: (route: NotificationRoute) => void,
): Promise<() => void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => undefined;
  }

  function redirectFromNotificationData(data: unknown) {
    const route = getNotificationRoute(data);
    if (!route) return;

    onRoute(route);
  }

  const lastNotificationResponse = Notifications.getLastNotificationResponse();
  if (lastNotificationResponse?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    redirectFromNotificationData(
      lastNotificationResponse.notification.request.content.data,
    );
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

export async function notifyTaskCompleted(): Promise<void> {
  await notifyIfEnabled(
    'tarefaConcluida',
    'Tarefa concluída',
    'Uma tarefa foi enviada para validação.',
    '/(admin)/tasks',
  );
}

export async function notifyTaskCreated(taskTitle: string): Promise<void> {
  await notifyIfEnabled(
    'tarefasPendentes',
    'Nova tarefa',
    `Uma nova tarefa foi atribuída a você: "${taskTitle}".`,
    '/(child)/tasks',
  );
}

export async function notifyRedemptionRequested(): Promise<void> {
  await notifyIfEnabled(
    'resgatesSolicitado',
    'Resgate solicitado',
    'Um resgate foi solicitado.',
    '/(admin)/tasks',
  );
}
