import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskDetailAdminScreen from '../../app/(admin)/tasks/[id]';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
}));

const taskDetailMock = vi.hoisted(() => ({
  data: {
    id: 'task-1',
    titulo: 'Arrumar o quarto',
    descricao: 'Guardar brinquedos e roupas.',
    pontos: 20,
    dias_semana: 127,
    exige_evidencia: false,
    ativo: true,
    arquivada_em: null,
    atribuicoes: [],
  } as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  isFetching: false,
}));

const assignmentsMock = vi.hoisted(() => ({
  data: { pages: [{ data: [], hasMore: false }], pageParams: [0] } as {
    pages: { data: Record<string, unknown>[]; hasMore: boolean }[];
    pageParams: number[];
  },
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  isFetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
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
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
    ...props
  }: {
    data: unknown[];
    renderItem: (params: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) =>
    React.createElement(
      'FlashList',
      props,
      ListHeaderComponent,
      ...data.map((item, index) =>
        React.createElement(
          React.Fragment,
          { key: String((item as { id?: string })?.id ?? index) },
          renderItem({ item, index }),
        ),
      ),
      ListFooterComponent,
    ),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'task-1' }),
  useRouter: () => routerMock,
}));

vi.mock('lucide-react-native', () => ({
  Camera: createHostComponent('Camera'),
  CheckCircle2: createHostComponent('CheckCircle2'),
  Clock: createHostComponent('Clock'),
  RefreshCw: createHostComponent('RefreshCw'),
  XCircle: createHostComponent('XCircle'),
}));

vi.mock('@lib/tasks', () => ({
  formatWeekdays: () => 'Todos os dias',
  isRecurring: () => true,
}));

vi.mock('@lib/status', () => ({
  getAssignmentStatusLabel: (status: string) => status,
  getAssignmentStatusTone: () => ({ background: '#fff', foreground: '#000' }),
}));

vi.mock('@lib/api-error', () => ({
  localizeRpcError: (message: string) => message,
}));

vi.mock('@lib/navigation-feedback', () => ({
  consumeNavigationFeedback: () => null,
}));

vi.mock('@lib/utils', () => ({
  formatDate: (value: string) => value,
  toDateString: () => '2026-04-19',
}));

vi.mock('@/hooks/queries', () => ({
  useTaskAssignments: () => assignmentsMock,
  useTaskDetail: () => taskDetailMock,
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (message: string | null) => message,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown> & { rightAction?: React.ReactNode }) =>
    React.createElement('ScreenHeader', props, props.rightAction),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
  ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/tasks/task-points-pill', () => ({
  TaskPointsPill: (props: Record<string, unknown>) => React.createElement('TaskPointsPill', props),
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
      if (Array.isArray(children)) {
        return children
          .filter((child) => typeof child === 'string' || typeof child === 'number')
          .map(String)
          .join('');
      }
      return '';
    })
    .join(' ');
}

describe('TaskDetailAdminScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    taskDetailMock.data = {
      id: 'task-1',
      titulo: 'Arrumar o quarto',
      descricao: 'Guardar brinquedos e roupas.',
      pontos: 20,
      dias_semana: 127,
      exige_evidencia: false,
      ativo: true,
      arquivada_em: null,
      atribuicoes: [],
    };
    taskDetailMock.isLoading = false;
    taskDetailMock.error = null;
    taskDetailMock.refetch.mockReset();
    assignmentsMock.data = { pages: [{ data: [], hasMore: false }], pageParams: [0] };
    assignmentsMock.error = null;
    assignmentsMock.isLoading = false;
  });

  it('renders task details without duplicated action controls', () => {
    const renderer = render(<TaskDetailAdminScreen />);

    const header = renderer.root.findByType('ScreenHeader' as never);
    const menuTargets = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Abrir menu da tarefa',
    );
    const text = allText(renderer);

    expect(header.props.rightAction).toBeUndefined();
    expect(menuTargets).toHaveLength(0);
    expect(renderer.root.findAllByType('TaskFormSheet' as never)).toHaveLength(0);
    expect(text).toContain('Arrumar o quarto');
    expect(text).not.toContain('Editar');
    expect(text).not.toContain('Arquivar');
    expect(text).not.toContain('Desarquivar');
  });
});
