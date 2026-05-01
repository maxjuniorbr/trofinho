import * as Sentry from '@sentry/react-native';

import { localizeRpcError, localizeSupabaseError } from './api-error';
import { deviceStorage } from './device-storage';
import { getGoogleIdToken, revokeGoogleAccess } from './google-auth';
import { isValidDateOfBirth, localizeOAuthError } from './google-auth-utils';
import { resolveStorageUrl, uploadImageToBucket } from './storage';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

/** Base URL for web redirect pages (email confirmation, password reset). */
const WEB_BASE_URL = 'https://trofinho.com.br';
const CONFIRM_EMAIL_REDIRECT = `${WEB_BASE_URL}/confirm-email`;
const RESET_PASSWORD_REDIRECT = `${WEB_BASE_URL}/reset-password`;

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
  const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });

  if (error) {
    return { profile: null, error: localizeSupabaseError(error.message) };
  }

  const profile = await getProfile();
  return { profile, error: null };
}

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

  const { error: signInError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (signInError) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'google_sign_in_supabase_error',
      level: 'error',
    });
    const localizedMessage = localizeOAuthError({ message: signInError.message, status: signInError.status });
    return { profile: null, isNewUser: false, googleName: user.name || null, error: localizedMessage };
  }

  const profile = await getProfile();
  const isNewUser = profile === null;

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

export async function signUp(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      emailRedirectTo: CONFIRM_EMAIL_REDIRECT,
    },
  });

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
  emailConfirmedAt: string | null;
} | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const rawAvatarUrl = (data.user.user_metadata?.avatar_url as string | undefined) ?? null;
  return {
    email: data.user.email ?? '',
    avatarUrl: await resolveStorageUrl('avatars', rawAvatarUrl),
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
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
  // Best-effort: revoke Google OAuth token before deleting the account (LGPD compliance).
  const hasGoogle = await hasGoogleIdentity();
  if (hasGoogle) {
    await revokeGoogleAccess();
  }

  const { error } = await supabase.rpc('excluir_minha_conta');

  if (error) {
    return { error: localizeRpcError(error.message) };
  }

  await supabase.auth.signOut({ scope: 'local' });
  return { error: null };
}

export async function requestPasswordReset(
  email: string,
): Promise<{ error: string | null }> {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'password_reset_requested',
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: RESET_PASSWORD_REDIRECT,
  });

  if (error) {
    // Only surface rate-limit errors — all other errors are suppressed
    // to prevent user enumeration (never reveal if an email exists).
    if (error.message.includes('Email rate limit exceeded')) {
      return { error: localizeSupabaseError(error.message) };
    }
    return { error: null };
  }

  return { error: null };
}

export async function resendConfirmationEmail(
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.toLowerCase(),
    options: {
      emailRedirectTo: CONFIRM_EMAIL_REDIRECT,
    },
  });

  if (error) {
    // Surface rate-limit errors with localized message.
    // Suppress all other errors to prevent email enumeration
    // (same anti-enumeration pattern as requestPasswordReset).
    if (error.message.includes('Email rate limit exceeded')) {
      return { error: localizeSupabaseError(error.message) };
    }
    return { error: null };
  }

  return { error: null };
}

export async function confirmPasswordReset(
  accessToken: string,
  refreshToken: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  if (!accessToken || !refreshToken) {
    return { error: 'Link expirado ou inválido. Solicite um novo link de redefinição.' };
  }

  // Step 1: Establish the recovery session using the tokens from the redirect
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'password_reset_token_failed',
    });
    return { error: localizeSupabaseError(sessionError.message) };
  }

  // Step 2: Update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    // Clean up the recovery session to prevent the user from being
    // unexpectedly logged in after a failed password update.
    await supabase.auth.signOut({ scope: 'local' });
    return { error: localizeSupabaseError(updateError.message) };
  }

  // Step 3: Sign out locally
  await supabase.auth.signOut({ scope: 'local' });

  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'password_reset_completed',
  });

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

export async function linkGoogleIdentity(): Promise<{ error: string | null }> {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'link_google_identity_started',
    level: 'info',
  });

  const googleResult = await getGoogleIdToken();

  if (googleResult.type === 'cancelled') {
    return { error: null };
  }

  if (googleResult.type === 'error') {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'link_google_identity_google_error',
      level: 'warning',
    });
    const localizedMessage = localizeOAuthError(googleResult);
    return { error: localizedMessage ?? 'Erro na autenticação. Tente novamente.' };
  }

  const { idToken } = googleResult;

  const { error: linkError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (linkError) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'link_google_identity_supabase_error',
      level: 'error',
    });

    const msg = (linkError.message ?? '').toLowerCase();
    if (msg.includes('provider') && msg.includes('already')) {
      return {
        error:
          'Esta conta já está vinculada a outro método de login. Faça login com e-mail/senha e vincule sua conta Google nas configurações.',
      };
    }

    const localizedMessage = localizeOAuthError({ message: linkError.message, status: linkError.status });
    return { error: localizedMessage };
  }

  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'link_google_identity_success',
    level: 'info',
  });

  return { error: null };
}

export async function hasGoogleIdentity(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return false;
  }

  const identities = data.user.identities ?? [];
  return identities.some((identity) => identity.provider === 'google');
}

export async function updateDateOfBirth(dateOfBirth: string): Promise<{ error: string | null }> {
  const parsed = new Date(dateOfBirth);

  if (!isValidDateOfBirth(parsed)) {
    return { error: 'Data de nascimento inválida.' };
  }

  const { error } = await supabase.auth.updateUser({
    data: { date_of_birth: dateOfBirth },
  });

  if (error) {
    return { error: localizeSupabaseError(error.message) };
  }

  return { error: null };
}
