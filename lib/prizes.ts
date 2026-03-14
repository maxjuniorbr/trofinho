import { supabase } from './supabase';

export type Prize = {
  id: string;
  familia_id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  ativo: boolean;
  created_at: string;
};

export type RedemptionStatus = 'pendente' | 'confirmado' | 'cancelado';

export type Redemption = {
  id: string;
  filho_id: string;
  premio_id: string;
  status: RedemptionStatus;
  pontos_debitados: number;
  created_at: string;
  updated_at: string;
};

export type RedemptionWithPrize = Redemption & {
  premios: { nome: string; custo_pontos: number };
};

export type RedemptionWithChildAndPrize = Redemption & {
  filhos: { nome: string };
  premios: { nome: string };
};

export type NewPrizeInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
};

export type UpdatePrizeInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
};

export function getRedemptionStatusLabel(status: RedemptionStatus): string {
  const map: Record<RedemptionStatus, string> = {
    pendente:   'Pendente',
    confirmado: 'Confirmado',
    cancelado:  'Cancelado',
  };
  return map[status];
}

export function getRedemptionStatusEmoji(status: RedemptionStatus): string {
  const map: Record<RedemptionStatus, string> = {
    pendente:   '⏳',
    confirmado: '✅',
    cancelado:  '❌',
  };
  return map[status];
}

export function getRedemptionStatusColor(status: RedemptionStatus): string {
  const map: Record<RedemptionStatus, string> = {
    pendente:   '#F59E0B',
    confirmado: '#10B981',
    cancelado:  '#EF4444',
  };
  return map[status];
}

export async function listPrizes(): Promise<{
  data: Prize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Prize[], error: null };
}

export async function getPrize(id: string): Promise<{
  data: Prize | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Prize, error: null };
}

export async function createPrize(input: NewPrizeInput): Promise<{
  data: Prize | null;
  error: string | null;
}> {
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return { data: null, error: 'Usuário não autenticado' };

  const { data: profile } = await supabase
    .from('usuarios')
    .select('familia_id')
    .eq('id', authUser.user.id)
    .single();

  if (!profile) return { data: null, error: 'Perfil não encontrado' };

  const { data, error } = await supabase
    .from('premios')
    .insert({
      familia_id:   profile.familia_id,
      nome:         input.nome,
      descricao:    input.descricao,
      custo_pontos: input.custo_pontos,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Prize, error: null };
}

export async function updatePrize(
  id: string,
  input: UpdatePrizeInput
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

export async function deactivatePrize(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('premios')
    .update({ ativo: false })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function reactivatePrize(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('premios')
    .update({ ativo: true })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function listRedemptions(): Promise<{
  data: RedemptionWithChildAndPrize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates')
    .select('*, filhos(nome), premios(nome)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RedemptionWithChildAndPrize[], error: null };
}

export async function confirmRedemption(redemptionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirmar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function cancelRedemption(redemptionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function listActivePrizes(): Promise<{
  data: Prize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('ativo', true)
    .order('custo_pontos');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Prize[], error: null };
}

export async function listChildRedemptions(): Promise<{
  data: RedemptionWithPrize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates')
    .select('*, premios(nome, custo_pontos)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RedemptionWithPrize[], error: null };
}

export async function requestRedemption(prizeId: string): Promise<{
  data: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('solicitar_resgate', {
    p_premio_id: prizeId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

export async function countPendingRedemptions(): Promise<{
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
