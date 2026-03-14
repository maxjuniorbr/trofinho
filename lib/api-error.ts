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
