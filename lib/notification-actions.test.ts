import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { handleNotificationAction, ACTION_IDS, CATEGORY_IDS } from './notification-actions';

const ASSIGNMENT_ID = '11111111-1111-1111-1111-111111111111';
const FAMILIA_ID = '22222222-2222-2222-2222-222222222222';
const CHILD_USER_ID = '33333333-3333-3333-3333-333333333333';
const REDEMPTION_ID = '44444444-4444-4444-4444-444444444444';

const approveAssignmentMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: true, error: null }),
);
const confirmRedemptionMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: true, error: null }),
);
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('./tasks', () => ({ approveAssignment: approveAssignmentMock }));
vi.mock('./redemptions', () => ({ confirmRedemption: confirmRedemptionMock }));
vi.mock('@sentry/react-native', () => ({
  captureException: captureExceptionMock,
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('notification-actions', () => {
  beforeEach(() => {
    approveAssignmentMock.mockReset().mockResolvedValue({ data: true, error: null });
    confirmRedemptionMock.mockReset().mockResolvedValue({ data: true, error: null });
    captureExceptionMock.mockReset();
  });

  describe('CATEGORY_IDS and ACTION_IDS', () => {
    it('exports expected category IDs', () => {
      expect(CATEGORY_IDS.TASK_REVIEW).toBe('TASK_REVIEW');
      expect(CATEGORY_IDS.REDEMPTION_REVIEW).toBe('REDEMPTION_REVIEW');
    });

    it('exports expected action IDs', () => {
      expect(ACTION_IDS.APPROVE_TASK).toBe('APPROVE_TASK');
      expect(ACTION_IDS.CONFIRM_REDEMPTION).toBe('CONFIRM_REDEMPTION');
    });
  });

  describe('APPROVE_TASK action', () => {
    it('calls approveAssignment with correct params', async () => {
      await handleNotificationAction(ACTION_IDS.APPROVE_TASK, {
        assignmentId: ASSIGNMENT_ID,
        familiaId: FAMILIA_ID,
        childUserId: CHILD_USER_ID,
        taskTitle: 'Arrumar cama',
      });

      expect(approveAssignmentMock).toHaveBeenCalledWith(ASSIGNMENT_ID, {
        familiaId: FAMILIA_ID,
        userId: CHILD_USER_ID,
        taskTitle: 'Arrumar cama',
      });
    });

    it('does nothing when assignmentId is missing', async () => {
      await handleNotificationAction(ACTION_IDS.APPROVE_TASK, { familiaId: FAMILIA_ID });
      expect(approveAssignmentMock).not.toHaveBeenCalled();
    });

    it('does nothing when familiaId is missing', async () => {
      await handleNotificationAction(ACTION_IDS.APPROVE_TASK, { assignmentId: ASSIGNMENT_ID });
      expect(approveAssignmentMock).not.toHaveBeenCalled();
    });

    it('defaults userId to null and taskTitle to empty when missing', async () => {
      await handleNotificationAction(ACTION_IDS.APPROVE_TASK, {
        assignmentId: ASSIGNMENT_ID,
        familiaId: FAMILIA_ID,
      });

      expect(approveAssignmentMock).toHaveBeenCalledWith(ASSIGNMENT_ID, {
        familiaId: FAMILIA_ID,
        userId: null,
        taskTitle: '',
      });
    });

    it('captures exception and does not throw on error', async () => {
      const fakeError = new Error('network');
      approveAssignmentMock.mockRejectedValueOnce(fakeError);

      await expect(
        handleNotificationAction(ACTION_IDS.APPROVE_TASK, {
          assignmentId: ASSIGNMENT_ID,
          familiaId: FAMILIA_ID,
        }),
      ).resolves.toBeUndefined();

      expect(captureExceptionMock).toHaveBeenCalledWith(fakeError, {
        tags: { subsystem: 'notification-action', actionId: ACTION_IDS.APPROVE_TASK },
      });
    });
  });

  describe('CONFIRM_REDEMPTION action', () => {
    it('calls confirmRedemption with correct params', async () => {
      await handleNotificationAction(ACTION_IDS.CONFIRM_REDEMPTION, {
        redemptionId: REDEMPTION_ID,
        familiaId: FAMILIA_ID,
        childUserId: CHILD_USER_ID,
        prizeName: 'Sorvete',
      });

      expect(confirmRedemptionMock).toHaveBeenCalledWith(REDEMPTION_ID, {
        familiaId: FAMILIA_ID,
        userId: CHILD_USER_ID,
        prizeName: 'Sorvete',
      });
    });

    it('does nothing when redemptionId is missing', async () => {
      await handleNotificationAction(ACTION_IDS.CONFIRM_REDEMPTION, { familiaId: FAMILIA_ID });
      expect(confirmRedemptionMock).not.toHaveBeenCalled();
    });

    it('does nothing when familiaId is missing', async () => {
      await handleNotificationAction(ACTION_IDS.CONFIRM_REDEMPTION, {
        redemptionId: REDEMPTION_ID,
      });
      expect(confirmRedemptionMock).not.toHaveBeenCalled();
    });

    it('captures exception on error', async () => {
      const fakeError = new Error('timeout');
      confirmRedemptionMock.mockRejectedValueOnce(fakeError);

      await handleNotificationAction(ACTION_IDS.CONFIRM_REDEMPTION, {
        redemptionId: REDEMPTION_ID,
        familiaId: FAMILIA_ID,
      });

      expect(captureExceptionMock).toHaveBeenCalledWith(fakeError, {
        tags: { subsystem: 'notification-action', actionId: ACTION_IDS.CONFIRM_REDEMPTION },
      });
    });
  });

  describe('invalid UUIDs', () => {
    it('does nothing and skips RPC when assignmentId is not a UUID', async () => {
      await handleNotificationAction(ACTION_IDS.APPROVE_TASK, {
        assignmentId: 'not-a-uuid',
        familiaId: FAMILIA_ID,
      });
      expect(approveAssignmentMock).not.toHaveBeenCalled();
    });

    it('does nothing and skips RPC when redemptionId is not a UUID', async () => {
      await handleNotificationAction(ACTION_IDS.CONFIRM_REDEMPTION, {
        redemptionId: 'not-a-uuid',
        familiaId: FAMILIA_ID,
      });
      expect(confirmRedemptionMock).not.toHaveBeenCalled();
    });
  });

  describe('unknown action', () => {
    it('does nothing for unknown action IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s !== ACTION_IDS.APPROVE_TASK && s !== ACTION_IDS.CONFIRM_REDEMPTION),
          async (actionId) => {
            await handleNotificationAction(actionId, {
              assignmentId: ASSIGNMENT_ID,
              familiaId: FAMILIA_ID,
            });
            expect(approveAssignmentMock).not.toHaveBeenCalled();
            expect(confirmRedemptionMock).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
