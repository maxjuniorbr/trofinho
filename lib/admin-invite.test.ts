import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateInvite,
  validateInvite,
  acceptInvite,
  cancelInvite,
  removeCoAdmin,
  listFamilyAdmins,
  getPendingInvite,
} from './admin-invite';

const rpcMock = vi.hoisted(() => vi.fn());
const fromSelectMock = vi.hoisted(() => vi.fn());
const resolveStorageUrlsMock = vi.hoisted(() => vi.fn());
const localizeRpcErrorMock = vi.hoisted(() => vi.fn((msg: string) => `localized: ${msg}`));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: fromSelectMock,
          })),
        })),
      })),
    })),
  },
}));

vi.mock('./api-error', () => ({
  localizeRpcError: localizeRpcErrorMock,
}));

vi.mock('./storage', () => ({
  resolveStorageUrls: resolveStorageUrlsMock,
}));

describe('admin-invite data access', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromSelectMock.mockReset();
    resolveStorageUrlsMock.mockReset();
    localizeRpcErrorMock.mockReset().mockImplementation((msg: string) => `localized: ${msg}`);
  });

  describe('generateInvite', () => {
    it('returns invite data on success', async () => {
      const mockData = { codigo: 'ABC123', expires_at: '2026-05-01T00:00:00Z' };
      rpcMock.mockResolvedValue({ data: mockData, error: null });

      const result = await generateInvite();

      expect(result).toEqual({ data: mockData, error: null });
      expect(rpcMock).toHaveBeenCalledWith('gerar_convite_admin');
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'rpc error' } });

      const result = await generateInvite();

      expect(result).toEqual({ data: null, error: 'localized: rpc error' });
    });
  });

  describe('validateInvite', () => {
    it('returns preview data on success', async () => {
      const mockData = { familia_nome: 'Família Silva', admin_nome: 'João' };
      rpcMock.mockResolvedValue({ data: mockData, error: null });

      const result = await validateInvite('ABC123');

      expect(result).toEqual({ data: mockData, error: null });
      expect(rpcMock).toHaveBeenCalledWith('validar_convite_admin', { p_codigo: 'ABC123' });
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'invalid code' } });

      const result = await validateInvite('XXXXXX');

      expect(result).toEqual({ data: null, error: 'localized: invalid code' });
    });
  });

  describe('acceptInvite', () => {
    it('returns familia_id on success', async () => {
      rpcMock.mockResolvedValue({ data: 'family-uuid-123', error: null });

      const result = await acceptInvite('ABC123', 'Maria');

      expect(result).toEqual({ data: { familia_id: 'family-uuid-123' }, error: null });
      expect(rpcMock).toHaveBeenCalledWith('aceitar_convite_admin', {
        p_codigo: 'ABC123',
        p_nome: 'Maria',
      });
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'already in family' } });

      const result = await acceptInvite('ABC123', 'Maria');

      expect(result).toEqual({ data: null, error: 'localized: already in family' });
    });
  });

  describe('cancelInvite', () => {
    it('returns no error on success', async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });

      const result = await cancelInvite('invite-id-1');

      expect(result).toEqual({ error: null });
      expect(rpcMock).toHaveBeenCalledWith('cancelar_convite_admin', {
        p_convite_id: 'invite-id-1',
      });
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const result = await cancelInvite('invite-id-1');

      expect(result).toEqual({ error: 'localized: not found' });
    });
  });

  describe('removeCoAdmin', () => {
    it('returns no error on success', async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });

      const result = await removeCoAdmin('user-id-1');

      expect(result).toEqual({ error: null });
      expect(rpcMock).toHaveBeenCalledWith('remover_co_admin', {
        p_usuario_id: 'user-id-1',
      });
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'cannot remove' } });

      const result = await removeCoAdmin('user-id-1');

      expect(result).toEqual({ error: 'localized: cannot remove' });
    });
  });

  describe('listFamilyAdmins', () => {
    it('returns admins with resolved avatar URLs on success', async () => {
      const admins = [
        { id: '1', nome: 'Admin A', email: 'a@test.com', avatarUrl: 'path/a.jpg' },
        { id: '2', nome: 'Admin B', email: null, avatarUrl: 'path/b.jpg' },
      ];
      rpcMock.mockResolvedValue({ data: admins, error: null });
      resolveStorageUrlsMock.mockResolvedValue([
        'https://signed-url/a.jpg',
        'https://signed-url/b.jpg',
      ]);

      const result = await listFamilyAdmins();

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        { id: '1', nome: 'Admin A', email: 'a@test.com', avatarUrl: 'https://signed-url/a.jpg' },
        { id: '2', nome: 'Admin B', email: null, avatarUrl: 'https://signed-url/b.jpg' },
      ]);
      expect(resolveStorageUrlsMock).toHaveBeenCalledWith('avatars', ['path/a.jpg', 'path/b.jpg']);
    });

    it('returns empty array when no admins found', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });

      const result = await listFamilyAdmins();

      expect(result).toEqual({ data: [], error: null });
      expect(resolveStorageUrlsMock).not.toHaveBeenCalled();
    });

    it('returns empty array with null data', async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });

      const result = await listFamilyAdmins();

      expect(result).toEqual({ data: [], error: null });
      expect(resolveStorageUrlsMock).not.toHaveBeenCalled();
    });

    it('returns localized error on failure', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'db error' } });

      const result = await listFamilyAdmins();

      expect(result).toEqual({ data: [], error: 'localized: db error' });
    });
  });

  describe('getPendingInvite', () => {
    it('returns invite data on success', async () => {
      const invite = {
        id: 'inv-1',
        familia_id: 'fam-1',
        convidado_por: 'user-1',
        codigo: 'ABC123',
        status: 'pendente',
        aceito_por: null,
        created_at: '2026-04-01T00:00:00Z',
        expires_at: '2026-04-03T00:00:00Z',
      };
      fromSelectMock.mockResolvedValue({ data: invite, error: null });

      const result = await getPendingInvite('fam-1');

      expect(result).toEqual({ data: invite, error: null });
    });

    it('returns null data when no pending invite exists', async () => {
      fromSelectMock.mockResolvedValue({ data: null, error: null });

      const result = await getPendingInvite('fam-1');

      expect(result).toEqual({ data: null, error: null });
    });

    it('returns localized error on failure', async () => {
      fromSelectMock.mockResolvedValue({ data: null, error: { message: 'query error' } });

      const result = await getPendingInvite('fam-1');

      expect(result).toEqual({ data: null, error: 'localized: query error' });
    });
  });
});
