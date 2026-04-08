// Feature: ux-polish-fase4b, Property 8: Destructive action executes if and only if user confirms
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import TaskDetailAdminScreen from '../../app/(admin)/tasks/[id]';

// --- Hoisted mocks ---

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  setParams: vi.fn(),
}));

const rejectMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const approveMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const taskDetailMock = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const deactivateMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const reactivateMutationMock = vi.hoisted(() => ({
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

vi.mock('react-native', () => {
  return {
    ActivityIndicator: createHostComponent('ActivityIndicator'),
    Alert: alertMock,
    Pressable: createHostComponent('Pressable'),
    ScrollView: createHostComponent('ScrollView'),
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
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'task-1' }),
  useRouter: () => routerMock,
}));

vi.mock('@lib/tasks', () => ({
  getTaskEditState: () => ({ canEdit: false }),
  buildTaskDeactivateMessage: () => 'Esta tarefa será desativada.',
  isRecurring: (dias: number) => dias > 0,
  formatWeekdays: (dias: number) => (dias === 0 ? 'Pontual' : 'Todos os dias'),
}));

vi.mock('@/constants/status', () => ({
  getAssignmentStatusColor: () => '#ccc',
  getAssignmentStatusLabel: (status: string) => status,
}));

vi.mock('@lib/utils', () => ({
  formatDate: (d: string) => d,
  toDateString: () => '2024-01-01',
}));

vi.mock('@/hooks/queries', () => ({
  useTaskDetail: () => taskDetailMock,
  useApproveAssignment: () => approveMutationMock,
  useRejectAssignment: () => rejectMutationMock,
  useDeactivateTask: () => deactivateMutationMock,
  useReactivateTask: () => reactivateMutationMock,
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
  HeaderIconButton: (props: Record<string, unknown>) =>
    React.createElement('HeaderIconButton', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@lib/safe-area', () => ({
  getSafeBottomPadding: () => 24,
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function makeTask(assignmentId: string) {
  return {
    id: 'task-1',
    titulo: 'Tarefa Teste',
    descricao: 'Descrição',
    pontos: 10,
    dias_semana: 0,
    exige_evidencia: false,
    ativo: true,
    atribuicoes: [
      {
        id: assignmentId,
        status: 'aguardando_validacao',
        concluida_em: '2024-01-01T00:00:00Z',
        validada_em: null,
        nota_rejeicao: null,
        evidencia_url: null,
        competencia: null,
        created_at: '2024-01-01T00:00:00Z',
        filhos: { nome: 'Filho Teste' },
      },
    ],
  };
}

/** Find the "Rejeitar" button that starts the rejection flow */
function findRejectStartButton(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => (n.type as string) === 'Text');
      return texts.some((t) => t.props.children === 'Rejeitar');
    } catch {
      return false;
    }
  });
}

/** Find the "Confirmar rejeição" button */
function findConfirmRejectButton(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => (n.type as string) === 'Text');
      return texts.some((t) => t.props.children === 'Confirmar rejeição');
    } catch {
      return false;
    }
  });
}

/** Find the rejection note TextInput */
function findNoteInput(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'TextInput') return false;
    return node.props.placeholder === 'Motivo da rejeição (obrigatório)';
  })[0];
}

describe('TaskDetailAdminScreen — rejection confirmation dialog (Property 8)', () => {
  beforeEach(() => {
    alertMock.alert.mockReset();
    rejectMutationMock.mutate.mockReset();
    approveMutationMock.mutate.mockReset();
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    routerMock.setParams.mockReset();
    taskDetailMock.data = makeTask('a-1');
    taskDetailMock.isLoading = false;
    taskDetailMock.error = null;
    taskDetailMock.refetch.mockReset();
  });

  // **Validates: Requirements 3.4, 3.5**
  it('P8-reject: reject mutation is called only when user confirms the Alert, not on cancel', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.boolean(),
        (rejectionNote, userConfirms) => {
          alertMock.alert.mockReset();
          rejectMutationMock.mutate.mockReset();

          taskDetailMock.data = makeTask('a-1');

          const renderer = render(<TaskDetailAdminScreen />);

          // Step 1: Press "Rejeitar" to enter rejection mode
          const rejectButtons = findRejectStartButton(renderer);
          expect(rejectButtons.length).toBeGreaterThan(0);
          act(() => {
            rejectButtons[0].props.onPress();
          });

          // Step 2: Fill in the rejection note
          const noteInput = findNoteInput(renderer);
          expect(noteInput).toBeDefined();
          act(() => {
            noteInput.props.onChangeText(rejectionNote);
          });

          // Step 3: Press "Confirmar rejeição" — this triggers Alert.alert
          const confirmButtons = findConfirmRejectButton(renderer);
          expect(confirmButtons.length).toBeGreaterThan(0);
          act(() => {
            confirmButtons[0].props.onPress();
          });

          expect(alertMock.alert).toHaveBeenCalledTimes(1);
          const buttons = alertMock.alert.mock.calls[0][2] as {
            text: string;
            style: string;
            onPress?: () => void;
          }[];

          if (userConfirms) {
            const destructiveBtn = buttons.find((b) => b.style === 'destructive');
            act(() => {
              destructiveBtn!.onPress!();
            });
            expect(rejectMutationMock.mutate).toHaveBeenCalledTimes(1);
          } else {
            // User cancels — do not press the destructive button
            expect(rejectMutationMock.mutate).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
