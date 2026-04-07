import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkColors } from '@/constants/theme';

import { __TEST_THEME_OVERRIDE__ } from '../setup';

import AdminHomeScreen from '../../app/(admin)/index';
import ProfileScreen from '../../app/(admin)/perfil';

// --- Hoisted mocks ---

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin', avatarUrl: null } as
    | Record<string, unknown>
    | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const authUserMock = vi.hoisted(() => ({
  data: { email: 'max@example.com', avatarUrl: null } as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const familyMock = vi.hoisted(() => ({
  data: { nome: 'Silva' } as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const childrenMock = vi.hoisted(() => ({
  data: [
    { id: 'c1', nome: 'Ana' },
    { id: 'c2', nome: 'Pedro' },
  ] as { id: string; nome: string }[],
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const balancesMock = vi.hoisted(() => ({
  data: [
    { filho_id: 'c1', saldo_livre: 100, cofrinho: 50 },
    { filho_id: 'c2', saldo_livre: 200, cofrinho: 30 },
  ] as { filho_id: string; saldo_livre: number; cofrinho: number }[],
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const pendingValidationMock = vi.hoisted(() => ({
  data: 0,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const pendingRedemptionMock = vi.hoisted(() => ({
  data: 0,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const notifPrefsMock = vi.hoisted(() => ({
  data: { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true } as Record<string, boolean> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const deleteAccountMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const createHostComponent = vi.hoisted(() => {
  return (name: string) =>
    React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) {
      return React.createElement(name, { ...props, ref }, props.children);
    });
});

vi.mock('react-native', () => ({
  ActivityIndicator: createHostComponent('ActivityIndicator'),
  Alert: alertMock,
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@lib/auth', () => ({
  signOut: signOutMock,
}));

vi.mock('@lib/utils', () => ({
  getGreeting: () => 'Bom dia',
}));

vi.mock('@lib/notifications', () => ({
  isNotificationPermissionDenied: vi.fn().mockResolvedValue(false),
  setNotificationPrefs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useFamily: () => familyMock,
  useChildrenList: () => childrenMock,
  useAdminBalances: () => balancesMock,
  usePendingValidationCount: () => pendingValidationMock,
  usePendingRedemptionCount: () => pendingRedemptionMock,
  useCurrentAuthUser: () => authUserMock,
  useNotificationPrefs: () => notifPrefsMock,
  useDeleteAccount: () => deleteAccountMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn(),
  }),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: Record<string, unknown>) => React.createElement('Badge', props),
}));

vi.mock('@/components/ui/notification-permission-banner', () => ({
  NotificationPermissionBanner: () => React.createElement('NotificationPermissionBanner'),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/logout-button', () => ({
  LogoutButton: (props: Record<string, unknown>) => React.createElement('LogoutButton', props),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/profile/avatar-section', () => ({
  AvatarSection: (props: Record<string, unknown>) => React.createElement('AvatarSection', props),
}));

vi.mock('@/components/profile/personal-data-card', () => ({
  PersonalDataCard: (props: Record<string, unknown>) =>
    React.createElement('PersonalDataCard', props),
}));

vi.mock('@/components/profile/password-card', () => ({
  PasswordCard: (props: Record<string, unknown>) => React.createElement('PasswordCard', props),
}));

vi.mock('@/components/profile/theme-card', () => ({
  ThemeCard: (props: Record<string, unknown>) => React.createElement('ThemeCard', props),
}));

vi.mock('@/components/profile/notification-card', () => ({
  NotificationCard: (props: Record<string, unknown>) =>
    React.createElement('NotificationCard', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

describe('Dark theme rendering', () => {
  beforeEach(() => {
    __TEST_THEME_OVERRIDE__.colors = darkColors;
    __TEST_THEME_OVERRIDE__.isDark = true;
    __TEST_THEME_OVERRIDE__.scheme = 'dark';

    routerMock.push.mockReset();
    routerMock.back.mockReset();
    routerMock.replace.mockReset();
    alertMock.alert.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
    deleteAccountMock.mutate.mockReset();

    profileMock.data = { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin', avatarUrl: null };
    profileMock.isLoading = false;
    profileMock.error = null;
    authUserMock.data = { email: 'max@example.com', avatarUrl: null };
    authUserMock.isLoading = false;
    familyMock.data = { nome: 'Silva' };
    familyMock.isLoading = false;
    childrenMock.data = [
      { id: 'c1', nome: 'Ana' },
      { id: 'c2', nome: 'Pedro' },
    ];
    childrenMock.isLoading = false;
    balancesMock.data = [
      { filho_id: 'c1', saldo_livre: 100, cofrinho: 50 },
      { filho_id: 'c2', saldo_livre: 200, cofrinho: 30 },
    ];
    pendingValidationMock.data = 0;
    pendingRedemptionMock.data = 0;
    notifPrefsMock.data = { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true };
    notifPrefsMock.isLoading = false;
  });

  describe('AdminHomeScreen', () => {
    it('renders without errors in dark mode', () => {
      const renderer = render(<AdminHomeScreen />);
      expect(renderer.root).toBeTruthy();
    });

    it('uses light StatusBar style for dark backgrounds', () => {
      const renderer = render(<AdminHomeScreen />);
      const statusBar = renderer.root.findByType('StatusBar' as never);
      expect(statusBar.props.style).toBe('light');
    });

    it('applies dark canvas background to scroll container', () => {
      const renderer = render(<AdminHomeScreen />);
      const scrollView = renderer.root.findByType('ScrollView' as never);
      expect(scrollView.props.style).toEqual(
        expect.objectContaining({ backgroundColor: darkColors.bg.canvas }),
      );
    });

    it('applies dark surface background to cards', () => {
      const renderer = render(<AdminHomeScreen />);
      const views = renderer.root.findAllByType('View' as never);
      const surfaceViews = views.filter((v) => {
        const style = v.props.style;
        if (Array.isArray(style)) {
          return style.some(
            (s: Record<string, unknown>) =>
              s && typeof s === 'object' && s.backgroundColor === darkColors.bg.surface,
          );
        }
        return style?.backgroundColor === darkColors.bg.surface;
      });
      expect(surfaceViews.length).toBeGreaterThan(0);
    });
  });

  describe('ProfileScreen (admin)', () => {
    it('renders without errors in dark mode', () => {
      const renderer = render(<ProfileScreen />);
      expect(renderer.root).toBeTruthy();
    });

    it('uses light StatusBar style for dark backgrounds', () => {
      const renderer = render(<ProfileScreen />);
      const statusBar = renderer.root.findByType('StatusBar' as never);
      expect(statusBar.props.style).toBe('light');
    });

    it('renders profile components in dark mode', () => {
      const renderer = render(<ProfileScreen />);
      expect(renderer.root.findAllByType('AvatarSection' as never).length).toBe(1);
      expect(renderer.root.findAllByType('PersonalDataCard' as never).length).toBe(1);
      expect(renderer.root.findAllByType('ThemeCard' as never).length).toBe(1);
    });
  });
});
