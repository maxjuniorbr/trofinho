import { localizeRpcError } from './api-error';
import { toDateString } from './utils';
import { extractErrorMessage } from './image-utils';
import { notifyTaskCompleted, notifyTaskCreated } from './notifications';
import { prepareImageUpload } from './storage';
import { supabase } from './supabase';

export type Child = {
  id: string;
  nome: string;
  usuario_id: string | null;
  avatar_url?: string | null;
};

export type TaskFrequencia = 'diaria' | 'unica';

export type Task = {
  id: string;
  familia_id: string;
  titulo: string;
  descricao: string | null;
  pontos: number;
  frequencia: TaskFrequencia;
  exige_evidencia: boolean;
  criado_por: string;
  created_at: string;
};

export type AssignmentStatus =
  | 'pendente'
  | 'aguardando_validacao'
  | 'aprovada'
  | 'rejeitada';

export type Assignment = {
  id: string;
  tarefa_id: string;
  filho_id: string;
  status: AssignmentStatus;
  pontos_snapshot?: number | null;
  evidencia_url: string | null;
  nota_rejeicao: string | null;
  concluida_em: string | null;
  validada_em: string | null;
  validada_por: string | null;
  created_at: string;
  competencia: string | null;
};

export type TaskListItem = {
  id: string;
  titulo: string;
  pontos: number;
  frequencia: TaskFrequencia;
  created_at: string;
  atribuicoes: { status: AssignmentStatus }[];
};

export type AdminTaskSort = 'action_first' | 'newest_first';

function assignmentPriority(atribuicoes: { status: AssignmentStatus }[]): number {
  if (atribuicoes.some((a) => a.status === 'aguardando_validacao')) return 0;
  if (atribuicoes.some((a) => a.status === 'pendente')) return 1;
  return 2;
}

export function sortAdminTasks(tasks: TaskListItem[], sort: AdminTaskSort): TaskListItem[] {
  if (sort === 'newest_first') return tasks.slice();
  return tasks.slice().sort((a, b) => assignmentPriority(a.atribuicoes) - assignmentPriority(b.atribuicoes));
}

export type AssignmentWithChild = Assignment & {
  filhos: { nome: string };
};

export type TaskDetail = Task & {
  atribuicoes: AssignmentWithChild[];
};

export type ChildAssignment = Assignment & {
  tarefas: Task;
};

export type NewTaskInput = {
  titulo: string;
  descricao: string | null;
  pontos: number;
  frequencia: TaskFrequencia;
  exige_evidencia: boolean;
  filhoIds: string[];
};

export type UpdateTaskInput = Readonly<{
  titulo: string;
  descricao: string | null;
  pontos: number;
  exige_evidencia: boolean;
}>;

export type TaskEditState = Readonly<{
  canEdit: boolean;
  canEditPoints: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
}>;

export async function listFamilyChildren(): Promise<{
  data: Child[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('filhos')
    .select('id, nome, usuario_id')
    .order('nome');

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: (data ?? []) as Child[], error: null };
}

export async function createTask(
  input: NewTaskInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('criar_tarefa_com_atribuicoes', {
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_pontos: input.pontos,
    p_frequencia: input.frequencia,
    p_exige_evidencia: input.exige_evidencia,
    p_filho_ids: input.filhoIds,
  });

  if (error) return { error: localizeRpcError(error.message) };
  await notifyTaskCreated(input.titulo);
  return { error: null };
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('editar_tarefa', {
    p_tarefa_id: taskId,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_pontos: input.pontos,
    p_requer_evidencia: input.exige_evidencia,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listAdminTasks(limit = 50): Promise<{
  data: TaskListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, frequencia, created_at, atribuicoes(status)')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<TaskListItem[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function getTaskWithAssignments(
  taskId: string
): Promise<{ data: TaskDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, atribuicoes(*, filhos(nome))')
    .eq('id', taskId)
    .returns<TaskDetail>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  const task = await signTaskEvidence(data as TaskDetail);
  return { data: task, error: null };
}

export async function approveAssignment(
  assignmentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aprovar_atribuicao', {
    atribuicao_id: assignmentId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function rejectAssignment(
  assignmentId: string,
  note: string
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuário não autenticado' };

  const { error } = await supabase
    .from('atribuicoes')
    .update({
      status: 'rejeitada',
      nota_rejeicao: note,
      validada_em: new Date().toISOString(),
      validada_por: user.id,
    })
    .eq('id', assignmentId)
    .eq('status', 'aguardando_validacao');

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function renewDailyTasks(): Promise<void> {
  await supabase.rpc('garantir_atribuicoes_diarias');
}

export async function listChildAssignments(): Promise<{
  data: ChildAssignment[];
  error: string | null;
}> {
  const today = toDateString(new Date());
  const visibleAssignmentsFilter =
    `competencia.is.null,competencia.eq.${today},status.in.(aprovada,rejeitada)`;

  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .or(visibleAssignmentsFilter)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<ChildAssignment[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function getChildAssignment(
  assignmentId: string
): Promise<{ data: ChildAssignment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .eq('id', assignmentId)
    .returns<ChildAssignment>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  const assignment = await signEvidence(data as ChildAssignment);
  return { data: assignment, error: null };
}

export async function completeAssignment(
  assignmentId: string,
  imageUri: string | null
): Promise<{ error: string | null }> {
  let evidenceUrl: string | null = null;

  if (imageUri) {
    const result = await uploadEvidence(imageUri);
    if (result.error) return { error: result.error };
    evidenceUrl = result.url;
  }

  const { error } = await supabase
    .from('atribuicoes')
    .update({
      status: 'aguardando_validacao',
      evidencia_url: evidenceUrl,
      concluida_em: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .eq('status', 'pendente');

  if (error) return { error: localizeRpcError(error.message) };
  await notifyTaskCompleted();
  return { error: null };
}

export function getTaskEditState(
  task: Pick<TaskDetail, 'atribuicoes' | 'frequencia'>,
): TaskEditState {
  if (task.frequencia === 'diaria') {
    return {
      canEdit: true,
      canEditPoints: true,
      errorMessage: null,
      infoMessage: 'Se você alterar os pontos, o novo valor será usado apenas nas próximas atribuições diárias.',
    };
  }

  const hasCompletedAssignment = task.atribuicoes.some((assignment) =>
    assignment.status === 'aguardando_validacao' ||
    assignment.status === 'aprovada' ||
    assignment.concluida_em !== null,
  );

  if (hasCompletedAssignment) {
    return {
      canEdit: false,
      canEditPoints: false,
      errorMessage: 'Esta tarefa já foi concluída e não pode ser editada.',
      infoMessage: null,
    };
  }

  return {
    canEdit: true,
    canEditPoints: false,
    errorMessage: null,
    infoMessage: 'Os pontos desta tarefa única já foram definidos na atribuição criada e não podem ser alterados.',
  };
}

export function getAssignmentPoints(
  assignment: Pick<Assignment, 'pontos_snapshot'> & {
    tarefas: Pick<Task, 'pontos'>;
  },
): number {
  return assignment.pontos_snapshot ?? assignment.tarefas.pontos;
}

async function uploadEvidence(
  imageUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, error: 'Usuário não autenticado' };
    }

    const [{ data: profile, error: profileError }, { data: child, error: childError }] =
      await Promise.all([
        supabase
          .from('usuarios')
          .select('familia_id')
          .eq('id', user.id)
          .single(),
        supabase
          .from('filhos')
          .select('id')
          .eq('usuario_id', user.id)
          .single(),
      ]);

    if (profileError || !profile?.familia_id) {
      return { url: null, error: 'Perfil não encontrado' };
    }

    if (childError || !child?.id) {
      return { url: null, error: 'Filho não encontrado' };
    }

    const { buffer, contentType, extension } = await prepareImageUpload(imageUri);
    const fileName = `evidencia_${createEvidenceSuffix()}.${extension}`;
    const filePath = `${profile.familia_id}/${child.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (error) return { url: null, error: 'Erro ao fazer upload da imagem.' };
    return { url: data.path, error: null };
  } catch (error) {
    return {
      url: null,
      error: extractErrorMessage(error, 'Erro ao fazer upload da imagem'),
    };
  }
}

let evidenceSuffixCounter = 0;

function createEvidenceSuffix(): string {
  evidenceSuffixCounter = (evidenceSuffixCounter + 1) % 1_000_000;

  const timePart = Date.now().toString(36);
  const counterPart = evidenceSuffixCounter.toString(36).padStart(4, '0');

  return `${timePart}_${counterPart}`;
}

const EVIDENCE_URL_TTL_SECONDS = 60 * 60;

async function signTaskEvidence(task: TaskDetail): Promise<TaskDetail> {
  const assignments = await Promise.all(
    task.atribuicoes.map((a) => signEvidence(a))
  );

  return { ...task, atribuicoes: assignments };
}

async function signEvidence<T extends { evidencia_url: string | null }>(
  item: T
): Promise<T> {
  const signedUrl = await resolveEvidenceUrl(item.evidencia_url);
  return { ...item, evidencia_url: signedUrl };
}

async function resolveEvidenceUrl(
  evidence: string | null
): Promise<string | null> {
  if (!evidence) return null;

  const path = normalizeEvidencePath(evidence);
  if (!path) return evidence;

  const { data, error } = await supabase.storage
    .from('evidencias')
    .createSignedUrl(path, EVIDENCE_URL_TTL_SECONDS);

  if (error) return null;
  return data.signedUrl;
}

function normalizeEvidencePath(evidence: string): string | null {
  if (!evidence.includes('://')) {
    return evidence;
  }

  const knownMarkers = [
    '/storage/v1/object/public/evidencias/',
    '/storage/v1/object/sign/evidencias/',
    '/object/public/evidencias/',
    '/object/sign/evidencias/',
  ];

  for (const marker of knownMarkers) {
    if (evidence.includes(marker)) {
      const path = evidence.split(marker)[1]?.split('?')[0] ?? '';
      return path ? decodeURIComponent(path) : null;
    }
  }

  try {
    const url = new URL(evidence);
    const bucketIndex = url.pathname.indexOf('/evidencias/');

    if (bucketIndex === -1) return null;

    const path = url.pathname.slice(bucketIndex + '/evidencias/'.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}
