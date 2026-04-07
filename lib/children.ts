import { createClient } from '@supabase/supabase-js';
import { localizeRpcError } from './api-error';
import { supabase } from './supabase';

export type Child = {
  id: string;
  nome: string;
  usuario_id: string | null;
  avatar_url?: string | null;
  ativo: boolean;
};

export type AdminChildProfile = Child & {
  avatar_url: string | null;
  email: string | null;
};

/**
 * Creates a throwaway Supabase client with `persistSession: false` so that
 * signing up a child account does NOT overwrite the admin's active session.
 *
 * Email confirmation is intentionally disabled for child accounts — they are
 * created by the admin (parent) and don't have real email access.
 */
function createTempClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Variáveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY não configuradas.',
    );
  }

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
  tempPassword: string,
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

export async function listChildren(onlyActive = false): Promise<{
  data: Child[];
  error: string | null;
}> {
  let query = supabase.from('filhos').select('id, nome, usuario_id, avatar_url, ativo');

  if (onlyActive) query = query.eq('ativo', true);

  const { data, error } = await query.order('nome').overrideTypes<Child[], { merge: false }>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function getChild(
  childId: string,
): Promise<{ data: AdminChildProfile | null; error: string | null }> {
  const { data, error } = await supabase.rpc('obter_filho_admin', {
    p_filho_id: childId,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  const child: AdminChildProfile | null = Array.isArray(data) ? (data[0] ?? null) : null;
  return { data: child, error: null };
}

export async function getMyChildId(userId?: string): Promise<string | null> {
  let uid = userId;

  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }

  const { data } = await supabase
    .from('filhos')
    .select('id')
    .eq('usuario_id', uid)
    .maybeSingle();

  return data?.id ?? null;
}

function translateSignUpError(msg: string): string {
  if (msg.includes('User already registered')) return 'Este e-mail já possui uma conta.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  if (msg.includes('email rate limit'))
    return 'Limite de e-mails atingido. Aguarde alguns minutos.';
  return 'Não foi possível cadastrar o filho. Tente novamente.';
}

export async function deactivateChild(childId: string): Promise<{
  data: { pendingValidationCount: number; totalBalance: number } | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('desativar_filho', {
    p_filho_id: childId,
  });
  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as { pendingValidationCount: number; totalBalance: number }, error: null };
}

export async function reactivateChild(childId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase.rpc('reativar_filho', {
    p_filho_id: childId,
  });
  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export function buildChildDeactivateMessage(
  childName: string,
  data: {
    pendingCount: number;
    awaitingCount: number;
    totalBalance: number;
  },
): string {
  const parts: string[] = [];

  parts.push(`${childName} não poderá mais fazer login no app.`);

  if (data.pendingCount > 0) {
    parts.push(
      data.pendingCount === 1
        ? '1 atribuição pendente será cancelada.'
        : `${data.pendingCount} atribuições pendentes serão canceladas.`,
    );
  }

  if (data.awaitingCount > 0) {
    parts.push(
      data.awaitingCount === 1
        ? '1 atribuição aguardando validação será mantida.'
        : `${data.awaitingCount} atribuições aguardando validação serão mantidas.`,
    );
  }

  if (data.totalBalance > 0) {
    parts.push(`O saldo de ${data.totalBalance} pts será mantido.`);
  }

  return parts.join('\n');
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
