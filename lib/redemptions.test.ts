import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  listRedemptions,
  confirmRedemption,
  cancelRedemption,
  listChildRedemptions,
  requestRedemption,
  countPendingRedemptions,
} from './redemptions';

const dispatchPushNotificationMock = vi.hoisted(() => vi.fn());

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./push', () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));

const mockSelectChain = (data: unknown, error: unknown = null) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.returns = vi.fn().mockReturnValue(chain);
  chain.overrideTypes = vi.fn().mockResolvedValue({ data, error });
  return chain;
};

const mockCountChain = (count: number | null, error: unknown = null) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue({ count, error });
  return chain;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listRedemptions', () => {
  it('returns paginated data on success', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: `r${i}` }));
    const chain = mockSelectChain(items);
    supabaseMock.from.mockReturnValue(chain);

    const result = await listRedemptions(0, 20);

    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.error).toBeNull();
    expect(supabaseMock.from).toHaveBeenCalledWith('resgates');
  });

  it('detects hasMore when items exceed page size', async () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}` }));
    const chain = mockSelectChain(items);
    supabaseMock.from.mockReturnValue(chain);

    const result = await listRedemptions(0, 3);

    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });

  it('returns error on failure', async () => {
    const chain = mockSelectChain(null, { message: 'Não autorizado' });
    supabaseMock.from.mockReturnValue(chain);

    const result = await listRedemptions();

    expect(result.data).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

describe('confirmRedemption', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await confirmRedemption('r-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });

    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('confirmar_resgate', { p_resgate_id: 'r-1' });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith('resgate_confirmado', 'fam-1', {
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });
  });

  it('does not dispatch push when userId is null', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await confirmRedemption('r-1', {
      familiaId: 'fam-1',
      userId: null,
      prizeName: 'Bicicleta',
    });

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'Resgate não encontrado' } });

    const result = await confirmRedemption('r-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });

    expect(result.error).toBeTruthy();
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });
});

describe('cancelRedemption', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await cancelRedemption('r-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });

    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('cancelar_resgate', { p_resgate_id: 'r-1' });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith('resgate_cancelado', 'fam-1', {
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });
  });

  it('does not dispatch push when opts is undefined', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await cancelRedemption('r-1');

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'Resgate não encontrado' } });

    const result = await cancelRedemption('r-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      prizeName: 'Bicicleta',
    });

    expect(result.error).toBeTruthy();
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });
});

describe('listChildRedemptions', () => {
  it('returns paginated data on success', async () => {
    const items = [{ id: 'r1' }, { id: 'r2' }];
    const chain = mockSelectChain(items);
    supabaseMock.from.mockReturnValue(chain);

    const result = await listChildRedemptions(0, 20);

    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.error).toBeNull();
  });
});

describe('requestRedemption', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 'redemption-id', error: null });

    const result = await requestRedemption('prize-1', {
      familiaId: 'fam-1',
      childName: 'Lia',
      prizeName: 'Bicicleta',
    });

    expect(result.data).toBe('redemption-id');
    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('solicitar_resgate', { p_premio_id: 'prize-1' });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith('resgate_solicitado', 'fam-1', {
      childName: 'Lia',
      prizeName: 'Bicicleta',
      redemptionId: 'redemption-id',
    });
  });

  it('does not dispatch push when opts is undefined', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 'redemption-id', error: null });

    await requestRedemption('prize-1');

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'Saldo insuficiente' } });

    const result = await requestRedemption('prize-1');

    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it('handles arbitrary rpc errors via property', () => {
    fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (msg) => {
        supabaseMock.rpc.mockResolvedValueOnce({ error: { message: msg } });
        const result = await requestRedemption('prize-1');
        return result.error !== null && result.data === null;
      }),
    );
  });
});

describe('countPendingRedemptions', () => {
  it('returns count on success', async () => {
    const chain = mockCountChain(5);
    supabaseMock.from.mockReturnValue(chain);

    const result = await countPendingRedemptions();

    expect(result.data).toBe(5);
    expect(result.error).toBeNull();
  });

  it('returns 0 on error', async () => {
    const chain = mockCountChain(null, { message: 'DB error' });
    supabaseMock.from.mockReturnValue(chain);

    const result = await countPendingRedemptions();

    expect(result.data).toBe(0);
    expect(result.error).toBeTruthy();
  });
});
