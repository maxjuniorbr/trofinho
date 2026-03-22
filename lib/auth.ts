import { localizeSupabaseError } from './api-error';
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

  let avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  if (data.papel === 'filho' && !avatarUrl) {
    const { data: childData } = await supabase
      .from('filhos')
      .select('avatar_url')
      .eq('usuario_id', user.id)
      .maybeSingle();

    avatarUrl = (childData as { avatar_url: string | null } | null)?.avatar_url ?? null;
  }

  return {
    ...(data as UserProfile),
    avatarUrl,
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

function translateRpcError(msg: string): string {
  if (msg.includes('já pertence a uma família')) return 'Você já tem uma família cadastrada.';
  if (msg.includes('não autenticado')) return 'Sessão expirada. Faça login novamente.';
  return 'Algo deu errado. Tente novamente.';
}
