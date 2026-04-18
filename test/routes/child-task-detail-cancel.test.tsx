import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildTaskDetailScreen from '../../app/(child)/tasks/[id]';

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
}));

const focusEffectMock = vi.hoisted(() => ({
  callback: null as null | (() => void),
}));

const childAssignmentMock = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { nome: 'Lia' },
}));

const completeMutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const cancelMutationMock = vi.hoisted(() => ({
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
  Alert: alertMock,
  Pressable: createHostComponent('Pressable'),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    absoluteFillObject: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-image', () => ({
  Image: createHostComponent('Image'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  launchCameraAsync: vi.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'assignment-1' }),
  useRouter: () => routerMock,
  useFocusEffect: (callback: () => void) => {
    focusEffectMock.callback = callback;
  },
}));

vi.mock('@lib/tasks', () => ({
  getAssignmentPoints: (assignment: { pontos_snapshot: number }) => assignment.pontos_snapshot,
  isRecurring: (dias: number) => dias > 0,
  formatWeekdays: (dias: number) => (dias === 0 ? 'Pontual' : 'Todos os dias'),
  getAssignmentCompletionState: (assignment: { status: string }, task: { ativo: boolean }) => {
    if (assignment.status !== 'pendente') {
      return { canComplete: false, reason: null };
    }

    if (!task.ativo) {
      return {
        canComplete: false,
        reason:
          'Esta tarefa foi desativada pelo responsável e não pode mais ser enviada para validação.',
      };
    }

    return { canComplete: true, reason: null };
  },
  getAssignmentCancellationState: (
    assignment: { status: string; competencia: string | null },
    task: { ativo: boolean; dias_semana: number },
  ) => {
    if (assignment.status !== 'aguardando_validacao') {
      return { canCancel: false, reason: null };
    }

    if (!task.ativo) {
      return {
        canCancel: false,
        reason: 'Esta tarefa está desativada e não permite cancelar o envio.',
      };
    }

    if (task.dias_semana > 0 && assignment.competencia === '2026-03-20') {
      return {
        canCancel: false,
        reason: 'Não é possível cancelar o envio de uma tarefa recorrente de data anterior.',
      };
    }

    return { canCancel: true, reason: null };
  },
}));

vi.mock('@/constants/status', () => ({
  getAssignmentStatusColor: () => '#308CE8',
  getAssignmentStatusLabel: (status: string) => status,
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fafafa', muted: '#eee' },
      text: {
        primary: '#111',
        secondary: '#333',
        muted: '#666',
        inverse: '#fff',
      },
      accent: {
        filho: '#FAC114',
        filhoBg: '#FFF3C4',
      },
      semantic: {
        success: '#20C55D',
        successBg: '#E7F8EC',
        warningBg: '#FFF3C4',
        warningText: '#7A5200',
      },
    },
  }),
}));

vi.mock('@/hooks/queries', () => ({
  useChildAssignment: () => childAssignmentMock,
  useProfile: () => profileMock,
  useCompleteAssignment: () => completeMutationMock,
  useCancelAssignmentSubmission: () => cancelMutationMock,
  useTasksLiveSync: () => undefined,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/sticky-footer-screen', () => ({
  StickyFooterScreen: ({
    children,
    footer,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) => React.createElement('StickyFooterScreen', null, children, footer),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
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
    tarefa_id: 'task-1',
    filho_id: 'child-1',
    status: 'aguardando_validacao',
    pontos_snapshot: 10,
    evidencia_url: null,
    nota_rejeicao: null,
    concluida_em: '2026-03-21T10:00:00Z',
    validada_em: null,
    validada_por: null,
    created_at: '2026-03-21T08:00:00Z',
    competencia: null,
    tarefas: {
      id: 'task-1',
      familia_id: 'family-1',
      titulo: 'Arrumar a cama',
      descricao: null,
      pontos: 10,
      dias_semana: 0,
      exige_evidencia: false,
      criado_por: 'admin-1',
      created_at: '2026-03-01T00:00:00Z',
      ativo: true,
    },
    ...overrides,
  };
}

function findButtonsByLabel(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll((node) => {
    return (node.type as string) === 'Button' && node.props.label === label;
  });
}

describe('ChildTaskDetailScreen — cancel assignment submission', () => {
  beforeEach(() => {
    alertMock.alert.mockReset();
    routerMock.back.mockReset();
    focusEffectMock.callback = null;
    childAssignmentMock.data = makeAssignment();
    childAssignmentMock.isLoading = false;
    childAssignmentMock.error = null;
    childAssignmentMock.refetch.mockReset();
    childAssignmentMock.refetch.mockResolvedValue({
      data: childAssignmentMock.data,
      error: null,
    });
    completeMutationMock.mutateAsync.mockReset();
    completeMutationMock.mutateAsync.mockResolvedValue(undefined);
    completeMutationMock.isPending = false;
    cancelMutationMock.mutate.mockReset();
    cancelMutationMock.isPending = false;
  });

  it('refetches the assignment when the screen regains focus', () => {
    render(<ChildTaskDetailScreen />);

    expect(focusEffectMock.callback).toBeTypeOf('function');

    act(() => {
      focusEffectMock.callback?.();
    });

    expect(childAssignmentMock.refetch).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation and only cancels after confirming, then shows success feedback', async () => {
    cancelMutationMock.mutate.mockImplementation(
      (_variables, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    const renderer = render(<ChildTaskDetailScreen />);
    const cancelButtons = findButtonsByLabel(renderer, 'Cancelar envio');

    expect(cancelButtons).toHaveLength(1);

    await act(async () => {
      await cancelButtons[0].props.onPress();
    });

    expect(alertMock.alert).toHaveBeenCalledTimes(1);
    expect(cancelMutationMock.mutate).not.toHaveBeenCalled();

    const alertButtons = alertMock.alert.mock.calls[0][2] as {
      text: string;
      style?: string;
      onPress?: () => void;
    }[];
    const destructiveButton = alertButtons.find((button) => button.style === 'destructive');

    expect(destructiveButton).toBeDefined();

    act(() => {
      destructiveButton?.onPress?.();
    });

    expect(cancelMutationMock.mutate).toHaveBeenCalledWith(
      { assignmentId: 'assignment-1' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    const inlineMessages = renderer.root.findAll((node) => {
      return (node.type as string) === 'InlineMessage';
    });

    expect(
      inlineMessages.some((node) => node.props.message === 'Envio cancelado com sucesso.'),
    ).toBe(true);
  });

  it('revalidates before completing and blocks the submit CTA when the task is deactivated', async () => {
    childAssignmentMock.data = makeAssignment({
      status: 'pendente',
      concluida_em: null,
    });
    childAssignmentMock.refetch.mockResolvedValue({
      data: makeAssignment({
        status: 'pendente',
        concluida_em: null,
        tarefas: {
          id: 'task-1',
          familia_id: 'family-1',
          titulo: 'Arrumar a cama',
          descricao: null,
          pontos: 10,
          dias_semana: 0,
          exige_evidencia: false,
          criado_por: 'admin-1',
          created_at: '2026-03-01T00:00:00Z',
          ativo: false,
        },
      }),
      error: null,
    });

    const renderer = render(<ChildTaskDetailScreen />);
    const completeButtons = findButtonsByLabel(renderer, 'Concluir tarefa');

    expect(completeButtons).toHaveLength(1);

    await act(async () => {
      await completeButtons[0].props.onPress();
    });

    expect(childAssignmentMock.refetch).toHaveBeenCalled();
    expect(completeMutationMock.mutateAsync).not.toHaveBeenCalled();

    const inlineMessages = renderer.root.findAll((node) => {
      return (node.type as string) === 'InlineMessage';
    });

    expect(
      inlineMessages.some(
        (node) =>
          node.props.message ===
          'Esta tarefa foi desativada pelo responsável e não pode mais ser enviada para validação.',
      ),
    ).toBe(true);
  });

  it('does not render the cancel CTA for an old recurring assignment and shows the blocking reason inline', () => {
    childAssignmentMock.data = makeAssignment({
      competencia: '2026-03-20',
      tarefas: {
        id: 'task-1',
        familia_id: 'family-1',
        titulo: 'Arrumar a cama',
        descricao: null,
        pontos: 10,
        dias_semana: 127,
        exige_evidencia: false,
        criado_por: 'admin-1',
        created_at: '2026-03-01T00:00:00Z',
        ativo: true,
      },
    });

    const renderer = render(<ChildTaskDetailScreen />);

    expect(findButtonsByLabel(renderer, 'Cancelar envio')).toHaveLength(0);

    const inlineMessages = renderer.root.findAll((node) => {
      return (node.type as string) === 'InlineMessage';
    });

    expect(
      inlineMessages.some(
        (node) =>
          node.props.message ===
          'Não é possível cancelar o envio de uma tarefa recorrente de data anterior.',
      ),
    ).toBe(true);
  });
});
