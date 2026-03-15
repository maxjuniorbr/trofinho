import { describe, expect, it } from 'vitest';
import { localizeSupabaseError } from './api-error';

describe('localizeSupabaseError', () => {
  it('maps known Supabase auth messages to pt-BR', () => {
    expect(localizeSupabaseError('User already registered')).toBe('Este e-mail já está cadastrado.');
    expect(localizeSupabaseError('Password should be at least 6 characters')).toBe('A senha deve ter ao menos 6 caracteres.');
    expect(localizeSupabaseError('New password should be different from the old password.')).toBe('A nova senha deve ser diferente da anterior.');
  });

  it('returns a generic fallback for unknown errors', () => {
    expect(localizeSupabaseError('Some unexpected error')).toBe('Algo deu errado. Tente novamente.');
  });
});
