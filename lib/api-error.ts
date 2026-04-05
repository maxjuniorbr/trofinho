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

const rpcErrorMatchers = [
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
  ['cancelar o próprio envio', 'Acesso negado.'],
  [
    'Não é possível editar uma tarefa desativada',
    'Esta tarefa está desativada e não pode ser editada.',
  ],
  ['Esta tarefa está desativada', 'Esta tarefa está desativada e não permite cancelar o envio.'],
  [
    'Não é possível editar um filho desativado',
    'Este filho está desativado e não pode ser editado.',
  ],
  [
    'tarefa diária de data anterior',
    'Não é possível cancelar o envio de uma tarefa diária de data anterior.',
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
  ['Limite de operações atingido', 'Muitas tentativas. Aguarde um momento e tente novamente.'],
] as const;

export function localizeRpcError(message: string, fallback?: string): string {
  const matchedEntry = rpcErrorMatchers.find(([matcher]) => message.includes(matcher));
  return matchedEntry?.[1] ?? fallback ?? 'Algo deu errado. Tente novamente.';
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}
