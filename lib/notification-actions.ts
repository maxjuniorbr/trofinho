import * as Sentry from '@sentry/react-native';
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

export async function handleNotificationAction(
  actionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    if (actionId === ACTION_IDS.APPROVE_TASK) {
      const assignmentId = data.assignmentId;
      const familiaId = data.familiaId;
      if (!isUuid(assignmentId) || !isUuid(familiaId)) {
        Sentry.addBreadcrumb({
          category: 'notification-action',
          level: 'warning',
          message: 'APPROVE_TASK ignored: invalid UUID payload',
        });
        return;
      }
      await approveAssignment(assignmentId, {
        familiaId,
        userId: isUuid(data.childUserId) ? data.childUserId : null,
        taskTitle: typeof data.taskTitle === 'string' ? data.taskTitle : '',
      });
    } else if (actionId === ACTION_IDS.CONFIRM_REDEMPTION) {
      const redemptionId = data.redemptionId;
      const familiaId = data.familiaId;
      if (!isUuid(redemptionId) || !isUuid(familiaId)) {
        Sentry.addBreadcrumb({
          category: 'notification-action',
          level: 'warning',
          message: 'CONFIRM_REDEMPTION ignored: invalid UUID payload',
        });
        return;
      }
      await confirmRedemption(redemptionId, {
        familiaId,
        userId: isUuid(data.childUserId) ? data.childUserId : null,
        prizeName: typeof data.prizeName === 'string' ? data.prizeName : '',
      });
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subsystem: 'notification-action', actionId },
    });
  }
}
