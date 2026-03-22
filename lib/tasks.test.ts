import { beforeEach, describe, expect, it, vi } from 'vitest';

const resizeImageMock = vi.hoisted(() => vi.fn((uri: string) => Promise.resolve(uri)));

const fileArrayBufferMock = vi.hoisted(() => vi.fn());
const fileConstructorMock = vi.hoisted(() => vi.fn());
const notifyTaskCompletedMock = vi.hoisted(() => vi.fn());
const notifyTaskCreatedMock = vi.hoisted(() => vi.fn());

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('./image-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('./image-utils')>();
  return { ...original, resizeImage: resizeImageMock };
});

vi.mock('./notifications', () => ({
  notifyTaskCompleted: notifyTaskCompletedMock,
  notifyTaskCreated: notifyTaskCreatedMock,
}));

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

import {
  approveAssignment,
  completeAssignment,
  createTask,
  getAssignmentPoints,
  getTaskEditState,
  getChildAssignment,
  getTaskWithAssignments,
  listAdminTasks,
  listChildAssignments,
  listFamilyChildren,
  rejectAssignment,
  renewDailyTasks,
  sortAdminTasks,
  updateTask,
} from './tasks';
import type { AssignmentWithChild, TaskListItem } from './tasks';
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
    pontos_snapshot: null,
    evidencia_url: null,
    nota_rejeicao: null,
    concluida_em: null,
    validada_em: null,
    validada_por: null,
    created_at: '2026-03-21T00:00:00Z',
    competencia: null,
    filhos: { nome: 'Lia' },
    ...overrides,
  };
}

describe('tasks', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock as typeof fetch;

    fileArrayBufferMock.mockReset();
    fileConstructorMock.mockReset();
    storageBucketMock.createSignedUrl.mockReset();
    storageBucketMock.upload.mockReset();
    notifyTaskCompletedMock.mockReset();
    notifyTaskCreatedMock.mockReset();

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

  it('lists family children and admin tasks', async () => {
    supabaseMock.from
      .mockReturnValueOnce(createSimpleOrderQuery({ data: [{ id: 'child-1' }], error: null }))
      .mockReturnValueOnce(createOrderQuery({ data: [{ id: 'task-1' }], error: null }));

    await expect(listFamilyChildren()).resolves.toEqual({
      data: [{ id: 'child-1' }],
      error: null,
    });

    await expect(listAdminTasks()).resolves.toEqual({
      data: [{ id: 'task-1' }],
      error: null,
    });
  });

  it('surfaces list errors for family children and admin tasks', async () => {
    supabaseMock.from
      .mockReturnValueOnce(createSimpleOrderQuery({ data: null, error: { message: 'children failed' } }))
      .mockReturnValueOnce(createOrderQuery({ data: null, error: { message: 'tasks failed' } }));

    await expect(listFamilyChildren()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(listAdminTasks()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });
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

    await expect(approveAssignment('assignment-1')).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(renewDailyTasks()).resolves.toBeUndefined();
    expect(notifyTaskCreatedMock).toHaveBeenCalledWith('Arrumar a cama');
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
      tarefas: { pontos: 30 },
    })).toBe(15);
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

  it('rejects assignments only for authenticated users', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: { id: 'admin-1' } } })
      .mockResolvedValueOnce({ data: { user: { id: 'admin-1' } } });

    const updateErrorQuery = createUpdateQuery({ error: { message: 'reject failed' } }, 2);
    const updateSuccessQuery = createUpdateQuery({ error: null }, 2);

    supabaseMock.from
      .mockReturnValueOnce(updateErrorQuery)
      .mockReturnValueOnce(updateSuccessQuery);

    await expect(rejectAssignment('assignment-1', 'Refazer')).resolves.toEqual({
      error: 'Usuário não autenticado',
    });

    await expect(rejectAssignment('assignment-1', 'Refazer')).resolves.toEqual({
      error: 'Algo deu errado. Tente novamente.',
    });

    await expect(rejectAssignment('assignment-1', 'Refazer')).resolves.toEqual({
      error: null,
    });

    expect(updateSuccessQuery.update).toHaveBeenCalledWith({
      status: 'rejeitada',
      nota_rejeicao: 'Refazer',
      validada_em: expect.any(String),
      validada_por: 'admin-1',
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

  it('completes an assignment without evidence', async () => {
    const updateQuery = createUpdateQuery({ error: null }, 2);
    supabaseMock.from.mockReturnValueOnce(updateQuery);

    await expect(completeAssignment('assignment-1', null)).resolves.toEqual({ error: null });
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: 'aguardando_validacao',
      evidencia_url: null,
      concluida_em: expect.any(String),
    });
    expect(notifyTaskCompletedMock).toHaveBeenCalledTimes(1);
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
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }))
      .mockReturnValueOnce(createUpdateQuery({ error: null }, 2));
    storageBucketMock.upload.mockResolvedValue({
      data: { path: `family-1/child-1/${fileName}` },
      error: null,
    });

    const result = await completeAssignment('assignment-1', `/test/${fileName}`);

    expect(fileConstructorMock).toHaveBeenCalledWith(`/test/${fileName}`);
    expect(storageBucketMock.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^family-1\/child-1\/evidencia_/),
      expect.any(ArrayBuffer),
      { contentType, upsert: false }
    );
    expect(result).toEqual({ error: null });
    expect(notifyTaskCompletedMock).toHaveBeenCalled();
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

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
      error: 'Erro ao fazer upload da imagem.',
    });
  });

  it('returns descriptive errors when evidence upload cannot resolve the actor context', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
      error: 'Usuário não autenticado',
    });

    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: null, error: { message: 'profile failed' } }))
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }));

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
      error: 'Perfil não encontrado',
    });

    supabaseMock.from
      .mockReturnValueOnce(createSingleQuery({ data: { familia_id: 'family-1' }, error: null }))
      .mockReturnValueOnce(createSingleQuery({ data: null, error: { message: 'child failed' } }));

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
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
      .mockReturnValueOnce(createSingleQuery({ data: { id: 'child-1' }, error: null }))
      .mockReturnValueOnce(createUpdateQuery({ error: null }, 2));
    storageBucketMock.upload.mockResolvedValue({
      data: { path: 'family-1/child-1/fallback.jpg' },
      error: null,
    });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({ error: null });
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

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
      error: 'Não foi possível ler a imagem selecionada',
    });

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
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

    await expect(completeAssignment('assignment-1', '/test/photo.jpg')).resolves.toEqual({
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
});
