import * as Sentry from '@sentry/react-native';

import { localizeRpcError, localizeSupabaseError } from './api-error';
import { deviceStorage } from './device-storage';
import { resolveStorageUrl, uploadImageToBucket } from './storage';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

export type UserProfile = {
  id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
  nome: string;
  avatarUrl?: string | null;
};

export async function signIn(
  email: string,
  password: string,
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { profile: null, error: localizeSupabaseError(error.message) };
  }

  const profile = await getProfile();
  return { profile, error: null };
}

export async function signUp(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Avoid leaking whether the email is already registered (user enumeration).
    // For weak/invalid password errors we still want to surface the actionable message.
    const message = error.message;
    if (message.includes('User already registered')) {
      Sentry.addBreadcrumb({
        category: 'auth',
        level: 'info',
        message: 'signUp: already-registered email collapsed to generic message',
      });
      return {
        error:
          'Não foi possível concluir o cadastro. Verifique o e-mail e a senha e tente novamente.',
      };
    }
    return { error: localizeSupabaseError(message) };
  }

  return { error: null };
}

export async function getCurrentAuthUser(): Promise<{
  email: string;
  avatarUrl: string | null;
} | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const rawAvatarUrl = (data.user.user_metadata?.avatar_url as string | undefined) ?? null;
  return {
    email: data.user.email ?? '',
    avatarUrl: await resolveStorageUrl('avatars', rawAvatarUrl),
  };
}

export async function signOut(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const deviceId = await deviceStorage.getItem('device_id');
      let query = supabase.from('push_tokens').delete().eq('user_id', user.id);
      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }
      const { error: deleteError } = await query;
      if (deleteError) {
        Sentry.captureMessage('signOut: failed to clean up push token', {
          level: 'warning',
          extra: { message: deleteError.message, hasDeviceId: Boolean(deviceId) },
        });
      }
    }
  } catch (err) {
    // Best-effort cleanup — do not block sign-out, but surface for diagnostics.
    Sentry.captureException(err, { tags: { stage: 'signOut.cleanup' } });
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'signOut.auth' } });
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  // RPC obter_meu_perfil returns a single flat object with camelCase avatarUrl,
  // which differs from the usuarios table row shape — cast bridges the gap
  const { data, error } = await supabase.rpc('obter_meu_perfil');

  if (error || !data) return null;

  const profile = data as {
    id: string;
    familia_id: string;
    papel: string;
    nome: string;
    avatarUrl: string | null;
  };

  return {
    id: profile.id,
    familia_id: profile.familia_id,
    papel: profile.papel as 'admin' | 'filho',
    nome: profile.nome,
    avatarUrl: await resolveStorageUrl('avatars', profile.avatarUrl),
  };
}

export async function createFamily(
  familyName: string,
  userName: string,
): Promise<{ familiaId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('criar_familia', {
    nome_familia: familyName,
    nome_usuario: userName,
  });

  if (error) {
    return { familiaId: null, error: localizeRpcError(error.message) };
  }

  // RPC criar_familia returns the new family UUID as text
  return { familiaId: data, error: null };
}

export async function refreshAuthSession(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.refreshSession();

  if (error) {
    Sentry.captureException(error);
    return { error: localizeSupabaseError(error.message) };
  }

  return { error: null };
}

export async function updateUserName(name: string): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: 'Sessão expirada. Faça login novamente.' };
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ nome: name })
    .eq('id', authData.user.id);

  if (error) return { error: localizeSupabaseError(error.message) };

  return { error: null };
}

export async function updateUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.email) {
    return { error: 'Sessão expirada. Faça login novamente.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authData.user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: 'Senha atual incorreta.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: localizeSupabaseError(error.message) };
  }

  return { error: null };
}

export async function deleteAccount(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('excluir_minha_conta');

  if (error) {
    return { error: localizeRpcError(error.message) };
  }

  await supabase.auth.signOut({ scope: 'local' });
  return { error: null };
}

export async function updateUserAvatar(
  imageUri: string,
): Promise<{ url: string | null; error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { url: null, error: 'Sessão expirada. Faça login novamente.' };
  }

  const uploadResult = await uploadImageToBucket({
    bucket: AVATAR_BUCKET,
    imageUri,
    pathWithoutExtension: `${authData.user.id}/avatar`,
  });

  if (uploadResult.error || !uploadResult.path) {
    return {
      url: null,
      error: uploadResult.error ?? 'Erro ao fazer upload do avatar',
    };
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: { avatar_url: uploadResult.path },
  });

  if (metaError) {
    if (uploadResult.path) {
      supabase.storage
        .from(AVATAR_BUCKET)
        .remove([uploadResult.path])
        .catch(() => {});
    }
    return {
      url: null,
      error: localizeSupabaseError(metaError.message),
    };
  }

  // Best-effort sync to filhos table so admin views show the avatar
  await supabase.rpc('sincronizar_avatar_filho', {
    p_avatar_url: uploadResult.path,
  });

  // Resolve to a signed URL for immediate display by the caller.
  const signedUrl = await resolveStorageUrl(AVATAR_BUCKET, uploadResult.path);

  return { url: signedUrl, error: null };
}
