import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  requestPiggyBankWithdrawal,
  confirmPiggyBankWithdrawal,
  cancelPiggyBankWithdrawal,
  listPendingPiggyBankWithdrawals,
  getChildPendingWithdrawal,
  configureWithdrawalRate,
  countPendingPiggyBankWithdrawals,
} from './piggy-bank-withdrawal';

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
  chain.limit = vi.fn().mockReturnValue(chain);
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

describe('requestPiggyBankWithdrawal', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 'w-1', error: null });

    const result = await requestPiggyBankWithdrawal(50, {
      familiaId: 'fam-1',
      childName: 'Lia',
      childUserId: 'user-1',
    });

    expect(result.data).toBe('w-1');
    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('solicitar_resgate_cofrinho', { p_valor: 50 });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
      'resgate_cofrinho_solicitado',
      'fam-1',
      { childName: 'Lia', withdrawalId: 'w-1', childUserId: 'user-1' },
    );
  });

  it('does not dispatch push when opts is undefined', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: 'w-1', error: null });

    await requestPiggyBankWithdrawal(50);

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'Saldo do cofrinho insuficiente' } });

    const result = await requestPiggyBankWithdrawal(50);

    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it('handles arbitrary rpc errors via property', () => {
    fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (msg) => {
        supabaseMock.rpc.mockResolvedValueOnce({ error: { message: msg } });
        const result = await requestPiggyBankWithdrawal(10);
        return result.error !== null && result.data === null;
      }),
    );
  });
});

describe('confirmPiggyBankWithdrawal', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await confirmPiggyBankWithdrawal('w-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      amount: 45,
    });

    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('confirmar_resgate_cofrinho', {
      p_resgate_id: 'w-1',
    });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
      'resgate_cofrinho_confirmado',
      'fam-1',
      { userId: 'user-1', amount: '45' },
    );
  });

  it('does not dispatch push when userId is null', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await confirmPiggyBankWithdrawal('w-1', {
      familiaId: 'fam-1',
      userId: null,
      amount: 45,
    });

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      error: { message: 'Resgate do cofrinho não encontrado' },
    });

    const result = await confirmPiggyBankWithdrawal('w-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      amount: 45,
    });

    expect(result.error).toBeTruthy();
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });
});

describe('cancelPiggyBankWithdrawal', () => {
  it('calls rpc and dispatches push notification', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await cancelPiggyBankWithdrawal('w-1', {
      familiaId: 'fam-1',
      userId: 'user-1',
      amount: 50,
    });

    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('cancelar_resgate_cofrinho', {
      p_resgate_id: 'w-1',
    });
    expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
      'resgate_cofrinho_cancelado',
      'fam-1',
      { userId: 'user-1', amount: '50' },
    );
  });

  it('does not dispatch push when opts is undefined', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await cancelPiggyBankWithdrawal('w-1');

    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      error: { message: 'Resgate do cofrinho não encontrado' },
    });

    const result = await cancelPiggyBankWithdrawal('w-1');

    expect(result.error).toBeTruthy();
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });
});

describe('listPendingPiggyBankWithdrawals', () => {
  it('returns data on success', async () => {
    const items = [{ id: 'w1' }, { id: 'w2' }];
    const chain = mockSelectChain(items);
    supabaseMock.from.mockReturnValue(chain);

    const result = await listPendingPiggyBankWithdrawals();

    expect(result.data).toHaveLength(2);
    expect(result.error).toBeNull();
    expect(supabaseMock.from).toHaveBeenCalledWith('resgates_cofrinho');
  });

  it('returns empty array on error', async () => {
    const chain = mockSelectChain(null, { message: 'DB error' });
    supabaseMock.from.mockReturnValue(chain);

    const result = await listPendingPiggyBankWithdrawals();

    expect(result.data).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

describe('getChildPendingWithdrawal', () => {
  it('returns first pending withdrawal', async () => {
    const items = [{ id: 'w1', status: 'pendente' }];
    const chain = mockSelectChain(items);
    supabaseMock.from.mockReturnValue(chain);

    const result = await getChildPendingWithdrawal();

    expect(result.data).toEqual({ id: 'w1', status: 'pendente' });
    expect(result.error).toBeNull();
  });

  it('returns null when no pending withdrawal', async () => {
    const chain = mockSelectChain([]);
    supabaseMock.from.mockReturnValue(chain);

    const result = await getChildPendingWithdrawal();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns null on error', async () => {
    const chain = mockSelectChain(null, { message: 'DB error' });
    supabaseMock.from.mockReturnValue(chain);

    const result = await getChildPendingWithdrawal();

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('configureWithdrawalRate', () => {
  it('calls rpc with correct params', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await configureWithdrawalRate('child-1', 25);

    expect(result.error).toBeNull();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('configurar_taxa_resgate_cofrinho', {
      p_filho_id: 'child-1',
      p_taxa: 25,
    });
  });

  it('returns error on rpc failure', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'Taxa deve estar entre 0 e 50' } });

    const result = await configureWithdrawalRate('child-1', 75);

    expect(result.error).toBeTruthy();
  });
});

describe('countPendingPiggyBankWithdrawals', () => {
  it('returns count on success', async () => {
    const chain = mockCountChain(3);
    supabaseMock.from.mockReturnValue(chain);

    const result = await countPendingPiggyBankWithdrawals();

    expect(result.data).toBe(3);
    expect(result.error).toBeNull();
  });

  it('returns 0 on error', async () => {
    const chain = mockCountChain(null, { message: 'DB error' });
    supabaseMock.from.mockReturnValue(chain);

    const result = await countPendingPiggyBankWithdrawals();

    expect(result.data).toBe(0);
    expect(result.error).toBeTruthy();
  });
});
