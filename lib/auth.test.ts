import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getPublicUrl: vi.fn(),
  upload: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    updateUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}));

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

import {
  createFamily,
  getCurrentAuthUser,
  getProfile,
  signIn,
  signOut,
  signUp,
  updateUserAvatar,
  updateUserName,
  updateUserPassword,
} from './auth';

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

function createMaybeSingleQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };
}

function createUpdateQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  };
}

const mockPassword = ['secret', '123'].join('-');
const invalidPassword = ['wrong', 'pass'].join('-');

describe('auth', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock as typeof fetch;

    fileArrayBufferMock.mockReset();
    fileConstructorMock.mockClear();
    storageBucketMock.upload.mockReset();
    storageBucketMock.getPublicUrl.mockReset();

    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.signInWithPassword.mockReset();
    supabaseMock.auth.signOut.mockReset();
    supabaseMock.auth.signUp.mockReset();
    supabaseMock.auth.updateUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();

    supabaseMock.storage.from.mockReturnValue(storageBucketMock);
  });

  describe('getCurrentAuthUser', () => {
    it('returns email and avatarUrl when authenticated', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', email: 'max@test.com', user_metadata: { avatar_url: 'https://avatar' } } },
        error: null,
      });

      const result = await getCurrentAuthUser();
      expect(result).toEqual({ email: 'max@test.com', avatarUrl: 'https://avatar' });
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
      expect(result).toEqual({ email: '', avatarUrl: null });
    });
  });

  it('signs in and returns the profile with avatar metadata', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null });
    supabaseMock.rpc.mockResolvedValue({
      data: { id: 'user-1', familia_id: 'family-1', papel: 'admin', nome: 'Max', avatarUrl: 'https://avatar' },
      error: null,
    });

    const result = await signIn('max@example.com', mockPassword);

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'max@example.com',
      password: mockPassword,
    });
    expect(result).toEqual({
      profile: {
        id: 'user-1',
        familia_id: 'family-1',
        papel: 'admin',
        nome: 'Max',
        avatarUrl: 'https://avatar',
      },
      error: null,
    });
  });

  it('localizes authentication errors during sign in and sign up', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    supabaseMock.auth.signUp.mockResolvedValue({
      error: { message: 'User already registered' },
    });

    await expect(signIn('max@example.com', invalidPassword)).resolves.toEqual({
      profile: null,
      error: { message: 'E-mail ou senha incorretos.' },
    });

    await expect(signUp('max@example.com', mockPassword)).resolves.toEqual({
      error: { message: 'Este e-mail já está cadastrado.' },
    });
  });

  it('signs up and signs out successfully', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ error: null });
    supabaseMock.auth.signOut.mockResolvedValue({});

    await expect(signUp('max@example.com', mockPassword)).resolves.toEqual({ error: null });
    await expect(signOut()).resolves.toBeUndefined();

    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('deletes push tokens before signing out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const deleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.from.mockReturnValue(deleteQuery);
    supabaseMock.auth.signOut.mockResolvedValue({});

    await signOut();

    expect(supabaseMock.from).toHaveBeenCalledWith('push_tokens');
    expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
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
      .mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(getProfile()).resolves.toBeNull();
    await expect(getProfile()).resolves.toBeNull();
  });

  it('returns the child avatar from the rpc result', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        id: 'child-1',
        familia_id: 'family-1',
        papel: 'filho',
        nome: 'Lia',
        avatarUrl: 'https://cdn.example.com/child-avatar.jpg',
      },
      error: null,
    });

    await expect(getProfile()).resolves.toEqual({
      id: 'child-1',
      familia_id: 'family-1',
      papel: 'filho',
      nome: 'Lia',
      avatarUrl: 'https://cdn.example.com/child-avatar.jpg',
    });
  });

  it('creates a family and translates rpc failures', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: 'family-1', error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'usuário já pertence a uma família' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'usuário não autenticado' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'unexpected db error' } });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: 'family-1',
      error: null,
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: { message: 'Você já tem uma família cadastrada.' },
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: { message: 'Sessão expirada. Faça login novamente.' },
    });

    await expect(createFamily('Silva', 'Max')).resolves.toEqual({
      familiaId: null,
      error: { message: 'Algo deu errado. Tente novamente.' },
    });
  });

  it('updates the user name and handles expired sessions or update failures', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    const updateErrorQuery = createUpdateQuery({ error: { message: 'cannot update' } });
    const updateSuccessQuery = createUpdateQuery({ error: null });

    supabaseMock.from
      .mockReturnValueOnce(updateErrorQuery)
      .mockReturnValueOnce(updateSuccessQuery);

    await expect(updateUserName('Novo Nome')).resolves.toEqual({
      error: { message: 'Sessão expirada. Faça login novamente.' },
    });

    await expect(updateUserName('Novo Nome')).resolves.toEqual({
      error: { message: 'Algo deu errado. Tente novamente.' },
    });

    await expect(updateUserName('Novo Nome')).resolves.toEqual({ error: null });
    expect(updateSuccessQuery.update).toHaveBeenCalledWith({ nome: 'Novo Nome' });
  });

  it('updates the password and localizes the provider error', async () => {
    supabaseMock.auth.updateUser
      .mockResolvedValueOnce({ error: { message: 'Password should be at least 6 characters' } })
      .mockResolvedValueOnce({ error: null });

    await expect(updateUserPassword('123')).resolves.toEqual({
      error: { message: 'A senha deve ter ao menos 6 caracteres.' },
    });

    await expect(updateUserPassword('123456')).resolves.toEqual({ error: null });
  });

  it('uploads an avatar from the local file system and updates the user metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    storageBucketMock.upload.mockResolvedValue({ error: null });
    storageBucketMock.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-1/avatar.png' },
    });
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null });

    const result = await updateUserAvatar('/test/avatar.png?cache=1');

    expect(fileConstructorMock).toHaveBeenCalledWith('/test/avatar.png');
    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      'user-1/avatar.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png', upsert: true }
    );
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      data: { avatar_url: 'https://cdn.example.com/user-1/avatar.png?t=1234' },
    });
    expect(result).toEqual({
      url: 'https://cdn.example.com/user-1/avatar.png?t=1234',
      error: null,
    });
  });

  it('falls back to fetch for remote avatars and preserves the url when metadata update fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5678);
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
    storageBucketMock.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-2/avatar.webp' },
    });
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'metadata failed' },
    });

    const result = await updateUserAvatar('https://images.example.com/photo.webp');

    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      'user-2/avatar.webp',
      arrayBuffer,
      { contentType: 'image/webp', upsert: true }
    );
    expect(result).toEqual({
      url: 'https://cdn.example.com/user-2/avatar.webp?t=5678',
      error: { message: 'Algo deu errado. Tente novamente.' },
    });
  });

  it('returns descriptive errors when the avatar upload cannot continue', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-3' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-4' } }, error: null });

    await expect(updateUserAvatar('/test/avatar.jpg')).resolves.toEqual({
      url: null,
      error: { message: 'Sessão expirada. Faça login novamente.' },
    });

    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
    storageBucketMock.upload.mockResolvedValue({ error: { message: 'upload failed' } });

    await expect(updateUserAvatar('/test/avatar.jpg')).resolves.toEqual({
      url: null,
      error: { message: 'upload failed' },
    });

    fileArrayBufferMock.mockRejectedValue(new Error('read failed'));
    fetchMock.mockResolvedValue({
      ok: false,
      arrayBuffer: vi.fn(),
    });

    await expect(updateUserAvatar('/test/avatar.unknown')).resolves.toEqual({
      url: null,
      error: { message: 'Não foi possível ler a imagem selecionada' },
    });
  });
});
