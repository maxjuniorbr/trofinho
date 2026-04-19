import * as Crypto from 'expo-crypto';
import * as Sentry from '@sentry/react-native';
import { localizeRpcError, extractErrorMessage } from './api-error';
import { toDateString, formatDate } from './utils';
import { dispatchPushNotification } from './push';
import { prepareImageUpload } from './storage';
import { supabase } from './supabase';

export const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
export const WEEKDAY_FULL_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const ALL_DAYS = 0b1111111; // 127
export const MAX_TENTATIVAS = 2;

/**
 * @deprecated Tarefas pontuais foram removidas. Mantido apenas para compat enquanto a UI é migrada.
 */
export const isRecurring = (_diasSemana: number): boolean => true;

export const isDayActive = (diasSemana: number, dow: number): boolean =>
  (diasSemana & (1 << dow)) > 0;

export const toggleDay = (diasSemana: number, dow: number): number => diasSemana ^ (1 << dow);

export const formatWeekdays = (diasSemana: number): string => {
  if (diasSemana === ALL_DAYS) return 'Todos os dias';
  return WEEKDAY_FULL_LABELS.filter((_, i) => isDayActive(diasSemana, i)).join(', ');
};

export type Task = {
  id: string;
  familia_id: string;
  titulo: string;
  descricao: string | null;
  pontos: number;
  dias_semana: number;
  exige_evidencia: boolean;
  criado_por: string | null;
  created_at: string;
  ativo: boolean;
  arquivada_em: string | null;
};

export type AssignmentStatus = 'pendente' | 'aguardando_validacao' | 'aprovada' | 'rejeitada';

export type Assignment = {
  id: string;
  tarefa_id: string;
  filho_id: string;
  status: AssignmentStatus;
  pontos_snapshot: number;
  evidencia_url: string | null;
  nota_rejeicao: string | null;
  concluida_em: string | null;
  validada_em: string | null;
  validada_por: string | null;
  created_at: string;
  competencia: string | null;
  tentativas: number;
};

export type TaskListItem = {
  id: string;
  titulo: string;
  pontos: number;
  dias_semana: number;
  created_at: string;
  ativo: boolean;
  arquivada_em: string | null;
  atribuicoes: { status: AssignmentStatus }[];
};

export type AdminTaskSort = 'action_first' | 'newest_first';

function assignmentPriority(atribuicoes: { status: AssignmentStatus }[]): number {
  if (atribuicoes.some((a) => a.status === 'aguardando_validacao')) return 0;
  if (atribuicoes.some((a) => a.status === 'pendente')) return 1;
  return 2;
}

export function sortAdminTasks(tasks: TaskListItem[], sort: AdminTaskSort): TaskListItem[] {
  if (sort === 'newest_first') {
    return tasks
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return tasks
    .slice()
    .sort((a, b) => assignmentPriority(a.atribuicoes) - assignmentPriority(b.atribuicoes));
}

const ASSIGNMENT_STATUS_PRIORITY: Record<AssignmentStatus, number> = {
  aguardando_validacao: 0,
  pendente: 1,
  rejeitada: 2,
  aprovada: 3,
};

function sortAssignments(assignments: AssignmentWithChild[]): AssignmentWithChild[] {
  return assignments.slice().sort((a, b) => {
    const priorityDiff =
      ASSIGNMENT_STATUS_PRIORITY[a.status] - ASSIGNMENT_STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    // Within the same status group, most recent first.
    const dateA = a.concluida_em ?? a.created_at;
    const dateB = b.concluida_em ?? b.created_at;
    return dateB.localeCompare(dateA);
  });
}

export type AssignmentWithChild = Assignment & {
  filhos: { nome: string; usuario_id: string | null };
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
  dias_semana: number;
  exige_evidencia: boolean;
  filhoIds: string[];
};

export type UpdateTaskInput = Readonly<{
  titulo: string;
  descricao: string | null;
  pontos: number;
  exige_evidencia: boolean;
  dias_semana: number;
}>;

export type TaskEditState = Readonly<{
  canEdit: boolean;
  canEditPoints: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
}>;

export type AssignmentCancellationState = Readonly<{
  canCancel: boolean;
  reason: string | null;
}>;

export type AssignmentCompletionState = Readonly<{
  canComplete: boolean;
  reason: string | null;
}>;

export async function createTask(
  input: NewTaskInput,
  opts?: { familiaId: string; filhoIds: string[] },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('criar_tarefa_com_atribuicoes', {
    p_titulo: input.titulo,
    p_descricao: input.descricao ?? '',
    p_pontos: input.pontos,
    p_dias_semana: input.dias_semana,
    p_exige_evidencia: input.exige_evidencia,
    p_filho_ids: input.filhoIds,
  });

  if (error) return { error: localizeRpcError(error.message) };
  if (opts) {
    dispatchPushNotification('tarefa_criada', opts.familiaId, {
      taskTitle: input.titulo,
      filhoIds: opts.filhoIds,
    });
  }
  return { error: null };
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('editar_tarefa', {
    p_tarefa_id: taskId,
    p_titulo: input.titulo,
    p_descricao: input.descricao ?? '',
    p_pontos: input.pontos,
    p_requer_evidencia: input.exige_evidencia,
    p_dias_semana: input.dias_semana,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function countPendingValidations(): Promise<{
  data: number;
  error: string | null;
}> {
  const { count, error } = await supabase
    .from('atribuicoes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aguardando_validacao');

  if (error) return { data: 0, error: localizeRpcError(error.message) };
  return { data: count ?? 0, error: null };
}

export async function listAdminTasks(
  page = 0,
  pageSize = 20,
): Promise<{
  data: TaskListItem[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize; // fetch one extra to detect next page

  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, dias_semana, created_at, ativo, arquivada_em, atribuicoes(status)')
    .is('arquivada_em', null)
    .order('created_at', { ascending: false })
    .range(from, to)
    .overrideTypes<TaskListItem[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export async function listArchivedTasks(
  page = 0,
  pageSize = 20,
): Promise<{
  data: TaskListItem[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, dias_semana, created_at, ativo, arquivada_em, atribuicoes(status)')
    .not('arquivada_em', 'is', null)
    .order('arquivada_em', { ascending: false })
    .range(from, to)
    .overrideTypes<TaskListItem[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export type ApprovedAssignmentFeedItem = {
  atribuicao_id: string;
  tarefa_id: string;
  tarefa_titulo: string;
  tarefa_arquivada: boolean;
  filho_id: string;
  filho_nome: string;
  pontos: number;
  validada_em: string;
  competencia: string | null;
  evidencia_url: string | null;
};

export async function listApprovedAssignments(
  page = 0,
  pageSize = 20,
): Promise<{
  data: ApprovedAssignmentFeedItem[];
  hasMore: boolean;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('listar_atribuicoes_aprovadas', {
    p_limit: pageSize + 1,
    p_offset: page * pageSize,
  });

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = (data ?? []) as ApprovedAssignmentFeedItem[];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export type PendingValidationItem = AssignmentWithChild & {
  tarefas: {
    id: string;
    titulo: string;
    descricao: string | null;
    pontos: number;
    exige_evidencia: boolean;
    familia_id: string;
  };
};

/**
 * Returns every assignment currently waiting for admin review across all
 * non-archived tasks owned by the family. Evidence URLs are signed in batch.
 */
export async function listPendingValidations(): Promise<{
  data: PendingValidationItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select(
      'id, tarefa_id, filho_id, status, pontos_snapshot, evidencia_url, nota_rejeicao, concluida_em, validada_em, validada_por, created_at, competencia, tentativas, filhos(nome, usuario_id), tarefas!inner(id, titulo, descricao, pontos, exige_evidencia, familia_id, arquivada_em)',
    )
    .eq('status', 'aguardando_validacao')
    .is('tarefas.arquivada_em', null)
    .order('concluida_em', { ascending: true })
    .returns<PendingValidationItem[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };

  const items = data ?? [];
  if (items.length === 0) return { data: [], error: null };

  const paths = items.map((a) => (a.evidencia_url ? normalizeEvidencePath(a.evidencia_url) : null));
  const validEntries = paths
    .map((path, index) => (path ? { path, index } : null))
    .filter((e): e is { path: string; index: number } => e !== null);

  if (validEntries.length === 0) return { data: items, error: null };

  const { data: signedData, error: signedError } = await supabase.storage
    .from('evidencias')
    .createSignedUrls(
      validEntries.map((e) => e.path),
      EVIDENCE_URL_TTL_SECONDS,
    );

  const signedMap = new Map<number, string>();
  if (!signedError && signedData) {
    for (let i = 0; i < validEntries.length; i++) {
      const signed = signedData[i];
      if (signed && !signed.error) {
        signedMap.set(validEntries[i].index, signed.signedUrl);
      }
    }
  }

  const signed = items.map((a, index) => {
    const url = signedMap.get(index);
    return url ? { ...a, evidencia_url: url } : a;
  });

  return { data: signed, error: null };
}

export async function getTaskWithAssignments(
  taskId: string,
): Promise<{ data: TaskDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, atribuicoes(*, filhos(nome, usuario_id))')
    .eq('id', taskId)
    .returns<TaskDetail>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  const detail = data as TaskDetail;
  detail.atribuicoes = sortAssignments(detail.atribuicoes);
  const task = await signTaskEvidence(detail);
  return { data: task, error: null };
}

export async function listTaskAssignments(
  taskId: string,
  page = 0,
  pageSize = 10,
): Promise<{
  data: AssignmentWithChild[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize; // fetch one extra to detect next page

  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, filhos(nome, usuario_id)')
    .eq('tarefa_id', taskId)
    .order('created_at', { ascending: false })
    .range(from, to)
    .overrideTypes<AssignmentWithChild[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };

  const items = data ?? [];
  const hasMore = items.length > pageSize;
  const page_items = hasMore ? items.slice(0, pageSize) : items;

  // Sign evidence URLs for items that have them
  const signed = await signAssignmentListEvidence(page_items);
  return { data: sortAssignments(signed), hasMore, error: null };
}

async function signAssignmentListEvidence(
  assignments: AssignmentWithChild[],
): Promise<AssignmentWithChild[]> {
  const paths = assignments.map((a) => {
    if (!a.evidencia_url) return null;
    return normalizeEvidencePath(a.evidencia_url);
  });

  const validEntries = paths
    .map((path, index) => (path ? { path, index } : null))
    .filter((e): e is { path: string; index: number } => e !== null);

  if (validEntries.length === 0) return assignments;

  const { data, error } = await supabase.storage.from('evidencias').createSignedUrls(
    validEntries.map((e) => e.path),
    EVIDENCE_URL_TTL_SECONDS,
  );

  if (error || !data) return assignments;

  const signedMap = new Map<number, string>();
  for (let i = 0; i < validEntries.length; i++) {
    const signed = data[i];
    if (signed && !signed.error) {
      signedMap.set(validEntries[i].index, signed.signedUrl);
    }
  }

  return assignments.map((a, index) => {
    const signedUrl = signedMap.get(index);
    return signedUrl ? { ...a, evidencia_url: signedUrl } : a;
  });
}

export async function approveAssignment(
  assignmentId: string,
  opts: { familiaId: string; userId?: string | null; taskTitle: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aprovar_atribuicao', {
    atribuicao_id: assignmentId,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts.userId) {
    dispatchPushNotification('tarefa_aprovada', opts.familiaId, {
      userId: opts.userId,
      taskTitle: opts.taskTitle,
      entityId: assignmentId,
    });
  } else {
    Sentry.addBreadcrumb({
      category: 'push',
      message: `Skipped 'tarefa_aprovada' for '${opts.taskTitle}': missing recipient userId`,
      level: 'warning',
    });
  }

  return { error: null };
}

export async function rejectAssignment(
  assignmentId: string,
  note: string,
  opts: { familiaId: string; userId?: string | null; taskTitle: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('rejeitar_atribuicao', {
    p_atribuicao_id: assignmentId,
    p_nota_rejeicao: note,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts.userId) {
    dispatchPushNotification('tarefa_rejeitada', opts.familiaId, {
      userId: opts.userId,
      taskTitle: opts.taskTitle,
      entityId: assignmentId,
    });
  } else {
    Sentry.addBreadcrumb({
      category: 'push',
      message: `Skipped 'tarefa_rejeitada' for '${opts.taskTitle}': missing recipient userId`,
      level: 'warning',
    });
  }

  return { error: null };
}

export async function cancelAssignmentSubmission(
  assignmentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_envio_atribuicao', {
    p_atribuicao_id: assignmentId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function renewRecurringTasks(): Promise<void> {
  const { error } = await supabase.rpc('garantir_atribuicoes_recorrentes');
  if (error) throw new Error(localizeRpcError(error.message));
}

export async function listChildAssignments(
  page = 0,
  pageSize = 20,
): Promise<{
  data: ChildAssignment[];
  hasMore: boolean;
  error: string | null;
}> {
  const today = toDateString(new Date());
  const sevenDaysAgo = toDateString(new Date(Date.now() - 7 * 86_400_000));
  const visibleAssignmentsFilter = `competencia.is.null,competencia.eq.${today},and(competencia.gte.${sevenDaysAgo},status.in.(aprovada,rejeitada))`;

  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .or(visibleAssignmentsFilter)
    .order('created_at', { ascending: false })
    .range(from, to)
    .overrideTypes<ChildAssignment[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export async function getChildAssignment(
  assignmentId: string,
): Promise<{ data: ChildAssignment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .eq('id', assignmentId)
    .returns<ChildAssignment>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  const assignment = await signEvidence(data);
  return { data: assignment, error: null };
}

export async function completeAssignment(
  assignmentId: string,
  imageUri: string | null,
  opts: {
    familiaId: string;
    childName: string;
    taskTitle: string;
    taskId?: string;
    childUserId?: string;
  },
): Promise<{ error: string | null }> {
  let evidenceUrl: string | undefined;

  if (imageUri) {
    const result = await uploadEvidence(imageUri);
    if (result.error) return { error: result.error };
    if (!result.url) return { error: 'Erro ao fazer upload da imagem.' };
    evidenceUrl = result.url;
  }

  const { error } = await supabase.rpc('concluir_atribuicao', {
    p_atribuicao_id: assignmentId,
    p_evidencia_url: evidenceUrl,
  });

  if (error) {
    if (evidenceUrl) {
      supabase.storage
        .from('evidencias')
        .remove([evidenceUrl])
        .catch(() => {});
    }
    return { error: localizeRpcError(error.message) };
  }
  dispatchPushNotification('tarefa_concluida', opts.familiaId, {
    childName: opts.childName,
    taskTitle: opts.taskTitle,
    ...(opts.taskId ? { entityId: opts.taskId } : {}),
    assignmentId,
    ...(opts.childUserId ? { childUserId: opts.childUserId } : {}),
  });
  return { error: null };
}

export function getAssignmentCancellationState(
  assignment: Pick<Assignment, 'status' | 'competencia'>,
  task: Pick<Task, 'ativo' | 'dias_semana'>,
  referenceDate = new Date(),
): AssignmentCancellationState {
  if (assignment.status !== 'aguardando_validacao') {
    return {
      canCancel: false,
      reason: null,
    };
  }

  if (task.ativo === false) {
    return {
      canCancel: false,
      reason: 'Esta tarefa está desativada e não permite cancelar o envio.',
    };
  }

  if (assignment.competencia !== null && assignment.competencia < toDateString(referenceDate)) {
    return {
      canCancel: false,
      reason: 'Não é possível cancelar o envio de uma tarefa de data anterior.',
    };
  }

  return {
    canCancel: true,
    reason: null,
  };
}

export function getAssignmentCompletionState(
  assignment: Pick<Assignment, 'status'>,
  task: Pick<Task, 'ativo'>,
): AssignmentCompletionState {
  if (assignment.status !== 'pendente') {
    return {
      canComplete: false,
      reason: null,
    };
  }

  if (task.ativo === false) {
    return {
      canComplete: false,
      reason:
        'Esta tarefa foi desativada pelo responsável e não pode mais ser enviada para validação.',
    };
  }

  return {
    canComplete: true,
    reason: null,
  };
}

export function getTaskEditState(
  task: Pick<TaskDetail, 'atribuicoes' | 'dias_semana' | 'ativo' | 'arquivada_em'>,
  _pendingDiasSemana?: number,
): TaskEditState {
  if (task.arquivada_em !== null) {
    return {
      canEdit: false,
      canEditPoints: false,
      errorMessage: 'Esta tarefa está arquivada. Desarquive para editar.',
      infoMessage: null,
    };
  }

  if (task.ativo === false) {
    return {
      canEdit: false,
      canEditPoints: false,
      errorMessage: 'Esta tarefa está pausada e não pode ser editada.',
      infoMessage: null,
    };
  }

  return {
    canEdit: true,
    canEditPoints: true,
    errorMessage: null,
    infoMessage:
      'Se você alterar os pontos, o novo valor será usado apenas nas próximas atribuições.',
  };
}

export function getAssignmentPoints(assignment: Pick<Assignment, 'pontos_snapshot'>): number {
  return assignment.pontos_snapshot;
}

export const buildValidationLine = (
  assignment: Pick<ChildAssignment, 'status' | 'validada_em' | 'concluida_em' | 'competencia'>,
): string | null => {
  if (assignment.status !== 'aprovada' && assignment.status !== 'rejeitada') return null;
  const dateVal = assignment.validada_em ?? assignment.concluida_em;
  if (!dateVal) return null;
  const label = assignment.status === 'aprovada' ? 'Aprovada em ' : 'Rejeitada em ';
  const base = `${label}${formatDate(dateVal)}`;
  if (!assignment.competencia) return base;
  const isCrossDay = toDateString(new Date(dateVal)) !== assignment.competencia;
  if (!isCrossDay) return base;
  const [year, month, day] = assignment.competencia.split('-').map(Number);
  return `${base} (tarefa de ${formatDate(new Date(year, month - 1, day))})`;
};

export async function deactivateTask(taskId: string): Promise<{
  data: { pendingValidationCount: number } | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('desativar_tarefa', {
    p_tarefa_id: taskId,
  });
  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: { pendingValidationCount: data ?? 0 }, error: null };
}

export async function reactivateTask(taskId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase.rpc('reativar_tarefa', {
    p_tarefa_id: taskId,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export function buildTaskDeactivateMessage(
  _task: Pick<Task, 'dias_semana'>,
  assignments: { status: AssignmentStatus }[],
): string {
  const parts: string[] = [];

  const pendingCount = assignments.filter((a) => a.status === 'pendente').length;
  const awaitingCount = assignments.filter((a) => a.status === 'aguardando_validacao').length;

  if (pendingCount > 0) {
    parts.push(
      pendingCount === 1
        ? '1 atribuição pendente será cancelada.'
        : `${pendingCount} atribuições pendentes serão canceladas.`,
    );
  }

  parts.push('Novas atribuições não serão mais geradas enquanto a tarefa estiver pausada.');

  if (awaitingCount > 0) {
    parts.push(
      awaitingCount === 1
        ? '1 atribuição aguardando validação será mantida.'
        : `${awaitingCount} atribuições aguardando validação serão mantidas.`,
    );
  }

  return parts.length > 0 ? parts.join('\n') : 'Esta tarefa será pausada.';
}

export const buildTaskPauseMessage = buildTaskDeactivateMessage;

export function buildTaskArchiveMessage(assignments: { status: AssignmentStatus }[]): string {
  const parts: string[] = [];
  const pendingCount = assignments.filter((a) => a.status === 'pendente').length;
  const awaitingCount = assignments.filter((a) => a.status === 'aguardando_validacao').length;

  if (pendingCount > 0) {
    parts.push(
      pendingCount === 1
        ? '1 atribuição pendente será cancelada.'
        : `${pendingCount} atribuições pendentes serão canceladas.`,
    );
  }

  parts.push('A tarefa some da lista ativa, mas o histórico aprovado fica preservado.');

  if (awaitingCount > 0) {
    parts.push(
      awaitingCount === 1
        ? '1 atribuição aguardando validação será mantida para você revisar.'
        : `${awaitingCount} atribuições aguardando validação serão mantidas para você revisar.`,
    );
  }

  return parts.join('\n');
}

export async function archiveTask(taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('arquivar_tarefa', { p_tarefa_id: taskId });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function unarchiveTask(taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('desarquivar_tarefa', { p_tarefa_id: taskId });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function discardRejection(assignmentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('descartar_rejeicao_atribuicao', {
    p_atribuicao_id: assignmentId,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export type AssignmentRetryState = Readonly<{
  canRetry: boolean;
  attemptsLeft: number;
  reason: string | null;
}>;

export function getAssignmentRetryState(
  assignment: Pick<Assignment, 'status' | 'tentativas'>,
): AssignmentRetryState {
  if (assignment.status !== 'rejeitada') {
    return { canRetry: false, attemptsLeft: 0, reason: null };
  }
  const used = assignment.tentativas ?? 0;
  const left = Math.max(0, MAX_TENTATIVAS - used);
  if (left <= 0) {
    return {
      canRetry: false,
      attemptsLeft: 0,
      reason: 'Você já usou todas as tentativas para esta tarefa.',
    };
  }
  return { canRetry: true, attemptsLeft: left, reason: null };
}

async function uploadEvidence(
  imageUri: string,
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
        supabase.from('usuarios').select('familia_id').eq('id', user.id).single(),
        supabase.from('filhos').select('id').eq('usuario_id', user.id).single(),
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

    const { data, error } = await supabase.storage.from('evidencias').upload(filePath, buffer, {
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

function createEvidenceSuffix(): string {
  return Crypto.randomUUID();
}

const EVIDENCE_URL_TTL_SECONDS = 60 * 60;

async function signTaskEvidence(task: TaskDetail): Promise<TaskDetail> {
  const paths = task.atribuicoes.map((a) => {
    if (!a.evidencia_url) return null;
    return normalizeEvidencePath(a.evidencia_url);
  });

  const validEntries = paths
    .map((path, index) => (path ? { path, index } : null))
    .filter((e): e is { path: string; index: number } => e !== null);

  if (validEntries.length === 0) return task;

  const { data, error } = await supabase.storage.from('evidencias').createSignedUrls(
    validEntries.map((e) => e.path),
    EVIDENCE_URL_TTL_SECONDS,
  );

  const signedMap = new Map<number, string>();
  if (!error && data) {
    for (let i = 0; i < validEntries.length; i++) {
      const signed = data[i];
      if (signed && !signed.error) {
        signedMap.set(validEntries[i].index, signed.signedUrl);
      }
    }
  }

  const assignments = task.atribuicoes.map((a, index) => {
    const signedUrl = signedMap.get(index);
    if (signedUrl) return { ...a, evidencia_url: signedUrl };
    return a;
  });

  return { ...task, atribuicoes: assignments };
}

async function signEvidence<T extends { evidencia_url: string | null }>(item: T): Promise<T> {
  const signedUrl = await resolveEvidenceUrl(item.evidencia_url);
  return { ...item, evidencia_url: signedUrl };
}

async function resolveEvidenceUrl(evidence: string | null): Promise<string | null> {
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
