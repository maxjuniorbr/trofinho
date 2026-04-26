import { useMemo } from 'react';
import { ClipboardList, Gift, House, ShoppingBag, User } from 'lucide-react-native';
import {
  useChildAssignments,
  usePendingValidationCount,
  usePendingRedemptionCount,
} from '@/hooks/queries';
import { getAssignmentRetryState } from '@lib/tasks';
import type { FooterItem } from '@/components/ui/home-footer-bar';

const CHILD_FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  { icon: ClipboardList, label: 'Tarefas', rota: '/(child)/tasks' },
  { icon: Gift, label: 'Prêmios', rota: '/(child)/prizes' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(child)/redemptions' },
  { icon: User, label: 'Perfil', rota: '/(child)/perfil' },
];

const ADMIN_FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  { icon: ClipboardList, label: 'Tarefas', rota: '/(admin)/tasks' },
  { icon: Gift, label: 'Prêmios', rota: '/(admin)/prizes' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(admin)/redemptions' },
  { icon: User, label: 'Perfil', rota: '/(admin)/perfil' },
];

export function useChildFooterItems(): readonly FooterItem[] {
  const assignmentsQuery = useChildAssignments();

  const pendingCount = useMemo(() => {
    const all = assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    return all.filter(
      (a) => a.status === 'pendente' || (a.status === 'rejeitada' && getAssignmentRetryState(a).canRetry),
    ).length;
  }, [assignmentsQuery.data]);

  return useMemo(
    () =>
      CHILD_FOOTER_ITEMS.map((item) => ({
        ...item,
        badge: item.rota === '/(child)/tasks' ? pendingCount : undefined,
      })),
    [pendingCount],
  );
}

export function useAdminFooterItems(): readonly FooterItem[] {
  const pendingValidationCount = usePendingValidationCount().data ?? 0;
  const pendingRedemptionCount = usePendingRedemptionCount().data ?? 0;

  return useMemo(
    () =>
      ADMIN_FOOTER_ITEMS.map((item) => {
        if (item.rota === '/(admin)/tasks') return { ...item, badge: pendingValidationCount };
        if (item.rota === '/(admin)/redemptions') return { ...item, badge: pendingRedemptionCount };
        return item;
      }),
    [pendingValidationCount, pendingRedemptionCount],
  );
}
