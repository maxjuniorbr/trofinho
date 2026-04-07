import { localizeRpcError } from './api-error';
import { dispatchPushNotification } from './push';
import { supabase } from './supabase';

/**
 * Minimum withdrawal amount so the penalty is at least 1 pt.
 * When rate is 0, returns 1 (no penalty, any amount is valid).
 */
export const getMinimumWithdrawalAmount = (rate: number): number => {
  if (rate <= 0) return 1;
  return Math.ceil(100 / rate);
};

/**
 * Calculate net amount after penalty, mirroring DB logic:
 * penalty = GREATEST(FLOOR(amount * rate / 100), 1) when rate > 0.
 */
export const calculateNetAmount = (
  amount: number,
  rate: number,
): { net: number; penalty: number } => {
  if (rate <= 0) return { net: amount, penalty: 0 };
  const penalty = Math.max(Math.floor((amount * rate) / 100), 1);
  return { net: amount - penalty, penalty };
};

export type PiggyBankWithdrawalStatus = 'pendente' | 'confirmado' | 'cancelado';

export type PiggyBankWithdrawal = {
  id: string;
  filho_id: string;
  valor_solicitado: number;
  taxa_aplicada: number;
  valor_liquido: number;
  status: PiggyBankWithdrawalStatus;
  created_at: string;
  updated_at: string;
};

export type PiggyBankWithdrawalWithChild = PiggyBankWithdrawal & {
  filhos: { nome: string; usuario_id: string | null };
};

export async function requestPiggyBankWithdrawal(
  amount: number,
  opts?: { familiaId: string; childName: string; childUserId?: string },
): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('solicitar_resgate_cofrinho', {
    p_valor: amount,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };

  if (opts) {
    dispatchPushNotification('resgate_cofrinho_solicitado', opts.familiaId, {
      childName: opts.childName,
      ...(data ? { withdrawalId: String(data) } : {}),
      ...(opts.childUserId ? { childUserId: opts.childUserId } : {}),
    });
  }

  return { data: data ? String(data) : null, error: null };
}

export async function confirmPiggyBankWithdrawal(
  withdrawalId: string,
  opts: { familiaId: string; userId?: string | null; amount: number },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirmar_resgate_cofrinho', {
    p_resgate_id: withdrawalId,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts.userId) {
    dispatchPushNotification('resgate_cofrinho_confirmado', opts.familiaId, {
      userId: opts.userId,
      amount: String(opts.amount),
    });
  } else {
    console.warn(
      `[push] Not dispatching 'resgate_cofrinho_confirmado': Missing required recipient (userId).`,
    );
  }

  return { error: null };
}

export async function cancelPiggyBankWithdrawal(
  withdrawalId: string,
  opts?: { familiaId: string; userId?: string | null; amount: number },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_resgate_cofrinho', {
    p_resgate_id: withdrawalId,
  });

  if (error) return { error: localizeRpcError(error.message) };

  if (opts?.userId) {
    dispatchPushNotification('resgate_cofrinho_cancelado', opts.familiaId, {
      userId: opts.userId,
      amount: String(opts.amount),
    });
  }

  return { error: null };
}

export async function listPendingPiggyBankWithdrawals(): Promise<{
  data: PiggyBankWithdrawalWithChild[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates_cofrinho')
    .select('*, filhos(nome, usuario_id)')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .overrideTypes<PiggyBankWithdrawalWithChild[], { merge: false }>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function getChildPendingWithdrawal(): Promise<{
  data: PiggyBankWithdrawal | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('resgates_cofrinho')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1)
    .overrideTypes<PiggyBankWithdrawal[], { merge: false }>();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data?.[0] ?? null, error: null };
}

export async function configureWithdrawalRate(
  childId: string,
  rate: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('configurar_taxa_resgate_cofrinho', {
    p_filho_id: childId,
    p_taxa: rate,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function countPendingPiggyBankWithdrawals(): Promise<{
  data: number;
  error: string | null;
}> {
  const { count, error } = await supabase
    .from('resgates_cofrinho')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) return { data: 0, error: localizeRpcError(error.message) };
  return { data: count ?? 0, error: null };
}
