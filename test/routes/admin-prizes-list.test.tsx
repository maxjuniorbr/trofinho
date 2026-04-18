import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPrizesScreen from '../../app/(admin)/prizes/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const prizesMock = vi.hoisted(() => ({
  data: undefined as
    | {
        pages: {
          data: {
            id: string;
            nome: string;
            descricao: string | null;
            custo_pontos: number;
            ativo: boolean;
          }[];
          hasMore: boolean;
        }[];
        pageParams: number[];
      }
    | undefined,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
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

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ...props
  }: {
    data: unknown[];
    renderItem: (params: { item: unknown }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
  }) =>
    React.createElement(
      'FlashList',
      props,
      ListHeaderComponent,
      data.map((item, idx) =>
        React.createElement(
          React.Fragment,
          { key: String((item as { id?: string })?.id ?? idx) },
          renderItem({ item }),
        ),
      ),
    ),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
  useFocusEffect: (cb: () => void) => cb(),
}));

vi.mock('@lib/navigation-feedback', () => ({
  consumeNavigationFeedback: vi.fn().mockReturnValue(null),
}));

vi.mock('@/hooks/queries', () => ({
  usePrizes: () => prizesMock,
}));

vi.mock('@/hooks/use-footer-items', () => ({
  useAdminFooterItems: () => [],
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (msg: string | null) => msg,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: ({
    rightAction,
    ...props
  }: Record<string, unknown> & { rightAction?: React.ReactNode }) =>
    React.createElement('ScreenHeader', props, rightAction),
  HeaderIconButton: (props: Record<string, unknown>) =>
    React.createElement('HeaderIconButton', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
  ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

vi.mock('@/components/ui/skeleton', () => ({
  ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
  FOOTER_BAR_HEIGHT: 56,
  HomeFooterBar: () => React.createElement('HomeFooterBar'),
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

function makePrize(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    nome: 'Sorvete',
    descricao: 'Um sorvete delicioso',
    custo_pontos: 50,
    ativo: true,
    ...overrides,
  };
}

describe('AdminPrizesScreen', () => {
  beforeEach(() => {
    routerMock.push.mockReset();
    routerMock.back.mockReset();
    prizesMock.data = {
      pages: [{ data: [makePrize()], hasMore: false }],
      pageParams: [0],
    };
    prizesMock.isLoading = false;
    prizesMock.error = null;
    prizesMock.refetch.mockReset();
  });

  it('shows empty state when no prizes', () => {
    prizesMock.data = { pages: [{ data: [], hasMore: false }], pageParams: [0] };
    const renderer = render(<AdminPrizesScreen />);
    const emptyState = renderer.root.findByType('EmptyState' as never);
    expect(emptyState).toBeDefined();
  });

  it('shows loading state', () => {
    prizesMock.isLoading = true;
    prizesMock.data = undefined;
    const renderer = render(<AdminPrizesScreen />);
    const skeleton = renderer.root.findByType('ListScreenSkeleton' as never);
    expect(skeleton).toBeDefined();
  });

  it('renders prize name, description and cost', () => {
    const renderer = render(<AdminPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('Sorvete');
    expect(text).toContain('Um sorvete delicioso');
    expect(text).toContain('50 pts');
  });

  it('navigates to prize detail on press', () => {
    const renderer = render(<AdminPrizesScreen />);
    const card = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Sorvete, 50 pontos',
    )[0];
    act(() => {
      card.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/prizes/p1');
  });

  it('navigates to new prize screen', () => {
    const renderer = render(<AdminPrizesScreen />);
    const addBtn = renderer.root.findAll(
      (node) =>
        (node.type as string) === 'HeaderIconButton' &&
        node.props.accessibilityLabel === 'Criar pr\u00eamio',
    )[0];
    act(() => {
      addBtn.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/prizes/new');
  });

  it('shows inactive badge for inactive prizes', () => {
    prizesMock.data = {
      pages: [{ data: [makePrize({ ativo: false })], hasMore: false }],
      pageParams: [0],
    };
    const renderer = render(<AdminPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('inativo');
  });

  it('shows active/inactive count summary', () => {
    prizesMock.data = {
      pages: [
        {
          data: [makePrize({ id: 'p1', ativo: true }), makePrize({ id: 'p2', ativo: false })],
          hasMore: false,
        },
      ],
      pageParams: [0],
    };
    const renderer = render(<AdminPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('1 ativo');
    expect(text).toContain('1 inativo');
  });
});
