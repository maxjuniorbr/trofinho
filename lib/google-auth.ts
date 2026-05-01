import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoogleAuthResult =
  | { type: 'success'; idToken: string; user: { name: string; email: string } }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configures the Google Sign-In SDK with the Web Client ID.
 * Must be called once during app initialization (e.g. in `app/_layout.tsx`).
 */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

// ---------------------------------------------------------------------------
// Sign-In
// ---------------------------------------------------------------------------

/**
 * Executes the native Google Sign-In flow.
 * Returns the `idToken` for use with `supabase.auth.signInWithIdToken()`.
 */
export async function getGoogleIdToken(): Promise<GoogleAuthResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // User cancelled the sign-in flow.
      return { type: 'cancelled' };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { type: 'error', message: 'Erro na autenticação. Tente novamente.' };
    }

    return {
      type: 'success',
      idToken,
      user: {
        name: response.data.user.name ?? '',
        email: response.data.user.email,
      },
    };
  } catch (error: unknown) {
    Sentry.captureException(error, {
      tags: { area: 'google-auth', step: 'sign_in' },
      extra: {
        errorCode: isErrorWithCode(error) ? error.code : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        webClientIdSet: Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
      },
    });
    return mapGoogleSignInError(error);
  }
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

/**
 * Revokes the Google OAuth token (used for account deletion / LGPD compliance).
 * Silently ignores errors — best-effort cleanup.
 */
export async function revokeGoogleAccess(): Promise<void> {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // Best-effort revocation — do not block the caller.
  }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapGoogleSignInError(error: unknown): GoogleAuthResult {
  if (!isErrorWithCode(error)) {
    return { type: 'error', message: 'Erro na autenticação. Tente novamente.' };
  }

  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return { type: 'cancelled' };

    case statusCodes.IN_PROGRESS:
      // Another sign-in operation is already in progress — treat as cancellation.
      return { type: 'cancelled' };

    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return {
        type: 'error',
        message:
          'O Google Play Services não está disponível. Atualize-o e tente novamente.',
      };

    default:
      return mapNetworkOrServerError(error);
  }
}

function mapNetworkOrServerError(error: { code: string; message?: string }): GoogleAuthResult {
  const msg = (error.message ?? '').toLowerCase();

  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('internet') ||
    msg.includes('connection')
  ) {
    return {
      type: 'error',
      message:
        'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    };
  }

  if (msg.includes('500') || msg.includes('503') || msg.includes('server')) {
    return {
      type: 'error',
      message:
        'O serviço do Google está temporariamente indisponível. Tente novamente em alguns minutos.',
    };
  }

  return { type: 'error', message: 'Erro na autenticação. Tente novamente.' };
}
