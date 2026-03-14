import { supabase } from './supabase';

// ─── Tipos ────────────────────────────────────────────────

export type Filho = {
  id: string;
  nome: string;
  usuario_id: string | null;
};

export type Tarefa = {
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

export type StatusAtribuicao =
  | 'pendente'
  | 'aguardando_validacao'
  | 'aprovada'
  | 'rejeitada';

export type Atribuicao = {
  id: string;
  tarefa_id: string;
  filho_id: string;
  status: StatusAtribuicao;
  evidencia_url: string | null;
  nota_rejeicao: string | null;
  concluida_em: string | null;
  validada_em: string | null;
  validada_por: string | null;
  created_at: string;
};

export type TarefaListItem = {
  id: string;
  titulo: string;
  pontos: number;
  timebox_fim: string;
  atribuicoes: { status: StatusAtribuicao }[];
};

export type AtribuicaoComFilho = Atribuicao & {
  filhos: { nome: string };
};

export type TarefaDetalhe = Tarefa & {
  atribuicoes: AtribuicaoComFilho[];
};

export type AtribuicaoFilho = Atribuicao & {
  tarefas: Tarefa;
};

export type Saldo = {
  filho_id: string;
  saldo_livre: number;
  cofrinho: number;
};

// ─── Admin: Filhos ────────────────────────────────────────

export async function listarFilhosDaFamilia(): Promise<{
  data: Filho[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('filhos')
    .select('id, nome, usuario_id')
    .order('nome');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Filho[], error: null };
}

// ─── Admin: Tarefas ───────────────────────────────────────

export type NovaTarefaInput = {
  titulo: string;
  descricao: string | null;
  pontos: number;
  timebox_inicio: string;
  timebox_fim: string;
  exige_evidencia: boolean;
  filhoIds: string[];
};

export async function criarTarefa(
  input: NovaTarefaInput
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuário não autenticado' };

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('familia_id')
    .eq('id', user.id)
    .single();

  if (!perfil) return { error: 'Perfil não encontrado' };

  const { data: tarefa, error: tarefaError } = await supabase
    .from('tarefas')
    .insert({
      titulo: input.titulo,
      descricao: input.descricao,
      pontos: input.pontos,
      timebox_inicio: input.timebox_inicio,
      timebox_fim: input.timebox_fim,
      exige_evidencia: input.exige_evidencia,
      familia_id: perfil.familia_id,
      criado_por: user.id,
    })
    .select('id')
    .single();

  if (tarefaError || !tarefa) {
    return { error: tarefaError?.message ?? 'Erro ao criar tarefa' };
  }

  if (input.filhoIds.length > 0) {
    const atribuicoes = input.filhoIds.map((filhoId) => ({
      tarefa_id: tarefa.id,
      filho_id: filhoId,
      status: 'pendente' as const,
    }));

    const { error: atribError } = await supabase
      .from('atribuicoes')
      .insert(atribuicoes);

    if (atribError) return { error: atribError.message };
  }

  return { error: null };
}

export async function listarTarefasAdmin(): Promise<{
  data: TarefaListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, pontos, timebox_fim, atribuicoes(status)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as TarefaListItem[], error: null };
}

export async function buscarTarefaComAtribuicoes(
  tarefaId: string
): Promise<{ data: TarefaDetalhe | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, atribuicoes(*, filhos(nome))')
    .eq('id', tarefaId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as TarefaDetalhe, error: null };
}

// ─── Admin: Validação ─────────────────────────────────────

export async function aprovarAtribuicao(
  atribuicaoId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aprovar_atribuicao', {
    atribuicao_id: atribuicaoId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function rejeitarAtribuicao(
  atribuicaoId: string,
  nota: string
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuário não autenticado' };

  const { error } = await supabase
    .from('atribuicoes')
    .update({
      status: 'rejeitada',
      nota_rejeicao: nota,
      validada_em: new Date().toISOString(),
      validada_por: user.id,
    })
    .eq('id', atribuicaoId)
    .eq('status', 'aguardando_validacao');

  if (error) return { error: error.message };
  return { error: null };
}

// ─── Filho: Tarefas ───────────────────────────────────────

export async function listarAtribuicoesFilho(): Promise<{
  data: AtribuicaoFilho[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as AtribuicaoFilho[], error: null };
}

export async function buscarAtribuicaoFilho(
  atribuicaoId: string
): Promise<{ data: AtribuicaoFilho | null; error: string | null }> {
  const { data, error } = await supabase
    .from('atribuicoes')
    .select('*, tarefas(*)')
    .eq('id', atribuicaoId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as AtribuicaoFilho, error: null };
}

export async function concluirAtribuicao(
  atribuicaoId: string,
  imagemUri: string | null
): Promise<{ error: string | null }> {
  let evidenciaUrl: string | null = null;

  if (imagemUri) {
    const result = await uploadEvidencia(imagemUri);
    if (result.error) return { error: result.error };
    evidenciaUrl = result.url;
  }

  const { error } = await supabase
    .from('atribuicoes')
    .update({
      status: 'aguardando_validacao',
      evidencia_url: evidenciaUrl,
      concluida_em: new Date().toISOString(),
    })
    .eq('id', atribuicaoId);

  if (error) return { error: error.message };
  return { error: null };
}

async function uploadEvidencia(
  imagemUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const arraybuffer = await fetch(imagemUri).then((res) =>
      res.arrayBuffer()
    );

    const fileName = `evidencia_${Date.now()}.jpg`;
    const filePath = `public/${fileName}`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(filePath, arraybuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) return { url: null, error: error.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from('evidencias').getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch {
    return { url: null, error: 'Erro ao fazer upload da imagem' };
  }
}

// ─── Saldos ───────────────────────────────────────────────

export async function buscarSaldoFilho(
  filhoId: string
): Promise<{ data: Saldo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('saldos')
    .select('filho_id, saldo_livre, cofrinho')
    .eq('filho_id', filhoId)
    .single();

  if (error?.code === 'PGRST116') return { data: null, error: null }; // não encontrado
  if (error) return { data: null, error: error.message };
  return { data: data as Saldo, error: null };
}

// ─── Utilitários ─────────────────────────────────────────

export function labelStatus(status: StatusAtribuicao): string {
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

export function corStatus(status: StatusAtribuicao): string {
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
