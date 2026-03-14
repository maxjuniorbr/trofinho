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

// ─── Autenticação ─────────────────────────────────────────────

export async function signIn(
  email: string,
  password: string
): Promise<{ profile: UserProfile | null; error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { profile: null, error: { message: traduzirErroAuth(error.message) } };
  }

  const profile = await buscarPerfil();
  return { profile, error: null };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: { message: traduzirErroAuth(error.message) } };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  // scope 'local' limpa a sessão do dispositivo imediatamente,
  // sem depender de round-trip de rede para disparar SIGNED_OUT.
  await supabase.auth.signOut({ scope: 'local' });
}

// ─── Perfil ───────────────────────────────────────────────────

export async function buscarPerfil(): Promise<UserProfile | null> {
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

// ─── Família ──────────────────────────────────────────────────

export async function criarFamilia(
  nomeFamilia: string,
  nomeUsuario: string
): Promise<{ familiaId: string | null; error: AuthError | null }> {
  const { data, error } = await supabase.rpc('criar_familia', {
    nome_familia: nomeFamilia,
    nome_usuario: nomeUsuario,
  });

  if (error) {
    return { familiaId: null, error: { message: traduzirErroRpc(error.message) } };
  }

  return { familiaId: data as string, error: null };
}

// ─── Utilitários ─────────────────────────────────────────────

function traduzirErroAuth(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter ao menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  return msg;
}

function traduzirErroRpc(msg: string): string {
  if (msg.includes('já pertence a uma família')) return 'Você já tem uma família cadastrada.';
  if (msg.includes('não autenticado')) return 'Sessão expirada. Faça login novamente.';
  return msg;
}
