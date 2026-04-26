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
    excluida_em: null,
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
  Alert: { alert: vi.fn() },
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-image', () => ({
  Image: createHostComponent('ExpoImage'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'task-1' }),
  useRouter: () => routerMock,
}));

vi.mock('lucide-react-native', () => ({
  Star: createHostComponent('Star'),
  Calendar: createHostComponent('Calendar'),
  PauseCircle: createHostComponent('PauseCircle'),
  PlayCircle: createHostComponent('PlayCircle'),
  Archive: createHostComponent('Archive'),
  Trash2: createHostComponent('Trash2'),
  CheckCircle2: createHostComponent('CheckCircle2'),
  XCircle: createHostComponent('XCircle'),
  Clock: createHostComponent('Clock'),
  Eye: createHostComponent('Eye'),
  Camera: createHostComponent('Camera'),
  Pencil: createHostComponent('Pencil'),
}));

vi.mock('@lib/tasks', () => ({
  formatWeekdays: () => 'Todos os dias',
  deriveTaskState: (task: Record<string, unknown>) => {
    if (task.excluida_em != null) return 'excluida';
    if (task.arquivada_em != null) return 'arquivada';
    if (task.ativo === false) return 'pausada';
    return 'ativa';
  },
  buildTaskDeactivateMessage: () => 'Pausar msg',
  buildTaskArchiveMessage: () => 'Arquivar msg',
  buildTaskDeleteMessage: () => 'Excluir msg',
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
}));

const mutationMock = vi.hoisted(() => () => ({ mutate: vi.fn(), isPending: false }));

vi.mock('@/hooks/queries', () => ({
  useTaskAssignments: () => assignmentsMock,
  useTaskDetail: () => taskDetailMock,
}));

vi.mock('@/hooks/queries/use-tasks', () => ({
  useDeactivateTask: mutationMock,
  useReactivateTask: mutationMock,
  useArchiveTask: mutationMock,
  useUnarchiveTask: mutationMock,
  useDeleteTask: mutationMock,
  useApproveAssignment: mutationMock,
  useRejectAssignment: mutationMock,
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (message: string | null) => message,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown> & { rightAction?: React.ReactNode }) =>
    React.createElement('ScreenHeader', props, props.rightAction),
  HeaderIconButton: (props: Record<string, unknown>) =>
    React.createElement('HeaderIconButton', props),
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

vi.mock('@/components/ui/fullscreen-image-viewer', () => ({
  FullscreenImageViewer: (props: Record<string, unknown>) =>
    React.createElement('FullscreenImageViewer', props),
}));

vi.mock('@/components/tasks/task-points-pill', () => ({
  TaskPointsPill: (props: Record<string, unknown>) => React.createElement('TaskPointsPill', props),
}));

vi.mock('@/components/tasks/task-form-sheet', () => ({
  TaskFormSheet: (props: Record<string, unknown>) => React.createElement('TaskFormSheet', props),
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
      excluida_em: null,
      atribuicoes: [],
    };
    taskDetailMock.isLoading = false;
    taskDetailMock.error = null;
    taskDetailMock.refetch.mockReset();
    assignmentsMock.data = { pages: [{ data: [], hasMore: false }], pageParams: [0] };
    assignmentsMock.error = null;
    assignmentsMock.isLoading = false;
  });

  it('renders task details with edit button and lifecycle actions', () => {
    const renderer = render(<TaskDetailAdminScreen />);

    const header = renderer.root.findByType('ScreenHeader' as never);
    const text = allText(renderer);

    // Header has rightAction (edit button)
    expect(header.props.rightAction).toBeDefined();
    expect(header.props.title).toBe('Detalhes da tarefa');

    // Task info is visible
    expect(text).toContain('Arrumar o quarto');
    expect(text).toContain('Todos os dias');
    expect(text).toContain('Descrição');
    expect(text).toContain('Guardar brinquedos e roupas.');

    // Lifecycle actions visible for active task
    expect(text).toContain('Pausar tarefa');
    expect(text).toContain('Arquivar');
    expect(text).toContain('Excluir definitivamente');

    // TaskFormSheet is rendered (hidden by default)
    const formSheets = renderer.root.findAllByType('TaskFormSheet' as never);
    expect(formSheets).toHaveLength(1);
    expect(formSheets[0].props.visible).toBe(false);
  });

  it('shows reactivate action for paused tasks', () => {
    taskDetailMock.data = {
      ...taskDetailMock.data!,
      ativo: false,
      arquivada_em: null,
    };
    const renderer = render(<TaskDetailAdminScreen />);
    const text = allText(renderer);

    expect(text).toContain('Reativar tarefa');
    expect(text).not.toContain('Pausar tarefa');
  });

  it('shows reactivate and delete for archived tasks', () => {
    taskDetailMock.data = {
      ...taskDetailMock.data!,
      ativo: false,
      arquivada_em: '2025-01-01T00:00:00Z',
    };
    const renderer = render(<TaskDetailAdminScreen />);
    const text = allText(renderer);

    expect(text).toContain('Reativar tarefa');
    expect(text).toContain('Excluir definitivamente');
    expect(text).not.toContain('Pausar tarefa');
  });

  it('shows empty history message when no assignments', () => {
    const renderer = render(<TaskDetailAdminScreen />);
    const text = allText(renderer);

    expect(text).toContain('Nenhum registro no histórico.');
  });

  it('renders history rows when assignments exist', () => {
    assignmentsMock.data = {
      pages: [
        {
          data: [
            {
              id: 'a-1',
              status: 'aprovada',
              pontos_snapshot: 20,
              evidencia_url: null,
              nota_rejeicao: null,
              concluida_em: '2025-01-15T10:00:00Z',
              validada_em: '2025-01-15T11:00:00Z',
              created_at: '2025-01-15T08:00:00Z',
              competencia: null,
              tentativas: 1,
              filhos: { nome: 'João', usuario_id: 'u-1' },
            },
          ],
          hasMore: false,
        },
      ],
      pageParams: [0],
    };
    const renderer = render(<TaskDetailAdminScreen />);
    const text = allText(renderer);

    expect(text).toContain('Histórico');
    expect(text).toContain('João');
    expect(text).toContain('Aprovações');
    expect(text).toContain('Pontos ganhos');
  });

  it('shows loading state', () => {
    taskDetailMock.isLoading = true;
    const renderer = render(<TaskDetailAdminScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    taskDetailMock.data = null;
    taskDetailMock.error = new Error('Falha ao carregar');
    const renderer = render(<TaskDetailAdminScreen />);
    const emptyStates = renderer.root.findAllByType('EmptyState' as never);
    expect(emptyStates).toHaveLength(1);
  });
});
