import { localizeSupabaseError } from './api-error';
import { readImageAsArrayBuffer, inferImageExtension, inferImageContentType } from './image-utils';
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
    return { profile: null, error: { message: localizeSupabaseError(error.message) } };
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
    return { error: { message: localizeSupabaseError(error.message) } };
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
    return { error: { message: localizeSupabaseError(error.message) } };
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
    const extension = inferImageExtension(imageUri);
    const buffer = await readImageAsArrayBuffer(imageUri);
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, buffer, {
        contentType: inferImageContentType(extension),
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: { message: uploadError.message } };
    }

    const { data: publicData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

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

function translateRpcError(msg: string): string {
  if (msg.includes('já pertence a uma família')) return 'Você já tem uma família cadastrada.';
  if (msg.includes('não autenticado')) return 'Sessão expirada. Faça login novamente.';
  return msg;
}

