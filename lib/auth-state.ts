import type { AuthChangeEvent, Session } from '@supabase/auth-js';
import * as Sentry from '@sentry/react-native';
import type { UserProfile } from './auth';

type AuthStateHandlerOptions = Readonly<{
  getProfile: () => Promise<UserProfile | null>;
  onProfileChange: (profile: UserProfile | null) => void;
  onReadyChange: (ready: boolean) => void;
  onSignOut?: () => void;
}>;

type AuthStateHandler = Readonly<{
  dispose: () => void;
  handleAuthStateChange: (event: AuthChangeEvent, session: Session | null) => void;
}>;

export function createAuthStateHandler({
  getProfile,
  onProfileChange,
  onReadyChange,
  onSignOut,
}: AuthStateHandlerOptions): AuthStateHandler {
  let active = true;
  let requestId = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastUserId: string | null = null;

  function clearPendingTimeout() {
    if (timeoutId === null) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  function applyResolvedProfile(profile: UserProfile | null, currentRequestId: number) {
    if (!active || currentRequestId !== requestId) return;
    onProfileChange(profile);
    onReadyChange(true);
  }

  function handleAuthStateChange(event: AuthChangeEvent, session: Session | null) {
    if (event === 'SIGNED_OUT' || !session) {
      requestId += 1;
      clearPendingTimeout();
      lastUserId = null;

      Sentry.addBreadcrumb({ category: 'auth', message: 'signed_out', level: 'info' });

      if (!active) return;

      onSignOut?.();
      onProfileChange(null);
      onReadyChange(true);
      return;
    }

    // Detect cross-account switch: different user without explicit sign-out.
    // Clear stale cache before loading the new user's profile.
    const currentUserId = session.user?.id ?? null;
    if (lastUserId && currentUserId && currentUserId !== lastUserId) {
      Sentry.addBreadcrumb({ category: 'auth', message: 'user_switch_detected', level: 'warning' });
      onSignOut?.();
    }
    lastUserId = currentUserId;

    Sentry.addBreadcrumb({ category: 'auth', message: event.toLowerCase(), level: 'info' });

    const currentRequestId = ++requestId;
    clearPendingTimeout();

    // O Supabase executa o listener de auth com lock interno.
    // A leitura seguinte precisa acontecer depois que o callback termina.
    timeoutId = setTimeout(() => {
      timeoutId = null;

      getProfile()
        .then((profile) => {
          // Orphan user: valid auth session but no `usuarios` row (e.g. user
          // signed up then abandoned onboarding). Produce a minimal profile
          // with empty familia_id so the nav guard redirects to onboarding
          // instead of login, giving the user a chance to complete setup.
          if (!profile && session?.user?.id) {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'orphan_user_detected',
              level: 'warning',
            });
            applyResolvedProfile(
              {
                id: session.user.id,
                familia_id: '',
                papel: 'admin',
                nome: '',
                avatarUrl: null,
              },
              currentRequestId,
            );
            return;
          }
          applyResolvedProfile(profile, currentRequestId);
        })
        .catch(() => {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'profile_load_failed',
            level: 'error',
          });
          applyResolvedProfile(null, currentRequestId);
        });
    }, 0);
  }

  function dispose() {
    active = false;
    requestId += 1;
    clearPendingTimeout();
  }

  return {
    dispose,
    handleAuthStateChange,
  };
}
