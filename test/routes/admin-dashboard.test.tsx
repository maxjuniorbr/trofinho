import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminHomeScreen from '../../app/(admin)/index';

// --- Hoisted mocks ---

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'Max', familia_id: 'fam-1', papel: 'admin', avatarUrl: null } as
    | Record<string, unknown>
    | undefined,
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
  data: [] as { id: string; nome: string; ativo?: boolean }[],
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const balancesMock = vi.hoisted(() => ({
  data: [] as { filho_id: string; saldo_livre: number; cofrinho: number }[],
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
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
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

vi.mock('@lib/utils', () => ({
  getGreeting: () => 'Bom dia',
}));

vi.mock('@lib/notifications', () => ({
  isNotificationPermissionDenied: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useFamily: () => familyMock,
  useChildrenList: () => childrenMock,
  useAdminBalances: () => balancesMock,
  usePendingValidationCount: () => pendingValidationMock,
  usePendingRedemptionCount: () => pendingRedemptionMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn(),
  }),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
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

vi.mock('@/components/ui/skeleton', () => ({
  AdminHomeScreenSkeleton: () => React.createElement('AdminHomeScreenSkeleton'),
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
  FOOTER_BAR_HEIGHT: 56,
  HomeFooterBar: ({
    items,
    onNavigate,
  }: {
    items: { label: string; rota: string; badge?: number }[];
    onNavigate: (rota: string) => void;
  }) =>
    React.createElement(
      'HomeFooterBar',
      null,
      ...items.map((item) =>
        React.createElement(
          'Pressable',
          { key: item.rota, accessibilityLabel: item.label, onPress: () => onNavigate(item.rota) },
          React.createElement('Text', null, item.label),
          item.badge ? React.createElement('Text', null, String(item.badge)) : null,
        ),
      ),
    ),
}));

vi.mock('@/hooks/use-footer-items', () => ({
  useAdminFooterItems: () => [
    { icon: 'House', label: 'Início', rota: 'index' },
    {
      icon: 'ClipboardList',
      label: 'Tarefas',
      rota: '/(admin)/tasks',
      badge: pendingValidationMock.data || undefined,
    },
    { icon: 'Gift', label: 'Prêmios', rota: '/(admin)/prizes' },
    {
      icon: 'ShoppingBag',
      label: 'Resgates',
      rota: '/(admin)/redemptions',
      badge: pendingRedemptionMock.data || undefined,
    },
    { icon: 'User', label: 'Perfil', rota: '/(admin)/perfil' },
  ],
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => (node.type as string) === 'Text')
    .map((node) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string').join('');
      return '';
    })
    .join(' ');
}

describe('AdminHomeScreen', () => {
  beforeEach(() => {
    routerMock.push.mockReset();
    profileMock.data = {
      id: 'u1',
      nome: 'Max',
      familia_id: 'fam-1',
      papel: 'admin',
      avatarUrl: null,
    };
    profileMock.isLoading = false;
    profileMock.error = null;
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
  });

  it('shows loading indicator when data is loading', () => {
    profileMock.isLoading = true;
    const renderer = render(<AdminHomeScreen />);
    const skeleton = renderer.root.findAllByType('AdminHomeScreenSkeleton' as never);
    expect(skeleton.length).toBeGreaterThan(0);
  });

  it('renders greeting and admin name', () => {
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Bom dia');
    expect(text).toContain('Família Silva');
  });

  it('renders children list with balances', () => {
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Ana');
    expect(text).toContain('Pedro');
  });

  it('limits the dashboard children cards to the first three children', () => {
    childrenMock.data = [
      { id: 'c1', nome: 'Ana' },
      { id: 'c2', nome: 'Pedro' },
      { id: 'c3', nome: 'Bia' },
      { id: 'c4', nome: 'Lia' },
    ];

    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);

    expect(text).toContain('Ana');
    expect(text).toContain('Pedro');
    expect(text).toContain('Bia');
    expect(text).not.toContain('Lia');
  });

  it('renders empty children state with management actions', () => {
    childrenMock.data = [];
    balancesMock.data = [];

    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);

    expect(text).toContain('Filhos');
    expect(text).toContain('Gerenciar');
    expect(text).toContain('Nenhum filho cadastrado');
    expect(text).toContain('Adicionar filho');

    const manageButton = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Gerenciar filhos',
    )[0];
    const addButton = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Adicionar filho',
    )[0];

    act(() => {
      manageButton.props.onPress();
      addButton.props.onPress();
    });

    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/children');
    expect(routerMock.push).toHaveBeenCalledTimes(2);
  });

  it('renders family summary card with totals', () => {
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('RESUMO DA FAMÍLIA');
    expect(text).toContain('LIVRE');
    expect(text).toContain('COFRINHO');
  });

  it('renders footer bar actions', () => {
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Início');
    expect(text).toContain('Tarefas');
    expect(text).toContain('Prêmios');
    expect(text).toContain('Resgates');
    expect(text).toContain('Perfil');
  });

  it('navigates to notifications when bell is pressed', () => {
    const renderer = render(<AdminHomeScreen />);
    const bellButton = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Notificações',
    )[0];
    act(() => {
      bellButton.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/notifications');
  });

  it('navigates to balance screen when pressing child card', () => {
    const renderer = render(<AdminHomeScreen />);
    const childCards = renderer.root.findAll((node) =>
      node.props.accessibilityLabel?.includes('Ana'),
    );
    expect(childCards.length).toBeGreaterThan(0);
    act(() => {
      childCards[0].props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/(admin)/balances/[filho_id]',
      params: { filho_id: 'c1', nome: 'Ana' },
    });
  });

  it('shows pending count badge on tasks quick action when there are pending validations', () => {
    pendingValidationMock.data = 3;
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('3');
    expect(text).not.toContain('Pendentes');
  });

  it('does not show pending count when no pending validations', () => {
    pendingValidationMock.data = 0;
    const renderer = render(<AdminHomeScreen />);
    const text = allText(renderer);
    expect(text).not.toContain('Pendentes');
  });

  it('navigates to quick action routes', () => {
    const renderer = render(<AdminHomeScreen />);
    const tarefasButton = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Tarefas',
    )[0];
    act(() => {
      tarefasButton.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/tasks');
  });
});
