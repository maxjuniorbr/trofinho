import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

import {
  applyAppreciation,
  applyPenalty,
  configureAppreciation,
  getAppreciationPeriodLabel,
  getBalance,
  getTransactionTypeLabel,
  isCredit,
  listAdminBalances,
  listTransactions,
  transferToPiggyBank,
} from './balances';

function createQuery(result: { data?: unknown; error?: { code?: string; message: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('balances', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns labels and credit flags for transaction types', () => {
    expect(getTransactionTypeLabel('credito')).toBe('Tarefa aprovada');
    expect(isCredit('credito')).toBe(true);
    expect(isCredit('debito')).toBe(false);
  });

  it('returns the appreciation period label', () => {
    expect(getAppreciationPeriodLabel('diario')).toBe('dia');
    expect(getAppreciationPeriodLabel('semanal')).toBe('semana');
    expect(getAppreciationPeriodLabel('mensal')).toBe('mês');
  });

  it('loads a balance with and without child filter', async () => {
    const query = createQuery({ data: { saldo_livre: 10 }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await getBalance('child-1');

    expect(query.eq).toHaveBeenCalledWith('filho_id', 'child-1');
    expect(result).toEqual({ data: { saldo_livre: 10 }, error: null });
  });

  it('treats missing balances as empty instead of an error', async () => {
    const query = createQuery({ data: null, error: { code: 'PGRST116', message: 'not found' } });
    supabaseMock.from.mockReturnValue(query);

    const result = await getBalance();

    expect(result).toEqual({ data: null, error: null });
  });

  it('surfaces query errors for balances and listings', async () => {
    const balanceQuery = createQuery({ data: null, error: { message: 'boom' } });
    const listQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'list failed' } }),
    };

    supabaseMock.from
      .mockReturnValueOnce(balanceQuery)
      .mockReturnValueOnce(listQuery);

    await expect(getBalance()).resolves.toEqual({ data: null, error: 'boom' });
    await expect(listAdminBalances()).resolves.toEqual({ data: [], error: 'list failed' });
  });

  it('lists transactions with limit and ordering', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'tx-1' }], error: null }),
    };
    supabaseMock.from.mockReturnValue(query);

    const result = await listTransactions('child-1', 5);

    expect(query.eq).toHaveBeenCalledWith('filho_id', 'child-1');
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({ data: [{ id: 'tx-1' }], error: null });
  });

  it('delegates balance mutations to RPC calls', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ data: 7, error: null })
      .mockResolvedValueOnce({ error: { message: 'penalty failed' } })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'transfer failed' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'appreciation failed' } });

    await expect(transferToPiggyBank('child-1', 10)).resolves.toEqual({ error: null });
    await expect(applyAppreciation('child-1')).resolves.toEqual({ data: 7, error: null });
    await expect(applyPenalty('child-1', 3, 'Late')).resolves.toEqual({ error: 'penalty failed' });
    await expect(configureAppreciation('child-1', 12, 'mensal')).resolves.toEqual({ error: null });
    await expect(transferToPiggyBank('child-1', 4)).resolves.toEqual({ error: 'transfer failed' });
    await expect(applyAppreciation('child-1')).resolves.toEqual({ data: null, error: 'appreciation failed' });

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'transferir_para_cofrinho', {
      p_filho_id: 'child-1',
      p_valor: 10,
    });
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(4, 'configurar_valorizacao', {
      p_filho_id: 'child-1',
      p_indice: 12,
      p_periodo: 'mensal',
    });
  });

  it('returns empty lists and successful penalty results for remaining branches', async () => {
    const emptyBalancesQuery = {
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
    };
    const listErrorQuery = {
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'list failed' } }),
      order: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };

    supabaseMock.from
      .mockReturnValueOnce(emptyBalancesQuery)
      .mockReturnValueOnce(listErrorQuery);
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(listAdminBalances()).resolves.toEqual({ data: [], error: null });
    await expect(listTransactions('child-1')).resolves.toEqual({ data: [], error: 'list failed' });
    await expect(applyPenalty('child-1', 2, 'Atraso')).resolves.toEqual({ error: null });
  });
});
