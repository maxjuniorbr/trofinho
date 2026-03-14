import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Child } from './tasks';

export type ChildWithBalance = Child & {
  usuarios: { nome: string } | null;
};

function createTempClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function registerChild(
  name: string,
  email: string,
  tempPassword: string
): Promise<{ error: string | null }> {
  const tempClient = createTempClient();

  const { data, error: signUpError } = await tempClient.auth.signUp({
    email,
    password: tempPassword,
  });

  if (signUpError) {
    return { error: translateSignUpError(signUpError.message) };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { error: 'Não foi possível criar a conta. Tente novamente.' };
  }

  const { error: rpcError } = await supabase.rpc('criar_filho_na_familia', {
    filho_user_id: userId,
    filho_nome: name,
  });

  if (rpcError) {
    await supabase.rpc('limpar_auth_user_orfao', {
      p_user_id: userId,
    });

    return { error: translateChildRegistrationError(rpcError.message) };
  }

  return { error: null };
}

export async function listChildren(): Promise<{
  data: Child[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('filhos')
    .select('id, nome, usuario_id')
    .order('nome');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Child[], error: null };
}

export async function getMyChildId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('filhos')
    .select('id')
    .eq('usuario_id', user.id)
    .maybeSingle();

  return data?.id ?? null;
}

function translateSignUpError(msg: string): string {
  if (msg.includes('User already registered')) return 'Este e-mail já possui uma conta.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  if (msg.includes('email rate limit')) return 'Limite de e-mails atingido. Aguarde alguns minutos.';
  return msg;
}

function translateChildRegistrationError(msg: string): string {
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
