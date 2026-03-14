import { supabase } from './supabase';

export type TransactionType =
  | 'credito'
  | 'debito'
  | 'transferencia_cofrinho'
  | 'valorizacao'
  | 'penalizacao';

export type AppreciationPeriod = 'diario' | 'semanal' | 'mensal';

export interface Balance {
  filho_id: string;
  saldo_livre: number;
  cofrinho: number;
  indice_valorizacao: number;
  periodo_valorizacao: AppreciationPeriod;
  data_ultima_valorizacao: string | null;
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
  };
  return map[type] ?? type;
}

export function getTransactionTypeEmoji(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    credito:                '✅',
    debito:                 '🔻',
    transferencia_cofrinho: '🐷',
    valorizacao:            '📈',
    penalizacao:            '⚠️',
  };
  return map[type] ?? '•';
}

export function isCredit(type: TransactionType): boolean {
  return type === 'credito' || type === 'valorizacao';
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

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null };
    return { data: null, error: error.message };
  }

  return { data: data as Balance, error: null };
}

export async function listAdminBalances(): Promise<{ data: BalanceWithChild[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saldos')
    .select('*, filhos(nome)')
    .order('filhos(nome)');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as BalanceWithChild[], error: null };
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
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Transaction[], error: null };
}

export async function transferToPiggyBank(
  childId: string,
  amount: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('transferir_para_cofrinho', {
    p_filho_id: childId,
    p_valor: amount,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function applyAppreciation(
  childId: string
): Promise<{ data: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('aplicar_valorizacao', {
    p_filho_id: childId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as number, error: null };
}

export async function applyPenalty(
  childId: string,
  amount: number,
  description: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aplicar_penalizacao', {
    p_filho_id: childId,
    p_valor: amount,
    p_descricao: description,
  });
  if (error) return { error: error.message };
  return { error: null };
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
  if (error) return { error: error.message };
  return { error: null };
}
