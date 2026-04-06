import { describe, expect, it, vi, beforeEach } from 'vitest';

const hapticsMock = vi.hoisted(() => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: hapticsMock.impactAsync,
  notificationAsync: hapticsMock.notificationAsync,
}));

const platformMock = vi.hoisted(() => ({ OS: 'ios' as string }));

vi.mock('react-native', () => ({
  Platform: platformMock,
}));

describe('haptics', () => {
  beforeEach(() => {
    hapticsMock.impactAsync.mockClear();
    hapticsMock.notificationAsync.mockClear();
    platformMock.OS = 'ios';
  });

  it('hapticSuccess calls notificationAsync on native', async () => {
    const { hapticSuccess } = await import('./haptics');
    hapticSuccess();
    expect(hapticsMock.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('hapticLight calls impactAsync on native', async () => {
    const { hapticLight } = await import('./haptics');
    hapticLight();
    expect(hapticsMock.impactAsync).toHaveBeenCalledWith('light');
  });

  it('hapticSuccess is a no-op on web', async () => {
    platformMock.OS = 'web';
    const { hapticSuccess } = await import('./haptics');
    hapticSuccess();
    expect(hapticsMock.notificationAsync).not.toHaveBeenCalled();
  });

  it('hapticLight is a no-op on web', async () => {
    platformMock.OS = 'web';
    const { hapticLight } = await import('./haptics');
    hapticLight();
    expect(hapticsMock.impactAsync).not.toHaveBeenCalled();
  });

  it('swallows errors silently', async () => {
    hapticsMock.notificationAsync.mockRejectedValueOnce(new Error('haptics unavailable'));
    const { hapticSuccess } = await import('./haptics');
    expect(() => hapticSuccess()).not.toThrow();
  });
});
