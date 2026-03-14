import { supabase } from './supabase';

// ─── Tipos ───────────────────────────────────────────────

export type TipoMovimentacao =
  | 'credito'
  | 'debito'
  | 'transferencia_cofrinho'
  | 'valorizacao'
  | 'penalizacao';

export type PeriodoValorizacao = 'diario' | 'semanal' | 'mensal';

export interface Saldo {
  filho_id: string;
  saldo_livre: number;
  cofrinho: number;
  indice_valorizacao: number;
  periodo_valorizacao: PeriodoValorizacao;
  data_ultima_valorizacao: string | null;
  updated_at: string;
}

export interface Movimentacao {
  id: string;
  filho_id: string;
  tipo: TipoMovimentacao;
  valor: number;
  descricao: string;
  referencia_id: string | null;
  created_at: string;
}

export interface SaldoComFilho extends Saldo {
  filhos: { nome: string };
}

// ─── Helpers ─────────────────────────────────────────────

export function labelTipo(tipo: TipoMovimentacao): string {
  const map: Record<TipoMovimentacao, string> = {
    credito:                'Tarefa aprovada',
    debito:                 'Débito',
    transferencia_cofrinho: 'Para cofrinho',
    valorizacao:            'Valorização',
    penalizacao:            'Penalização',
  };
  return map[tipo] ?? tipo;
}

export function emojiTipo(tipo: TipoMovimentacao): string {
  const map: Record<TipoMovimentacao, string> = {
    credito:                '✅',
    debito:                 '🔻',
    transferencia_cofrinho: '🐷',
    valorizacao:            '📈',
    penalizacao:            '⚠️',
  };
  return map[tipo] ?? '•';
}

export function isCredito(tipo: TipoMovimentacao): boolean {
  return tipo === 'credito' || tipo === 'valorizacao';
}

export function labelPeriodoValorizacao(periodo: PeriodoValorizacao): string {
  const map: Record<PeriodoValorizacao, string> = {
    diario: 'dia',
    semanal: 'semana',
    mensal: 'mês',
  };

  return map[periodo];
}

// ─── Funções ─────────────────────────────────────────────

export async function buscarSaldo(filhoId?: string): Promise<{ data: Saldo | null; error: string | null }> {
  let query = supabase
    .from('saldos')
    .select('*');

  if (filhoId) {
    query = query.eq('filho_id', filhoId);
  } else {
    // filho autenticado — RLS retorna apenas o próprio registro
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null }; // nenhum registro
    return { data: null, error: error.message };
  }

  return { data: data as Saldo, error: null };
}

export async function listarSaldosAdmin(): Promise<{ data: SaldoComFilho[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saldos')
    .select('*, filhos(nome)')
    .order('filhos(nome)');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as SaldoComFilho[], error: null };
}

export async function listarMovimentacoes(
  filhoId: string,
  limite = 30
): Promise<{ data: Movimentacao[]; error: string | null }> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('filho_id', filhoId)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Movimentacao[], error: null };
}

export async function transferirParaCofrinho(
  filhoId: string,
  valor: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('transferir_para_cofrinho', {
    p_filho_id: filhoId,
    p_valor: valor,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function aplicarValorizacao(
  filhoId: string
): Promise<{ data: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('aplicar_valorizacao', {
    p_filho_id: filhoId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as number, error: null };
}

export async function aplicarPenalizacao(
  filhoId: string,
  valor: number,
  descricao: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('aplicar_penalizacao', {
    p_filho_id: filhoId,
    p_valor: valor,
    p_descricao: descricao,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function configurarValorizacao(
  filhoId: string,
  indice: number,
  periodo: PeriodoValorizacao
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('configurar_valorizacao', {
    p_filho_id: filhoId,
    p_indice: indice,
    p_periodo: periodo,
  });
  if (error) return { error: error.message };
  return { error: null };
}
