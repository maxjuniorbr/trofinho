import { supabase } from './supabase';

type PushEvent =
  | 'tarefa_aprovada'
  | 'tarefa_rejeitada'
  | 'resgate_confirmado'
  | 'resgate_solicitado'
  | 'tarefa_concluida';

export async function dispatchPushNotification(
  event: PushEvent,
  familiaId: string,
  payload: Record<string, string>,
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: { event, familiaId, payload },
    });
  } catch (error) {
    console.error(error);
  }
}
