import * as Sentry from '@sentry/react-native';
import { localizeRpcError } from './api-error';
import { supabase } from './supabase';

export type TransactionType =
  | 'credito'
  | 'debito'
  | 'transferencia_cofrinho'
  | 'valorizacao'
  | 'penalizacao'
  | 'resgate'
  | 'estorno_resgate'
  | 'resgate_cofrinho';

// Locked to 'mensal' by migration 20260419200000. DB enum retains all values for backward compat.
export type AppreciationPeriod = 'mensal';

export interface Balance {
  filho_id: string;
  saldo_livre: number;
  cofrinho: number;
  indice_valorizacao: number;
  periodo_valorizacao: AppreciationPeriod;
  data_ultima_valorizacao: string | null;
  proxima_valorizacao_em: string | null;
  taxa_resgate_cofrinho: number;
  prazo_bloqueio_dias: number;
  updated_at: string;
}

export interface PiggyBankConfig {
  rate: number;
  withdrawalRate: number;
  prazo: number;
}

export interface Transaction {
  id: string;
  filho_id: string;
  tipo: TransactionType;
  valor: number;
  descricao: string;
  referencia_id: string | null;
  created_at: string;
}

export interface BalanceWithChild extends Balance {
  filhos: { nome: string; ativo: boolean; avatar_url: string | null };
}

export function getTransactionTypeLabel(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    credito: 'Tarefa aprovada',
    debito: 'Débito',
    transferencia_cofrinho: 'Para cofrinho',
    valorizacao: 'Valorização',
    penalizacao: 'Penalização',
    resgate: 'Resgate de prêmio',
    estorno_resgate: 'Estorno de resgate',
    resgate_cofrinho: 'Resgate do cofrinho',
  };
  return map[type] ?? type;
}

export type TransactionCategory = 'ganho' | 'gasto' | 'cofrinho';

export function getTransactionCategory(type: TransactionType): TransactionCategory {
  if (type === 'credito' || type === 'estorno_resgate') return 'ganho';
  if (type === 'transferencia_cofrinho' || type === 'resgate_cofrinho' || type === 'valorizacao')
    return 'cofrinho';
  return 'gasto';
}

export function isCredit(type: TransactionType): boolean {
  return type === 'credito' || type === 'valorizacao' || type === 'estorno_resgate';
}

export function getAppreciationPeriodLabel(period: AppreciationPeriod): string {
  const map: Record<AppreciationPeriod, string> = {
    mensal: 'mês',
  };
  return map[period];
}

export async function getBalance(
  childId?: string,
): Promise<{ data: Balance | null; error: string | null }> {
  let query = supabase.from('saldos').select('*');

  if (childId) {
    query = query.eq('filho_id', childId);
  }

  const { data, error } = await query.returns<Balance>().single();

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null };
    return { data: null, error: localizeRpcError(error.message) };
  }

  return { data, error: null };
}

export async function listAdminBalances(): Promise<{
  data: BalanceWithChild[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('saldos')
    .select('*, filhos(nome, ativo, avatar_url)')
    .order('filhos(nome)')
    .overrideTypes<BalanceWithChild[], { merge: false }>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function listTransactions(
  childId: string,
  page = 0,
  pageSize = 20,
): Promise<{ data: Transaction[]; hasMore: boolean; error: string | null }> {
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('filho_id', childId)
    .order('created_at', { ascending: false })
    .range(from, to)
    .overrideTypes<Transaction[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
}

export async function listTransactionsByPeriod(
  childId: string,
  from: string,
  to: string,
): Promise<{ data: Transaction[]; error: string | null }> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('filho_id', childId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false })
    .overrideTypes<Transaction[], { merge: false }>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function transferToPiggyBank(
  childId: string,
  amount: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('transferir_para_cofrinho', {
    p_filho_id: childId,
    p_valor: amount,
  });
  if (error) {
    const localized = localizeRpcError(error.message);
    if (localized === 'Algo deu errado. Tente novamente.') {
      Sentry.captureException(error, {
        tags: { subsystem: 'cofrinho' },
        extra: { childId, amount },
      });
    }
    return { error: localized };
  }
  return { error: null };
}

export async function applyPenalty(
  childId: string,
  amount: number,
  description: string,
): Promise<{ data: { deducted: number } | null; error: string | null }> {
  const { data, error } = await supabase.rpc('aplicar_penalizacao', {
    p_filho_id: childId,
    p_valor: amount,
    p_descricao: description,
  });
  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: { deducted: (data as number) ?? amount }, error: null };
}

export const calculateProjection = (cofrinho: number, rate: number): number => {
  if (rate <= 0 || cofrinho <= 0) return 0;
  return Math.max(Math.floor((cofrinho * rate) / 100), 1);
};

export async function configureAppreciation(
  childId: string,
  rate: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('configurar_valorizacao', {
    p_filho_id: childId,
    p_indice: rate,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function configurePiggyBank(
  childId: string,
  config: PiggyBankConfig,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('configurar_cofrinho', {
    p_filho_id: childId,
    p_indice: config.rate,
    p_taxa: config.withdrawalRate,
    p_prazo: config.prazo,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function syncAutomaticAppreciation(childId?: string): Promise<void> {
  try {
    if (childId) {
      await supabase.rpc('sincronizar_valorizacoes_automaticas', { p_filho_id: childId });
    } else {
      await supabase.rpc('sincronizar_valorizacoes_automaticas');
    }
  } catch (error) {
    // Best-effort: sync failure must not block balance reads
    Sentry.captureException(error, { tags: { subsystem: 'balances', step: 'sync-appreciation' } });
  }
}
