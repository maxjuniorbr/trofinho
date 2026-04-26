import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
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
  data: { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin' } as
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

const notifPrefsMock = vi.hoisted(() => ({
  data: { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true } as Record<
    string,
    boolean
  > | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const deleteAccountMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const childrenListMock = vi.hoisted(() => ({
  data: [] as Array<{ id: string; nome: string; ativo: boolean; avatar_url: string | null }>,
}));

const startImpersonationMock = vi.hoisted(() => vi.fn());

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

vi.mock('@lib/auth', () => ({
  signOut: signOutMock,
}));

vi.mock('@lib/notifications', () => ({
  setNotificationPrefs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useFamily: () => familyMock,
  useCurrentAuthUser: () => authUserMock,
  useNotificationPrefs: () => notifPrefsMock,
  useDeleteAccount: () => deleteAccountMock,
  useChildrenList: () => childrenListMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
  }),
}));

vi.mock('@/context/impersonation-context', () => ({
  useImpersonation: () => ({
    impersonating: null,
    startImpersonation: startImpersonationMock,
    stopImpersonation: vi.fn(),
  }),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/hooks/use-footer-items', () => ({
  useAdminFooterItems: () => [],
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
  FOOTER_BAR_HEIGHT: 56,
  HomeFooterBar: () => React.createElement('HomeFooterBar'),
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

vi.mock('lucide-react-native', () => ({
  ChevronRight: createHostComponent('ChevronRight'),
  Eye: createHostComponent('Eye'),
  Info: createHostComponent('Info'),
  Lock: createHostComponent('Lock'),
  User: createHostComponent('User'),
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

vi.mock('@/components/profile/child-selection-sheet', () => ({
  ChildSelectionSheet: (props: Record<string, unknown>) =>
    React.createElement('ChildSelectionSheet', props),
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

function profileBlockMarkers(renderer: ReactTestRenderer): string[] {
  const markers: string[] = [];
  renderer.root.findAll((node) => {
    if (node.type === 'AvatarSection') markers.push('usuario');
    if (node.type === 'ThemeCard') markers.push('aparencia');
    if (node.type === 'NotificationCard') markers.push('notificacoes');
    if (node.type === 'Text') {
      if (node.props.children === 'Dados pessoais') markers.push('dados');
      if (node.props.children === 'Segurança') markers.push('seguranca');
      if (node.props.children === 'Ferramentas') markers.push('ferramentas');
      if (node.props.children === 'Sobre') markers.push('sobre');
    }
    return false;
  });
  return markers;
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
    familyMock.data = { nome: 'Silva' };
    familyMock.isLoading = false;
    notifPrefsMock.data = { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true };
    notifPrefsMock.isLoading = false;
    childrenListMock.data = [];
    startImpersonationMock.mockReset();
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
    const avatar = renderer.root.findByType('AvatarSection' as never);
    expect(avatar.props.name).toBe('Família Silva');
    expect(avatar.props.email).toBe('max@example.com');
    expect(renderer.root.findAllByType('PersonalDataSheet' as never).length).toBe(1);
    expect(renderer.root.findAllByType('ThemeCard' as never).length).toBe(1);
    expect(renderer.root.findAllByType('NotificationCard' as never).length).toBe(1);
    expect(renderer.root.findAllByType('ChangePasswordSheet' as never).length).toBe(1);
  });

  it('renders profile blocks in the requested admin order', () => {
    const renderer = render(<ProfileScreen />);
    expect(profileBlockMarkers(renderer)).toEqual([
      'usuario',
      'aparencia',
      'notificacoes',
      'dados',
      'seguranca',
      'ferramentas',
      'sobre',
    ]);
  });

  it('opens profile sheets from personal data and security rows', () => {
    const renderer = render(<ProfileScreen />);
    const personalDataSheet = renderer.root.findByType('PersonalDataSheet' as never);
    const passwordSheet = renderer.root.findByType('ChangePasswordSheet' as never);

    expect(personalDataSheet.props.visible).toBe(false);
    expect(passwordSheet.props.visible).toBe(false);

    const personalDataRow = renderer.root
      .findAllByType('Pressable' as never)
      .find((node) => node.props.accessibilityLabel === 'Alterar dados pessoais')!;
    const passwordRow = renderer.root
      .findAllByType('Pressable' as never)
      .find((node) => node.props.accessibilityLabel === 'Alterar senha')!;

    act(() => {
      personalDataRow.props.onPress();
    });
    expect(renderer.root.findByType('PersonalDataSheet' as never).props.visible).toBe(true);

    act(() => {
      passwordRow.props.onPress();
    });
    expect(renderer.root.findByType('ChangePasswordSheet' as never).props.visible).toBe(true);
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
      .findAllByType('Pressable' as never)
      .find((b) => b.props.accessibilityLabel === 'Excluir minha conta');
    expect(deleteBtn).toBeDefined();
  });

  it('shows alert when delete account is pressed', () => {
    const renderer = render(<ProfileScreen />);
    const deleteBtn = renderer.root
      .findAllByType('Pressable' as never)
      .find((b) => b.props.accessibilityLabel === 'Excluir minha conta')!;
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
      .findAllByType('Pressable' as never)
      .find((b) => b.props.accessibilityLabel === 'Excluir minha conta')!;
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

  it('enables "Ver app como filho" menu item when there are active children', () => {
    childrenListMock.data = [
      { id: 'c1', nome: 'Ana', ativo: true, avatar_url: null },
    ];
    const renderer = render(<ProfileScreen />);
    const menuRow = renderer.root
      .findAllByType('Pressable' as never)
      .find((node) => node.props.accessibilityLabel === 'Ver app como filho')!;
    expect(menuRow).toBeDefined();
    expect(menuRow.props.accessibilityState).toEqual({ disabled: false });
    expect(menuRow.props.disabled).toBe(false);
  });

  it('disables "Ver app como filho" with "Sem filhos" hint when no active children', () => {
    childrenListMock.data = [];
    const renderer = render(<ProfileScreen />);
    const menuRow = renderer.root
      .findAllByType('Pressable' as never)
      .find((node) => node.props.accessibilityLabel === 'Ver app como filho')!;
    expect(menuRow).toBeDefined();
    expect(menuRow.props.accessibilityState).toEqual({ disabled: true });
    expect(menuRow.props.disabled).toBe(true);

    // Verify "Sem filhos" hint badge is rendered inside the menu row
    const hintTexts = menuRow.findAll(
      (node) => node.type === 'Text' && node.props.children === 'Sem filhos',
    );
    expect(hintTexts.length).toBe(1);
  });

  it('opens ChildSelectionSheet when "Ver app como filho" is pressed', () => {
    childrenListMock.data = [
      { id: 'c1', nome: 'Ana', ativo: true, avatar_url: null },
    ];
    const renderer = render(<ProfileScreen />);

    // Initially the sheet should not be visible
    const sheetBefore = renderer.root.findByType('ChildSelectionSheet' as never);
    expect(sheetBefore.props.visible).toBe(false);

    // Press the menu item
    const menuRow = renderer.root
      .findAllByType('Pressable' as never)
      .find((node) => node.props.accessibilityLabel === 'Ver app como filho')!;
    act(() => {
      menuRow.props.onPress();
    });

    // Now the sheet should be visible
    const sheetAfter = renderer.root.findByType('ChildSelectionSheet' as never);
    expect(sheetAfter.props.visible).toBe(true);
  });
});
