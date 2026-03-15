const authErrorMatchers = [
  ['User already registered', 'Este e-mail já está cadastrado.'],
  ['Invalid login credentials', 'E-mail ou senha incorretos.'],
  ['Email not confirmed', 'Confirme seu e-mail antes de entrar.'],
  ['at least 6 characters', 'A senha deve ter ao menos 6 caracteres.'],
  ['Email rate limit exceeded', 'Muitas tentativas. Aguarde um momento e tente novamente.'],
  ['User not found', 'Usuário não encontrado.'],
  ['different from the old', 'A nova senha deve ser diferente da anterior.'],
  ['Auth session missing!', 'Sessão expirada. Faça login novamente.'],
] as const;

export function localizeSupabaseError(message: string): string {
  const matchedEntry = authErrorMatchers.find(([matcher]) => message.includes(matcher));
  return matchedEntry?.[1] ?? 'Algo deu errado. Tente novamente.';
}
