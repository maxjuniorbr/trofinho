import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { queryKeys } from './query-keys';

/**
 * Subscribes to the family's resgates rows in Realtime.
 * Invalidates all redemption queries (admin list, child list, pending count)
 * when any redemption in the family is created or updated, so screens reflect
 * changes without requiring a manual pull-to-refresh.
 *
 * Uses familia_id filter to prevent cross-family data leaks.
 */
export const useRedemptionsLiveSync = (familiaId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familiaId) return;

    const invalidateRedemptions = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemptions.all });
    };

    // Stable channel name keyed on familiaId — avoids channel accumulation
    // when the component remounts rapidly (e.g. tab switches).
    const channel = supabase
      .channel(`redemptions-live-sync-${familiaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'resgates',
          filter: `familia_id=eq.${familiaId}`,
        },
        invalidateRedemptions,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, familiaId]);
};
