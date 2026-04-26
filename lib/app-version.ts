import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * Returns the app version string from the most reliable available source.
 *
 * Priority:
 * 1. `Application.nativeApplicationVersion` — reads from the native binary
 *    (android:versionName / CFBundleShortVersionString). Most reliable in
 *    production builds.
 * 2. `Constants.expoConfig?.version` — reads from app.json / app.config.js.
 *    Available in dev builds and Expo Go.
 * 3. `'—'` — fallback when neither source is available (e.g. test environment).
 */
export function getAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
}
