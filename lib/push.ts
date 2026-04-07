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

/** Minimum remaining lifetime (in seconds) before we proactively refresh the token. */
const TOKEN_REFRESH_BUFFER_S = 30;

/**
 * Returns a fresh access token for the current user.
 *
 * `getSession()` only reads from memory/storage and may return an expired JWT.
 * When the token is expired (or close to it), we call `refreshSession()` so the
 * edge function always receives a valid JWT — avoiding the 401 that caused
 * TROFINHO-9 and TROFINHO-A.
 */
async function getFreshAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const nowS = Math.floor(Date.now() / 1000);

  if (expiresAt - nowS >= TOKEN_REFRESH_BUFFER_S) {
    return session.access_token;
  }

  // Token is expired or about to expire — attempt a refresh.
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
}

export async function dispatchPushNotification(
  event: PushEvent,
  familiaId: string,
  payload: Record<string, string | string[]>,
): Promise<void> {
  try {
    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      // No valid session — can't authenticate with the edge function.
      // Fire-and-forget: skip silently.
      return;
    }

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { event, familiaId, payload },
      headers: { Authorization: `Bearer ${accessToken}` },
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
