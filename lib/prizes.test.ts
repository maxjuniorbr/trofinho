import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  createPrize,
  deactivatePrize,
  getPrize,
  listActivePrizes,
  listPrizes,
  reactivatePrize,
  updatePrize,
} from './prizes';
import {
  cancelRedemption,
  confirmRedemption,
  countPendingRedemptions,
  listChildRedemptions,
  listRedemptions,
  requestRedemption,
} from './redemptions';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';

const uploadImageToPublicBucketMock = vi.hoisted(() => vi.fn());
const dispatchPushNotificationMock = vi.hoisted(() => vi.fn());

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

vi.mock('./storage', () => ({
  uploadImageToPublicBucket: uploadImageToPublicBucketMock,
}));

vi.mock('./push', () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message: string } | null;
};

function createSingleQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function createOrderQuery(result: QueryResult, callsBeforeResolve = 0) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn(),
    range: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue(result),
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
    uploadImageToPublicBucketMock.mockReset();
    dispatchPushNotificationMock.mockReset();
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

    supabaseMock.from.mockReturnValueOnce(listQuery).mockReturnValueOnce(getQuery);

    await expect(listPrizes()).resolves.toEqual({
      data: [{ id: 'prize-1' }],
      hasMore: false,
      error: null,
    });
    await expect(getPrize('prize-1')).resolves.toEqual({ data: { id: 'prize-1' }, error: null });
  });

  it('creates a prize for the authenticated family', async () => {
    const profileQuery = createSingleQuery({ data: { familia_id: 'family-1' }, error: null });
    const insertQuery = createSingleQuery({ data: { id: 'prize-1' }, error: null });

    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    supabaseMock.from.mockReturnValueOnce(profileQuery).mockReturnValueOnce(insertQuery);

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
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ error: { message: 'cannot update' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'cannot deactivate' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      updatePrize('prize-1', {
        nome: 'Novo',
        descricao: 'D',
        custo_pontos: 10,
      }),
    ).resolves.toEqual({ error: null, imageUrl: null, pointsMessage: null });
    await expect(
      updatePrize('prize-1', {
        nome: 'Novo',
        descricao: 'D',
        custo_pontos: 10,
      }),
    ).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
      imageUrl: null,
      pointsMessage: null,
    });
    await expect(deactivatePrize('prize-1')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
      warning: null,
    });
    await expect(reactivatePrize('prize-1')).resolves.toEqual({ error: null });
  });

  it('uploads the prize image before calling the edit rpc', async () => {
    uploadImageToPublicBucketMock.mockResolvedValue({
      error: null,
      path: 'prize-2/capa.jpg',
      publicUrl: 'https://cdn.example.com/prize-2/capa.jpg?t=2',
    });
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      updatePrize('prize-2', {
        nome: 'Cinema',
        descricao: 'Sessão especial',
        custo_pontos: 120,
        ativo: false,
        imageUri: 'file:///data/user/0/com.trofinho/cache/prize.jpg',
      }),
    ).resolves.toEqual({
      error: null,
      imageUrl: 'https://cdn.example.com/prize-2/capa.jpg?t=2',
      pointsMessage: null,
    });

    expect(uploadImageToPublicBucketMock).toHaveBeenCalledWith({
      bucket: 'premios',
      imageUri: 'file:///data/user/0/com.trofinho/cache/prize.jpg',
      imageOptions: { maxDimension: 768, compress: 0.65 },
      pathWithoutExtension: 'prize-2/capa',
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('editar_premio', {
      p_premio_id: 'prize-2',
      p_nome: 'Cinema',
      p_descricao: 'Sessão especial',
      p_custo_pontos: 120,
      p_imagem_url: 'https://cdn.example.com/prize-2/capa.jpg?t=2',
      p_ativo: false,
    });
  });

  it('returns the inline points warning when the rpc preserves other prize fields', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: 'Não é possível alterar os pontos pois há resgates em aberto.',
      error: null,
    });

    await expect(
      updatePrize('prize-3', {
        nome: 'Livro',
        descricao: 'Edição nova',
        custo_pontos: 80,
        ativo: true,
        imagem_url: 'https://cdn.example.com/prize-3/capa.jpg',
      }),
    ).resolves.toEqual({
      error: null,
      imageUrl: 'https://cdn.example.com/prize-3/capa.jpg',
      pointsMessage: 'Não é possível alterar os pontos pois há resgates em aberto.',
    });
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

    await expect(listRedemptions()).resolves.toEqual({
      data: [{ id: 'red-1' }],
      hasMore: false,
      error: null,
    });
    await expect(listActivePrizes()).resolves.toEqual({ data: [{ id: 'active-1' }], error: null });
    await expect(listChildRedemptions()).resolves.toEqual({
      data: [{ id: 'child-red-1' }],
      hasMore: false,
      error: null,
    });
    await expect(countPendingRedemptions()).resolves.toEqual({ data: 4, error: null });
  });

  it('delegates redemption actions to RPC calls', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'cancel failed' } })
      .mockResolvedValueOnce({ data: 'redemption-1', error: null })
      .mockResolvedValueOnce({ error: { message: 'confirm failed' } });

    await expect(
      confirmRedemption('red-1', { familiaId: 'f1', userId: 'u1', prizeName: 'P' }),
    ).resolves.toEqual({ error: null });
    await expect(cancelRedemption('red-1')).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(
      requestRedemption('prize-1', { familiaId: 'f1', childName: 'C', prizeName: 'P' }),
    ).resolves.toEqual({ data: 'redemption-1', error: null });
    await expect(
      confirmRedemption('red-2', { familiaId: 'f1', userId: 'u1', prizeName: 'P' }),
    ).resolves.toEqual({ error: 'Algo deu errado. Tente novamente.' });
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty lists and success defaults for remaining prize branches', async () => {
    const listQuery = createOrderQuery({ data: null, error: null });

    supabaseMock.from.mockReturnValueOnce(listQuery);
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(listRedemptions()).resolves.toEqual({ data: [], hasMore: false, error: null });
    await expect(reactivatePrize('prize-2')).resolves.toEqual({ error: null });
  });

  it('returns errors from prize read and list operations', async () => {
    const listErrorQuery = createOrderQuery({ data: null, error: { message: 'list error' } }, 1);
    const getErrorQuery = createSingleQuery({ data: null, error: { message: 'not found' } });
    const redemptionErrorQuery = createOrderQuery({
      data: null,
      error: { message: 'redemption error' },
    });
    const activeErrorQuery = createOrderQuery({ data: null, error: { message: 'active error' } });
    const childRedErrorQuery = createOrderQuery({ data: null, error: { message: 'child error' } });

    supabaseMock.from
      .mockReturnValueOnce(listErrorQuery)
      .mockReturnValueOnce(getErrorQuery)
      .mockReturnValueOnce(redemptionErrorQuery)
      .mockReturnValueOnce(activeErrorQuery)
      .mockReturnValueOnce(childRedErrorQuery);

    await expect(listPrizes()).resolves.toEqual({
      data: [],
      hasMore: false,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(getPrize('prize-x')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(listRedemptions()).resolves.toEqual({
      data: [],
      hasMore: false,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(listActivePrizes()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(listChildRedemptions()).resolves.toEqual({
      data: [],
      hasMore: false,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('returns errors from write operations and handles edge cases', async () => {
    const countErrorQuery = createEqQuery({ count: null, error: { message: 'count error' } });
    const countNullQuery = createEqQuery({ count: null, error: null });
    const profileQuery = createSingleQuery({ data: { familia_id: 'fam-1' }, error: null });
    const insertErrorQuery = createSingleQuery({
      data: null,
      error: { message: 'constraint violation' },
    });

    supabaseMock.from
      .mockReturnValueOnce(countErrorQuery)
      .mockReturnValueOnce(countNullQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(insertErrorQuery);

    supabaseMock.rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'request failed' } })
      .mockResolvedValueOnce({ error: null });

    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    await expect(countPendingRedemptions()).resolves.toEqual({
      data: 0,
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(countPendingRedemptions()).resolves.toEqual({ data: 0, error: null });
    await expect(deactivatePrize('prize-1')).resolves.toEqual({
      data: { pendingCount: 0 },
      error: null,
      warning: null,
    });
    await expect(
      requestRedemption('prize-1', { familiaId: 'f1', childName: 'C', prizeName: 'P' }),
    ).resolves.toEqual({ data: null, error: 'Algo deu errado. Tente novamente.' });
    await expect(cancelRedemption('red-2')).resolves.toEqual({ error: null });
    await expect(createPrize({ nome: 'A', descricao: null, custo_pontos: 1 })).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('returns error from reactivating and handles null data from list queries', async () => {
    const listNullQuery = createOrderQuery({ data: null, error: null }, 1);
    const activeNullQuery = createOrderQuery({ data: null, error: null });
    const childNullQuery = createOrderQuery({ data: null, error: null });

    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'reactivate failed' } });

    supabaseMock.from
      .mockReturnValueOnce(listNullQuery)
      .mockReturnValueOnce(activeNullQuery)
      .mockReturnValueOnce(childNullQuery);

    await expect(reactivatePrize('prize-1')).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });
    await expect(listPrizes()).resolves.toEqual({ data: [], hasMore: false, error: null });
    await expect(listActivePrizes()).resolves.toEqual({ data: [], error: null });
    await expect(listChildRedemptions()).resolves.toEqual({
      data: [],
      hasMore: false,
      error: null,
    });
  });

  it('returns upload errors when the prize image upload fails', async () => {
    uploadImageToPublicBucketMock
      .mockResolvedValueOnce({ error: 'upload failed', publicUrl: null })
      .mockResolvedValueOnce({ error: null, publicUrl: null });

    const input = {
      nome: 'A',
      descricao: null,
      custo_pontos: 10,
      imageUri: 'file:///cache/img.jpg',
    };

    await expect(updatePrize('prize-1', input)).resolves.toEqual({
      error: 'upload failed',
      imageUrl: null,
      pointsMessage: null,
    });
    await expect(updatePrize('prize-1', input)).resolves.toEqual({
      error: 'Não foi possível fazer upload da imagem do prêmio.',
      imageUrl: null,
      pointsMessage: null,
    });
  });

  describe('push notification dispatch', () => {
    it('requestRedemption dispatches resgate_solicitado with correct payload when opts provided', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ data: 'redemption-1', error: null });

      await requestRedemption('prize-1', {
        familiaId: 'family-1',
        childName: 'Lia',
        prizeName: 'Sorvete',
      });

      expect(dispatchPushNotificationMock).toHaveBeenCalledWith('resgate_solicitado', 'family-1', {
        childName: 'Lia',
        prizeName: 'Sorvete',
        redemptionId: 'redemption-1',
      });
    });

    it('confirmRedemption dispatches resgate_confirmado with correct payload when opts provided', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await confirmRedemption('red-1', {
        familiaId: 'family-1',
        userId: 'child-user-1',
        prizeName: 'Cinema',
      });

      expect(dispatchPushNotificationMock).toHaveBeenCalledWith('resgate_confirmado', 'family-1', {
        userId: 'child-user-1',
        prizeName: 'Cinema',
      });
    });

    it('requestRedemption always dispatches because opts is now required', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ data: 'redemption-1', error: null });

      await requestRedemption('prize-1', { familiaId: 'f1', childName: 'C', prizeName: 'P' });

      expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    });

    it('dispatch failure does not affect the RPC return value', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });
      dispatchPushNotificationMock.mockRejectedValueOnce(new Error('push failed'));

      const result = await confirmRedemption('red-1', {
        familiaId: 'family-1',
        userId: 'child-user-1',
        prizeName: 'Livro',
      });

      expect(result).toEqual({ error: null });
    });
  });

  describe('Feature: ux-polish-fase4b, Property 3: Deactivation via RPC with pending count', () => {
    /**
     * **Validates: Requirements 2.1, 2.3, 2.4, 2.5**
     *
     * For any prize ID and non-negative integer N, deactivatePrize invokes
     * supabase.rpc('desativar_premio', ...) and returns the pending count N.
     */
    it('calls desativar_premio RPC and returns the pending count', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.nat(), async (prizeId, pendingCount) => {
          supabaseMock.rpc.mockReset();
          supabaseMock.rpc.mockResolvedValue({ data: pendingCount, error: null });

          const result = await deactivatePrize(prizeId);

          expect(supabaseMock.rpc).toHaveBeenCalledWith('desativar_premio', {
            p_premio_id: prizeId,
          });
          expect(result.data).toEqual({ pendingCount });
          expect(result.error).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Feature: ux-polish-fase4b, Property 4: Reactivation via RPC', () => {
    /**
     * **Validates: Requirements 2.2, 2.5**
     *
     * For any prize ID, reactivatePrize invokes
     * supabase.rpc('reativar_premio', ...) and returns success.
     */
    it('calls reativar_premio RPC and returns success', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (prizeId) => {
          supabaseMock.rpc.mockReset();
          supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

          const result = await reactivatePrize(prizeId);

          expect(supabaseMock.rpc).toHaveBeenCalledWith('reativar_premio', {
            p_premio_id: prizeId,
          });
          expect(result.error).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Feature: ux-polish-fase4b, Property 5: Warning message for pending redemptions', () => {
    /**
     * **Validates: Requirements 2.6**
     *
     * For any positive integer N returned as pending count,
     * deactivatePrize includes a non-null warning containing N.
     */
    it('includes a warning containing the pending count when count > 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (prizeId, pendingCount) => {
            supabaseMock.rpc.mockReset();
            supabaseMock.rpc.mockResolvedValue({ data: pendingCount, error: null });

            const result = await deactivatePrize(prizeId);

            expect(result.warning).not.toBeNull();
            expect(result.warning).toContain(String(pendingCount));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
