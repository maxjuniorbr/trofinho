/**
 * Erro tipado para falhas em chamadas de API/Supabase.
 * Centraliza tratamento de erros HTTP e de rede.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const SUPABASE_ERROR_MAP: Record<string, string> = {
  'User already registered': 'Este e-mail já está cadastrado.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'Password should be at least 6 characters': 'A senha deve ter ao menos 6 caracteres.',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde um momento e tente novamente.',
  'User not found': 'Usuário não encontrado.',
  'New password should be different from the old password.': 'A nova senha deve ser diferente da anterior.',
  'Auth session missing!': 'Sessão expirada. Faça login novamente.',
};

/**
 * Traduz mensagens de erro do Supabase Auth para PT-BR.
 * Retorna mensagem genérica se não houver mapeamento.
 */
export function localizeSupabaseError(message: string): string {
  return SUPABASE_ERROR_MAP[message] ?? 'Algo deu errado. Tente novamente.';
}

/**
 * Wrapper de fetch com tratamento de erros padronizado.
 * Lança `ApiError` com status HTTP ou code `NETWORK_ERROR`.
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        (body as { message?: string }).message ?? 'Request failed',
        response.status,
        (body as { code?: string }).code,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0, 'NETWORK_ERROR');
  }
}
