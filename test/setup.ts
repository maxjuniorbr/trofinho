import React from 'react';
import { afterEach, vi } from 'vitest';
import { lightColors } from '@/constants/theme';

process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'example-anon-key';
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Record<string, unknown> & { children?: React.ReactNode };

function createIcon(name: string) {
  const Icon = React.forwardRef(function Icon(
    props: Record<string, unknown>,
    ref: React.ForwardedRef<unknown>,
  ) {
    return React.createElement(name, { ...props, ref });
  });
  Icon.displayName = `Icon(${name})`;
  return Icon;
}

function createHostComponent(name: string) {
  return React.forwardRef(function HostComponent(props: Props, ref: React.ForwardedRef<unknown>) {
    return React.createElement(name, { ...props, ref }, props.children);
  });
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, item) => ({
        ...acc,
        ...flattenStyle(item),
      }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

vi.mock('@/constants/assets', () => ({
  mascotImage: 'mascot-mock',
  celebratingImage: 'celebrating-mock',
  emptyImage: 'empty-mock',
}));

vi.mock('react-native-svg', () => {
  const Svg = createHostComponent('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path: createHostComponent('Path'),
    Circle: createHostComponent('Circle'),
    Rect: createHostComponent('Rect'),
    Line: createHostComponent('Line'),
    Polyline: createHostComponent('Polyline'),
    G: createHostComponent('G'),
  };
});

vi.mock('lucide-react-native', () => ({
  AlertCircle: createIcon('AlertCircle'),
  Clock: createIcon('Clock'),
  Eye: createIcon('Eye'),
  CheckCircle2: createIcon('CheckCircle2'),
  XCircle: createIcon('XCircle'),
  AlertTriangle: createIcon('AlertTriangle'),
  TriangleAlert: createIcon('TriangleAlert'),
  Info: createIcon('Info'),
  ClipboardList: createIcon('ClipboardList'),
  Users: createIcon('Users'),
  Wallet: createIcon('Wallet'),
  Gift: createIcon('Gift'),
  Plus: createIcon('Plus'),
  ShoppingBag: createIcon('ShoppingBag'),
  Pencil: createIcon('Pencil'),
  Camera: createIcon('Camera'),
  LogOut: createIcon('LogOut'),
  Sun: createIcon('Sun'),
  Moon: createIcon('Moon'),
  Smartphone: createIcon('Smartphone'),
  ChevronLeft: createIcon('ChevronLeft'),
  ChevronRight: createIcon('ChevronRight'),
  RefreshCw: createIcon('RefreshCw'),
  Trophy: createIcon('Trophy'),
  TrendingUp: createIcon('TrendingUp'),
  ArrowDownCircle: createIcon('ArrowDownCircle'),
  PiggyBank: createIcon('PiggyBank'),
  User: createIcon('User'),
  BellOff: createIcon('BellOff'),
  Bell: createIcon('Bell'),
  ShieldCheck: createIcon('ShieldCheck'),
  Palette: createIcon('Palette'),
  Lock: createIcon('Lock'),
  ImagePlus: createIcon('ImagePlus'),
  Maximize2: createIcon('Maximize2'),
  RotateCcw: createIcon('RotateCcw'),
  UserCircle: createIcon('UserCircle'),
  House: createIcon('House'),
  Mail: createIcon('Mail'),
  EyeOff: createIcon('EyeOff'),
  X: createIcon('X'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: Props) =>
    React.createElement('LinearGradient', props, children),
}));

vi.mock('expo-image', () => ({
  Image: createHostComponent('Image'),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: Props) => children,
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

class AnimatedValue {
  constructor(private readonly initialValue: number) {}

  interpolate(config: { outputRange: unknown[] }) {
    return config.outputRange[0] ?? this.initialValue;
  }
}

vi.mock('react-native', () => ({
  ActivityIndicator: createHostComponent('ActivityIndicator'),
  Alert: { alert: vi.fn() },
  Animated: {
    View: createHostComponent('Animated.View'),
    Value: AnimatedValue,
    parallel: vi.fn(() => ({ start: vi.fn() })),
    spring: vi.fn(() => ({ start: vi.fn() })),
    timing: vi.fn(() => ({ start: vi.fn() })),
  },
  Image: createHostComponent('Image'),
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
  Pressable: createHostComponent('Pressable'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: {
    create: <T>(styles: T) => styles,
    flatten: flattenStyle,
  },
  Text: createHostComponent('Text'),
  TextInput: createHostComponent('TextInput'),
  View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: (props: Record<string, unknown>) => React.createElement('StatusBar', props),
}));

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  wrap: (component: unknown) => component,
  ReactNavigationInstrumentation: vi.fn(),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/**
 * Override this object in `beforeEach` to test dark-mode rendering.
 * Reset happens automatically in the global `afterEach`.
 *
 * Usage:
 *   import { __TEST_THEME_OVERRIDE__ } from '../../test/setup';
 *   import { darkColors } from '@/constants/theme';
 *   beforeEach(() => {
 *     __TEST_THEME_OVERRIDE__.colors = darkColors;
 *     __TEST_THEME_OVERRIDE__.isDark = true;
 *     __TEST_THEME_OVERRIDE__.scheme = 'dark';
 *   });
 */
export const __TEST_THEME_OVERRIDE__: {
  colors: unknown;
  isDark: boolean;
  scheme: 'light' | 'dark' | 'system';
  setScheme: ReturnType<typeof vi.fn>;
} = {
  colors: lightColors,
  isDark: false,
  scheme: 'light',
  setScheme: vi.fn(),
};

vi.mock('@/context/theme-context', () => ({
  useTheme: () => __TEST_THEME_OVERRIDE__,
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  __TEST_THEME_OVERRIDE__.colors = lightColors;
  __TEST_THEME_OVERRIDE__.isDark = false;
  __TEST_THEME_OVERRIDE__.scheme = 'light';
  __TEST_THEME_OVERRIDE__.setScheme = vi.fn();
});
