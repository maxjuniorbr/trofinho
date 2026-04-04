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

    const channel = supabase
      .channel(`tasks-live-sync-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'atribuicoes',
      }, invalidateTasks)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tarefas',
        filter: `familia_id=eq.${familiaId}`,
      }, invalidateTasks)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, familiaId]);
};
