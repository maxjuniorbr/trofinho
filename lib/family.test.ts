import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFamily } from './family';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

function createSingleQuery(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('getFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna a família quando encontrada', async () => {
    const query = createSingleQuery({ data: { nome: 'Família Silva' }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await getFamily('family-123');

    expect(supabaseMock.from).toHaveBeenCalledWith('familias');
    expect(query.select).toHaveBeenCalledWith('nome');
    expect(query.eq).toHaveBeenCalledWith('id', 'family-123');
    expect(result).toEqual({ data: { nome: 'Família Silva' }, error: null });
  });

  it('retorna erro quando ocorre falha', async () => {
    const query = createSingleQuery({ data: null, error: { message: 'not found' } });
    supabaseMock.from.mockReturnValue(query);

    const result = await getFamily('invalid-id');

    expect(result).toEqual({ data: null, error: expect.any(String) });
  });

  it('retorna data null quando registro não existe', async () => {
    const query = createSingleQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await getFamily('empty-id');

    expect(result).toEqual({ data: null, error: null });
  });
});
