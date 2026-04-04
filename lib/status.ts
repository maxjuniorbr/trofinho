import type { ThemeColors } from '@/constants/colors';
import type { RedemptionStatus } from '@lib/prizes';
import type { AssignmentStatus } from '@lib/tasks';

export function getAssignmentStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'aguardando_validacao':
      return 'Aguardando validação';
    case 'aprovada':
      return 'Aprovada';
    case 'rejeitada':
      return 'Rejeitada';
  }
}

export function getAssignmentStatusColor(status: AssignmentStatus, colors: Pick<ThemeColors, 'semantic'>): string {
  const map: Record<AssignmentStatus, string> = {
    pendente: colors.semantic.warning,
    aguardando_validacao: colors.semantic.info,
    aprovada: colors.semantic.success,
    rejeitada: colors.semantic.error,
  };

  return map[status];
}

export function getRedemptionStatusLabel(status: RedemptionStatus): string {
  const map: Record<RedemptionStatus, string> = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
  };

  return map[status];
}

export function getRedemptionStatusColor(status: RedemptionStatus, colors: Pick<ThemeColors, 'semantic'>): string {
  const map: Record<RedemptionStatus, string> = {
    pendente: colors.semantic.warning,
    confirmado: colors.semantic.success,
    cancelado: colors.semantic.error,
  };

  return map[status];
}
