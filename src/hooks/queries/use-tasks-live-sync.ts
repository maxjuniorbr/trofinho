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

    // Only subscribe to tarefas (filtered by familia_id). The atribuicoes
    // table lacks a familia_id column, so an unfiltered subscription would
    // broadcast events from ALL families — a cross-family data leak (S2).
    // Task-level changes are sufficient to trigger cache invalidation.
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, familiaId]);
};
