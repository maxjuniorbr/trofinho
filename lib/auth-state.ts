import type { AuthChangeEvent, Session } from '@supabase/auth-js';
import type { UserProfile } from './auth';

type AuthStateHandlerOptions = Readonly<{
  getProfile: () => Promise<UserProfile | null>;
  onProfileChange: (profile: UserProfile | null) => void;
  onReadyChange: (ready: boolean) => void;
}>;

type AuthStateHandler = Readonly<{
  dispose: () => void;
  handleAuthStateChange: (event: AuthChangeEvent, session: Session | null) => void;
}>;

export function createAuthStateHandler({
  getProfile,
  onProfileChange,
  onReadyChange,
}: AuthStateHandlerOptions): AuthStateHandler {
  let active = true;
  let requestId = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

      if (!active) return;

      onProfileChange(null);
      onReadyChange(true);
      return;
    }

    const currentRequestId = ++requestId;
    clearPendingTimeout();

    // O Supabase executa o listener de auth com lock interno.
    // A leitura seguinte precisa acontecer depois que o callback termina.
    timeoutId = setTimeout(() => {
      timeoutId = null;

      getProfile()
        .then((profile) => {
          applyResolvedProfile(profile, currentRequestId);
        })
        .catch(() => {
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
