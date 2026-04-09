import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react-native';
import { createAuthStateHandler } from './auth-state';
import type { UserProfile } from './auth';

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('createAuthStateHandler', () => {
  const getProfile = vi.fn<() => Promise<UserProfile | null>>();
  const onProfileChange = vi.fn<(profile: UserProfile | null) => void>();
  const onReadyChange = vi.fn<(ready: boolean) => void>();
  const onSignOut = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    getProfile.mockReset();
    onProfileChange.mockReset();
    onReadyChange.mockReset();
    onSignOut.mockReset();
    vi.mocked(Sentry.addBreadcrumb).mockClear();
  });

  it('defers profile refresh until after the auth callback returns', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('USER_UPDATED', { access_token: 'token' } as never);

    expect(getProfile).not.toHaveBeenCalled();
    expect(onProfileChange).not.toHaveBeenCalled();
    expect(onReadyChange).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(onProfileChange).toHaveBeenCalledWith({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
    expect(onReadyChange).toHaveBeenCalledWith(true);
  });

  it('handles signed out events immediately and cancels pending refreshes', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_IN', { access_token: 'token' } as never);
    handler.handleAuthStateChange('SIGNED_OUT', null);

    expect(onProfileChange).toHaveBeenCalledWith(null);
    expect(onReadyChange).toHaveBeenCalledWith(true);

    await vi.runAllTimersAsync();

    expect(getProfile).not.toHaveBeenCalled();
    expect(onProfileChange).toHaveBeenCalledTimes(1);
  });

  it('calls onProfileChange(null) when getProfile rejects', async () => {
    getProfile.mockRejectedValue(new Error('network error'));

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_IN', { access_token: 'token' } as never);
    await vi.runAllTimersAsync();

    expect(onProfileChange).toHaveBeenCalledWith(null);
    expect(onReadyChange).toHaveBeenCalledWith(true);
  });

  it('stops reacting to events after dispose', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_IN', { access_token: 'token' } as never);
    handler.dispose();

    await vi.runAllTimersAsync();

    expect(onProfileChange).not.toHaveBeenCalled();
    expect(onReadyChange).not.toHaveBeenCalled();
  });

  it('handles SIGNED_OUT after dispose without calling callbacks', () => {
    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.dispose();
    handler.handleAuthStateChange('SIGNED_OUT', null);

    expect(onProfileChange).not.toHaveBeenCalled();
  });

  it('ignores stale profile fetches after a newer auth event', async () => {
    let resolveFirst: ((profile: UserProfile | null) => void) | undefined;

    getProfile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        id: 'user-2',
        familia_id: 'family-1',
        papel: 'admin',
        nome: 'Ana',
      });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('TOKEN_REFRESHED', { access_token: 'first' } as never);
    await vi.runOnlyPendingTimersAsync();

    handler.handleAuthStateChange('USER_UPDATED', { access_token: 'second' } as never);
    await vi.runOnlyPendingTimersAsync();

    resolveFirst?.({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
    });
    await Promise.resolve();

    expect(onProfileChange).toHaveBeenCalledTimes(1);
    expect(onProfileChange).toHaveBeenLastCalledWith({
      id: 'user-2',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Ana',
    });
  });

  it('calls onSignOut before onProfileChange on SIGNED_OUT', () => {
    const callOrder: string[] = [];
    const trackingOnProfileChange = vi.fn(() => callOrder.push('profileChange'));
    const trackingOnSignOut = vi.fn(() => callOrder.push('signOut'));

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange: trackingOnProfileChange,
      onReadyChange,
      onSignOut: trackingOnSignOut,
    });

    handler.handleAuthStateChange('SIGNED_OUT', null);

    expect(trackingOnSignOut).toHaveBeenCalledTimes(1);
    expect(trackingOnProfileChange).toHaveBeenCalledWith(null);
    expect(callOrder).toEqual(['signOut', 'profileChange']);
  });

  it('calls onSignOut when userId changes without explicit sign-out', async () => {
    getProfile.mockResolvedValue({
      id: 'user-2',
      familia_id: 'family-2',
      papel: 'admin',
      nome: 'Ana',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
      onSignOut,
    });

    // First login — establishes lastUserId
    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token-1',
      user: { id: 'user-1' },
    } as never);
    await vi.runAllTimersAsync();

    // Second login — different user without SIGNED_OUT
    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token-2',
      user: { id: 'user-2' },
    } as never);

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not call onSignOut when same user re-authenticates', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
      onSignOut,
    });

    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token-1',
      user: { id: 'user-1' },
    } as never);
    await vi.runAllTimersAsync();

    handler.handleAuthStateChange('TOKEN_REFRESHED', {
      access_token: 'token-2',
      user: { id: 'user-1' },
    } as never);

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('emits signed_out breadcrumb on SIGNED_OUT', () => {
    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_OUT', null);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'signed_out',
      level: 'info',
    });
  });

  it('emits auth event breadcrumb on SIGNED_IN', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1',
      familia_id: 'family-1',
      papel: 'admin',
      nome: 'Max',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token',
      user: { id: 'user-1' },
    } as never);
    await vi.runAllTimersAsync();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'signed_in',
      level: 'info',
    });
  });

  it('emits user_switch_detected breadcrumb on cross-account switch', async () => {
    getProfile.mockResolvedValue({
      id: 'user-2',
      familia_id: 'family-2',
      papel: 'admin',
      nome: 'Ana',
    });

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
      onSignOut,
    });

    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token-1',
      user: { id: 'user-1' },
    } as never);
    await vi.runAllTimersAsync();

    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token-2',
      user: { id: 'user-2' },
    } as never);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'user_switch_detected',
      level: 'warning',
    });
  });

  it('emits profile_load_failed breadcrumb when getProfile rejects', async () => {
    getProfile.mockRejectedValue(new Error('network error'));

    const handler = createAuthStateHandler({
      getProfile,
      onProfileChange,
      onReadyChange,
    });

    handler.handleAuthStateChange('SIGNED_IN', {
      access_token: 'token',
      user: { id: 'user-1' },
    } as never);
    await vi.runAllTimersAsync();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'profile_load_failed',
      level: 'error',
    });
  });
});
