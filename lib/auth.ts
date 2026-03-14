import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
  nome: string;
};

export type AuthError = {
  message: string;
};

export async function signIn(
  email: string,
  password: string
): Promise<{ profile: UserProfile | null; error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { profile: null, error: { message: translateAuthError(error.message) } };
  }

  const profile = await getProfile();
  return { profile, error: null };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: { message: translateAuthError(error.message) } };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, familia_id, papel, nome')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as UserProfile;
}

export async function createFamily(
  familyName: string,
  userName: string
): Promise<{ familiaId: string | null; error: AuthError | null }> {
  const { data, error } = await supabase.rpc('criar_familia', {
    nome_familia: familyName,
    nome_usuario: userName,
  });

  if (error) {
    return { familiaId: null, error: { message: translateRpcError(error.message) } };
  }

  return { familiaId: data as string, error: null };
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  return msg;
}

function translateRpcError(msg: string): string {
  if (msg.includes('já pertence a uma família')) return 'Você já tem uma família cadastrada.';
  if (msg.includes('não autenticado')) return 'Sessão expirada. Faça login novamente.';
  return msg;
}
