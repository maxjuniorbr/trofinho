import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';

export type PushEvent =
  | 'tarefa_aprovada'
  | 'tarefa_rejeitada'
  | 'tarefa_criada'
  | 'resgate_confirmado'
  | 'resgate_solicitado'
  | 'resgate_cancelado'
  | 'tarefa_concluida'
  | 'resgate_cofrinho_solicitado'
  | 'resgate_cofrinho_confirmado'
  | 'resgate_cofrinho_cancelado';

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

/** Maximum retry attempts for transient push failures. */
const MAX_PUSH_RETRIES = 2;
/** Base delay in ms for exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: { name?: string; context?: { status?: number } }): boolean {
  if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') return true;
  const status = error.context?.status;
  return status !== undefined && (status === 429 || status >= 500);
}

export async function dispatchPushNotification(
  event: PushEvent,
  familiaId: string,
  payload: Record<string, string | string[]>,
): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        Sentry.addBreadcrumb({
          category: 'push',
          message: `Skipped '${event}': no valid session`,
          level: 'info',
        });
        return;
      }

      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { event, familiaId, payload },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        lastError = error;

        if (attempt < MAX_PUSH_RETRIES && isTransientError(error as { name?: string; context?: { status?: number } })) {
          Sentry.addBreadcrumb({
            category: 'push',
            message: `Retry ${attempt + 1}/${MAX_PUSH_RETRIES} for '${event}'`,
            level: 'warning',
            data: { errorName: error.name, message: error.message },
          });
          continue;
        }

        // Non-transient or final attempt — capture to Sentry
        let statusCode: number | undefined;
        if (error.name === 'FunctionsHttpError') {
          statusCode = (error as { context?: { status?: number } }).context?.status;
        }

        Sentry.captureException(error, {
          tags: { subsystem: 'push', event, errorCategory: error.name || 'Unknown' },
          extra: { statusCode, attempt, message: error.message ?? String(error) },
        });
        return;
      }

      if (__DEV__) {
        Sentry.addBreadcrumb({
          category: 'push',
          message: `Evento '${event}' processado`,
          level: 'info',
          data: data as Record<string, unknown> | undefined,
        });
      }

      // Surface partial-failure: the edge function returns
      // { sent: number, failed: number } when it fans out to multiple tokens.
      const result = data as { failed?: number; sent?: number } | null;
      if (result && typeof result.failed === 'number' && result.failed > 0) {
        Sentry.captureMessage('push: partial delivery failure', {
          level: 'warning',
          tags: { subsystem: 'push', event },
          extra: { failed: result.failed, sent: result.sent ?? 0, familiaId },
        });
      }

      return; // Success — exit retry loop
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_PUSH_RETRIES) {
        Sentry.captureException(err, {
          tags: { subsystem: 'push', event, errorCategory: 'Exception' },
          extra: { attempt },
        });
      }
    }
  }

  // All retries exhausted
  if (lastError) {
    Sentry.captureMessage('push: all retries exhausted', {
      level: 'error',
      tags: { subsystem: 'push', event },
      extra: { familiaId, attempts: MAX_PUSH_RETRIES + 1 },
    });
  }
}
