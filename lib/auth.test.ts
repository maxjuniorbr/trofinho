import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFamily,
  deleteAccount,
  getCurrentAuthUser,
  getProfile,
  refreshAuthSession,
  signOut,
  updateUserAvatar,
  updateUserName,
} from './auth';

const resizeImageMock = vi.hoisted(() => vi.fn((uri: string) => Promise.resolve(uri)));

const fileArrayBufferMock = vi.hoisted(() => vi.fn());
const fileConstructorMock = vi.hoisted(() => vi.fn());

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('./image-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('./image-utils')>();
  return { ...original, resizeImage: resizeImageMock };
});

const storageBucketMock = vi.hoisted(() => ({
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed-url' },
    error: null,
  }),
  remove: vi.fn().mockResolvedValue({ error: null }),
  upload: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => {
  const createRpcResult = (result: unknown) => {
    const promise = Promise.resolve(result);
    return Object.assign(promise, {
      returns: vi.fn().mockReturnValue(promise),
    });
  };

  const rpcFn: ReturnType<typeof vi.fn> & { _createResult: typeof createRpcResult } = Object.assign(
    vi.fn(),
    { _createResult: createRpcResult },
  );

  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      refreshSession: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      setSession: vi.fn(),
    },
    from: vi.fn(),
    rpc: rpcFn,
    storage: {
      from: vi.fn(),
    },
  };
});

vi.mock('expo-file-system', () => ({
  File: class MockFile {
    constructor(path: string) {
      fileConstructorMock(path);
    }

    arrayBuffer() {
      return fileArrayBufferMock();
    }
  },
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

const deviceStorageMock = vi.hoisted(() => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./device-storage', () => ({
  deviceStorage: deviceStorageMock,
}));

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

function createUpdateQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  };
}

describe('auth', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock;

    fileArrayBufferMock.mockReset();
    fileConstructorMock.mockClear();
    storageBucketMock.upload.mockReset();
    storageBucketMock.remove.mockReset().mockResolvedValue({ error: null });

    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.signInWithPassword.mockReset();
    supabaseMock.auth.signOut.mockReset();
    supabaseMock.auth.signUp.mockReset();
    supabaseMock.auth.refreshSession.mockReset();
    supabaseMock.auth.updateUser.mockReset();
    supabaseMock.auth.resetPasswordForEmail.mockReset();
    supabaseMock.auth.resend.mockReset();
    supabaseMock.auth.verifyOtp.mockReset();
    supabaseMock.auth.setSession.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();

    supabaseMock.storage.from.mockReturnValue(storageBucketMock);
  });

  describe('getCurrentAuthUser', () => {
    it('returns email and avatarUrl when authenticated', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'max@test.com',
            email_confirmed_at: '2024-01-15T10:30:00Z',
            user_metadata: { avatar_url: 'https://avatar' },
          },
        },
        error: null,
      });

      const result = await getCurrentAuthUser();
      expect(result).toEqual({
        email: 'max@test.com',
        avatarUrl: 'https://signed-url',
        emailConfirmedAt: '2024-01-15T10:30:00Z',
        dateOfBirth: null,
        fullName: null,
      });
    });

    it('returns null when there is an auth error', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'not authenticated' },
      });

      expect(await getCurrentAuthUser()).toBeNull();
    });

    it('returns null when user is null', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      expect(await getCurrentAuthUser()).toBeNull();
    });

    it('defaults email to empty string and avatarUrl to null', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', user_metadata: {} } },
        error: null,
      });

      const result = await getCurrentAuthUser();
      expect(result).toEqual({ email: '', avatarUrl: null, emailConfirmedAt: null, dateOfBirth: null, fullName: null });
    });

    it('returns emailConfirmedAt when email_confirmed_at is present on the user object', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'admin@test.com',
            email_confirmed_at: '2024-06-01T12:00:00Z',
            user_metadata: {},
          },
        },
        error: null,
      });

      const result = await getCurrentAuthUser();
      expect(result).not.toBeNull();
      expect(result!.emailConfirmedAt).toBe('2024-06-01T12:00:00Z');
    });

    it('defaults emailConfirmedAt to null when email_confirmed_at is missing', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'admin@test.com',
            user_metadata: {},
          },
        },
        error: null,
      });

      const result = await getCurrentAuthUser();
      expect(result).not.toBeNull();
      expect(result!.emailConfirmedAt).toBeNull();
    });
  });

  it('deletes push tokens for current device before signing out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    deviceStorageMock.getItem.mockResolvedValue('device-abc');
    const deleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    supabaseMock.from.mockReturnValue(deleteQuery);
    supabaseMock.auth.signOut.mockResolvedValue({});

    await signOut();

    expect(supabaseMock.from).toHaveBeenCalledWith('push_tokens');
    expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(deleteQuery.eq).toHaveBeenCalledWith('device_id', 'device-abc');
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signs out even when push token cleanup fails', async () => {
    supabaseMock.auth.getUser.mockRejectedValue(new Error('auth error'));
    supabaseMock.auth.signOut.mockResolvedValue({});

    await signOut();

    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns null profile when the rpc fails or returns no data', async () => {
    supabaseMock.rpc
      .mockReturnValueOnce(
        supabaseMock.rpc._createResult({ data: null, error: { message: 'rpc error' } }),
      )
      .mockReturnValueOnce(supabaseMock.rpc._createResult({ data: null, error: null }));

    await expect(getProfile()).resolves.toBeNull();
    await expect(getProfile()).resolves.toBeNull();
  });

  it('returns the child avatar from the rpc result', async () => {
    supabaseMock.rpc.mockReturnValue(
      supabaseMock.rpc._createResult({
        data: {
          id: 'child-1',
          familia_id: 'family-1',
          papel: 'filho',
          nome: 'Lia',
          avatarUrl: 'https://cdn.example.com/child-avatar.jpg',
        },
        error: null,
      }),
    );

    await expect(getProfile()).resolves.toEqual({
      id: 'child-1',
      familia_id: 'family-1',
      papel: 'filho',
      nome: 'Lia',
      avatarUrl: 'https://signed-url',
    });
  });

  it('creates a family and translates rpc failures', async () => {
    supabaseMock.rpc
      .mockReturnValueOnce(supabaseMock.rpc._createResult({ data: 'family-1', error: null }))
      .mockReturnValueOnce(
        supabaseMock.rpc._createResult({
          data: null,
          error: { message: 'usuário já pertence a uma família' },
        }),
      )
      .mockReturnValueOnce(
        supabaseMock.rpc._createResult({
          data: null,
          error: { message: 'usuário não autenticado' },
        }),
      )
      .mockReturnValueOnce(
        supabaseMock.rpc._createResult({ data: null, error: { message: 'unexpected db error' } }),
      );

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: 'family-1',
      error: null,
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: 'Você já tem uma família cadastrada.',
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: 'Sessão expirada. Faça login novamente.',
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('refreshes the current auth session and reports failures', async () => {
    supabaseMock.auth.refreshSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: { message: 'refresh failed' } });

    await expect(refreshAuthSession()).resolves.toEqual({ error: null });
    await expect(refreshAuthSession()).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('updates the user name and handles expired sessions or update failures', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    const updateErrorQuery = createUpdateQuery({ error: { message: 'cannot update' } });
    const updateSuccessQuery = createUpdateQuery({ error: null });

    supabaseMock.from.mockReturnValueOnce(updateErrorQuery).mockReturnValueOnce(updateSuccessQuery);

    await expect(updateUserName('Novo Nome')).resolves.toEqual({
      error: 'Sessão expirada. Faça login novamente.',
    });

    await expect(updateUserName('Novo Nome')).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(updateUserName('Novo Nome')).resolves.toEqual({ error: null });
    expect(updateSuccessQuery.update).toHaveBeenCalledWith({ nome: 'Novo Nome' });
  });

  it('uploads an avatar from the local file system and updates the user metadata', async () => {
    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    storageBucketMock.upload.mockResolvedValue({ error: null });
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null });

    const result = await updateUserAvatar('/test/avatar.png?cache=1');

    expect(fileConstructorMock).toHaveBeenCalledWith('/test/avatar.png');
    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      'user-1/avatar.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png', upsert: true },
    );
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      data: { avatar_url: 'user-1/avatar.png' },
    });
    expect(result).toEqual({
      url: 'https://signed-url',
      error: null,
    });
  });

  it('falls back to fetch for remote avatars and cleans up uploaded file when metadata update fails', async () => {
    const arrayBuffer = new ArrayBuffer(8);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
    });
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-2' } },
      error: null,
    });
    storageBucketMock.upload.mockResolvedValue({ error: null });
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'metadata failed' },
    });

    const result = await updateUserAvatar('https://images.example.com/photo.webp');

    expect(storageBucketMock.upload).toHaveBeenCalledWith('user-2/avatar.webp', arrayBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });
    expect(storageBucketMock.remove).toHaveBeenCalledWith(['user-2/avatar.webp']);
    expect(result).toEqual({
      url: null,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('returns descriptive errors when the avatar upload cannot continue', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-3' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-4' } }, error: null });

    await expect(updateUserAvatar('/test/avatar.jpg')).resolves.toEqual({
      url: null,
      error: 'Sessão expirada. Faça login novamente.',
    });

    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
    storageBucketMock.upload.mockResolvedValue({ error: { message: 'upload failed' } });

    await expect(updateUserAvatar('/test/avatar.jpg')).resolves.toEqual({
      url: null,
      error: 'upload failed',
    });

    fileArrayBufferMock.mockRejectedValue(new Error('read failed'));
    fetchMock.mockResolvedValue({
      ok: false,
      arrayBuffer: vi.fn(),
    });

    await expect(updateUserAvatar('/test/avatar.unknown')).resolves.toEqual({
      url: null,
      error: 'Não foi possível ler a imagem selecionada',
    });
  });

  describe('deleteAccount', () => {
    it('calls excluir_minha_conta RPC and signs out on success', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { identities: [{ provider: 'email' }] } },
        error: null,
      });
      supabaseMock.rpc.mockReturnValue(
        supabaseMock.rpc._createResult({ data: null, error: null }),
      );
      supabaseMock.auth.signOut.mockResolvedValue({});

      const result = await deleteAccount();

      expect(supabaseMock.rpc).toHaveBeenCalledWith('excluir_minha_conta');
      expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(result).toEqual({ error: null });
    });

    it('revokes Google access before deleting when user has Google identity', async () => {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { identities: [{ provider: 'google' }] } },
        error: null,
      });
      supabaseMock.rpc.mockReturnValue(
        supabaseMock.rpc._createResult({ data: null, error: null }),
      );
      supabaseMock.auth.signOut.mockResolvedValue({});

      const result = await deleteAccount();

      expect(GoogleSignin.revokeAccess).toHaveBeenCalled();
      expect(supabaseMock.rpc).toHaveBeenCalledWith('excluir_minha_conta');
      expect(result).toEqual({ error: null });
    });

    it('returns localized error when RPC fails and does not sign out', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { identities: [] } },
        error: null,
      });
      supabaseMock.rpc.mockReturnValue(
        supabaseMock.rpc._createResult({
          data: null,
          error: { message: 'unexpected db error' },
        }),
      );

      const result = await deleteAccount();

      expect(result.error).toBe('Algo deu errado. Tente novamente.');
      expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
    });
  });
});
