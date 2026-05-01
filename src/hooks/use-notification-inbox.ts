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
import { useProfile } from '@/hooks/queries/use-profile';
import { useMyChildId } from '@/hooks/queries/use-children';
import { useTransactionsByPeriod } from '@/hooks/queries/use-balances';

/** Look-back window for surfacing penalty/appreciation transactions in the inbox. */
const INBOX_TX_LOOKBACK_DAYS = 30;

function inboxTxRange(): { from: string; to: string } {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - INBOX_TX_LOOKBACK_DAYS);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(tomorrow) };
}

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
  const { data: profile } = useProfile();
  const { data: childId } = useMyChildId(profile?.id);
  const { from, to } = useMemo(inboxTxRange, []);
  const transactionsQuery = useTransactionsByPeriod(childId ?? '', from, to);

  const assignments = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const redemptions = useMemo(
    () => redemptionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [redemptionsQuery.data],
  );

  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const items = useMemo(
    () => deriveChildNotifs({ assignments, redemptions, transactions }),
    [assignments, redemptions, transactions],
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
  const { data: profile } = useProfile();
  const { data: childId } = useMyChildId(profile?.id);
  const { from, to } = useMemo(inboxTxRange, []);
  const transactionsQuery = useTransactionsByPeriod(childId ?? '', from, to);

  return useMemo(() => {
    if (assignmentsQuery.isLoading || redemptionsQuery.isLoading) return 0;
    const assignments = assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    const redemptions = redemptionsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    const transactions = transactionsQuery.data ?? [];
    const items = deriveChildNotifs({ assignments, redemptions, transactions });
    return items.filter((n) => n.group === 'Hoje').length;
  }, [
    assignmentsQuery.data,
    assignmentsQuery.isLoading,
    redemptionsQuery.data,
    redemptionsQuery.isLoading,
    transactionsQuery.data,
  ]);
}
