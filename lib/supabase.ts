import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY não configuradas. ' +
      'Copie .env.example para .env.local e preencha os valores.'
  );
}

function getWebStorage(): Storage | null {
  if (process.env.EXPO_OS !== 'web') return null;

  const webWindow = globalThis.window;
  return webWindow ? webWindow.localStorage : null;
}

const SecureStoreAdapter = {
  getItem: (key: string) => {
    if (process.env.EXPO_OS === 'web') {
      return Promise.resolve(getWebStorage()?.getItem(key) ?? null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (process.env.EXPO_OS === 'web') {
      getWebStorage()?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
