import React from 'react';
import { afterEach, vi } from 'vitest';
import { lightColors } from '@/constants/theme';

process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'example-anon-key';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Record<string, unknown> & { children?: React.ReactNode };

function createIcon(name: string) {
  return React.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) =>
    React.createElement(name, { ...props, ref }));
}

function createHostComponent(name: string) {
  return React.forwardRef(function HostComponent(
    props: Props,
    ref: React.ForwardedRef<unknown>
  ) {
    return React.createElement(name, { ...props, ref }, props.children);
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
  User: createIcon('User'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: Props) =>
    React.createElement('LinearGradient', props, children),
}));

class AnimatedValue {
  constructor(private readonly initialValue: number) {}

  interpolate(config: { outputRange: unknown[] }) {
    return config.outputRange[0] ?? this.initialValue;
  }
}

vi.mock('react-native', () => ({
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
}));

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
});
