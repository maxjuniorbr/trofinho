import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';

type PushEvent =
  | 'tarefa_aprovada'
  | 'tarefa_rejeitada'
  | 'tarefa_criada'
  | 'resgate_confirmado'
  | 'resgate_solicitado'
  | 'resgate_cancelado'
  | 'tarefa_concluida';

export async function dispatchPushNotification(
  event: PushEvent,
  familiaId: string,
  payload: Record<string, string | string[]>,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { event, familiaId, payload },
    });

    if (error) {
      // Supabase Edge Functions retornam erros específicos herdados de FunctionsError
      let errorCategory = 'Inesperado';
      if (error.name === 'FunctionsHttpError') {
        errorCategory = 'HTTP/Não encontrado (possivelmente falta deploy)';
      } else if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
        errorCategory = 'Rede/Conexão';
      }

      console.warn(
        `[push] Falha ao enviar evento '${event}':\n` +
          `       Causa: ${errorCategory}\n` +
          `       Detalhe: ${error.message ?? error}`,
      );

      Sentry.captureException(error, {
        tags: { subsystem: 'push', event, errorCategory: error.name || 'Unknown' },
        extra: { familiaId, payload, response: data },
      });
      return;
    }

    if (__DEV__) {
      console.log(`[push] Evento '${event}' processado:`, data);
    }
  } catch (err) {
    console.warn(
      `[push] Exceção inesperada no evento '${event}':`,
      err instanceof Error ? err.message : err,
    );
    Sentry.captureException(err, {
      tags: { subsystem: 'push', event, errorCategory: 'Exception' },
      extra: { familiaId, payload },
    });
  }
}
