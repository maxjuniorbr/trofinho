import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';
import { approveAssignment } from './tasks';
import { confirmRedemption } from './redemptions';

export const CATEGORY_IDS = {
  TASK_REVIEW: 'TASK_REVIEW',
  REDEMPTION_REVIEW: 'REDEMPTION_REVIEW',
} as const;

export const ACTION_IDS = {
  APPROVE_TASK: 'APPROVE_TASK',
  CONFIRM_REDEMPTION: 'CONFIRM_REDEMPTION',
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asUuidOrNull = (value: unknown): string | null => (isUuid(value) ? value : null);

/**
 * Ensures the session is valid before executing a background action.
 * Push notification actions run without UI, so a stale/expired token
 * would silently fail. Returns true if the session is usable.
 */
async function ensureValidSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const expiresAt = session.expires_at ?? 0;
  const nowS = Math.floor(Date.now() / 1000);
  if (expiresAt - nowS >= 30) return true;

  const { error } = await supabase.auth.refreshSession();
  return !error;
}

function logIgnored(actionId: string, reason: string): void {
  Sentry.addBreadcrumb({
    category: 'notification-action',
    level: 'warning',
    message: `${actionId} ignored: ${reason}`,
  });
}

async function runApproveTask(data: Record<string, unknown>): Promise<void> {
  const { assignmentId, familiaId } = data;
  if (!isUuid(assignmentId) || !isUuid(familiaId)) {
    logIgnored(ACTION_IDS.APPROVE_TASK, 'invalid UUID payload');
    return;
  }
  await approveAssignment(assignmentId, {
    familiaId,
    userId: asUuidOrNull(data.childUserId),
    taskTitle: asString(data.taskTitle),
  });
}

async function runConfirmRedemption(data: Record<string, unknown>): Promise<void> {
  const { redemptionId, familiaId } = data;
  if (!isUuid(redemptionId) || !isUuid(familiaId)) {
    logIgnored(ACTION_IDS.CONFIRM_REDEMPTION, 'invalid UUID payload');
    return;
  }
  await confirmRedemption(redemptionId, {
    familiaId,
    userId: asUuidOrNull(data.childUserId),
    prizeName: asString(data.prizeName),
  });
}

export async function handleNotificationAction(
  actionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hasSession = await ensureValidSession();
    if (!hasSession) {
      logIgnored(actionId, 'no valid session');
      return;
    }

    if (actionId === ACTION_IDS.APPROVE_TASK) {
      await runApproveTask(data);
    } else if (actionId === ACTION_IDS.CONFIRM_REDEMPTION) {
      await runConfirmRedemption(data);
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subsystem: 'notification-action', actionId },
    });
  }
}
