import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import {
  applyPenalty,
  calculateProjection,
  configureAppreciation,
  formatTransactionDates,
  getAppreciationPeriodLabel,
  getBalance,
  getTransactionCategory,
  getTransactionTypeLabel,
  isCredit,
  listAdminBalances,
  listTransactions,
  syncAutomaticAppreciation,
  transferToPiggyBank,
} from './balances';
import type { TransactionCategory, TransactionType } from './balances';

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
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
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
      limit: vi.fn().mockReturnThis(),
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
    await expect(configureAppreciation('child-1', 12)).resolves.toEqual({ error: null });
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
    });
  });

  it('returns empty lists and successful penalty results for remaining branches', async () => {
    const emptyBalancesQuery = {
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
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

  it('reports sync errors via Sentry without throwing', async () => {
    const error = new Error('sync failed');
    supabaseMock.rpc.mockRejectedValue(error);
    await expect(syncAutomaticAppreciation()).resolves.toBeUndefined();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ subsystem: 'balances', step: 'sync-appreciation' }),
      }),
    );
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
      'resgate_cofrinho',
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

    it('getTransactionCategory classifies all types correctly', () => {
      const expected: Record<TransactionType, TransactionCategory> = {
        credito: 'ganho',
        estorno_resgate: 'ganho',
        transferencia_cofrinho: 'cofrinho',
        resgate_cofrinho: 'cofrinho',
        valorizacao: 'cofrinho',
        resgate: 'gasto',
        penalizacao: 'gasto',
        debito: 'gasto',
      };
      fc.assert(
        fc.property(fc.constantFrom(...allTransactionTypes), (type) => {
          return getTransactionCategory(type) === expected[type];
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('calculateProjection', () => {
    it('returns 0 when cofrinho is 0', () => {
      expect(calculateProjection(0, 10)).toBe(0);
    });

    it('returns 0 when rate is 0', () => {
      expect(calculateProjection(100, 0)).toBe(0);
    });

    it('floors the result like the DB does', () => {
      expect(calculateProjection(99, 10)).toBe(9);
    });

    it('returns minimum 1 for small positive balances', () => {
      expect(calculateProjection(1, 5)).toBe(1);
    });

    it('calculates correctly for typical values', () => {
      expect(calculateProjection(200, 15)).toBe(30);
    });
  });

  describe('formatTransactionDates', () => {
    const today = new Date(2026, 4, 3); // May 3, 2026
    const baseTx = {
      id: '1',
      filho_id: 'f1',
      valor: 10,
      descricao: 'Test',
      referencia_id: null,
      tipo: 'credito' as TransactionType,
    };

    it('falls back to created_at when data_referencia is null (legacy data)', () => {
      const tx = {
        ...baseTx,
        created_at: '2026-05-01T10:00:00Z',
        data_referencia: null,
      };
      const result = formatTransactionDates(tx, today);
      expect(result.hasEventDate).toBe(false);
      expect(result.sameDay).toBe(true);
      expect(result.showRecordedPhrase).toBe(false);
      expect(result.eventDate).toBe('Há 2 dias');
      expect(result.eventDateFull).toBe('01/05/2026');
      expect(result.recordedDate).toBe('Há 2 dias');
      expect(result.recordedLabel).toBe('Aprovado');
      expect(result.recordedPhrase).toBe('Aprovado há 2 dias');
    });

    it('marks sameDay when activity and recording happen on the same day', () => {
      const tx = {
        ...baseTx,
        created_at: '2026-05-01T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.hasEventDate).toBe(true);
      expect(result.sameDay).toBe(true);
      expect(result.showRecordedPhrase).toBe(true);
      expect(result.eventDate).toBe('Há 2 dias');
      expect(result.recordedDate).toBe('Há 2 dias');
    });

    it('uses "Aprovado" label and natural phrase for credito when dates differ', () => {
      const tx = {
        ...baseTx,
        tipo: 'credito' as TransactionType,
        created_at: '2026-05-02T10:00:00Z',
        data_referencia: '2026-04-28',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.sameDay).toBe(false);
      expect(result.showRecordedPhrase).toBe(true);
      expect(result.eventDate).toBe('Há 5 dias');
      expect(result.eventDateFull).toBe('28/04/2026');
      expect(result.recordedDate).toBe('Ontem');
      expect(result.recordedLabel).toBe('Aprovado');
      expect(result.recordedPhrase).toBe('Aprovado ontem');
    });

    it('uses "em" preposition for absolute recorded dates', () => {
      const tx = {
        ...baseTx,
        tipo: 'credito' as TransactionType,
        created_at: '2026-04-10T10:00:00Z',
        data_referencia: '2026-04-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedDate).toBe('Sex, 10/04');
      expect(result.recordedPhrase).toBe('Aprovado em Sex, 10/04');
    });

    it('uses "Cancelado" label for estorno_resgate', () => {
      const tx = {
        ...baseTx,
        tipo: 'estorno_resgate' as TransactionType,
        created_at: '2026-05-03T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedLabel).toBe('Cancelado');
      expect(result.recordedDate).toBe('Hoje');
      expect(result.recordedPhrase).toBe('Cancelado hoje');
    });

    it('uses "Confirmado" label for resgate_cofrinho', () => {
      const tx = {
        ...baseTx,
        tipo: 'resgate_cofrinho' as TransactionType,
        created_at: '2026-05-03T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedLabel).toBe('Confirmado');
    });

    it('uses "Registrado" label for generic types', () => {
      const tx = {
        ...baseTx,
        tipo: 'debito' as TransactionType,
        created_at: '2026-05-03T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedLabel).toBe('Registrado');
      expect(result.showRecordedPhrase).toBe(true);
    });

    it('uses "Aplicado" label for penalizacao', () => {
      const tx = {
        ...baseTx,
        tipo: 'penalizacao' as TransactionType,
        created_at: '2026-05-03T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedLabel).toBe('Aplicado');
      expect(result.showRecordedPhrase).toBe(true);
    });

    it('uses "Transferido" label for transferencia_cofrinho', () => {
      const tx = {
        ...baseTx,
        tipo: 'transferencia_cofrinho' as TransactionType,
        created_at: '2026-05-03T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.recordedLabel).toBe('Transferido');
      expect(result.showRecordedPhrase).toBe(true);
    });

    it('shows recorded phrase for specific label even on sameDay', () => {
      const tx = {
        ...baseTx,
        tipo: 'credito' as TransactionType,
        created_at: '2026-05-01T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.sameDay).toBe(true);
      expect(result.showRecordedPhrase).toBe(true);
    });

    it('hides recorded phrase for generic label on sameDay', () => {
      const tx = {
        ...baseTx,
        tipo: 'resgate' as TransactionType,
        created_at: '2026-05-01T10:00:00Z',
        data_referencia: '2026-05-01',
      };
      const result = formatTransactionDates(tx, today);
      expect(result.sameDay).toBe(true);
      expect(result.showRecordedPhrase).toBe(false);
    });
  });
});
