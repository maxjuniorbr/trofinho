import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildProfileScreen from '../../app/(child)/perfil';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' } as
    | Record<string, unknown>
    | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const authUserMock = vi.hoisted(() => ({
  data: { email: 'joao@example.com', avatarUrl: null } as
    | Record<string, unknown>
    | undefined
    | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const notifPrefsMock = vi.hoisted(() => ({
  data: { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true } as Record<
    string,
    boolean
  > | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteAccountMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

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
  Alert: { alert: vi.fn() },
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Pressable: createHostComponent('Pressable'),
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

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('@lib/auth', () => ({
  signOut: signOutMock,
}));

vi.mock('@lib/notifications', () => ({
  setNotificationPrefs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('lucide-react-native', () => ({
  ChevronRight: createHostComponent('ChevronRight'),
  Info: createHostComponent('Info'),
  Lock: createHostComponent('Lock'),
  User: createHostComponent('User'),
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

vi.mock('@/components/profile/avatar-section', () => ({
  AvatarSection: (props: Record<string, unknown>) => React.createElement('AvatarSection', props),
}));

vi.mock('@/components/profile/personal-data-sheet', () => ({
  PersonalDataSheet: (props: Record<string, unknown>) =>
    React.createElement('PersonalDataSheet', props),
}));

vi.mock('@/components/profile/change-password-sheet', () => ({
  ChangePasswordSheet: (props: Record<string, unknown>) =>
    React.createElement('ChangePasswordSheet', props),
}));

vi.mock('@/components/profile/theme-card', () => ({
  ThemeCard: (props: Record<string, unknown>) => React.createElement('ThemeCard', props),
}));

vi.mock('@/components/profile/notification-card', () => ({
  NotificationCard: (props: Record<string, unknown>) =>
    React.createElement('NotificationCard', props),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fff', muted: '#eee' },
      accent: { filho: '#3366CC' },
      border: { subtle: '#ddd' },
      text: {
        primary: '#111',
        secondary: '#555',
        muted: '#777',
      },
    },
  }),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function profileBlockMarkers(renderer: ReactTestRenderer): string[] {
  const markers: string[] = [];
  renderer.root.findAll((node) => {
    if (node.type === 'AvatarSection') markers.push('usuario');
    if (node.type === 'ThemeCard') markers.push('aparencia');
    if (node.type === 'NotificationCard') markers.push('notificacoes');
    if (node.type === 'Text') {
      if (node.props.children === 'Dados pessoais') markers.push('dados');
      if (node.props.children === 'Segurança') markers.push('seguranca');
      if (node.props.children === 'Sobre') markers.push('sobre');
    }
    return false;
  });
  return markers;
}

describe('ChildProfileScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.replace.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
    profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' };
    profileMock.isLoading = false;
    authUserMock.data = { email: 'joao@example.com', avatarUrl: null };
    authUserMock.isLoading = false;
    notifPrefsMock.data = { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true };
    notifPrefsMock.isLoading = false;
  });

  it('shows loading indicator when loading', () => {
    profileMock.isLoading = true;
    const renderer = render(<ChildProfileScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('redirects to login when authUser is null', () => {
    authUserMock.data = null;
    render(<ChildProfileScreen />);
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('renders avatar section', () => {
    const renderer = render(<ChildProfileScreen />);
    const avatar = renderer.root.findByType('AvatarSection' as never);
    expect(avatar.props.name).toBe('João');
    expect(avatar.props.email).toBe('joao@example.com');
    expect(avatar.props.role).toBe('filho');
  });

  it('renders theme card', () => {
    const renderer = render(<ChildProfileScreen />);
    const themeCard = renderer.root.findByType('ThemeCard' as never);
    expect(themeCard.props.role).toBe('filho');
  });

  it('renders notification card when prefs available', () => {
    const renderer = render(<ChildProfileScreen />);
    const card = renderer.root.findAllByType('NotificationCard' as never);
    expect(card.length).toBe(1);
    expect(card[0].props.role).toBe('filho');
  });

  it('hides notification card when prefs are null', () => {
    notifPrefsMock.data = null;
    const renderer = render(<ChildProfileScreen />);
    const cards = renderer.root.findAllByType('NotificationCard' as never);
    expect(cards.length).toBe(0);
  });

  it('renders logout button', () => {
    const renderer = render(<ChildProfileScreen />);
    const logoutBtn = renderer.root.findByType('LogoutButton' as never);
    expect(logoutBtn).toBeDefined();
  });

  it('calls signOut when logout button is pressed', async () => {
    const renderer = render(<ChildProfileScreen />);
    const logoutBtn = renderer.root.findByType('LogoutButton' as never);
    await act(async () => {
      await logoutBtn.props.onPress();
    });
    expect(signOutMock).toHaveBeenCalled();
  });

  it('renders personal data and password sheets', () => {
    const renderer = render(<ChildProfileScreen />);
    const personalData = renderer.root.findAllByType('PersonalDataSheet' as never);
    const password = renderer.root.findAllByType('ChangePasswordSheet' as never);
    expect(personalData.length).toBe(1);
    expect(password.length).toBe(1);
  });

  it('renders profile blocks in the requested child order', () => {
    const renderer = render(<ChildProfileScreen />);
    expect(profileBlockMarkers(renderer)).toEqual([
      'usuario',
      'aparencia',
      'notificacoes',
      'dados',
      'seguranca',
      'sobre',
    ]);
  });

  it('renders screen header with correct title', () => {
    const renderer = render(<ChildProfileScreen />);
    const header = renderer.root.findByType('ScreenHeader' as never);
    expect(header.props.title).toBe('Meu Perfil');
    expect(header.props.role).toBe('filho');
  });

  it('renders delete account button', () => {
    const renderer = render(<ChildProfileScreen />);
    const buttons = renderer.root.findAllByType('Button' as never);
    const deleteButton = buttons.find((b) => b.props.label === 'Excluir minha conta');
    expect(deleteButton).toBeDefined();
    expect(deleteButton!.props.variant).toBe('danger');
    expect(deleteButton!.props.accessibilityLabel).toBe('Excluir minha conta');
  });

  it('renders screen header with back button', () => {
    const renderer = render(<ChildProfileScreen />);
    const header = renderer.root.findByType('ScreenHeader' as never);
    expect(header.props.onBack).toBeDefined();
    act(() => {
      header.props.onBack();
    });
    expect(routerMock.back).toHaveBeenCalled();
  });
});
