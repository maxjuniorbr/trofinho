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
  const Component = React.forwardRef(function HostComponent(
    props: Props,
    ref: React.ForwardedRef<unknown>,
  ) {
    return React.createElement(name, { ...props, ref }, props.children);
  });
  Component.displayName = name;
  return Component;
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
  CircleCheck: createIcon('CircleCheck'),
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
  Star: createIcon('Star'),
  Archive: createIcon('Archive'),
  ArchiveRestore: createIcon('ArchiveRestore'),
  Package: createIcon('Package'),
  Inbox: createIcon('Inbox'),
  TrendingUp: createIcon('TrendingUp'),
  ArrowDownCircle: createIcon('ArrowDownCircle'),
  PiggyBank: createIcon('PiggyBank'),
  User: createIcon('User'),
  BellOff: createIcon('BellOff'),
  Bell: createIcon('Bell'),
  ShieldCheck: createIcon('ShieldCheck'),
  Shield: createIcon('Shield'),
  Palette: createIcon('Palette'),
  Lock: createIcon('Lock'),
  Settings: createIcon('Settings'),
  ImagePlus: createIcon('ImagePlus'),
  Maximize2: createIcon('Maximize2'),
  RotateCcw: createIcon('RotateCcw'),
  UserCircle: createIcon('UserCircle'),
  House: createIcon('House'),
  Home: createIcon('Home'),
  Mail: createIcon('Mail'),
  EyeOff: createIcon('EyeOff'),
  X: createIcon('X'),
  ArrowRight: createIcon('ArrowRight'),
  Check: createIcon('Check'),
  UserPlus: createIcon('UserPlus'),
  Trash2: createIcon('Trash2'),
  KeyRound: createIcon('KeyRound'),
  Hash: createIcon('Hash'),
  Calendar: createIcon('Calendar'),
  FileText: createIcon('FileText'),
  Zap: createIcon('Zap'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: Props) =>
    React.createElement('LinearGradient', props, children),
}));

vi.mock('expo-image', () => ({
  Image: createHostComponent('Image'),
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn().mockResolvedValue(true),
  getStringAsync: vi.fn().mockResolvedValue(''),
  hasStringAsync: vi.fn().mockResolvedValue(false),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: Props) => children,
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useInfiniteQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isLoading: false, isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
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
  BackHandler: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    removeEventListener: vi.fn(),
  },
  Image: createHostComponent('Image'),
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    dismiss: vi.fn(),
  },
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Modal: createHostComponent('Modal'),
  Platform: { OS: 'android', select: (obj: Record<string, unknown>) => obj.android },
  Pressable: createHostComponent('Pressable'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: {
    create: <T>(styles: T) => styles,
    flatten: flattenStyle,
    absoluteFillObject: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  Switch: createHostComponent('Switch'),
  Text: createHostComponent('Text'),
  TextInput: createHostComponent('TextInput'),
  View: createHostComponent('View'),
}));

vi.mock('react-native-gesture-handler', () => {
  const createPanGesture = () => {
    const gesture = {
      activeOffsetX: vi.fn(() => gesture),
      activeOffsetY: vi.fn(() => gesture),
      onEnd: vi.fn(() => gesture),
      onUpdate: vi.fn(() => gesture),
    };
    return gesture;
  };

  return {
    Gesture: {
      Pan: vi.fn(createPanGesture),
    },
    GestureDetector: ({ children, ...props }: Props) =>
      React.createElement('GestureDetector', props, children),
    GestureHandlerRootView: createHostComponent('GestureHandlerRootView'),
  };
});

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: vi.fn((fn: unknown) => fn),
}));

vi.mock('react-native-reanimated', () => {
  const AnimatedView = createHostComponent('Animated.View');

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
    },
    FadeIn: { duration: vi.fn(() => ({})) },
    FadeOut: { duration: vi.fn(() => ({})) },
    interpolate: vi.fn(
      (_value: number, _inputRange: number[], outputRange: number[]) => outputRange[0] ?? 0,
    ),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown, _config?: unknown, callback?: (finished?: boolean) => void) => {
      callback?.(true);
      return value;
    },
  };
});

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

vi.mock('expo-file-system', () => ({
  File: vi.fn(),
}));

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: { projectId: 'test-project-id' },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

vi.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  getAndroidId: vi.fn(() => 'test-android-id'),
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  init: vi.fn(),
  wrap: (component: unknown) => component,
  ReactNavigationInstrumentation: vi.fn(),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  },
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

export const __APP_ALERT_MOCK__ = {
  showAlert: vi.fn(),
  hideAlert: vi.fn(),
};

vi.mock('@/context/app-alert-context', () => ({
  AppAlertProvider: ({ children }: Props) => children,
  useAppAlert: () => __APP_ALERT_MOCK__,
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
  },
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({ type: 'cancelled' }),
    revokeAccess: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: vi.fn(
    (error: unknown) => error != null && typeof error === 'object' && 'code' in error,
  ),
  isSuccessResponse: vi.fn(
    (response: unknown) =>
      response != null &&
      typeof response === 'object' &&
      'data' in (response as Record<string, unknown>),
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
  __APP_ALERT_MOCK__.showAlert.mockReset();
  __APP_ALERT_MOCK__.hideAlert.mockReset();
  __TEST_THEME_OVERRIDE__.colors = lightColors;
  __TEST_THEME_OVERRIDE__.isDark = false;
  __TEST_THEME_OVERRIDE__.scheme = 'light';
  __TEST_THEME_OVERRIDE__.setScheme = vi.fn();
});
