import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-application', () => ({
  nativeApplicationVersion: null,
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '2.0.0' },
  },
}));

describe('getAppVersion', () => {
  it('falls back to expoConfig.version when nativeApplicationVersion is null', async () => {
    const { getAppVersion } = await import('./app-version');
    expect(getAppVersion()).toBe('2.0.0');
  });

  it('falls back to dash when both sources are unavailable', async () => {
    const constants = await import('expo-constants');
    const original = constants.default.expoConfig;
    (constants.default as Record<string, unknown>).expoConfig = null;

    const { getAppVersion } = await import('./app-version');
    expect(getAppVersion()).toBe('—');

    (constants.default as Record<string, unknown>).expoConfig = original;
  });
});
