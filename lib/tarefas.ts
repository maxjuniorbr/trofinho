import { File } from 'expo-file-system';
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
  const tarefa = await assinarEvidenciasTarefa(data as unknown as TarefaDetalhe);
  return { data: tarefa, error: null };
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
  const atribuicao = await assinarEvidencia(
    data as unknown as AtribuicaoFilho
  );

  return { data: atribuicao, error: null };
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
    .eq('id', atribuicaoId)
    .eq('status', 'pendente');

  if (error) return { error: error.message };
  return { error: null };
}

async function uploadEvidencia(
  imagemUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, error: 'Usuário não autenticado' };
    }

    const [{ data: perfil, error: perfilError }, { data: filho, error: filhoError }] =
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

    if (perfilError || !perfil?.familia_id) {
      return { url: null, error: perfilError?.message ?? 'Perfil não encontrado' };
    }

    if (filhoError || !filho?.id) {
      return { url: null, error: filhoError?.message ?? 'Filho não encontrado' };
    }

    const extensao = inferirExtensaoImagem(imagemUri);
    const arraybuffer = await lerImagemComoArrayBuffer(imagemUri);
    const fileName = `evidencia_${Date.now()}_${gerarSufixoAleatorio()}.${extensao}`;
    const filePath = `${perfil.familia_id}/${filho.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(filePath, arraybuffer, {
        contentType: inferirContentTypeImagem(extensao),
        upsert: false,
      });

    if (error) return { url: null, error: error.message };
    return { url: data.path, error: null };
  } catch (error) {
    return {
      url: null,
      error: extrairMensagemErro(error, 'Erro ao fazer upload da imagem'),
    };
  }
}

async function lerImagemComoArrayBuffer(imagemUri: string): Promise<ArrayBuffer> {
  const uriNormalizada = imagemUri.split('?')[0] ?? imagemUri;

  if (
    !uriNormalizada.startsWith('http://') &&
    !uriNormalizada.startsWith('https://') &&
    !uriNormalizada.startsWith('blob:')
  ) {
    try {
      return await new File(uriNormalizada).arrayBuffer();
    } catch {
      // Fallback para ambientes/URIs onde o expo-file-system não consiga abrir o arquivo.
    }
  }

  const resposta = await fetch(imagemUri);

  if (!resposta.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  return resposta.arrayBuffer();
}

function gerarSufixoAleatorio(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    return Array.from(cryptoApi.getRandomValues(new Uint8Array(8)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function inferirExtensaoImagem(imagemUri: string): string {
  const extensao = imagemUri.split('?')[0]?.split('.').pop()?.toLowerCase();

  switch (extensao) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'heic':
    case 'heif':
      return extensao;
    default:
      return 'jpg';
  }
}

function inferirContentTypeImagem(extensao: string): string {
  switch (extensao) {
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

function extrairMensagemErro(error: unknown, fallback: string): string {
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

const EVIDENCIA_URL_TTL_SECONDS = 60 * 60;

async function assinarEvidenciasTarefa(
  tarefa: TarefaDetalhe
): Promise<TarefaDetalhe> {
  const atribuicoes = await Promise.all(
    tarefa.atribuicoes.map((atrib) => assinarEvidencia(atrib))
  );

  return {
    ...tarefa,
    atribuicoes,
  };
}

async function assinarEvidencia<T extends { evidencia_url: string | null }>(
  item: T
): Promise<T> {
  const urlAssinada = await resolverUrlEvidencia(item.evidencia_url);

  return {
    ...item,
    evidencia_url: urlAssinada,
  };
}

async function resolverUrlEvidencia(
  evidencia: string | null
): Promise<string | null> {
  if (!evidencia) return null;

  const caminho = normalizarCaminhoEvidencia(evidencia);
  if (!caminho) return evidencia;

  const { data, error } = await supabase.storage
    .from('evidencias')
    .createSignedUrl(caminho, EVIDENCIA_URL_TTL_SECONDS);

  if (error) return null;
  return data.signedUrl;
}

function normalizarCaminhoEvidencia(evidencia: string): string | null {
  if (!evidencia.includes('://')) {
    return evidencia;
  }

  const marcadoresConhecidos = [
    '/storage/v1/object/public/evidencias/',
    '/storage/v1/object/sign/evidencias/',
    '/object/public/evidencias/',
    '/object/sign/evidencias/',
  ];

  for (const marcador of marcadoresConhecidos) {
    if (evidencia.includes(marcador)) {
      const caminho = evidencia.split(marcador)[1]?.split('?')[0] ?? '';
      return caminho ? decodeURIComponent(caminho) : null;
    }
  }

  try {
    const url = new URL(evidencia);
    const indiceBucket = url.pathname.indexOf('/evidencias/');

    if (indiceBucket === -1) {
      return null;
    }

    const caminho = url.pathname.slice(indiceBucket + '/evidencias/'.length);
    return caminho ? decodeURIComponent(caminho) : null;
  } catch {
    return null;
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
