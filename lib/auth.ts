import { localizeRpcError, localizeSupabaseError } from './api-error';
import { uploadImageToPublicBucket } from './storage';
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

export async function getCurrentAuthUser(): Promise<{
  email: string;
  avatarUrl: string | null;
} | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    email: data.user.email ?? '',
    avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}

export async function signOut(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('push_tokens').delete().eq('user_id', user.id);
    }
  } catch {
    // Best-effort cleanup — do not block sign-out
  }
  await supabase.auth.signOut({ scope: 'local' });
}

export async function getProfile(): Promise<UserProfile | null> {
  // RPC obter_meu_perfil returns a single flat object with camelCase avatarUrl,
  // which differs from the usuarios table row shape — cast bridges the gap
  const { data, error } = await supabase.rpc('obter_meu_perfil');

  if (error || !data) return null;

  const profile = data as unknown as {
    id: string;
    familia_id: string;
    papel: 'admin' | 'filho';
    nome: string;
    avatarUrl: string | null;
  };

  return {
    id: profile.id,
    familia_id: profile.familia_id,
    papel: profile.papel,
    nome: profile.nome,
    avatarUrl: profile.avatarUrl ?? null,
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
    return { familiaId: null, error: { message: localizeRpcError(error.message) } };
  }

  // RPC criar_familia returns the new family UUID as text
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

  if (error) return { error: { message: localizeSupabaseError(error.message) } };

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
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { url: null, error: { message: 'Sessão expirada. Faça login novamente.' } };
  }

  const uploadResult = await uploadImageToPublicBucket({
    bucket: AVATAR_BUCKET,
    imageUri,
    pathWithoutExtension: `${authData.user.id}/avatar`,
  });

  if (uploadResult.error || !uploadResult.publicUrl) {
    return {
      url: null,
      error: { message: uploadResult.error ?? 'Erro ao fazer upload do avatar' },
    };
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: { avatar_url: uploadResult.publicUrl },
  });

  if (metaError) {
    return { url: uploadResult.publicUrl, error: { message: localizeSupabaseError(metaError.message) } };
  }

  return { url: uploadResult.publicUrl, error: null };
}
