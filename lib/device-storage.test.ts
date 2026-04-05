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

  it('reassembles chunked values', async () => {
    vi.mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce('2')
      .mockResolvedValueOnce('dark')
      .mockResolvedValueOnce('-mode');

    const result = await deviceStorage.getItem('trofinho_color_scheme');

    expect(result).toBe('dark-mode');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('trofinho_color_scheme_chunk_0');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('trofinho_color_scheme_chunk_1');
  });

  it('returns null when a chunk is missing', async () => {
    vi.mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce('2')
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce(null);

    const result = await deviceStorage.getItem('chunked');

    expect(result).toBeNull();
  });

  it('splits large values into chunks when storing', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('2');
    const largeValue = 'a'.repeat(4000);

    await deviceStorage.setItem('large', largeValue);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('large');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('large_chunk_0');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('large_chunk_1');

    // Count must be written BEFORE chunks to prevent corruption on crash
    const setCalls = vi.mocked(SecureStore.setItemAsync).mock.calls;
    const countCallIndex = setCalls.findIndex(([key]) => key === 'large_chunks');
    const chunkCallIndex = setCalls.findIndex(([key]) => String(key).startsWith('large_chunk_'));
    expect(countCallIndex).toBeLessThan(chunkCallIndex);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('large_chunks', '3');
    expect(
      vi
        .mocked(SecureStore.setItemAsync)
        .mock.calls.some(([key]) => String(key).startsWith('large_chunk_')),
    ).toBe(true);
  });

  it('removes chunk metadata when deleting chunked values', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('3');

    await deviceStorage.removeItem('chunked');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('chunked_chunk_0');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('chunked_chunk_1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('chunked_chunk_2');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('chunked_chunks');
  });
});
