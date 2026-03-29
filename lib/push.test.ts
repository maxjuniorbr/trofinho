import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

const invokeMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('./sentry', () => ({
  captureException: captureExceptionMock,
}));

import { dispatchPushNotification } from './push';

describe('dispatchPushNotification', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    captureExceptionMock.mockReset();
  });

  /**
   * Property 8: Fire-and-forget error isolation
   * Validates: Requirements 8.1, 8.2, 10.3
   *
   * For any error thrown by supabase.functions.invoke(), dispatchPushNotification
   * SHALL catch the error, pass it to captureException, and SHALL NOT re-throw
   * or propagate the error to the caller.
   */
  describe('Property 8: Fire-and-forget error isolation', () => {
    const eventArb = fc.constantFrom(
      'tarefa_aprovada' as const,
      'tarefa_rejeitada' as const,
      'resgate_confirmado' as const,
      'resgate_solicitado' as const,
      'tarefa_concluida' as const,
    );

    const familiaIdArb = fc.uuid();

    const payloadArb = fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 50 }));

    const errorArb = fc.oneof(
      fc.string().map((msg) => new Error(msg)),
      fc.string().map((msg) => new TypeError(msg)),
      fc.string(),
      fc.dictionary(fc.string(), fc.string()),
    );

    it('never throws regardless of error type', async () => {
      await fc.assert(
        fc.asyncProperty(eventArb, familiaIdArb, payloadArb, errorArb, async (event, familiaId, payload, error) => {
          invokeMock.mockRejectedValueOnce(error);
          // Must not throw — resolves to undefined
          await expect(dispatchPushNotification(event, familiaId, payload)).resolves.toBeUndefined();
        }),
        { numRuns: 100 },
      );
    });

    it('calls captureException with the thrown error', async () => {
      await fc.assert(
        fc.asyncProperty(eventArb, familiaIdArb, payloadArb, errorArb, async (event, familiaId, payload, error) => {
          invokeMock.mockReset();
          captureExceptionMock.mockReset();
          invokeMock.mockRejectedValueOnce(error);

          await dispatchPushNotification(event, familiaId, payload);

          expect(captureExceptionMock).toHaveBeenCalledOnce();
          expect(captureExceptionMock).toHaveBeenCalledWith(error);
        }),
        { numRuns: 100 },
      );
    });
  });

  it('completes without error on successful invocation', async () => {
    invokeMock.mockResolvedValueOnce({ data: { sent: 1, failed: 0, cleaned: 0 }, error: null });

    await expect(
      dispatchPushNotification('tarefa_aprovada', 'family-123', { userId: 'u1', taskTitle: 'Lavar louça' }),
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith('send-push-notification', {
      body: {
        event: 'tarefa_aprovada',
        familiaId: 'family-123',
        payload: { userId: 'u1', taskTitle: 'Lavar louça' },
      },
    });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
