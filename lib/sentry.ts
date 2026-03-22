import * as Sentry from '@sentry/react-native';

// Created once at module scope so the same instance is shared between
// initSentry() (which registers it as an integration) and
// registerNavigationRef() (which connects it to the Expo Router container).
const navigationIntegration = Sentry.reactNavigationIntegration();

// Call at the top of app/_layout.tsx, outside the React tree.
// If EXPO_PUBLIC_SENTRY_DSN is not set, init is skipped and all Sentry calls
// become no-ops — the app works normally.
export const initSentry = (): void => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,

    // Disable in local dev: avoids event noise during Metro/Expo Go sessions.
    // Sentry already short-circuits in Metro dev server, but this also prevents
    // the JS-side event queue from being active during development client runs.
    enabled: !__DEV__,

    // Do NOT capture IP addresses, cookies, or any PII. We send only the user
    // UUID via setUserContext() below.
    sendDefaultPii: false,

    // Session Replay is intentionally disabled. Recording screens is
    // inappropriate for an app used by children (LGPD art. 14 concerns) and
    // would add significant payload size to every build.

    integrations: [navigationIntegration],
  });
};

// Call once after the navigation container mounts.
// useNavigationContainerRef() from expo-router provides the ref.
export const registerNavigationRef = (
  ref: Parameters<typeof navigationIntegration.registerNavigationContainer>[0],
): void => {
  navigationIntegration.registerNavigationContainer(ref);
};

// Call when a user profile is loaded. Captures only the UUID and role tag —
// never email, name, or any other personal data.
export const setUserContext = (userId: string, role: 'admin' | 'filho'): void => {
  Sentry.setUser({ id: userId });
  Sentry.setTag('role', role);
};

// Call on SIGNED_OUT to remove user context from subsequent events.
export const clearUserContext = (): void => {
  Sentry.setUser(null);
  Sentry.setTag('role', null);
};

// Re-exported for use in catch blocks throughout the app.
// Route all Sentry calls through this module for consistency.
export { captureException } from '@sentry/react-native';
