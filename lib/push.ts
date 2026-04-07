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
    // Explicitly retrieve the session so the user JWT is sent in the Authorization header.
    // Without this, supabase.functions.invoke falls back to the anon key when the session
    // is momentarily unavailable (e.g. during token refresh), causing the edge function
    // to reject the request with 401.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { event, familiaId, payload },
      ...(session ? { headers: { Authorization: `Bearer ${session.access_token}` } } : {}),
    });

    if (error) {
      // Supabase Edge Functions retornam erros específicos herdados de FunctionsError
      let errorCategory = 'Inesperado';
      let statusCode: number | undefined;
      if (error.name === 'FunctionsHttpError') {
        statusCode = (error as { context?: { status?: number } }).context?.status;
        errorCategory = `HTTP/${statusCode ?? 'desconhecido'}`;
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
        extra: { familiaId, payload, response: data, statusCode },
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
