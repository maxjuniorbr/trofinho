import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { Filho } from './tarefas';

// ─── Tipos ────────────────────────────────────────────────

export type FilhoComSaldo = Filho & {
  usuarios: { nome: string } | null;
};

// ─── Cliente temporário (não substitui a sessão do admin) ─

function criarClienteTemp() {
  const url = Constants.expoConfig?.extra?.supabaseUrl as string;
  const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// ─── Cadastrar filho ──────────────────────────────────────
// 1. Cria conta auth com client temporário (admin fica logado)
// 2. Chama RPC SECURITY DEFINER para criar usuarios + filhos

export async function cadastrarFilho(
  nome: string,
  email: string,
  senhaTemporaria: string
): Promise<{ error: string | null }> {
  const tempClient = criarClienteTemp();

  const { data, error: signUpError } = await tempClient.auth.signUp({
    email,
    password: senhaTemporaria,
  });

  if (signUpError) {
    return { error: traduzirErroSignUp(signUpError.message) };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { error: 'Não foi possível criar a conta. Tente novamente.' };
  }

  const { error: rpcError } = await supabase.rpc('criar_filho_na_familia', {
    filho_user_id: userId,
    filho_nome: nome,
  });

  if (rpcError) {
    return { error: traduzirErroCadastroFilho(rpcError.message) };
  }

  return { error: null };
}

// ─── Listar filhos da família ─────────────────────────────

export async function listarFilhos(): Promise<{
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

// ─── ID do filho autenticado ────────────────────────────

export async function buscarMeuFilhoId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('filhos')
    .select('id')
    .eq('usuario_id', user.id)
    .maybeSingle();

  return data?.id ?? null;
}

// ─── Utilitários ─────────────────────────────────────────

function traduzirErroSignUp(msg: string): string {
  if (msg.includes('User already registered')) return 'Este e-mail já possui uma conta.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  if (msg.includes('email rate limit')) return 'Limite de e-mails atingido. Aguarde alguns minutos.';
  return msg;
}

function traduzirErroCadastroFilho(msg: string): string {
  if (msg.includes('Usuário já pertence a uma família')) {
    return 'Esta conta já está vinculada a uma família.';
  }
  if (msg.includes('Usuário já está vinculado a um filho')) {
    return 'Esta conta já está vinculada a um perfil de filho.';
  }
  if (msg.includes('Apenas admins podem cadastrar filhos')) {
    return 'Somente administradores podem cadastrar filhos.';
  }
  if (msg.includes('Usuário não autenticado')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }

  return 'Não foi possível vincular a conta à família. Verifique o cadastro antes de tentar novamente.';
}
