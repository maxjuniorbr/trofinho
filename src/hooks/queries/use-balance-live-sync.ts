import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { queryKeys } from './query-keys';

/**
 * Subscribes to the child's own saldo row in Realtime.
 * When the parent approves a task (or any other balance mutation happens on the server),
 * the saldos row is updated and this hook invalidates the balances cache so the child
 * home screen reflects the new points without requiring a manual pull-to-refresh.
 *
 * Uses filho_id filter to prevent cross-family data leaks.
 */
export const useBalanceLiveSync = (childId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!childId) return;

    const invalidateBalance = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    };

    const channel = supabase
      .channel(`balance-live-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`) // NOSONAR — not security-sensitive, just channel uniqueness
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'saldos',
          filter: `filho_id=eq.${childId}`,
        },
        invalidateBalance,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, childId]);
};
