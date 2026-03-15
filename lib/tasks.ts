import { toDateString } from './utils';
import { readImageAsArrayBuffer, inferImageExtension, inferImageContentType, extractErrorMessage } from './image-utils';
import { supabase } from './supabase';

export type Child = {
  id: string;
  nome: string;
  usuario_id: string | null;
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
  evidencia_url: string | null;
  nota_rejeicao: string | null;
  concluida_em: string | null;
  validada_em: string | null;
  validada_por: string | null;
  created_at: string;
};

export type TaskListItem = {
  id: string;
  titulo: string;
  pontos: number;
  frequencia: TaskFrequencia;
  atribuicoes: { status: AssignmentStatus }[];
};

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

export async function listFamilyChildren(): Promise<{
  data: Child[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('filhos')
    .select('id, nome, usuario_id')
    .order('nome');

  if (error) return { data: [], error: error.message };
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

  if (error) return { error: error.message };
  return { error: null };
}

export async function listAdminTasks(limit = 50): Promise<{
  data: TaskListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, frequencia, atribuicoes(status)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as TaskListItem[], error: null };
}

export async function getTaskWithAssignments(
  taskId: string
): Promise<{ data: TaskDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, atribuicoes(*, filhos(nome))')
    .eq('id', taskId)
    .single();

  if (error) return { data: null, error: error.message };
  const task = await signTaskEvidence(data as unknown as TaskDetail);
  return { data: task, error: null };
}

export async function approveAssignment(
  assignmentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aprovar_atribuicao', {
    atribuicao_id: assignmentId,
  });

  if (error) return { error: error.message };
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

  if (error) return { error: error.message };
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
    .limit(100);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as ChildAssignment[], error: null };
}

export async function getChildAssignment(
  assignmentId: string
): Promise<{ data: ChildAssignment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .eq('id', assignmentId)
    .single();

  if (error) return { data: null, error: error.message };
  const assignment = await signEvidence(data as unknown as ChildAssignment);
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

  if (error) return { error: error.message };
  return { error: null };
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
      return { url: null, error: profileError?.message ?? 'Perfil não encontrado' };
    }

    if (childError || !child?.id) {
      return { url: null, error: childError?.message ?? 'Filho não encontrado' };
    }

    const extension = inferImageExtension(imageUri);
    const buffer = await readImageAsArrayBuffer(imageUri);
    const fileName = `evidencia_${createEvidenceSuffix()}.${extension}`;
    const filePath = `${profile.familia_id}/${child.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(filePath, buffer, {
        contentType: inferImageContentType(extension),
        upsert: false,
      });

    if (error) return { url: null, error: error.message };
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
