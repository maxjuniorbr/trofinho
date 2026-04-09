import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminTasksScreen from '../../app/(admin)/tasks/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const adminTasksMock = vi.hoisted(() => ({
  data: undefined as
    | {
        pages: {
          data: {
            id: string;
            titulo: string;
            pontos: number;
            dias_semana: number;
            ativo: boolean;
            created_at: string;
            atribuicoes: { status: string }[];
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
  useFocusEffect: (cb: () => void) => cb(),
}));

vi.mock('@lib/tasks', () => ({
  sortAdminTasks: (tasks: unknown[]) => tasks,
  isRecurring: (dias: number) => dias > 0,
  formatWeekdays: (dias: number) => {
    if (dias === 0) return 'Pontual';
    if (dias === 127) return 'Todos os dias';
    return 'Parcial';
  },
}));

vi.mock('@lib/utils', () => ({
  formatDate: (v: string) => v,
}));

vi.mock('@lib/navigation-feedback', () => ({
  consumeNavigationFeedback: vi.fn().mockReturnValue(null),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminTasks: () => adminTasksMock,
}));

vi.mock('@/hooks/use-footer-items', () => ({
  useAdminFooterItems: () => [],
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (msg: string | null) => msg,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: ({ rightAction, ...props }: Record<string, unknown> & { rightAction?: React.ReactNode }) =>
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

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: Record<string, unknown>) => React.createElement('Badge', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/segmented-bar', () => ({
  SegmentedBar: (props: Record<string, unknown>) => React.createElement('SegmentedBar', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
  ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
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

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    titulo: 'Arrumar quarto',
    pontos: 10,
    dias_semana: 0,
    ativo: true,
    created_at: '2026-04-01T10:00:00Z',
    atribuicoes: [{ status: 'pendente' }],
    ...overrides,
  };
}

describe('AdminTasksScreen', () => {
  beforeEach(() => {
    routerMock.push.mockReset();
    routerMock.back.mockReset();
    adminTasksMock.data = {
      pages: [{ data: [makeTask()], hasMore: false }],
      pageParams: [0],
    };
    adminTasksMock.isLoading = false;
    adminTasksMock.error = null;
    adminTasksMock.refetch.mockReset();
  });

  it('shows empty state when no tasks', () => {
    adminTasksMock.data = { pages: [{ data: [], hasMore: false }], pageParams: [0] };
    const renderer = render(<AdminTasksScreen />);
    const emptyState = renderer.root.findByType('EmptyState' as never);
    expect(emptyState.props.empty).toBe(true);
  });

  it('shows loading state', () => {
    adminTasksMock.isLoading = true;
    adminTasksMock.data = undefined;
    const renderer = render(<AdminTasksScreen />);
    renderer.root.findByType('ListScreenSkeleton' as never);
  });

  it('renders task title and points', () => {
    const renderer = render(<AdminTasksScreen />);
    const text = allText(renderer);
    expect(text).toContain('Arrumar quarto');
    expect(text).toContain('10 pts');
  });

  it('shows badges for assignment statuses', () => {
    adminTasksMock.data = {
      pages: [
        {
          data: [
            makeTask({
              atribuicoes: [
                { status: 'pendente' },
                { status: 'aguardando_validacao' },
                { status: 'aprovada' },
              ],
            }),
          ],
          hasMore: false,
        },
      ],
      pageParams: [0],
    };
    const renderer = render(<AdminTasksScreen />);
    const badges = renderer.root.findAllByType('Badge' as never);
    const labels = badges.map((b) => b.props.label);
    expect(labels).not.toContain('1 pendente');
    expect(labels).toContain('1 validar');
    expect(labels).not.toContain('1 aprovada');
  });

  it('navigates to task detail on press', () => {
    const renderer = render(<AdminTasksScreen />);
    const card = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Ver detalhes da tarefa Arrumar quarto',
    )[0];
    act(() => {
      card.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/tasks/task-1');
  });

  it('navigates to new task screen', () => {
    const renderer = render(<AdminTasksScreen />);
    const addBtn = renderer.root.findByType('HeaderIconButton' as never);
    act(() => {
      addBtn.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/tasks/new');
  });

  it('shows deactivated badge for inactive tasks', () => {
    adminTasksMock.data = {
      pages: [{ data: [makeTask({ ativo: false })], hasMore: false }],
      pageParams: [0],
    };
    const renderer = render(<AdminTasksScreen />);
    const text = allText(renderer);
    expect(text).toContain('Desativada');
  });

  it('shows recurring frequency label', () => {
    adminTasksMock.data = {
      pages: [{ data: [makeTask({ dias_semana: 127 })], hasMore: false }],
      pageParams: [0],
    };
    const renderer = render(<AdminTasksScreen />);
    const text = allText(renderer);
    expect(text).toContain('Todos os dias');
  });
});
