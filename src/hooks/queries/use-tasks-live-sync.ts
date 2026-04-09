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
    const channel = supabase
      .channel(`tasks-live-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`) // NOSONAR — not security-sensitive, just channel uniqueness
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
