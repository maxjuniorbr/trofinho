import * as SecureStore from 'expo-secure-store';

function getWebStorage(): Storage | null {
  if (process.env.EXPO_OS !== 'web') return null;

  const webWindow = globalThis.window;
  return webWindow ? webWindow.localStorage : null;
}

export const deviceStorage = {
  async getItem(key: string): Promise<string | null> {
    if (process.env.EXPO_OS === 'web') {
      return getWebStorage()?.getItem(key) ?? null;
    }

    return await SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.setItem(key, value);

      return;
    }

    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.removeItem(key);

      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};
