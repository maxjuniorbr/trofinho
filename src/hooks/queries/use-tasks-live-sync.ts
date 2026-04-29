import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { queryKeys } from './query-keys';

export const useTasksLiveSync = (familiaId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familiaId) return;

    const invalidateTasks = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    };

    // Subscribe to both tarefas and atribuicoes, filtered by familia_id.
    // Migration 20260426200000 added familia_id to atribuicoes, enabling
    // safe family-scoped subscriptions (previously blocked — S2 risk).
    // Stable channel name keyed on familiaId — avoids channel accumulation
    // when the component remounts rapidly (e.g. tab switches).
    const channel = supabase
      .channel(`tasks-live-sync-${familiaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tarefas',
          filter: `familia_id=eq.${familiaId}`,
        },
        invalidateTasks,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atribuicoes',
          filter: `familia_id=eq.${familiaId}`,
        },
        invalidateTasks,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, familiaId]);
};
