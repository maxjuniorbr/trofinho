import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { localizeRpcError, localizeSupabaseError } from './api-error';

describe('localizeSupabaseError', () => {
  it('maps known Supabase auth messages to pt-BR', () => {
    expect(localizeSupabaseError('User already registered')).toBe(
      'Este e-mail já está cadastrado.',
    );
    expect(localizeSupabaseError('Password should be at least 6 characters')).toBe(
      'A senha deve ter ao menos 6 caracteres.',
    );
    expect(localizeSupabaseError('New password should be different from the old password.')).toBe(
      'A nova senha deve ser diferente da anterior.',
    );
  });

  it('returns a generic fallback for unknown errors', () => {
    expect(localizeSupabaseError('Some unexpected error')).toBe(
      'Algo deu errado. Tente novamente.',
    );
  });
});

describe('localizeRpcError', () => {
  it('maps known RPC error patterns to safe pt-BR messages', () => {
    expect(localizeRpcError('Apenas admins podem aprovar tarefas')).toBe('Acesso negado.');
    expect(localizeRpcError('Apenas filhos podem solicitar resgates')).toBe('Acesso negado.');
    expect(localizeRpcError('Acesso negado: atribuição de outra família')).toBe('Acesso negado.');
    expect(localizeRpcError('Saldo livre insuficiente')).toBe('Saldo livre insuficiente.');
    expect(localizeRpcError('Título obrigatório')).toBe('Título obrigatório.');
    expect(localizeRpcError('Atribuição não encontrada ou não está aguardando validação')).toBe(
      'Registro não encontrado.',
    );
    expect(localizeRpcError('Esta tarefa já foi concluída e não pode ser editada.')).toBe(
      'Esta tarefa já foi concluída e não pode ser editada.',
    );
    expect(
      localizeRpcError('Limite de operações atingido. Tente novamente em alguns minutos.'),
    ).toBe('Muitas tentativas. Aguarde um momento e tente novamente.');
  });

  it('returns a generic fallback for unknown RPC errors', () => {
    expect(localizeRpcError('some internal pg error')).toBe('Algo deu errado. Tente novamente.');
  });

  it('uses a custom fallback when provided', () => {
    expect(localizeRpcError('unknown error', 'Erro personalizado.')).toBe('Erro personalizado.');
  });

  it('maps deactivated task edit error to localized message', () => {
    expect(localizeRpcError('Não é possível editar uma tarefa desativada.')).toBe(
      'Esta tarefa está desativada e não pode ser editada.',
    );
  });

  it('maps deactivated task completion error to localized message', () => {
    expect(
      localizeRpcError('Esta tarefa está desativada e não pode ser enviada para validação'),
    ).toBe('Esta tarefa foi desativada e não pode mais ser enviada para validação.');
  });

  it('maps deactivated child edit error to localized message', () => {
    expect(localizeRpcError('Não é possível editar um filho desativado.')).toBe(
      'Este filho está desativado e não pode ser editado.',
    );
  });

  it('maps deactivated account error to localized message', () => {
    expect(localizeRpcError('Sua conta foi desativada. Entre em contato com o responsável.')).toBe(
      'Sua conta foi desativada. Entre em contato com o responsável.',
    );
  });

  it('maps deactivation pending redemptions error to localized message', () => {
    expect(
      localizeRpcError(
        'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.',
      ),
    ).toBe(
      'Não é possível desativar com resgates pendentes. Confirme ou cancele os resgates primeiro.',
    );
  });

  it('matches "resgates pendentes. Confirme" before generic "resgates pendentes"', () => {
    const deactivationMsg =
      'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.';
    expect(localizeRpcError(deactivationMsg)).toBe(
      'Não é possível desativar com resgates pendentes. Confirme ou cancele os resgates primeiro.',
    );
    expect(localizeRpcError(deactivationMsg)).not.toBe(
      'Não é possível alterar o custo com resgates pendentes.',
    );
  });
});

describe('property tests', () => {
  const knownMatchers: [string, string][] = [
    ['Apenas admins', 'Acesso negado.'],
    ['Apenas filhos', 'Acesso negado.'],
    ['Acesso negado', 'Acesso negado.'],
    ['não autenticado', 'Sessão expirada. Faça login novamente.'],
    ['Saldo livre insuficiente', 'Saldo livre insuficiente.'],
    ['Saldo insuficiente', 'Saldo insuficiente.'],
    ['Saldo não encontrado', 'Saldo não encontrado.'],
    ['Título obrigatório', 'Título obrigatório.'],
    ['Nome obrigatório', 'Nome obrigatório.'],
    ['Pontos devem ser maiores', 'Pontos devem ser maiores que zero.'],
    ['Valor deve ser maior que zero', 'Valor deve ser maior que zero.'],
    ['Descrição obrigatória', 'Descrição obrigatória.'],
    ['Frequência obrigatória', 'Frequência obrigatória.'],
    ['Índice deve estar entre', 'Índice deve estar entre 0 e 100.'],
    ['não encontrad', 'Registro não encontrado.'],
    ['não está aguardando', 'Esta ação não pode ser realizada no momento.'],
    ['não está pendente', 'Esta ação não pode ser realizada no momento.'],
    [
      'não pode ser enviada para validação',
      'Esta tarefa foi desativada e não pode mais ser enviada para validação.',
    ],
    [
      'Não é possível editar uma tarefa desativada',
      'Esta tarefa está desativada e não pode ser editada.',
    ],
    [
      'Não é possível editar um filho desativado',
      'Este filho está desativado e não pode ser editado.',
    ],
    ['Sua conta foi desativada', 'Sua conta foi desativada. Entre em contato com o responsável.'],
    ['já foi concluída', 'Esta tarefa já foi concluída e não pode ser editada.'],
    ['outra família', 'Acesso negado.'],
    ['filhos inválidos', 'Há filhos inválidos na atribuição.'],
    ['resgates em aberto', 'Não é possível alterar os pontos pois há resgates em aberto.'],
    [
      'resgates pendentes. Confirme',
      'Não é possível desativar com resgates pendentes. Confirme ou cancele os resgates primeiro.',
    ],
    ['resgates pendentes', 'Não é possível alterar o custo com resgates pendentes.'],
    ['Prêmio não encontrado ou não disponível', 'Prêmio não disponível.'],
    ['já pertence a uma família', 'Você já tem uma família cadastrada.'],
    ['Sem índice de valorização', 'Valorização não configurada.'],
  ];

  // Feature: review-phases-1-2-implementation, Property 3: RPC error localization covers all known matchers
  it('P3: for any string containing a known matcher substring, localizeRpcError does not return the generic fallback', () => {
    fc.assert(
      fc.property(fc.constantFrom(...knownMatchers), ([substring]) => {
        return localizeRpcError(substring) !== 'Algo deu errado. Tente novamente.';
      }),
      { numRuns: 100 },
    );
  });
});
