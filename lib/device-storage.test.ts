import { afterEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { deviceStorage } from './device-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const originalExpoOs = process.env.EXPO_OS;

afterEach(() => {
  process.env.EXPO_OS = originalExpoOs;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('deviceStorage', () => {
  it('uses localStorage on web instead of expo-secure-store', async () => {
    process.env.EXPO_OS = 'web';

    const localStorage = {
      getItem: vi.fn().mockReturnValue('dark'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    vi.stubGlobal('window', { localStorage });

    await expect(deviceStorage.getItem('trofinho_color_scheme')).resolves.toBe('dark');
    await expect(deviceStorage.setItem('trofinho_color_scheme', 'light')).resolves.toBeUndefined();
    await expect(deviceStorage.removeItem('trofinho_color_scheme')).resolves.toBeUndefined();

    expect(localStorage.getItem).toHaveBeenCalledWith('trofinho_color_scheme');
    expect(localStorage.setItem).toHaveBeenCalledWith('trofinho_color_scheme', 'light');
    expect(localStorage.removeItem).toHaveBeenCalledWith('trofinho_color_scheme');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
