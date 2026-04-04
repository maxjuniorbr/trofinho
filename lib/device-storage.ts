import * as SecureStore from 'expo-secure-store';

// O SecureStore limita cada item a 2048 bytes. Valores maiores ficam
// quebrados em partes para suportar sessoes do Supabase com metadados maiores.
const CHUNK_SIZE = 1900; // margem segura abaixo de 2048 bytes

async function secureGet(key: string): Promise<string | null> {
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
    await secureClearChunks(key);
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; ) {
    let end = offset + CHUNK_SIZE;
    while (end > offset && new TextEncoder().encode(value.slice(offset, end)).byteLength > CHUNK_SIZE) {
      end--;
    }
    chunks.push(value.slice(offset, end));
    offset = end;
  }

  await SecureStore.deleteItemAsync(key);
  await secureClearChunks(key);

  // Write count FIRST so a crash mid-write leaves a recoverable state.
  // On read, missing chunks are detected and treated as corruption (returns null).
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
  await Promise.all(
    chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk)),
  );
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
    return secureGet(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureSet(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await secureRemove(key);
  },
};
