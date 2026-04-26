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

export function useAdminNotifInbox(): {
  items: Notif[];
  isLoading: boolean;
  isError: boolean;
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
    isError: tasksQuery.isError || redemptionsQuery.isError,
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
  isError: boolean;
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
    isError: assignmentsQuery.isError || redemptionsQuery.isError,
  };
}

export function useChildUnreadNotifCount(): number {
  const assignmentsQuery = useChildAssignments();
  const redemptionsQuery = useChildRedemptions();

  return useMemo(() => {
    if (assignmentsQuery.isLoading || redemptionsQuery.isLoading) return 0;
    const assignments = assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    const redemptions = redemptionsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    const items = deriveChildNotifs({ assignments, redemptions });
    return items.filter((n) => n.group === 'Hoje').length;
  }, [assignmentsQuery.data, assignmentsQuery.isLoading, redemptionsQuery.data, redemptionsQuery.isLoading]);
}
