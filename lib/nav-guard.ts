import type { UserProfile } from './auth';

export type NavTarget =
  | '/(auth)/login'
  | '/(auth)/onboarding'
  | '/(auth)/join-child'
  | '/(admin)/'
  | '/(child)/';

/** Auth sub-routes that bypass the normal redirect logic. */
const AUTH_PASSTHROUGH_ROUTES = new Set(['onboarding', 'join-family', 'join-child']);

function getRoleHome(profile: UserProfile): NavTarget {
  return profile.papel === 'admin' ? '/(admin)/' : '/(child)/';
}

/** Returns true when the user is in the correct route group for their role. */
function isInCorrectRouteGroup(group: string, papel: string, isImpersonating: boolean): boolean {
  if (group === '(admin)') return papel === 'admin';
  if (group === '(child)') return papel === 'filho' || isImpersonating;
  return false;
}

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
  /** When true, an admin is allowed inside the (child) route group. */
  isImpersonating = false,
): NavTarget | null {
  if (!ready) return null;

  const inAuth = segments[0] === '(auth)';
  const seg1 = segments[1] as string | undefined;

  if (profile === null) {
    return inAuth ? null : '/(auth)/login';
  }

  if (profile === undefined) return null;

  const roleHome = getRoleHome(profile);

  // No family yet — only allow passthrough auth routes (onboarding,
  // join-family, join-child). Everything else redirects to onboarding.
  // Exception: orphan users with a pending child invite go to join-child.
  if (!profile.familia_id) {
    if (AUTH_PASSTHROUGH_ROUTES.has(seg1 ?? '')) return null;
    if (profile.pendingChildInvite) return '/(auth)/join-child';
    return '/(auth)/onboarding';
  }

  if (inAuth) {
    return roleHome;
  }

  if (isInCorrectRouteGroup(segments[0], profile.papel, isImpersonating)) return null;

  return roleHome;
}
