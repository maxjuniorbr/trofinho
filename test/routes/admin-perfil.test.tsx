import React from 'react';
import {act, create, type ReactTestRenderer} from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileScreen from '../../app/(admin)/perfil';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin' } as Record<string, unknown> | undefined,
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
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles },
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

vi.mock('@lib/notifications', () => ({
  setNotificationPrefs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useCurrentAuthUser: () => authUserMock,
  useNotificationPrefs: () => notifPrefsMock,
  useDeleteAccount: () => deleteAccountMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
  }),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/logout-button', () => ({
  LogoutButton: (props: Record<string, unknown>) => React.createElement('LogoutButton', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
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

describe('ProfileScreen (admin)', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.replace.mockReset();
    alertMock.alert.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
    deleteAccountMock.mutate.mockReset();
    profileMock.data = { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin' };
    profileMock.isLoading = false;
    authUserMock.data = { email: 'max@example.com', avatarUrl: null };
    authUserMock.isLoading = false;
    notifPrefsMock.data = { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true };
    notifPrefsMock.isLoading = false;
  });

  it('shows loading indicator when data is loading', () => {
    profileMock.isLoading = true;
    const renderer = render(<ProfileScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('redirects to login when authUser is null', () => {
    authUserMock.data = undefined;
    render(<ProfileScreen />);
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('renders profile components when data is available', () => {
    const renderer = render(<ProfileScreen />);
    expect(renderer.root.findAllByType('AvatarSection' as never).length).toBe(1);
    expect(renderer.root.findAllByType('PersonalDataCard' as never).length).toBe(1);
    expect(renderer.root.findAllByType('PasswordCard' as never).length).toBe(1);
    expect(renderer.root.findAllByType('ThemeCard' as never).length).toBe(1);
    expect(renderer.root.findAllByType('NotificationCard' as never).length).toBe(1);
  });

  it('renders logout button', () => {
    const renderer = render(<ProfileScreen />);
    const logoutBtn = renderer.root.findAllByType('LogoutButton' as never);
    expect(logoutBtn.length).toBe(1);
  });

  it('calls signOut when logout button is pressed', async () => {
    const renderer = render(<ProfileScreen />);
    const logoutBtn = renderer.root.findByType('LogoutButton' as never);
    await act(async () => {
      await logoutBtn.props.onPress();
    });
    expect(signOutMock).toHaveBeenCalled();
  });

  it('renders delete account button', () => {
    const renderer = render(<ProfileScreen />);
    const deleteBtn = renderer.root
      .findAllByType('Button' as never)
      .find((b) => b.props.label === 'Excluir minha conta');
    expect(deleteBtn).toBeDefined();
  });

  it('shows alert when delete account is pressed', () => {
    const renderer = render(<ProfileScreen />);
    const deleteBtn = renderer.root
      .findAllByType('Button' as never)
      .find((b) => b.props.label === 'Excluir minha conta')!;
    act(() => {
      deleteBtn.props.onPress();
    });
    expect(alertMock.alert).toHaveBeenCalledWith(
      'Excluir conta',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('calls deleteAccount mutation when confirmed', () => {
    const renderer = render(<ProfileScreen />);
    const deleteBtn = renderer.root
      .findAllByType('Button' as never)
      .find((b) => b.props.label === 'Excluir minha conta')!;
    act(() => {
      deleteBtn.props.onPress();
    });

    const buttons = alertMock.alert.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    const destructive = buttons.find((b) => b.text === 'Excluir conta');
    act(() => {
      destructive!.onPress!();
    });
    expect(deleteAccountMock.mutate).toHaveBeenCalled();
  });

  it('hides notification card when prefs are null', () => {
    notifPrefsMock.data = null;
    const renderer = render(<ProfileScreen />);
    const cards = renderer.root.findAllByType('NotificationCard' as never);
    expect(cards.length).toBe(0);
  });
});
