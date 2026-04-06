import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildTasksScreen from '../../app/(child)/tasks/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const focusEffectMock = vi.hoisted(() => ({
  callback: null as null | (() => void),
}));

const childAssignmentsMock = vi.hoisted(() => ({
  data: { pages: [{ data: [] as unknown[], hasMore: false }], pageParams: [0] } as
    | { pages: { data: unknown[]; hasMore: boolean }[]; pageParams: number[] }
    | undefined,
  isLoading: false,
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
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
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
      data.map((item) =>
        React.createElement(
          React.Fragment,
          { key: String((item as { id?: string })?.id ?? crypto.randomUUID()) },
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
  useFocusEffect: (callback: () => void) => {
    focusEffectMock.callback = callback;
  },
}));

vi.mock('@lib/tasks', () => ({
  getAssignmentPoints: (assignment: { pontos_snapshot: number }) => assignment.pontos_snapshot,
}));

vi.mock('@lib/utils', () => ({
  formatDate: (value: string) => value,
}));

vi.mock('@lib/status', () => ({
  getAssignmentStatusColor: () => '#308CE8',
  getAssignmentStatusLabel: (status: string) => status,
}));

vi.mock('@/hooks/queries', () => ({
  useChildAssignments: () => childAssignmentsMock,
  useTasksLiveSync: () => undefined,
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fafafa' },
      brand: { vivid: '#FAC114' },
      text: {
        primary: '#111',
        muted: '#666',
      },
      accent: {
        filho: '#FAC114',
        filhoBg: '#FFF3C4',
      },
      semantic: {
        warningBg: '#FFF3C4',
        warningText: '#7A5200',
      },
    },
  }),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/segmented-bar', () => ({
  SegmentedBar: (props: Record<string, unknown>) => React.createElement('SegmentedBar', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
  ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment-1',
    status: 'pendente',
    pontos_snapshot: 10,
    concluida_em: null,
    validada_em: null,
    created_at: '2026-04-03T10:00:00Z',
    tarefas: {
      titulo: 'Arrumar a cama',
      frequencia: 'unica',
      ativo: true,
    },
    ...overrides,
  };
}

describe('ChildTasksScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    focusEffectMock.callback = null;
    childAssignmentsMock.data = {
      pages: [{ data: [makeAssignment()], hasMore: false }],
      pageParams: [0],
    };
    childAssignmentsMock.isLoading = false;
    childAssignmentsMock.error = null;
    childAssignmentsMock.refetch.mockReset();
  });

  it('refetches the list when the screen regains focus', () => {
    render(<ChildTasksScreen />);

    expect(focusEffectMock.callback).toBeTypeOf('function');

    act(() => {
      focusEffectMock.callback?.();
    });

    expect(childAssignmentsMock.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders inactive pending tasks as unavailable', () => {
    childAssignmentsMock.data = {
      pages: [
        {
          data: [
            makeAssignment({
              tarefas: {
                titulo: 'Arrumar a cama',
                frequencia: 'unica',
                ativo: false,
              },
            }),
          ],
          hasMore: false,
        },
      ],
      pageParams: [0],
    };

    const renderer = render(<ChildTasksScreen />);

    const pressables = renderer.root.findAll((node) => {
      return (node.type as string) === 'Pressable';
    });

    expect(
      renderer.root.findAll(
        (node) => (node.type as string) === 'Text' && node.props.children === 'Desativada',
      ),
    ).toHaveLength(1);
    expect(pressables[0].props.disabled).toBe(true);
    expect(pressables[0].props.accessibilityLabel).toBe('Tarefa Arrumar a cama desativada');
  });
});
