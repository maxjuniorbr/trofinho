import * as Sentry from '@sentry/react-native';

import { extractErrorMessage, localizeRpcError, localizeSupabaseError } from './api-error';
import { deviceStorage } from './device-storage';
import { getGoogleIdToken, revokeGoogleAccess } from './google-auth';
import { isValidDateOfBirth, localizeOAuthError, parseIsoDate } from './google-auth-utils';
import { resolveStorageUrl } from './storage';
import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
  nome: string;
  avatarUrl?: string | null;
  pendingChildInvite?: string | null;
};

export async function signInWithGoogle(): Promise<{
  profile: UserProfile | null;
  isNewUser: boolean;
  googleName: string | null;
  error: string | null;
}> {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'google_sign_in_started',
    level: 'info',
  });

  const googleResult = await getGoogleIdToken();

  if (googleResult.type === 'cancelled') {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'google_sign_in_cancelled',
      level: 'info',
    });
    return { profile: null, isNewUser: false, googleName: null, error: null };
  }

  if (googleResult.type === 'error') {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'google_sign_in_error',
      level: 'warning',
    });
    const localizedMessage = localizeOAuthError(googleResult);
    return { profile: null, isNewUser: false, googleName: null, error: localizedMessage ?? 'Erro na autenticação. Tente novamente.' };
  }

  const { idToken, user } = googleResult;

  let signInError: { message: string; status?: number } | null = null;
  try {
    ({ error: signInError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    }));
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'auth', step: 'sign-in-with-id-token' },
    });
    const message = extractErrorMessage(error, 'Erro na autenticação. Tente novamente.');
    return {
      profile: null,
      isNewUser: false,
      googleName: user.name || null,
      error: localizeOAuthError({ message }),
    };
  }

  if (signInError) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'google_sign_in_supabase_error',
      level: 'error',
    });
    const localizedMessage = localizeOAuthError({ message: signInError.message, status: signInError.status });
    return { profile: null, isNewUser: false, googleName: user.name || null, error: localizedMessage };
  }

  const profileResult = await readProfile();
  if (profileResult.error) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'google_sign_in_profile_load_error',
      level: 'error',
    });
    return {
      profile: null,
      isNewUser: false,
      googleName: user.name || null,
      error: profileResult.error,
    };
  }

  const profile = profileResult.profile;
  const isNewUser = profile === null;

  // Best-effort: backfill child avatar from Google picture so admin views show it.
  // Only syncs when the child has no custom avatar yet.
  if (profile?.papel === 'filho' && !profile.avatarUrl) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const googlePicture =
        (authData?.user?.user_metadata?.picture as string | undefined) ??
        (authData?.user?.user_metadata?.avatar_url as string | undefined) ??
        null;
      if (googlePicture) {
        await supabase.rpc('sincronizar_avatar_filho', { p_avatar_url: googlePicture });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'auth', step: 'sync-google-avatar' } });
    }
  }

  Sentry.addBreadcrumb({
    category: 'auth',
    message: isNewUser ? 'google_sign_in_new_user' : 'google_sign_in_existing_user',
    level: 'info',
  });

  return {
    profile,
    isNewUser,
    googleName: user.name || null,
    error: null,
  };
}

export async function getCurrentAuthUser(): Promise<{
  email: string;
  avatarUrl: string | null;
  emailConfirmedAt: string | null;
  dateOfBirth: string | null;
  fullName: string | null;
} | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const rawAvatarUrl =
    (data.user.user_metadata?.avatar_url as string | undefined) ??
    (data.user.user_metadata?.picture as string | undefined) ??
    null;
  const rawDateOfBirth = (data.user.user_metadata?.date_of_birth as string | undefined) ?? null;
  const rawFullName = (data.user.user_metadata?.full_name as string | undefined) ?? null;
  return {
    email: data.user.email ?? '',
    avatarUrl: await resolveStorageUrl('avatars', rawAvatarUrl),
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    dateOfBirth: rawDateOfBirth || null,
    fullName: rawFullName || null,
  };
}

export async function signOut(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const deviceId = await deviceStorage.getItem('device_id');
      if (deviceId) {
        const { error: deleteError } = await supabase
          .from('push_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('device_id', deviceId);
        if (deleteError) {
          Sentry.captureMessage('signOut: failed to clean up push token', {
            level: 'warning',
            extra: { message: deleteError.message },
          });
        }
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

type ProfileLookupResult = {
  profile: UserProfile | null;
  error: string | null;
};

async function readProfile(): Promise<ProfileLookupResult> {
  // RPC obter_meu_perfil returns a single flat object with camelCase avatarUrl,
  // which differs from the usuarios table row shape — cast bridges the gap
  try {
    const { data, error } = await supabase.rpc('obter_meu_perfil');

    if (error) {
      return {
        profile: null,
        error: localizeRpcError(error.message, 'Erro ao carregar perfil. Tente novamente.'),
      };
    }

    if (!data) return { profile: null, error: null };

    const profile = data as {
      id: string;
      familia_id: string;
      papel: string;
      nome: string;
      avatarUrl: string | null;
    };

    return {
      profile: {
        id: profile.id,
        familia_id: profile.familia_id,
        papel: profile.papel as 'admin' | 'filho',
        nome: profile.nome,
        avatarUrl: await resolveStorageUrl('avatars', profile.avatarUrl),
      },
      error: null,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'auth', step: 'get-profile' },
    });
    const message = extractErrorMessage(error, 'Erro ao carregar perfil. Tente novamente.');
    return {
      profile: null,
      error: localizeRpcError(message, 'Erro ao carregar perfil. Tente novamente.'),
    };
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  const { profile, error } = await readProfile();
  if (error) {
    throw new Error(error);
  }
  return profile;
}

export async function createFamily(
  familyName: string,
  userName: string,
): Promise<{ familiaId: string | null; error: string | null }> {
  let data: string | null = null;
  let error: { message: string } | null = null;
  try {
    ({ data, error } = await supabase.rpc('criar_familia', {
      nome_familia: familyName,
      nome_usuario: userName,
    }));
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'auth', step: 'create-family' },
    });
    const message = extractErrorMessage(err, 'Erro ao criar família. Tente novamente.');
    return { familiaId: null, error: localizeRpcError(message) };
  }

  if (error) {
    return { familiaId: null, error: localizeRpcError(error.message) };
  }

  // RPC criar_familia returns the new family UUID as text
  return { familiaId: data, error: null };
}

export async function refreshAuthSession(): Promise<{ error: string | null }> {
  let error: { message: string } | null = null;
  try {
    ({ error } = await supabase.auth.refreshSession());
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'auth', step: 'refresh-session' },
    });
    return { error: 'Algo deu errado. Tente novamente.' };
  }

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

export async function deleteAccount(): Promise<{ error: string | null }> {
  // Revoke Google OAuth token before deleting the account (LGPD compliance).
  await revokeGoogleAccess();

  const { error } = await supabase.rpc('excluir_minha_conta');

  if (error) {
    return { error: localizeRpcError(error.message) };
  }

  await supabase.auth.signOut({ scope: 'local' });
  return { error: null };
}

export async function updateDateOfBirth(
  dateOfBirth: string,
  minAge = 8,
): Promise<{ error: string | null }> {
  const parsed = parseIsoDate(dateOfBirth);

  if (!parsed || !isValidDateOfBirth(parsed, minAge)) {
    return { error: 'Data de nascimento inválida.' };
  }

  let error: { message: string } | null = null;
  try {
    ({ error } = await supabase.auth.updateUser({
      data: { date_of_birth: dateOfBirth },
    }));
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'auth', step: 'update-date-of-birth' },
    });
    return { error: 'Algo deu errado. Tente novamente.' };
  }

  if (error) {
    return { error: localizeSupabaseError(error.message) };
  }

  return { error: null };
}
