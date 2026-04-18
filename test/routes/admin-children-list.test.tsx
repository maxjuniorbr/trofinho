import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminChildrenScreen from '../../app/(admin)/children/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const childrenMock = vi.hoisted(() => ({
  data: [] as {
    id: string;
    nome: string;
    ativo?: boolean;
    usuario_id?: string | null;
    avatar_url?: string | null;
  }[],
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
  Alert: { alert: vi.fn() },
  RefreshControl: createHostComponent('RefreshControl'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ...props
  }: {
    data: unknown[];
    renderItem: (params: { item: unknown }) => React.ReactNode;
  }) =>
    React.createElement(
      'FlashList',
      props,
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
}));

vi.mock('lucide-react-native', () => ({
  Eye: createHostComponent('Eye'),
  Plus: createHostComponent('Plus'),
  Star: createHostComponent('Star'),
}));

vi.mock('@/hooks/queries', () => ({
  useChildrenList: () => childrenMock,
  useAdminBalances: () => balancesMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    isFetching: false,
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn(),
  }),
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

vi.mock('@/components/ui/skeleton', () => ({
  ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

vi.mock('@/components/children/child-view-sheet', () => ({
  ChildViewSheet: (props: Record<string, unknown>) => React.createElement('ChildViewSheet', props),
}));

vi.mock('@/components/children/child-new-sheet', () => ({
  ChildNewSheet: (props: Record<string, unknown>) => React.createElement('ChildNewSheet', props),
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

describe('AdminChildrenScreen', () => {
  beforeEach(() => {
    routerMock.push.mockReset();
    routerMock.back.mockReset();
    childrenMock.data = [
      { id: 'c1', nome: 'Ana', ativo: true, usuario_id: 'u1', avatar_url: null },
      { id: 'c2', nome: 'Pedro', ativo: true, usuario_id: null, avatar_url: null },
    ];
    childrenMock.isLoading = false;
    childrenMock.error = null;
    balancesMock.data = [
      { filho_id: 'c1', saldo_livre: 100, cofrinho: 50 },
      { filho_id: 'c2', saldo_livre: 0, cofrinho: 0 },
    ];
  });

  it('shows empty state when no children', () => {
    childrenMock.data = [];
    const renderer = render(<AdminChildrenScreen />);
    const emptyState = renderer.root.findByType('EmptyState' as never);
    expect(emptyState.props.empty).toBe(true);
  });

  it('shows loading state', () => {
    childrenMock.isLoading = true;
    const renderer = render(<AdminChildrenScreen />);
    renderer.root.findByType('ListScreenSkeleton' as never);
  });

  it('renders child names', () => {
    const renderer = render(<AdminChildrenScreen />);
    const text = allText(renderer);
    expect(text).toContain('Ana');
    expect(text).toContain('Pedro');
  });

  it('shows linked account status', () => {
    const renderer = render(<AdminChildrenScreen />);
    const text = allText(renderer);
    expect(text).toContain('Conta vinculada');
    expect(text).toContain('Sem conta');
  });

  it('shows balance with star and pts format', () => {
    const renderer = render(<AdminChildrenScreen />);
    const text = allText(renderer);
    expect(text).toContain('150 pts');
    expect(text).toContain('100 livre');
    expect(text).toContain('50 cofrinho');
  });

  it('opens view sheet on eye button press', () => {
    const renderer = render(<AdminChildrenScreen />);
    const eyeBtn = renderer.root.findAll(
      (node) =>
        (node.type as string) === 'HeaderIconButton' &&
        node.props.accessibilityLabel === 'Ver detalhes de Ana',
    )[0];
    act(() => {
      eyeBtn.props.onPress();
    });
    const viewSheet = renderer.root.findByType('ChildViewSheet' as never);
    expect(viewSheet.props.childId).toBe('c1');
  });

  it('opens new child sheet via header button', () => {
    const renderer = render(<AdminChildrenScreen />);
    const addBtn = renderer.root.findAll(
      (node) =>
        (node.type as string) === 'HeaderIconButton' &&
        node.props.accessibilityLabel === 'Cadastrar filho',
    )[0];
    act(() => {
      addBtn.props.onPress();
    });
    const newSheet = renderer.root.findByType('ChildNewSheet' as never);
    expect(newSheet.props.visible).toBe(true);
  });

  it('shows deactivated badge for inactive children', () => {
    childrenMock.data = [
      { id: 'c1', nome: 'Ana', ativo: false, usuario_id: 'u1', avatar_url: null },
    ];
    const renderer = render(<AdminChildrenScreen />);
    const text = allText(renderer);
    expect(text).toContain('Desativado');
  });
});
