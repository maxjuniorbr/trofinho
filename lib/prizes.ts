import { localizeRpcError } from './api-error';
import { supabase } from './supabase';

export const PRIZE_EMOJIS = [
  '🎁', '🍦', '🎮', '🎬', '🍕', '📚', '🧸', '🍫', '🎨', '⚽', '🚲', '🎵',
] as const;

export type Prize = {
  id: string;
  familia_id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  emoji: string;
  estoque: number;
  ativo: boolean;
  created_at: string;
};

export type PrizeInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  emoji: string;
  estoque: number;
};

export type UpdatePrizeInput = PrizeInput & {
  ativo?: boolean | null;
};

export async function listPrizes(
  page = 0,
  pageSize = 20,
): Promise<{
  data: Prize[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome')
    .range(from, to)
    .overrideTypes<Prize[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  const page_items = hasMore ? items.slice(0, pageSize) : items;

  return { data: page_items, hasMore, error: null };
}

export async function getPrize(id: string): Promise<{
  data: Prize | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('id', id)
    .returns<Prize>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as Prize | null, error: null };
}

export async function createPrize(input: PrizeInput): Promise<{
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
      familia_id: profile.familia_id,
      nome: input.nome,
      descricao: input.descricao,
      custo_pontos: input.custo_pontos,
      emoji: input.emoji,
      estoque: input.estoque,
    })
    .select()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data, error: null };
}

export async function updatePrize(
  id: string,
  input: UpdatePrizeInput,
): Promise<{ error: string | null; pointsMessage: string | null }> {
  const { data, error } = await supabase.rpc('editar_premio', {
    p_premio_id: id,
    p_nome: input.nome,
    p_descricao: input.descricao ?? '',
    p_custo_pontos: input.custo_pontos,
    p_emoji: input.emoji,
    p_estoque: input.estoque,
    p_ativo: input.ativo ?? undefined,
  });

  if (error) {
    return { error: localizeRpcError(error.message), pointsMessage: null };
  }

  return {
    error: null,
    pointsMessage: (data as string | null) ?? null,
  };
}

export async function deactivatePrize(id: string): Promise<{
  data: { pendingCount: number } | null;
  error: string | null;
  warning: string | null;
}> {
  const { data, error } = await supabase.rpc('desativar_premio', {
    p_premio_id: id,
  });

  if (error) return { data: null, error: localizeRpcError(error.message), warning: null };

  const pendingCount = data ?? 0;
  const warning =
    pendingCount > 0 ? `Existem ${pendingCount} resgates pendentes para este prêmio.` : null;

  return { data: { pendingCount }, error: null, warning };
}

export async function reactivatePrize(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reativar_premio', {
    p_premio_id: id,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listActivePrizes(
  page = 0,
  pageSize = 20,
): Promise<{
  data: Prize[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('ativo', true)
    .order('custo_pontos')
    .range(from, to)
    .overrideTypes<Prize[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  const page_items = hasMore ? items.slice(0, pageSize) : items;

  return { data: page_items, hasMore, error: null };
}
