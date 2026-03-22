import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from '@/constants/theme';
import { deviceStorage } from '@lib/device-storage';

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

function isColorScheme(value: string | null): value is ColorScheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [currentScheme, setCurrentScheme] = useState<ColorScheme>('system');

  useEffect(() => {
    let isMounted = true;

    deviceStorage.getItem(STORE_KEY).then((stored) => {
      if (isMounted && isColorScheme(stored)) {
        setCurrentScheme(stored);
      }
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const setScheme = useCallback((nextScheme: ColorScheme) => {
    setCurrentScheme(nextScheme);
    deviceStorage.setItem(STORE_KEY, nextScheme).catch(() => undefined);
  }, []);

  const isDark = useMemo(() => {
    if (currentScheme === 'system') {
      return systemScheme === 'dark';
    }

    return currentScheme === 'dark';
  }, [currentScheme, systemScheme]);

  const colors: ThemeColors = isDark ? darkColors : lightColors;

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
