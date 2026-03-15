import { File } from 'expo-file-system';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

export type UserProfile = {
  id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
  nome: string;
  avatarUrl?: string | null;
};

export type AuthError = {
  message: string;
};

export async function signIn(
  email: string,
  password: string
): Promise<{ profile: UserProfile | null; error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { profile: null, error: { message: translateAuthError(error.message) } };
  }

  const profile = await getProfile();
  return { profile, error: null };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: { message: translateAuthError(error.message) } };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const user = authData.user;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, familia_id, papel, nome')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...(data as UserProfile),
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}

export async function createFamily(
  familyName: string,
  userName: string
): Promise<{ familiaId: string | null; error: AuthError | null }> {
  const { data, error } = await supabase.rpc('criar_familia', {
    nome_familia: familyName,
    nome_usuario: userName,
  });

  if (error) {
    return { familiaId: null, error: { message: translateRpcError(error.message) } };
  }

  return { familiaId: data as string, error: null };
}

export async function updateUserName(
  name: string
): Promise<{ error: AuthError | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: { message: 'Sessão expirada. Faça login novamente.' } };
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ nome: name })
    .eq('id', authData.user.id);

  if (error) return { error: { message: error.message } };

  return { error: null };
}

export async function updateUserPassword(
  newPassword: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: { message: translateAuthError(error.message) } };
  }

  return { error: null };
}

export async function updateUserAvatar(
  imageUri: string
): Promise<{ url: string | null; error: AuthError | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { url: null, error: { message: 'Sessão expirada. Faça login novamente.' } };
    }

    const userId = authData.user.id;
    const extension = inferAvatarExtension(imageUri);
    const buffer = await readAsArrayBuffer(imageUri);
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, buffer, {
        contentType: inferAvatarContentType(extension),
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: { message: uploadError.message } };
    }

    const { data: publicData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    // Persist the avatar URL in user metadata so it survives across sessions.
    const { error: metaError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });

    if (metaError) {
      return { url: publicUrl, error: { message: metaError.message } };
    }

    return { url: publicUrl, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao fazer upload do avatar';
    return { url: null, error: { message: msg } };
  }
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  return msg;
}

function translateRpcError(msg: string): string {
  if (msg.includes('já pertence a uma família')) return 'Você já tem uma família cadastrada.';
  if (msg.includes('não autenticado')) return 'Sessão expirada. Faça login novamente.';
  return msg;
}

async function readAsArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  const normalizedUri = imageUri.split('?')[0];

  if (
    !normalizedUri.startsWith('http://') &&
    !normalizedUri.startsWith('https://')
  ) {
    try {
      return await new File(normalizedUri).arrayBuffer();
    } catch {
      // Fallback para fetch
    }
  }

  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  return response.arrayBuffer();
}

function inferAvatarExtension(imageUri: string): string {
  const extension = imageUri.split('?')[0]?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
      return extension;
    default:
      return 'jpg';
  }
}

function inferAvatarContentType(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}
