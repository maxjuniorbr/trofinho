import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

const resizeImageMock = vi.hoisted(() => vi.fn((uri: string) => Promise.resolve(uri)));

const fileArrayBufferMock = vi.hoisted(() => vi.fn());
const fileConstructorMock = vi.hoisted(() => vi.fn());
const dispatchPushNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('./image-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('./image-utils')>();
  return { ...original, resizeImage: resizeImageMock };
});



const storageBucketMock = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}));

vi.mock('expo-file-system', () => ({
  File: class MockFile {
    constructor(path: string) {
      fileConstructorMock(path);
    }

    arrayBuffer() {
      return fileArrayBufferMock();
    }
  },
}));


vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./push', () => ({
  dispatchPushNotification: dispatchPushNotificationMock,
}));

import {
  approveAssignment,
  cancelAssignmentSubmission,
  buildTaskDeactivateMessage,
  completeAssignment,
  countPendingValidations,
  createTask,
  deactivateTask,
  getAssignmentCancellationState,
  getAssignmentCompletionState,
  getAssignmentPoints,
  getTaskEditState,
  getChildAssignment,
  getTaskWithAssignments,
  listAdminTasks,
  listChildAssignments,
  reactivateTask,
  rejectAssignment,
  renewDailyTasks,
  sortAdminTasks,
  updateTask,
} from './tasks';
import type { AssignmentWithChild, TaskDetail, TaskListItem } from './tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@/constants/status';

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message: string } | null;
};

function createOrderQuery(result: QueryResult, orderCallsBeforeResolve = 0) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn(),
    returns: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };

  for (let index = 0; index < orderCallsBeforeResolve; index += 1) {
    query.order.mockImplementationOnce(() => query);
  }

  // Return self so that a chained .limit().returns() can resolve
  query.order.mockReturnValueOnce(query);

  return query;
}

/** Order query that resolves directly from .order() — no .limit() chain */
function createSimpleOrderQuery(result: QueryResult) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };
  return query;
}

function createSingleQuery(result: QueryResult) {
  return {
    eq: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function createUpdateQuery(result: QueryResult, eqCallsBeforeResolve = 1) {
  const query = {
    eq: vi.fn(),
    update: vi.fn().mockReturnThis(),
  };

  for (let index = 0; index < eqCallsBeforeResolve - 1; index += 1) {
    query.eq.mockImplementationOnce(() => query);
  }

  query.eq.mockResolvedValueOnce(result);

  return query;
}

function createAssignmentWithChild(
  overrides: Partial<AssignmentWithChild>,
): AssignmentWithChild {
  return {
    id: 'assignment-1',
    tarefa_id: 'task-1',
    filho_id: 'child-1',
    status: 'pendente',
    pontos_snapshot: 10,
    evidencia_url: null,
    nota_rejeicao: null,
    concluida_em: null,
    validada_em: null,
    validada_por: null,
    created_at: '2026-03-21T00:00:00Z',
    competencia: null,
    filhos: { nome: 'Lia', usuario_id: null },
    ...overrides,
  };
}

describe('tasks', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock;

    fileArrayBufferMock.mockReset();
    fileConstructorMock.mockReset();
    storageBucketMock.createSignedUrl.mockReset();
    storageBucketMock.upload.mockReset();
    dispatchPushNotificationMock.mockReset();

    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();

    supabaseMock.storage.from.mockReturnValue(storageBucketMock);
  });

  describe('sortAdminTasks', () => {
    const makeTask = (id: string, statuses: string[]): TaskListItem => ({
      id,
      titulo: `Tarefa ${id}`,
      pontos: 10,
      frequencia: 'unica',
      ativo: true,
      created_at: `2026-03-${id.padStart(2, '0')}T00:00:00Z`,
      atribuicoes: statuses.map((status) => ({ status }) as TaskListItem['atribuicoes'][number]),
    });

    it('places aguardando_validacao tasks first in action_first mode', () => {
      const tasks = [
        makeTask('1', ['pendente']),
        makeTask('2', ['aguardando_validacao']),
        makeTask('3', ['aprovada']),
      ];
      const result = sortAdminTasks(tasks, 'action_first');
      expect(result.map((t) => t.id)).toEqual(['2', '1', '3']);
    });

    it('places pendente before fully completed in action_first mode', () => {
      const tasks = [
        makeTask('1', ['aprovada']),
        makeTask('2', ['pendente']),
      ];
      const result = sortAdminTasks(tasks, 'action_first');
      expect(result.map((t) => t.id)).toEqual(['2', '1']);
    });

    it('treats empty atribuicoes as lowest priority', () => {
      const tasks = [
        makeTask('1', []),
        makeTask('2', ['pendente']),
        makeTask('3', ['aguardando_validacao']),
      ];
      const result = sortAdminTasks(tasks, 'action_first');
      expect(result.map((t) => t.id)).toEqual(['3', '2', '1']);
    });

    it('preserves relative order within the same priority group', () => {
      const tasks = [
        makeTask('1', ['pendente']),
        makeTask('2', ['pendente']),
        makeTask('3', ['aguardando_validacao']),
        makeTask('4', ['aguardando_validacao']),
      ];
      const result = sortAdminTasks(tasks, 'action_first');
      expect(result.map((t) => t.id)).toEqual(['3', '4', '1', '2']);
    });

    it('preserves original order in newest_first mode', () => {
      const tasks = [
        makeTask('1', ['pendente']),
        makeTask('2', ['aguardando_validacao']),
      ];
      const result = sortAdminTasks(tasks, 'newest_first');
      expect(result.map((t) => t.id)).toEqual(['1', '2']);
    });

    it('does not mutate the input array', () => {
      const tasks = [
        makeTask('1', ['aprovada']),
        makeTask('2', ['aguardando_validacao']),
      ];
      const original = [...tasks];
      sortAdminTasks(tasks, 'action_first');
      expect(tasks).toEqual(original);
    });
  });

  it('returns status labels and colors', () => {
    expect(getAssignmentStatusLabel('pendente')).toBe('Pendente');
    expect(getAssignmentStatusLabel('aguardando_validacao')).toBe('Aguardando validação');
    expect(getAssignmentStatusLabel('aprovada')).toBe('Aprovada');
    expect(getAssignmentStatusLabel('rejeitada')).toBe('Rejeitada');

    const mockColors = {
      semantic: { warning: '#F59F0A', info: '#308CE8', success: '#20C55D', error: '#DC2828' },
    } as Parameters<typeof getAssignmentStatusColor>[1];

    expect(getAssignmentStatusColor('pendente', mockColors)).toBe('#F59F0A');
    expect(getAssignmentStatusColor('aguardando_validacao', mockColors)).toBe('#308CE8');
    expect(getAssignmentStatusColor('aprovada', mockColors)).toBe('#20C55D');
    expect(getAssignmentStatusColor('rejeitada', mockColors)).toBe('#DC2828');
  });

  it('lists admin tasks', async () => {
    supabaseMock.from
      .mockReturnValueOnce(createOrderQuery({ data: [{ id: 'task-1' }], error: null }));

    await expect(listAdminTasks()).resolves.toEqual({
      data: [{ id: 'task-1' }],
      error: null,
    });
  });

  it('surfaces list errors for admin tasks', async () => {
    supabaseMock.from
      .mockReturnValueOnce(createOrderQuery({ data: null, error: { message: 'tasks failed' } }));

    await expect(listAdminTasks()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('counts pending validations using a head query', async () => {
    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    });

    await expect(countPendingValidations()).resolves.toEqual({ data: 3, error: null });
  });

  it('returns zero when counting pending validations fails', async () => {
    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'count failed' } }),
    });

    await expect(countPendingValidations()).resolves.toEqual({ data: 0, error: 'Algo deu errado. Tente novamente.' });
  });

  it('creates tasks, approves assignments, and renews daily tasks', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'approve failed' } })
      .mockResolvedValueOnce({ error: null });

    await expect(createTask({
      titulo: 'Arrumar a cama',
      descricao: null,
      pontos: 10,
      frequencia: 'diaria',
      exige_evidencia: false,
      filhoIds: ['child-1'],
    })).resolves.toEqual({ error: null });

    await expect(approveAssignment('assignment-1', { familiaId: 'f1', userId: 'u1', taskTitle: 'T' })).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(renewDailyTasks()).resolves.toBeUndefined();
  });

  it('updates tasks through rpc and exposes the edit-state rules', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'edit failed' } });

    await expect(updateTask('task-1', {
      titulo: 'Nova tarefa',
      descricao: 'Detalhes',
      pontos: 20,
      exige_evidencia: true,
    })).resolves.toEqual({ error: null });

    await expect(updateTask('task-1', {
      titulo: 'Nova tarefa',
      descricao: 'Detalhes',
      pontos: 20,
      exige_evidencia: false,
    })).resolves.toEqual({ error: 'Algo deu errado. Tente novamente.' });

    expect(getTaskEditState({
      frequencia: 'diaria',
      ativo: true,
      atribuicoes: [createAssignmentWithChild({
        status: 'aprovada',
        concluida_em: '2026-03-21T12:00:00Z',
      })],
    })).toEqual({
      canEdit: true,
      canEditPoints: true,
      errorMessage: null,
      infoMessage: 'Se você alterar os pontos, o novo valor será usado apenas nas próximas atribuições diárias.',
    });

    expect(getTaskEditState({
      frequencia: 'unica',
      ativo: true,
      atribuicoes: [createAssignmentWithChild({
        status: 'pendente',
        concluida_em: null,
      })],
    })).toEqual({
      canEdit: true,
      canEditPoints: false,
      errorMessage: null,
      infoMessage: 'Os pontos desta tarefa única já foram definidos na atribuição criada e não podem ser alterados.',
    });

    expect(getTaskEditState({
      frequencia: 'unica',
      ativo: true,
      atribuicoes: [createAssignmentWithChild({
        status: 'aprovada',
        concluida_em: '2026-03-21T12:00:00Z',
      })],
    })).toEqual({
      canEdit: false,
      canEditPoints: false,
      errorMessage: 'Esta tarefa já foi concluída e não pode ser editada.',
      infoMessage: null,
    });

    expect(getAssignmentPoints({
      pontos_snapshot: 15,
    })).toBe(15);
  });

  it('exposes cancellation-state rules for inactive tasks and old daily assignments', () => {
    const referenceDate = new Date('2026-03-21T10:00:00-03:00');

    expect(getAssignmentCancellationState(
      {
        status: 'aguardando_validacao',
        competencia: null,
      },
      {
        ativo: false,
        frequencia: 'unica',
      },
      referenceDate,
    )).toEqual({
      canCancel: false,
      reason: 'Esta tarefa está desativada e não permite cancelar o envio.',
    });

    expect(getAssignmentCancellationState(
      {
        status: 'aguardando_validacao',
        competencia: '2026-03-20',
      },
      {
        ativo: true,
        frequencia: 'diaria',
      },
      referenceDate,
    )).toEqual({
      canCancel: false,
      reason: 'Não é possível cancelar o envio de uma tarefa diária de data anterior.',
    });

    expect(getAssignmentCancellationState(
      {
        status: 'aguardando_validacao',
        competencia: '2026-03-21',
      },
      {
        ativo: true,
        frequencia: 'diaria',
      },
      referenceDate,
    )).toEqual({
      canCancel: true,
      reason: null,
    });
  });

  it('blocks completion when the task is inactive', () => {
    expect(getAssignmentCompletionState(
      {
        status: 'pendente',
      },
      {
        ativo: false,
      },
    )).toEqual({
      canComplete: false,
      reason: 'Esta tarefa foi desativada pelo responsável e não pode mais ser enviada para validação.',
    });

    expect(getAssignmentCompletionState(
      {
        status: 'aguardando_validacao',
      },
      {
        ativo: true,
      },
    )).toEqual({
      canComplete: false,
      reason: null,
    });
  });

  it('gets task details and signs evidence urls from multiple shapes', async () => {
    supabaseMock.from.mockReturnValueOnce(
      createSingleQuery({
        data: {
          id: 'task-1',
          atribuicoes: [
            { id: 'a-1', evidencia_url: 'family/child/evidence-one.jpg', filhos: { nome: 'Lia' } },
            {
              id: 'a-2',
              evidencia_url: 'https://example.com/storage/v1/object/public/evidencias/family/child/file%20two.jpg?x=1',
              filhos: { nome: 'Leo' },
            },
            {
              id: 'a-3',
              evidencia_url: 'https://cdn.example.com/evidencias/family/child/file-three.jpg?token=1',
              filhos: { nome: 'Luna' },
            },
            {
              id: 'a-4',
              evidencia_url: 'https://external.example.com/preview.jpg',
              filhos: { nome: 'Bia' },
            },
            { id: 'a-5', evidencia_url: null, filhos: { nome: 'Caio' } },
          ],
        },
        error: null,
      })
    );
    storageBucketMock.createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.example.com/one' }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.example.com/two' }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.example.com/three' }, error: null });

    const result = await getTaskWithAssignments('task-1');

    expect(storageBucketMock.createSignedUrl).toHaveBeenNthCalledWith(
      1,
      'family/child/evidence-one.jpg',
      3600
    );
    expect(storageBucketMock.createSignedUrl).toHaveBeenNthCalledWith(
      2,
      'family/child/file two.jpg',
      3600
    );
    expect(storageBucketMock.createSignedUrl).toHaveBeenNthCalledWith(
      3,
      'family/child/file-three.jpg',
      3600
    );
    expect(result).toEqual({
      data: {
        id: 'task-1',
        atribuicoes: [
          { id: 'a-1', evidencia_url: 'https://signed.example.com/one', filhos: { nome: 'Lia' } },
          { id: 'a-2', evidencia_url: 'https://signed.example.com/two', filhos: { nome: 'Leo' } },
          { id: 'a-3', evidencia_url: 'https://signed.example.com/three', filhos: { nome: 'Luna' } },
          { id: 'a-4', evidencia_url: 'https://external.example.com/preview.jpg', filhos: { nome: 'Bia' } },
          { id: 'a-5', evidencia_url: null, filhos: { nome: 'Caio' } },
        ],
      },
      error: null,
    });
  });

  it('returns task detail query errors without trying to sign evidence', async () => {
    supabaseMock.from.mockReturnValueOnce(
      createSingleQuery({
        data: null,
        error: { message: 'task not found' },
      })
    );

    await expect(getTaskWithAssignments('missing')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
    expect(storageBucketMock.createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects assignments via RPC', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Atribuição não encontrada ou não está aguardando validação' } });

    await expect(rejectAssignment('assignment-1', 'Refazer', { familiaId: 'f1', userId: 'u1', taskTitle: 'T' })).resolves.toEqual({ error: null });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('rejeitar_atribuicao', {
      p_atribuicao_id: 'assignment-1',
      p_nota_rejeicao: 'Refazer',
    });

    await expect(rejectAssignment('assignment-2', 'Errado', { familiaId: 'f1', userId: 'u1', taskTitle: 'T' })).resolves.toEqual({
      error: 'Registro não encontrado.',
    });
  });

  it('cancels an assignment submission via RPC', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(cancelAssignmentSubmission('assignment-1')).resolves.toEqual({ error: null });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('cancelar_envio_atribuicao', {
      p_atribuicao_id: 'assignment-1',
    });
  });

  it('localizes cancellation errors for invalid status, inactive task, old daily task and invalid ownership', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ error: { message: 'Esta atribuição não está aguardando validação' } })
      .mockResolvedValueOnce({ error: { message: 'Esta tarefa está desativada' } })
      .mockResolvedValueOnce({ error: { message: 'Não é possível cancelar envio de tarefa diária de data anterior' } })
      .mockResolvedValueOnce({ error: { message: 'Apenas filhos podem cancelar o próprio envio' } });

    await expect(cancelAssignmentSubmission('assignment-1')).resolves.toEqual({
      error: 'Esta ação não pode ser realizada no momento.',
    });
    await expect(cancelAssignmentSubmission('assignment-2')).resolves.toEqual({
      error: 'Esta tarefa está desativada e não permite cancelar o envio.',
    });
    await expect(cancelAssignmentSubmission('assignment-3')).resolves.toEqual({
      error: 'Não é possível cancelar o envio de uma tarefa diária de data anterior.',
    });
    await expect(cancelAssignmentSubmission('assignment-4')).resolves.toEqual({
      error: 'Acesso negado.',
    });
  });

  it('uses backend status validation to handle races with approval or rejection', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      error: { message: 'Esta atribuição não está aguardando validação' },
    });

    await expect(cancelAssignmentSubmission('assignment-race')).resolves.toEqual({
      error: 'Esta ação não pode ser realizada no momento.',
    });
  });

  it('lists child assignments using the current competence filter', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00-03:00'));

    const query = createOrderQuery({ data: [{ id: 'assignment-1' }], error: null });
    supabaseMock.from.mockReturnValueOnce(query);

    await expect(listChildAssignments()).resolves.toEqual({
      data: [{ id: 'assignment-1' }],
      error: null,
    });

    expect(query.or).toHaveBeenCalledWith(
      'competencia.is.null,competencia.eq.2026-03-15,status.in.(aprovada,rejeitada)'
    );

    vi.useRealTimers();
  });

  it('returns child assignment query errors', async () => {
    supabaseMock.from
      .mockReturnValueOnce(createOrderQuery({ data: null, error: { message: 'list failed' } }))
      .mockReturnValueOnce(createSingleQuery({ data: null, error: { message: 'detail failed' } }));

    await expect(listChildAssignments()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(getChildAssignment('assignment-1')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('signs a child assignment evidence url and returns null when the signed url fails', async () => {
    supabaseMock.from
      .mockReturnValueOnce(
        createSingleQuery({
          data: {
            id: 'assignment-1',
            evidencia_url: 'https://example.com/object/sign/evidencias/family/child/proof.jpg?token=1',
          },
          error: null,
        })
      )
      .mockReturnValueOnce(
        createSingleQuery({
          data: {
            id: 'assignment-2',
            evidencia_url: 'family/child/proof-two.jpg',
          },
          error: null,
        })
      );
    storageBucketMock.createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.example.com/proof' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'cannot sign' } });

    await expect(getChildAssignment('assignment-1')).resolves.toEqual({
      data: {
        id: 'assignment-1',
        evidencia_url: 'https://signed.example.com/proof',
      },
      error: null,
    });

    await expect(getChildAssignment('assignment-2')).resolves.toEqual({
      data: {
        id: 'assignment-2',
        evidencia_url: null,
      },
      error: null,
    });
  });

  it('completes an assignment without evidence via RPC', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(completeAssignment('assignment-1', null, { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({ error: null });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('concluir_atribuicao', {
      p_atribuicao_id: 'assignment-1',
      p_evidencia_url: undefined,
    });
  });

  it('localizes completion errors when the task has been deactivated or the assignment is no longer pending', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        error: { message: 'Esta tarefa está desativada e não pode ser enviada para validação' },
      })
      .mockResolvedValueOnce({
        error: { message: 'Esta atribuição não está pendente' },
      });

    await expect(
      completeAssignment('assignment-1', null, { familiaId: 'f1', childName: 'C', taskTitle: 'T' }),
    ).resolves.toEqual({
      error: 'Esta tarefa foi desativada e não pode mais ser enviada para validação.',
    });

    await expect(
      completeAssignment('assignment-2', null, { familiaId: 'f1', childName: 'C', taskTitle: 'T' }),
    ).resolves.toEqual({
      error: 'Esta ação não pode ser realizada no momento.',
    });
  });

  it.each([
    ['photo.png', 'image/png'],
    ['photo.webp', 'image/webp'],
    ['photo.heic', 'image/heic'],
    ['photo.heif', 'image/heif'],
    ['photo.unknown', 'image/jpeg'],
  ])('uploads evidence with the correct content type for %s', async (fileName, contentType) => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(8));
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));
    storageBucketMock.upload.mockResolvedValue({
      data: { path: `family-1/child-1/${fileName}` },
      error: null,
    });
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    const result = await completeAssignment('assignment-1', `/test/${fileName}`, { familiaId: 'f1', childName: 'C', taskTitle: 'T' });

    expect(fileConstructorMock).toHaveBeenCalledWith(`/test/${fileName}`);
    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^family-1\/child-1\/evidencia_/),
      expect.any(ArrayBuffer),
      { contentType, upsert: false }
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith('concluir_atribuicao', {
      p_atribuicao_id: 'assignment-1',
      p_evidencia_url: `family-1/child-1/${fileName}`,
    });
    expect(result).toEqual({ error: null });
  });

  it('returns upload errors from evidence completion', async () => {
    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(8));
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));
    storageBucketMock.upload.mockResolvedValue({
      data: null,
      error: { message: 'upload failed' },
    });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'Erro ao fazer upload da imagem.',
    });
  });

  it('returns descriptive errors when evidence upload cannot resolve the actor context', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'Usuário não autenticado',
    });

    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: null, error: { message: 'profile failed' } }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'Perfil não encontrado',
    });

    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: null, error: { message: 'child failed' } }));

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'Filho não encontrado',
    });
  });

  it('falls back to fetch when reading the local image fails', async () => {
    const arrayBuffer = new ArrayBuffer(4);
    fileArrayBufferMock.mockRejectedValue(new Error('local read failed'));
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
    });
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));
    storageBucketMock.upload.mockResolvedValue({
      data: { path: 'family-1/child-1/fallback.jpg' },
      error: null,
    });
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({ error: null });
    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      expect.any(String),
      arrayBuffer,
      { contentType: 'image/jpeg', upsert: false }
    );
  });

  it('returns fallback messages when image reading throws or fetch responds badly', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));

    fileArrayBufferMock.mockRejectedValueOnce({}).mockRejectedValueOnce(new Error('ignored'));
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        arrayBuffer: vi.fn(),
      })
      .mockRejectedValueOnce(new Error('network blew up'));

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'Não foi possível ler a imagem selecionada',
    });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'network blew up',
    });
  });

  it('handles structured unknown errors and malformed evidence urls', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));

    fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(8));
    storageBucketMock.upload.mockRejectedValueOnce({ message: 'structured error' });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg', { familiaId: 'f1', childName: 'C', taskTitle: 'T' })).resolves.toEqual({
      error: 'structured error',
    });

    supabaseMock.from.mockReturnValueOnce(
      createSingleQuery({
        data: {
          id: 'assignment-3',
          evidencia_url: 'not a valid url:://broken',
        },
        error: null,
      })
    );

    await expect(getChildAssignment('assignment-3')).resolves.toEqual({
      data: {
        id: 'assignment-3',
        evidencia_url: 'not a valid url:://broken',
      },
      error: null,
    });
    expect(storageBucketMock.createSignedUrl).not.toHaveBeenCalled();
  });

  describe('push notification dispatch', () => {
    it('approveAssignment dispatches tarefa_aprovada with correct payload when opts provided', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await approveAssignment('assignment-1', {
        familiaId: 'family-1',
        userId: 'child-user-1',
        taskTitle: 'Arrumar a cama',
      });

      expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
        'tarefa_aprovada',
        'family-1',
        { userId: 'child-user-1', taskTitle: 'Arrumar a cama' },
      );
    });

    it('rejectAssignment dispatches tarefa_rejeitada with correct payload when opts provided', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await rejectAssignment('assignment-1', 'Refazer', {
        familiaId: 'family-1',
        userId: 'child-user-1',
        taskTitle: 'Lavar louça',
      });

      expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
        'tarefa_rejeitada',
        'family-1',
        { userId: 'child-user-1', taskTitle: 'Lavar louça' },
      );
    });

    it('completeAssignment dispatches tarefa_concluida with correct payload when opts provided', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await completeAssignment('assignment-1', null, {
        familiaId: 'family-1',
        childName: 'Lia',
        taskTitle: 'Estudar',
      });

      expect(dispatchPushNotificationMock).toHaveBeenCalledWith(
        'tarefa_concluida',
        'family-1',
        { childName: 'Lia', taskTitle: 'Estudar' },
      );
    });

    it('approveAssignment always dispatches because opts is now required', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await approveAssignment('assignment-1', { familiaId: 'f1', userId: 'u1', taskTitle: 'T' });

      expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    });

    it('dispatch failure does not affect the RPC return value', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });
      dispatchPushNotificationMock.mockRejectedValueOnce(new Error('push failed'));

      const result = await approveAssignment('assignment-1', {
        familiaId: 'family-1',
        userId: 'child-user-1',
        taskTitle: 'Tarefa teste',
      });

      expect(result).toEqual({ error: null });
    });
  });

  describe('property tests', () => {
    // Feature: review-phases-1-2-implementation, Property 2: getAssignmentPoints returns pontos_snapshot directly
    it('P2: for any assignment with numeric pontos_snapshot, returns exactly pontos_snapshot', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100000 }), (pontos) => {
          return getAssignmentPoints({ pontos_snapshot: pontos }) === pontos;
        }),
        { numRuns: 100 },
      );
    });

    // Feature: ux-polish-fase4b, Property 9: Evidence file path format with UUID
    // **Validates: Requirements 4.1, 4.2, 4.3**
    const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const extensionArb = fc.constantFrom('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif');
    const idArb = fc.stringMatching(/^[a-z0-9-]{1,36}$/);

    it('P9: evidence path matches {familia_id}/{filho_id}/evidencia_{uuid}.{ext} with valid UUID', async () => {
      await fc.assert(
        fc.asyncProperty(idArb, idArb, extensionArb, async (familiaId, filhoId, ext) => {
          // Reset mocks for each iteration
          storageBucketMock.upload.mockReset();
          supabaseMock.auth.getUser.mockReset();
          supabaseMock.from.mockReset();
          supabaseMock.rpc.mockReset();
          supabaseMock.storage.from.mockReturnValue(storageBucketMock);
          fileArrayBufferMock.mockResolvedValue(new ArrayBuffer(8));
          resizeImageMock.mockImplementation((uri: string) => Promise.resolve(uri));

          supabaseMock.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
          });
          supabaseMock.from
            .mockReturnValueOnce(createSingleQuery({ data: { familia_id: familiaId }, error: null }))
            .mockReturnValueOnce(createSingleQuery({ data: { id: filhoId }, error: null }));
          storageBucketMock.upload.mockResolvedValue({
            data: { path: `${familiaId}/${filhoId}/evidencia_test.${ext}` },
            error: null,
          });
          supabaseMock.rpc.mockResolvedValueOnce({ error: null });

          await completeAssignment('assignment-1', `/test/photo.${ext}`, { familiaId: 'f1', childName: 'C', taskTitle: 'T' });

          const uploadPath: string = storageBucketMock.upload.mock.calls[0][0];
          const expectedPrefix = `${familiaId}/${filhoId}/evidencia_`;
          const expectedSuffix = `.${ext}`;

          expect(uploadPath.startsWith(expectedPrefix)).toBe(true);
          expect(uploadPath.endsWith(expectedSuffix)).toBe(true);

          const uuidPart = uploadPath.slice(expectedPrefix.length, -expectedSuffix.length);
          expect(uuidPart).toMatch(UUID_V4_RE);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('deactivateTask', () => {
    it('returns pendingValidationCount on success', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ data: 3, error: null });

      await expect(deactivateTask('task-1')).resolves.toEqual({
        data: { pendingValidationCount: 3 },
        error: null,
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('desativar_tarefa', {
        p_tarefa_id: 'task-1',
      });
    });

    it('returns localized error on failure', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Tarefa não encontrada' },
      });

      await expect(deactivateTask('task-1')).resolves.toEqual({
        data: null,
        error: 'Registro não encontrado.',
      });
    });
  });

  describe('reactivateTask', () => {
    it('returns no error on success', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({ error: null });

      await expect(reactivateTask('task-1')).resolves.toEqual({
        error: null,
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('reativar_tarefa', {
        p_tarefa_id: 'task-1',
      });
    });

    it('returns localized error on failure', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        error: { message: 'some error' },
      });

      await expect(reactivateTask('task-1')).resolves.toEqual({
        error: 'Algo deu errado. Tente novamente.',
      });
    });
  });

  describe('getTaskEditState — ativo check', () => {
    it('returns canEdit: false when ativo = false', () => {
      expect(getTaskEditState({
        frequencia: 'diaria',
        ativo: false,
        atribuicoes: [createAssignmentWithChild({ status: 'pendente' })],
      })).toEqual({
        canEdit: false,
        canEditPoints: false,
        errorMessage: 'Esta tarefa está desativada e não pode ser editada.',
        infoMessage: null,
      });
    });
  });

  describe('Property tests — soft delete', () => {
    // Feature: soft-delete, Property 6: Idempotência das RPCs de soft delete
    // **Validates: Requirements 0.3**
    it('deactivateTask returns same shape on repeated calls (no error)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (taskId) => {
          supabaseMock.rpc.mockResolvedValue({ data: 0, error: null });
          const first = await deactivateTask(taskId);
          const second = await deactivateTask(taskId);
          expect(first.error).toBeNull();
          expect(second.error).toBeNull();
          expect(first.data).toEqual(second.data);
        }),
        { numRuns: 100 },
      );
    });

    // Feature: soft-delete, Property 15: Confirmation dialog message includes correct counts
    // **Validates: Requirements 12.2, 12.4**
    it('buildTaskDeactivateMessage includes correct counts for arbitrary assignments', () => {
      fc.assert(
        fc.property(
          fc.record({
            frequencia: fc.constantFrom('diaria' as const, 'unica' as const),
          }),
          fc.array(
            fc.record({
              status: fc.constantFrom(
                'pendente' as const,
                'aguardando_validacao' as const,
                'aprovada' as const,
                'rejeitada' as const,
              ),
            }),
          ),
          (task, assignments) => {
            const message = buildTaskDeactivateMessage(task, assignments);

            const pendingCount = assignments.filter(a => a.status === 'pendente').length;
            const awaitingCount = assignments.filter(a => a.status === 'aguardando_validacao').length;

            if (pendingCount > 0) {
              expect(message).toContain(String(pendingCount));
              expect(message).toContain('cancelada');
            }

            if (awaitingCount > 0) {
              expect(message).toContain(String(awaitingCount));
              expect(message).toContain('mantida');
            }

            if (task.frequencia === 'diaria') {
              expect(message).toContain('diárias');
            }

            // Message is never empty
            expect(message.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: soft-delete, Property 7: getTaskEditState returns canEdit=false for any task with ativo=false
    // **Validates: Requirements 0.2**
    it('getTaskEditState returns canEdit=false for any task with ativo=false', () => {
      fc.assert(
        fc.property(
          fc.record({
            frequencia: fc.constantFrom('diaria' as const, 'unica' as const),
            atribuicoes: fc.array(
              fc.record({
                status: fc.constantFrom(
                  'pendente' as const,
                  'aguardando_validacao' as const,
                  'aprovada' as const,
                  'rejeitada' as const,
                ),
                concluida_em: fc.option(fc.constant('2025-06-15T10:00:00.000Z'), { nil: null }),
              }),
            ),
            ativo: fc.constant(false as const),
          }),
          (task) => {
            const result = getTaskEditState(task as Pick<TaskDetail, 'atribuicoes' | 'frequencia' | 'ativo'>);
            expect(result.canEdit).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
