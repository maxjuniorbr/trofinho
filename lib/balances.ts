import { localizeRpcError } from './api-error';
import { captureException } from '@lib/sentry';
import { supabase } from './supabase';

export type TransactionType =
  | 'credito'
  | 'debito'
  | 'transferencia_cofrinho'
  | 'valorizacao'
  | 'penalizacao'
  | 'resgate'
  | 'estorno_resgate';

export type AppreciationPeriod = 'diario' | 'semanal' | 'mensal';

export interface Balance {
  filho_id: string;
  saldo_livre: number;
  cofrinho: number;
  indice_valorizacao: number;
  periodo_valorizacao: AppreciationPeriod;
  data_ultima_valorizacao: string | null;
  proxima_valorizacao_em: string | null;
  updated_at: string;
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
  filhos: { nome: string };
}

export function getTransactionTypeLabel(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    credito:                'Tarefa aprovada',
    debito:                 'Débito',
    transferencia_cofrinho: 'Para cofrinho',
    valorizacao:            'Valorização',
    penalizacao:            'Penalização',
    resgate:                'Resgate de prêmio',
    estorno_resgate:        'Estorno de resgate',
  };
  return map[type] ?? type;
}

export function isCredit(type: TransactionType): boolean {
  return type === 'credito' || type === 'valorizacao' || type === 'estorno_resgate';
}

export function getAppreciationPeriodLabel(period: AppreciationPeriod): string {
  const map: Record<AppreciationPeriod, string> = {
    diario: 'dia',
    semanal: 'semana',
    mensal: 'mês',
  };
  return map[period];
}

export async function getBalance(childId?: string): Promise<{ data: Balance | null; error: string | null }> {
  let query = supabase
    .from('saldos')
    .select('*');

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

export async function listAdminBalances(): Promise<{ data: BalanceWithChild[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saldos')
    .select('*, filhos(nome)')
    .order('filhos(nome)')
    .returns<BalanceWithChild[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function listTransactions(
  childId: string,
  limit = 30
): Promise<{ data: Transaction[]; error: string | null }> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('filho_id', childId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<Transaction[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function transferToPiggyBank(
  childId: string,
  amount: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('transferir_para_cofrinho', {
    p_filho_id: childId,
    p_valor: amount,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function applyPenalty(
  childId: string,
  amount: number,
  description: string
): Promise<{ data: { deducted: number } | null; error: string | null }> {
  const { data, error } = await supabase.rpc('aplicar_penalizacao', {
    p_filho_id: childId,
    p_valor: amount,
    p_descricao: description,
  });
  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: { deducted: (data as unknown as number) ?? amount }, error: null };
}

export async function configureAppreciation(
  childId: string,
  rate: number,
  period: AppreciationPeriod
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('configurar_valorizacao', {
    p_filho_id: childId,
    p_indice: rate,
    p_periodo: period,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function syncAutomaticAppreciation(childId?: string): Promise<void> {
  try {
    const args = childId ? { p_filho_id: childId } : undefined;
    args
      ? await supabase.rpc('sincronizar_valorizacoes_automaticas', args)
      : await supabase.rpc('sincronizar_valorizacoes_automaticas');
  } catch (error) {
    captureException(error);
    // Best-effort: sync failure must not block balance reads
  }
}
