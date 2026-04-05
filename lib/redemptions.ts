import { localizeRpcError } from './api-error';
import { dispatchPushNotification } from './push';
import { supabase } from './supabase';

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
  filhos: { nome: string; usuario_id: string | null };
  premios: { nome: string };
};

export async function listRedemptions(
  page = 0,
  pageSize = 20,
): Promise<{
  data: RedemptionWithChildAndPrize[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  // .returns needed: joined shape (filhos + premios) differs from generated row type
  const { data, error } = await supabase
    .from('resgates')
    .select('*, filhos(nome, usuario_id), premios(nome)')
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<RedemptionWithChildAndPrize[]>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export async function confirmRedemption(
  redemptionId: string,
  opts: { familiaId: string; userId?: string | null; prizeName: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirmar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts.userId) {
    dispatchPushNotification('resgate_confirmado', opts.familiaId, {
      userId: opts.userId,
      prizeName: opts.prizeName,
    });
  } else {
    console.warn(`[push] Not dispatching 'resgate_confirmado' for '${opts.prizeName}': Missing required recipient (userId).`);
  }

  return { error: null };
}

export async function cancelRedemption(
  redemptionId: string,
  opts?: { familiaId: string; userId?: string | null; prizeName: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts) {
    if (opts.userId) {
      dispatchPushNotification('resgate_cancelado', opts.familiaId, {
        userId: opts.userId,
        prizeName: opts.prizeName,
      });
    } else {
      console.warn(`[push] Not dispatching 'resgate_cancelado' for '${opts.prizeName}': Missing required recipient (userId).`);
    }
  }

  return { error: null };
}

export async function listChildRedemptions(
  page = 0,
  pageSize = 20,
): Promise<{
  data: RedemptionWithPrize[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  // .returns needed: joined shape (premios) differs from generated row type
  const { data, error } = await supabase
    .from('resgates')
    .select('*, premios(nome, custo_pontos)')
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<RedemptionWithPrize[]>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export async function requestRedemption(
  prizeId: string,
  opts?: { familiaId: string; childName: string; prizeName: string },
): Promise<{
  data: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('solicitar_resgate', {
    p_premio_id: prizeId,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  if (opts) {
    dispatchPushNotification('resgate_solicitado', opts.familiaId, {
      childName: opts.childName,
      prizeName: opts.prizeName,
    });
  } else {
    console.warn("[push] Not dispatching 'resgate_solicitado': Missing profile context (familiaId).");
  }
  // RPC solicitar_resgate returns the redemption ID as text
  return { data: data, error: null };
}

export async function countPendingRedemptions(): Promise<{
  data: number;
  error: string | null;
}> {
  const { count, error } = await supabase
    .from('resgates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) return { data: 0, error: localizeRpcError(error.message) };
  return { data: count ?? 0, error: null };
}
