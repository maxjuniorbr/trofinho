import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BalancesAdminScreen from '../../app/(admin)/balances/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const balancesMock = vi.hoisted(() => ({
  data: undefined as Record<string, unknown>[] | undefined,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn().mockResolvedValue(undefined),
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
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
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

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListEmptyComponent,
    ...props
  }: {
    data: Record<string, unknown>[];
    renderItem: (info: { item: Record<string, unknown> }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'FlashList',
      props,
      data && data.length > 0
        ? data.map((item) =>
            React.createElement(
              React.Fragment,
              { key: item.filho_id as string },
              renderItem({ item }),
            ),
          )
        : ListEmptyComponent,
    ),
}));

vi.mock('lucide-react-native', () => ({
  ChevronLeft: (props: Record<string, unknown>) => React.createElement('ChevronLeft', props),
  ChevronRight: (props: Record<string, unknown>) => React.createElement('ChevronRight', props),
  TrendingUp: (props: Record<string, unknown>) => React.createElement('TrendingUp', props),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

vi.mock('@lib/safe-area', () => ({
  getSafeTopPadding: () => 0,
  getSafeHorizontalPadding: () => ({}),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminBalances: () => balancesMock,
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      brand: { vivid: '#000' },
      bg: { surface: '#fff', canvas: '#fff' },
      border: { subtle: '#eee' },
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      accent: { admin: '#FAC114', filho: '#FAC114' },
      semantic: { warningText: '#f90', success: '#20C55D' },
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

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => (node.type as string) === 'Text')
    .map((node) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (typeof children === 'number') return String(children);
      if (Array.isArray(children))
        return children
          .filter((c) => typeof c === 'string' || typeof c === 'number')
          .map(String)
          .join('');
      return '';
    })
    .join(' ');
}

describe('BalancesAdminScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    balancesMock.data = [
      {
        filho_id: 'c1',
        saldo_livre: 100,
        cofrinho: 50,
        indice_valorizacao: 5,
        periodo_valorizacao: 'mensal',
        filhos: { nome: 'Alice', ativo: true, avatar_url: null },
      },
      {
        filho_id: 'c2',
        saldo_livre: 0,
        cofrinho: 0,
        indice_valorizacao: 0,
        periodo_valorizacao: 'mensal',
        filhos: { nome: 'Bob', ativo: false, avatar_url: null },
      },
    ];
    balancesMock.isLoading = false;
    balancesMock.isFetching = false;
  });

  it('shows loading empty state when loading', () => {
    balancesMock.isLoading = true;
    const renderer = render(<BalancesAdminScreen />);
    const empty = renderer.root.findByType('EmptyState' as never);
    expect(empty.props.loading).toBe(true);
  });

  it('renders empty state when no balances', () => {
    balancesMock.data = [];
    const renderer = render(<BalancesAdminScreen />);
    const empty = renderer.root.findByType('EmptyState' as never);
    expect(empty.props.empty).toBe(true);
  });

  it('renders child names', () => {
    const renderer = render(<BalancesAdminScreen />);
    const text = allText(renderer);
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
  });

  it('renders balance amounts', () => {
    const renderer = render(<BalancesAdminScreen />);
    const text = allText(renderer);
    expect(text).toContain('100 livre');
    expect(text).toContain('50 cofrinho');
  });

  it('shows deactivated badge for inactive child', () => {
    const renderer = render(<BalancesAdminScreen />);
    const text = allText(renderer);
    expect(text).toContain('Desativado');
  });

  it('shows appreciation info when positive', () => {
    const renderer = render(<BalancesAdminScreen />);
    const text = allText(renderer);
    expect(text).toContain('5% ao mês');
  });

  it('navigates to child balance detail on press', () => {
    const renderer = render(<BalancesAdminScreen />);
    const aliceCard = renderer.root.findAll((node) =>
      node.props.accessibilityLabel?.includes('Alice'),
    )[0];
    act(() => {
      aliceCard.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/(admin)/balances/[filho_id]',
      params: { filho_id: 'c1', nome: 'Alice' },
    });
  });

  it('renders header with title and total points', () => {
    const renderer = render(<BalancesAdminScreen />);
    const text = allText(renderer);
    expect(text).toContain('Saldos');
    expect(text).toContain('pts no total');
  });
});
