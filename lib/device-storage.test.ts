import { afterEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { deviceStorage } from './device-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deviceStorage', () => {
  it('delegates getItem to SecureStore', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null); // no chunks
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('dark');

    const result = await deviceStorage.getItem('trofinho_color_scheme');

    expect(result).toBe('dark');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('trofinho_color_scheme_chunks');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('trofinho_color_scheme');
  });

  it('delegates setItem to SecureStore for small values', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null); // no existing chunks

    await deviceStorage.setItem('key', 'value');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('key', 'value');
  });

  it('delegates removeItem to SecureStore', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null); // no chunks

    await deviceStorage.removeItem('key');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('key');
  });
});
