import type { ThemeColors } from '@/constants/colors';
import type { RedemptionStatus } from '@lib/redemptions';
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
    case 'cancelada':
      return 'Cancelada';
  }
}

export function getAssignmentStatusColor(
  status: AssignmentStatus,
  colors: Pick<ThemeColors, 'semantic'>,
): string {
  return getAssignmentStatusTone(status, colors).foreground;
}

export function getAssignmentStatusTone(
  status: AssignmentStatus,
  colors: Pick<ThemeColors, 'semantic'>,
): {
  foreground: string;
  background: string;
  text: string;
} {
  switch (status) {
    case 'pendente':
      return {
        foreground: colors.semantic.warning,
        background: colors.semantic.warningBg,
        text: colors.semantic.warningText,
      };
    case 'aguardando_validacao':
      return {
        foreground: colors.semantic.info,
        background: colors.semantic.infoBg,
        text: colors.semantic.infoText,
      };
    case 'aprovada':
      return {
        foreground: colors.semantic.success,
        background: colors.semantic.successBg,
        text: colors.semantic.successText,
      };
    case 'rejeitada':
      return {
        foreground: colors.semantic.error,
        background: colors.semantic.errorBg,
        text: colors.semantic.errorText,
      };
    case 'cancelada':
      return {
        foreground: colors.semantic.warning,
        background: colors.semantic.warningBg,
        text: colors.semantic.warningText,
      };
  }
}

export function getRedemptionStatusLabel(status: RedemptionStatus): string {
  const map: Record<RedemptionStatus, string> = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
  };

  return map[status];
}

export function getRedemptionStatusColor(
  status: RedemptionStatus,
  colors: Pick<ThemeColors, 'semantic'>,
): string {
  const map: Record<RedemptionStatus, string> = {
    pendente: colors.semantic.warning,
    confirmado: colors.semantic.success,
    cancelado: colors.semantic.error,
  };

  return map[status];
}
