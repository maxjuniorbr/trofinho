import { describe, expect, it } from 'vitest';
import { localizeRpcError, localizeSupabaseError } from './api-error';

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

describe('localizeRpcError', () => {
  it('maps known RPC error patterns to safe pt-BR messages', () => {
    expect(localizeRpcError('Apenas admins podem aprovar tarefas')).toBe('Acesso negado.');
    expect(localizeRpcError('Apenas filhos podem solicitar resgates')).toBe('Acesso negado.');
    expect(localizeRpcError('Acesso negado: atribuição de outra família')).toBe('Acesso negado.');
    expect(localizeRpcError('Saldo livre insuficiente')).toBe('Saldo livre insuficiente.');
    expect(localizeRpcError('Título obrigatório')).toBe('Título obrigatório.');
    expect(localizeRpcError('Atribuição não encontrada ou não está aguardando validação')).toBe('Registro não encontrado.');
    expect(localizeRpcError('Esta tarefa já foi concluída e não pode ser editada.')).toBe('Esta tarefa já foi concluída e não pode ser editada.');
  });

  it('returns a generic fallback for unknown RPC errors', () => {
    expect(localizeRpcError('some internal pg error')).toBe('Algo deu errado. Tente novamente.');
  });

  it('uses a custom fallback when provided', () => {
    expect(localizeRpcError('unknown error', 'Erro personalizado.')).toBe('Erro personalizado.');
  });
});
