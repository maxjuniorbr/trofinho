import { useMemo } from 'react';
import { deriveAdminNotifs, deriveChildNotifs, type Notif } from '@lib/notification-inbox';
import {
  useAdminTasks,
  usePendingValidationCount,
  useChildAssignments,
} from '@/hooks/queries/use-tasks';
import {
  useAdminRedemptions,
  usePendingRedemptionCount,
  useChildRedemptions,
} from '@/hooks/queries/use-redemptions';

// ── Admin ────────────────────────────────────────────────

export function useAdminNotifInbox(): {
  items: Notif[];
  isLoading: boolean;
} {
  const tasksQuery = useAdminTasks();
  const redemptionsQuery = useAdminRedemptions();

  const tasks = useMemo(
    () => tasksQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [tasksQuery.data],
  );

  const redemptions = useMemo(
    () => redemptionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [redemptionsQuery.data],
  );

  const items = useMemo(() => deriveAdminNotifs({ tasks, redemptions }), [tasks, redemptions]);

  return {
    items,
    isLoading: tasksQuery.isLoading || redemptionsQuery.isLoading,
  };
}

export function useAdminUnreadNotifCount(): number {
  const pendingValidations = usePendingValidationCount();
  const pendingRedemptions = usePendingRedemptionCount();
  return (pendingValidations.data ?? 0) + (pendingRedemptions.data ?? 0);
}

// ── Child ────────────────────────────────────────────────

export function useChildNotifInbox(): {
  items: Notif[];
  isLoading: boolean;
} {
  const assignmentsQuery = useChildAssignments();
  const redemptionsQuery = useChildRedemptions();

  const assignments = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const redemptions = useMemo(
    () => redemptionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [redemptionsQuery.data],
  );

  const items = useMemo(
    () => deriveChildNotifs({ assignments, redemptions }),
    [assignments, redemptions],
  );

  return {
    items,
    isLoading: assignmentsQuery.isLoading || redemptionsQuery.isLoading,
  };
}

export function useChildUnreadNotifCount(): number {
  const { items, isLoading } = useChildNotifInbox();
  if (isLoading) return 0;
  return items.length;
}
