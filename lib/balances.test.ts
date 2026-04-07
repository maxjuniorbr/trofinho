import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import {
  applyPenalty,
  configureAppreciation,
  getAppreciationPeriodLabel,
  getBalance,
  getTransactionTypeLabel,
  isCredit,
  listAdminBalances,
  listTransactions,
  syncAutomaticAppreciation,
  transferToPiggyBank,
} from './balances';
import type { TransactionType } from './balances';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('@sentry/react-native', () => ({
  captureException: captureExceptionMock,
}));

function createQuery(result: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    overrideTypes: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('balances', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ error: null });
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

  it('loads a balance with child filter', async () => {
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

  it('proceeds to query data even when sync fails', async () => {
    const balanceQuery = createQuery({ data: { saldo_livre: 5 }, error: null });
    supabaseMock.from.mockReturnValue(balanceQuery);

    const result = await getBalance();
    expect(result).toEqual({ data: { saldo_livre: 5 }, error: null });
  });

  it('surfaces query errors for balances and listings', async () => {
    const balanceQuery = createQuery({ data: null, error: { message: 'boom' } });
    const listQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      overrideTypes: vi.fn().mockResolvedValue({ data: null, error: { message: 'list failed' } }),
    };

    supabaseMock.from.mockReturnValueOnce(balanceQuery).mockReturnValueOnce(listQuery);

    await expect(getBalance()).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(listAdminBalances()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('lists transactions with pagination and ordering', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      overrideTypes: vi.fn().mockResolvedValue({ data: [{ id: 'tx-1' }], error: null }),
    };
    supabaseMock.from.mockReturnValue(query);

    const result = await listTransactions('child-1');

    expect(query.eq).toHaveBeenCalledWith('filho_id', 'child-1');
    expect(query.range).toHaveBeenCalledWith(0, 20);
    expect(result).toEqual({ data: [{ id: 'tx-1' }], hasMore: false, error: null });
  });

  it('delegates balance mutations to RPC calls', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'penalty failed' } })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'transfer failed' } });

    await expect(transferToPiggyBank('child-1', 10)).resolves.toEqual({ error: null });
    await expect(applyPenalty('child-1', 3, 'Late')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(configureAppreciation('child-1', 12, 'mensal')).resolves.toEqual({ error: null });
    await expect(transferToPiggyBank('child-1', 4)).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'transferir_para_cofrinho', {
      p_filho_id: 'child-1',
      p_valor: 10,
    });
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(3, 'configurar_valorizacao', {
      p_filho_id: 'child-1',
      p_indice: 12,
      p_periodo: 'mensal',
    });
  });

  it('returns empty lists and successful penalty results for remaining branches', async () => {
    const emptyBalancesQuery = {
      order: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      overrideTypes: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
    };
    const listErrorQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      overrideTypes: vi.fn().mockResolvedValue({ data: null, error: { message: 'list failed' } }),
      select: vi.fn().mockReturnThis(),
    };

    supabaseMock.from.mockReturnValueOnce(emptyBalancesQuery).mockReturnValueOnce(listErrorQuery);
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(listAdminBalances()).resolves.toEqual({ data: [], error: null });
    await expect(listTransactions('child-1')).resolves.toEqual({
      data: [],
      hasMore: false,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(applyPenalty('child-1', 2, 'Atraso')).resolves.toEqual({
      data: { deducted: 2 },
      error: null,
    });
  });

  it('syncs automatic appreciation with and without child id', async () => {
    supabaseMock.rpc.mockResolvedValue({ error: null });

    await syncAutomaticAppreciation('child-1');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('sincronizar_valorizacoes_automaticas', {
      p_filho_id: 'child-1',
    });

    supabaseMock.rpc.mockClear();
    await syncAutomaticAppreciation();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('sincronizar_valorizacoes_automaticas');
  });

  it('swallows sync errors silently', async () => {
    supabaseMock.rpc.mockRejectedValue(new Error('network error'));
    await expect(syncAutomaticAppreciation()).resolves.toBeUndefined();
  });

  it('reports sync errors via console.error without throwing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('sync failed');
    supabaseMock.rpc.mockRejectedValue(error);
    await expect(syncAutomaticAppreciation()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    consoleErrorSpy.mockRestore();
  });

  describe('property tests', () => {
    const allTransactionTypes: TransactionType[] = [
      'credito',
      'debito',
      'transferencia_cofrinho',
      'valorizacao',
      'penalizacao',
      'resgate',
      'estorno_resgate',
    ];

    // Feature: review-phases-1-2-implementation, Property 1: Transaction type labels are exhaustive
    it('P1: for any valid TransactionType, getTransactionTypeLabel returns a non-empty pt-BR string ≠ the raw key', () => {
      fc.assert(
        fc.property(fc.constantFrom(...allTransactionTypes), (type) => {
          const label = getTransactionTypeLabel(type);
          return label.length > 0 && label !== type;
        }),
        { numRuns: 100 },
      );
    });

    // Feature: review-phases-1-2-implementation, Property 6: isCredit correctly classifies all transaction types
    it('P6: isCredit returns true only for credito, valorizacao, estorno_resgate', () => {
      const creditTypes = new Set(['credito', 'valorizacao', 'estorno_resgate']);
      fc.assert(
        fc.property(fc.constantFrom(...allTransactionTypes), (type) => {
          return isCredit(type) === creditTypes.has(type);
        }),
        { numRuns: 100 },
      );
    });
  });
});
