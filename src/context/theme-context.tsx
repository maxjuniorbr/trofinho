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

type ThemeProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [currentScheme, setCurrentScheme] = useState<ColorScheme>('system');

  // Load persisted preference once on mount
  useEffect(() => {
    void SecureStore.getItemAsync(STORE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setCurrentScheme(stored);
      }
    });
  }, []);

  const setScheme = useCallback((nextScheme: ColorScheme) => {
    setCurrentScheme(nextScheme);
    void SecureStore.setItemAsync(STORE_KEY, nextScheme);
  }, []);

  const isDark = useMemo(() => {
    if (currentScheme === 'system') {
      return systemScheme === 'dark';
    }

    return currentScheme === 'dark';
  }, [currentScheme, systemScheme]);

  const colors = (isDark ? darkColors : lightColors) as ThemeColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, isDark, scheme: currentScheme, setScheme }),
    [colors, currentScheme, isDark, setScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
