import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

import {
  cancelRedemption,
  confirmRedemption,
  countPendingRedemptions,
  createPrize,
  deactivatePrize,
  getPrize,
  listActivePrizes,
  listChildRedemptions,
  listPrizes,
  listRedemptions,
  reactivatePrize,
  requestRedemption,
  updatePrize,
} from './prizes';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@/constants/status';

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message: string } | null;
};

function createSingleQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function createOrderQuery(result: QueryResult, callsBeforeResolve = 0) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    order: vi.fn(),
    select: vi.fn().mockReturnThis(),
  };

  for (let index = 0; index < callsBeforeResolve; index += 1) {
    query.order.mockImplementationOnce(() => query);
  }

  query.order.mockReturnValueOnce(query);

  return query;
}

function createEqQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
}

describe('prizes', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.auth.getUser.mockReset();
  });

  it('returns redemption presentation helpers', () => {
    expect(getRedemptionStatusLabel('pendente')).toBe('Pendente');

    const mockColors = {
      semantic: { warning: '#F59F0A', success: '#20C55D', error: '#DC2828' },
    } as Parameters<typeof getRedemptionStatusColor>[1];

    expect(getRedemptionStatusColor('cancelado', mockColors)).toBe('#DC2828');
  });

  it('lists and fetches prizes', async () => {
    const listQuery = createOrderQuery({ data: [{ id: 'prize-1' }], error: null }, 1);
    const getQuery = createSingleQuery({ data: { id: 'prize-1' }, error: null });

    supabaseMock.from
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(getQuery);

    await expect(listPrizes()).resolves.toEqual({ data: [{ id: 'prize-1' }], error: null });
    await expect(getPrize('prize-1')).resolves.toEqual({ data: { id: 'prize-1' }, error: null });
  });

  it('creates a prize for the authenticated family', async () => {
    const profileQuery = createSingleQuery({ data: { familia_id: 'family-1' }, error: null });
    const insertQuery = createSingleQuery({ data: { id: 'prize-1' }, error: null });

    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    supabaseMock.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(insertQuery);

    const result = await createPrize({ nome: 'Sorvete', descricao: null, custo_pontos: 50 });

    expect(insertQuery.insert).toHaveBeenCalledWith({
      familia_id: 'family-1',
      nome: 'Sorvete',
      descricao: null,
      custo_pontos: 50,
    });
    expect(result).toEqual({ data: { id: 'prize-1' }, error: null });
  });

  it('returns translated failures while creating a prize', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(createPrize({ nome: 'A', descricao: null, custo_pontos: 1 })).resolves.toEqual({
      data: null,
      error: 'Usuário não autenticado',
    });

    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const profileQuery = createSingleQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(profileQuery);

    await expect(createPrize({ nome: 'A', descricao: null, custo_pontos: 1 })).resolves.toEqual({
      data: null,
      error: 'Perfil não encontrado',
    });
  });

  it('updates, deactivates and reactivates prizes', async () => {
    const updateQuery = createEqQuery({ error: null });
    const deactivateQuery = createEqQuery({ error: { message: 'cannot deactivate' } });
    const reactivateQuery = createEqQuery({ error: null });

    supabaseMock.from
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(deactivateQuery)
      .mockReturnValueOnce(reactivateQuery);

    await expect(updatePrize('prize-1', { nome: 'Novo', descricao: 'D', custo_pontos: 10 })).resolves.toEqual({ error: null });
    await expect(deactivatePrize('prize-1')).resolves.toEqual({ error: 'cannot deactivate' });
    await expect(reactivatePrize('prize-1')).resolves.toEqual({ error: null });
  });

  it('lists redemption data and counts pending requests', async () => {
    const listQuery = createOrderQuery({ data: [{ id: 'red-1' }], error: null });
    const activeQuery = createOrderQuery({ data: [{ id: 'active-1' }], error: null });
    const childQuery = createOrderQuery({ data: [{ id: 'child-red-1' }], error: null });
    const countQuery = {
      eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
      select: vi.fn().mockReturnThis(),
    };

    supabaseMock.from
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(activeQuery)
      .mockReturnValueOnce(childQuery)
      .mockReturnValueOnce(countQuery);

    await expect(listRedemptions()).resolves.toEqual({ data: [{ id: 'red-1' }], error: null });
    await expect(listActivePrizes()).resolves.toEqual({ data: [{ id: 'active-1' }], error: null });
    await expect(listChildRedemptions()).resolves.toEqual({ data: [{ id: 'child-red-1' }], error: null });
    await expect(countPendingRedemptions()).resolves.toEqual({ data: 4, error: null });
  });

  it('delegates redemption actions to RPC calls', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'cancel failed' } })
      .mockResolvedValueOnce({ data: 'redemption-1', error: null })
      .mockResolvedValueOnce({ error: { message: 'confirm failed' } });

    await expect(confirmRedemption('red-1')).resolves.toEqual({ error: null });
    await expect(cancelRedemption('red-1')).resolves.toEqual({ error: 'cancel failed' });
    await expect(requestRedemption('prize-1')).resolves.toEqual({ data: 'redemption-1', error: null });
    await expect(confirmRedemption('red-2')).resolves.toEqual({ error: 'confirm failed' });
  });

  it('returns empty lists and success defaults for remaining prize branches', async () => {
    const listQuery = createOrderQuery({ data: null, error: null });
    const reactivateQuery = createEqQuery({ error: null });

    supabaseMock.from
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(reactivateQuery);

    await expect(listRedemptions()).resolves.toEqual({ data: [], error: null });
    await expect(reactivatePrize('prize-2')).resolves.toEqual({ error: null });
  });
});
