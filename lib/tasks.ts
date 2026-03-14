import { File } from 'expo-file-system';
import { supabase } from './supabase';

export type Child = {
  id: string;
  nome: string;
  usuario_id: string | null;
};

export type Task = {
  id: string;
  familia_id: string;
  titulo: string;
  descricao: string | null;
  pontos: number;
  timebox_inicio: string;
  timebox_fim: string;
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
  timebox_fim: string;
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
  timebox_inicio: string;
  timebox_fim: string;
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
    p_timebox_inicio: input.timebox_inicio,
    p_timebox_fim: input.timebox_fim,
    p_exige_evidencia: input.exige_evidencia,
    p_filho_ids: input.filhoIds,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function listAdminTasks(): Promise<{
  data: TaskListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, timebox_fim, atribuicoes(status)')
    .order('created_at', { ascending: false });

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

export async function listChildAssignments(): Promise<{
  data: ChildAssignment[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .order('created_at', { ascending: false });

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
    const fileName = `evidencia_${Date.now()}_${generateRandomSuffix()}.${extension}`;
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

async function readImageAsArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  const normalizedUri = imageUri.split('?')[0] ?? imageUri;

  if (
    !normalizedUri.startsWith('http://') &&
    !normalizedUri.startsWith('https://') &&
    !normalizedUri.startsWith('blob:')
  ) {
    try {
      return await new File(normalizedUri).arrayBuffer();
    } catch {
      // Fallback for environments/URIs where expo-file-system cannot open the file.
    }
  }

  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  return response.arrayBuffer();
}

function generateRandomSuffix(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    return Array.from(cryptoApi.getRandomValues(new Uint8Array(8)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function inferImageExtension(imageUri: string): string {
  const extension = imageUri.split('?')[0]?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'heic':
    case 'heif':
      return extension;
    default:
      return 'jpg';
  }
}

function inferImageContentType(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
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

export function getStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'aguardando_validacao':
      return 'Aguardando validação';
    case 'aprovada':
      return 'Aprovada';
    case 'rejeitada':
      return 'Rejeitada';
  }
}

export function getStatusColor(status: AssignmentStatus): string {
  switch (status) {
    case 'pendente':
      return '#F59E0B';
    case 'aguardando_validacao':
      return '#3B82F6';
    case 'aprovada':
      return '#10B981';
    case 'rejeitada':
      return '#EF4444';
  }
}
