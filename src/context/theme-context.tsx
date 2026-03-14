import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, type ThemeColors } from '@/constants/theme';

const STORE_KEY = 'trofinho_color_scheme';
type ColorScheme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  scheme: ColorScheme;
  setScheme: (s: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [scheme, setSchemeState] = useState<ColorScheme>('system');

  // Load persisted preference once on mount
  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setSchemeState(stored);
      }
    });
  }, []);

  const setScheme = useCallback((s: ColorScheme) => {
    setSchemeState(s);
    SecureStore.setItemAsync(STORE_KEY, s);
  }, []);

  const isDark = useMemo(() => {
    if (scheme === 'system') return systemScheme === 'dark';
    return scheme === 'dark';
  }, [scheme, systemScheme]);

  const colors = (isDark ? darkColors : lightColors) as ThemeColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, isDark, scheme, setScheme }),
    [colors, isDark, scheme, setScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
