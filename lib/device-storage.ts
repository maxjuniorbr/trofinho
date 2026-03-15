import * as SecureStore from 'expo-secure-store';

// SecureStore has a 2048-byte limit per entry. Values larger than that
// (e.g. Supabase sessions with avatar_url in user metadata) are split into
// fixed-size chunks stored under "<key>_chunk_<n>", with a count key "<key>_chunks".
const CHUNK_SIZE = 1900; // bytes per chunk (safe margin below 2048)

function getWebStorage(): Storage | null {
  if (process.env.EXPO_OS !== 'web') return null;

  const webWindow = globalThis.window;
  return webWindow ? webWindow.localStorage : null;
}

async function secureGet(key: string): Promise<string | null> {
  // Check if value was stored in chunks
  const countRaw = await SecureStore.getItemAsync(`${key}_chunks`);
  if (countRaw !== null) {
    const count = Number.parseInt(countRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null;
      parts.push(chunk);
    }
    return parts.join('');
  }

  return await SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  const encoded = new TextEncoder().encode(value);

  if (encoded.byteLength <= CHUNK_SIZE) {
    // Clean up any previous chunked version before writing normally
    await secureClearChunks(key);
    await SecureStore.setItemAsync(key, value);
    return;
  }

  // Split into chunks
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; ) {
    // Slice by characters; re-check byte length to avoid multi-byte overruns
    let end = offset + CHUNK_SIZE;
    while (end > offset && new TextEncoder().encode(value.slice(offset, end)).byteLength > CHUNK_SIZE) {
      end--;
    }
    chunks.push(value.slice(offset, end));
    offset = end;
  }

  // Remove any plain (non-chunked) entry and any previous chunks
  await SecureStore.deleteItemAsync(key);
  await secureClearChunks(key);

  // Write chunks
  await Promise.all(
    chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk)),
  );
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
}

async function secureClearChunks(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}_chunks`);
  if (countRaw === null) return;
  const count = Number.parseInt(countRaw, 10);
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_chunk_${i}`)),
  );
  await SecureStore.deleteItemAsync(`${key}_chunks`);
}

async function secureRemove(key: string): Promise<void> {
  await secureClearChunks(key);
  await SecureStore.deleteItemAsync(key);
}

export const deviceStorage = {
  async getItem(key: string): Promise<string | null> {
    if (process.env.EXPO_OS === 'web') {
      return getWebStorage()?.getItem(key) ?? null;
    }

    return secureGet(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.setItem(key, value);

      return;
    }

    await secureSet(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.removeItem(key);

      return;
    }

    await secureRemove(key);
  },
};
