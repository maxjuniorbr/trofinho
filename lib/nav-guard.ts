import type { UserProfile } from './auth';

export type NavTarget = '/(auth)/login' | '/(auth)/onboarding' | '/(admin)/' | '/(child)/';

/**
 * Pure function that determines the navigation target for the root layout.
 * Returns the route the app should replace to, or null if no redirect is needed.
 *
 * Mirrors the routing logic in app/_layout.tsx RootNavigator exactly,
 * making it independently testable without any React or router dependencies.
 */
export function resolveNavDecision(
  ready: boolean,
  profile: UserProfile | null | undefined,
  segments: string[],
): NavTarget | null {
  if (!ready) return null;

  const inAuth = segments[0] === '(auth)';
  const seg1 = segments[1] as string | undefined;

  if (profile === null) {
    // Onboarding requires an active session — if signed out while on it,
    // redirect to login instead of staying on a screen that can't work.
    if (seg1 === 'onboarding') return '/(auth)/login';
    return inAuth ? null : '/(auth)/login';
  }

  if (profile === undefined) return null;

  const roleHome: NavTarget = profile.papel === 'admin' ? '/(admin)/' : '/(child)/';

  if (!profile.familia_id) {
    return seg1 === 'onboarding' ? null : '/(auth)/onboarding';
  }

  if (inAuth) return roleHome;

  const inAdmin = segments[0] === '(admin)';
  const inChild = segments[0] === '(child)';

  if ((inAdmin && profile.papel !== 'admin') || (inChild && profile.papel !== 'filho')) {
    return roleHome;
  }

  if (!inAdmin && !inChild) return roleHome;

  return null;
}
