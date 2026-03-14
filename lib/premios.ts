import { supabase } from './supabase';

// ─── Tipos ────────────────────────────────────────────────

export type Premio = {
  id: string;
  familia_id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  ativo: boolean;
  created_at: string;
};

export type StatusResgate = 'pendente' | 'confirmado' | 'cancelado';

export type Resgate = {
  id: string;
  filho_id: string;
  premio_id: string;
  status: StatusResgate;
  pontos_debitados: number;
  created_at: string;
  updated_at: string;
};

export type ResgateComPremio = Resgate & {
  premios: { nome: string; custo_pontos: number };
};

export type ResgateComFilhoEPremio = Resgate & {
  filhos: { nome: string };
  premios: { nome: string };
};

export type NovoPremioInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
};

export type AtualizarPremioInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
};

// ─── Helpers ─────────────────────────────────────────────

export function labelStatusResgate(status: StatusResgate): string {
  const map: Record<StatusResgate, string> = {
    pendente:   'Pendente',
    confirmado: 'Confirmado',
    cancelado:  'Cancelado',
  };
  return map[status];
}

export function emojiStatusResgate(status: StatusResgate): string {
  const map: Record<StatusResgate, string> = {
    pendente:   '⏳',
    confirmado: '✅',
    cancelado:  '❌',
  };
  return map[status];
}

export function corStatusResgate(status: StatusResgate): string {
  const map: Record<StatusResgate, string> = {
    pendente:   '#F59E0B',
    confirmado: '#10B981',
    cancelado:  '#EF4444',
  };
  return map[status];
}

// ─── Admin: Prêmios ───────────────────────────────────────

export async function listarPremios(): Promise<{
  data: Premio[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Premio[], error: null };
}

export async function buscarPremio(id: string): Promise<{
  data: Premio | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Premio, error: null };
}

export async function criarPremio(input: NovoPremioInput): Promise<{
  data: Premio | null;
  error: string | null;
}> {
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return { data: null, error: 'Usuário não autenticado' };

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('familia_id')
    .eq('id', usuario.user.id)
    .single();

  if (!perfil) return { data: null, error: 'Perfil não encontrado' };

  const { data, error } = await supabase
    .from('premios')
    .insert({
      familia_id:   perfil.familia_id,
      nome:         input.nome,
      descricao:    input.descricao,
      custo_pontos: input.custo_pontos,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Premio, error: null };
}

export async function atualizarPremio(
  id: string,
  input: AtualizarPremioInput
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('premios')
    .update({
      nome:         input.nome,
      descricao:    input.descricao,
      custo_pontos: input.custo_pontos,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function desativarPremio(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('premios')
    .update({ ativo: false })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function reativarPremio(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('premios')
    .update({ ativo: true })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

// ─── Admin: Resgates ─────────────────────────────────────

export async function listarResgates(): Promise<{
  data: ResgateComFilhoEPremio[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates')
    .select('*, filhos(nome), premios(nome)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ResgateComFilhoEPremio[], error: null };
}

export async function confirmarResgate(resgateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirmar_resgate', {
    p_resgate_id: resgateId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function cancelarResgate(resgateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_resgate', {
    p_resgate_id: resgateId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

// ─── Filho: Prêmios ──────────────────────────────────────

export async function listarPremiosAtivos(): Promise<{
  data: Premio[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('custo_pontos');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Premio[], error: null };
}

// ─── Filho: Resgates ─────────────────────────────────────

export async function listarResgatesFilho(): Promise<{
  data: ResgateComPremio[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates')
    .select('*, premios(nome, custo_pontos)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ResgateComPremio[], error: null };
}

export async function solicitarResgate(premioId: string): Promise<{
  data: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('solicitar_resgate', {
    p_premio_id: premioId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

export async function contarResgatesPendentes(): Promise<{
  data: number;
  error: string | null;
}> {
  const { count, error } = await supabase
    .from('resgates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) return { data: 0, error: error.message };
  return { data: count ?? 0, error: null };
}
