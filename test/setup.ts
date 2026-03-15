import React from 'react';
import { afterEach, vi } from 'vitest';
import { lightColors } from '@/constants/theme';

process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'example-anon-key';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('LinearGradient', props, children as React.ReactNode),
}));

vi.mock('react-native', () => {
  function createHostComponent(name: string) {
    return React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>
    ) {
      return React.createElement(name, { ...props, ref }, props.children as React.ReactNode);
    });
  }

  function flattenStyle(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>((acc, item) => ({
        ...acc,
        ...flattenStyle(item),
      }), {});
    }

    if (style && typeof style === 'object') {
      return style as Record<string, unknown>;
    }

    return {};
  }

  class AnimatedValue {
    constructor(private readonly initialValue: number) {}

    interpolate(config: { outputRange: unknown[] }) {
      return config.outputRange[0] ?? this.initialValue;
    }
  }

  return {
    ActivityIndicator: createHostComponent('ActivityIndicator'),
    Animated: {
      View: createHostComponent('Animated.View'),
      Value: AnimatedValue,
      parallel: vi.fn(() => ({ start: vi.fn() })),
      spring: vi.fn(() => ({})),
      timing: vi.fn(() => ({})),
    },
    Image: createHostComponent('Image'),
    KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
    Pressable: createHostComponent('Pressable'),
    ScrollView: createHostComponent('ScrollView'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: flattenStyle,
    },
    Text: createHostComponent('Text'),
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
  };
});

vi.mock('expo-status-bar', () => ({
  StatusBar: (props: Record<string, unknown>) => React.createElement('StatusBar', props),
}));

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: lightColors,
    isDark: false,
    scheme: 'light',
    setScheme: vi.fn(),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
