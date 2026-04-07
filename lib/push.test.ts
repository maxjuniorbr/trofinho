import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { dispatchPushNotification } from './push';

const invokeMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const refreshSessionMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('@sentry/react-native', () => ({
  captureException: captureExceptionMock,
}));

describe('dispatchPushNotification', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    captureExceptionMock.mockReset();
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    // Default: session with token valid for 1 hour
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error('no refresh needed'),
    });
    vi.restoreAllMocks();
  });

  /**
   * Property 8: Fire-and-forget error isolation
   * Validates: Requirements 8.1, 8.2, 10.3
   *
   * For any error thrown by supabase.functions.invoke(), dispatchPushNotification
   * SHALL catch the error, log it via console.warn, report to Sentry, and SHALL NOT
   * re-throw or propagate the error to the caller.
   */
  describe('Property 8: Fire-and-forget error isolation', () => {
    const eventArb = fc.constantFrom(
      'tarefa_aprovada' as const,
      'tarefa_rejeitada' as const,
      'tarefa_criada' as const,
      'resgate_confirmado' as const,
      'resgate_solicitado' as const,
      'resgate_cancelado' as const,
      'tarefa_concluida' as const,
    );

    const familiaIdArb = fc.uuid();

    const payloadArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ maxLength: 50 }),
    );

    const errorArb = fc.oneof(
      fc.string().map((msg) => new Error(msg)),
      fc.string().map((msg) => new TypeError(msg)),
      fc.string(),
      fc.dictionary(fc.string(), fc.string()),
    );

    it('never throws regardless of error type (catch path)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await fc.assert(
        fc.asyncProperty(
          eventArb,
          familiaIdArb,
          payloadArb,
          errorArb,
          async (event, familiaId, payload, error) => {
            invokeMock.mockRejectedValueOnce(error);
            // Must not throw — resolves to undefined
            await expect(
              dispatchPushNotification(event, familiaId, payload),
            ).resolves.toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('reports to Sentry on catch path', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const thrownError = new Error('network blew up');
      invokeMock.mockRejectedValueOnce(thrownError);

      await dispatchPushNotification('tarefa_aprovada', 'family-1', {
        userId: 'u1',
        taskTitle: 'T',
      });

      expect(captureExceptionMock).toHaveBeenCalledOnce();
      expect(captureExceptionMock).toHaveBeenCalledWith(
        thrownError,
        expect.objectContaining({
          tags: expect.objectContaining({ subsystem: 'push', event: 'tarefa_aprovada' }),
        }),
      );
    });

    it('never throws when invoke returns FunctionsHttpError', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const fnError = Object.assign(new Error('Not found'), { name: 'FunctionsHttpError' });
      invokeMock.mockResolvedValueOnce({ data: null, error: fnError });

      await expect(
        dispatchPushNotification('tarefa_aprovada', 'family-1', { userId: 'u1', taskTitle: 'T' }),
      ).resolves.toBeUndefined();

      expect(captureExceptionMock).toHaveBeenCalledOnce();
    });

    it('logs via console.warn on FunctionsHttpError path', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const fnError = Object.assign(new Error('Edge fn error'), { name: 'FunctionsHttpError' });
      invokeMock.mockResolvedValueOnce({ data: null, error: fnError });

      await dispatchPushNotification('resgate_solicitado', 'family-1', {
        childName: 'C',
        prizeName: 'P',
      });

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('resgate_solicitado');
    });
  });

  it('completes without error on successful invocation', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    invokeMock.mockResolvedValueOnce({ data: { sent: 1, failed: 0, cleaned: 0 }, error: null });

    await expect(
      dispatchPushNotification('tarefa_aprovada', 'family-123', {
        userId: 'u1',
        taskTitle: 'Lavar louça',
      }),
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith('send-push-notification', {
      body: {
        event: 'tarefa_aprovada',
        familiaId: 'family-123',
        payload: { userId: 'u1', taskTitle: 'Lavar louça' },
      },
      headers: { Authorization: 'Bearer test-access-token' },
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  describe('Token freshness', () => {
    it('skips notification when session is null', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: null } });

      await dispatchPushNotification('tarefa_aprovada', 'family-1', {
        userId: 'u1',
        taskTitle: 'T',
      });

      expect(invokeMock).not.toHaveBeenCalled();
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('refreshes token when session is expired', async () => {
      getSessionMock.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'expired-token',
            expires_at: Math.floor(Date.now() / 1000) - 60,
          },
        },
      });
      refreshSessionMock.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      });
      invokeMock.mockResolvedValueOnce({ data: { sent: 1 }, error: null });

      await dispatchPushNotification('tarefa_aprovada', 'family-1', {
        userId: 'u1',
        taskTitle: 'T',
      });

      expect(refreshSessionMock).toHaveBeenCalledOnce();
      expect(invokeMock).toHaveBeenCalledWith('send-push-notification', {
        body: {
          event: 'tarefa_aprovada',
          familiaId: 'family-1',
          payload: { userId: 'u1', taskTitle: 'T' },
        },
        headers: { Authorization: 'Bearer refreshed-token' },
      });
    });

    it('skips notification when refresh fails', async () => {
      getSessionMock.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'expired-token',
            expires_at: Math.floor(Date.now() / 1000) - 60,
          },
        },
      });
      refreshSessionMock.mockResolvedValueOnce({
        data: { session: null },
        error: new Error('refresh failed'),
      });

      await dispatchPushNotification('tarefa_aprovada', 'family-1', {
        userId: 'u1',
        taskTitle: 'T',
      });

      expect(invokeMock).not.toHaveBeenCalled();
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('does not refresh when token has plenty of time left', async () => {
      invokeMock.mockResolvedValueOnce({ data: { sent: 1 }, error: null });

      await dispatchPushNotification('tarefa_aprovada', 'family-1', {
        userId: 'u1',
        taskTitle: 'T',
      });

      expect(refreshSessionMock).not.toHaveBeenCalled();
      expect(invokeMock).toHaveBeenCalledOnce();
    });
  });
});
