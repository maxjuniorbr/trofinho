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

export async function handleNotificationAction(
  actionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    if (actionId === ACTION_IDS.APPROVE_TASK) {
      const assignmentId = data.assignmentId as string | undefined;
      const familiaId = data.familiaId as string | undefined;
      if (!assignmentId || !familiaId) return;
      await approveAssignment(assignmentId, {
        familiaId,
        userId: (data.childUserId as string) ?? null,
        taskTitle: (data.taskTitle as string) ?? '',
      });
    } else if (actionId === ACTION_IDS.CONFIRM_REDEMPTION) {
      const redemptionId = data.redemptionId as string | undefined;
      const familiaId = data.familiaId as string | undefined;
      if (!redemptionId || !familiaId) return;
      await confirmRedemption(redemptionId, {
        familiaId,
        userId: (data.childUserId as string) ?? null,
        prizeName: (data.prizeName as string) ?? '',
      });
    }
  } catch (error) {
    console.warn('[notification-action] Failed:', error);
    Sentry.captureException(error, {
      tags: { subsystem: 'notification-action', actionId },
    });
  }
}
