import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';

export const CHILD_INVITE_CODE_LENGTH = 6;

export type ChildInvitePreview = {
  id: string;
  familia_id: string;
  filho_id: string | null;
  nome_filho: string;
  familyName: string;
  adminName: string;
};

type ChildInviteRpcResult = {
  valid: boolean;
  error?: string;
  id?: string;
  familia_id?: string;
  filho_id?: string | null;
  nome_filho?: string;
  familyName?: string;
  adminName?: string;
};

export function formatChildInviteCode(value: string): string {
  return value
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .slice(0, CHILD_INVITE_CODE_LENGTH);
}

export function childInviteErrorMessage(error?: string): string {
  switch (error) {
    case 'ALREADY_LINKED':
      return 'Este convite já foi utilizado.';
    case 'INVALID_CODE':
    case 'EXPIRED_CODE':
      return 'Código inválido ou expirado. Peça um novo ao responsável.';
    default:
      return 'Código inválido ou expirado. Peça um novo ao responsável.';
  }
}

export async function validateChildInvite(code: string): Promise<{
  preview: ChildInvitePreview | null;
  error: string | null;
}> {
  const inviteCode = formatChildInviteCode(code);
  if (inviteCode.length !== CHILD_INVITE_CODE_LENGTH) {
    return { preview: null, error: 'Informe um código de 6 caracteres.' };
  }

  try {
    const { data, error } = await supabase.rpc('validar_convite_filho', {
      p_codigo: inviteCode,
    });

    if (error) {
      Sentry.captureException(error, {
        tags: { area: 'child-invite', step: 'validate' },
      });
      return { preview: null, error: 'Erro ao verificar código. Tente novamente.' };
    }

    const result = data as ChildInviteRpcResult | null;

    if (!result?.valid) {
      return { preview: null, error: childInviteErrorMessage(result?.error) };
    }

    if (!result.id || !result.familia_id || !result.nome_filho) {
      Sentry.captureMessage('validar_convite_filho returned incomplete preview', {
        level: 'error',
        extra: {
          hasId: Boolean(result.id),
          hasFamiliaId: Boolean(result.familia_id),
          hasNomeFilho: Boolean(result.nome_filho),
        },
      });
      return { preview: null, error: 'Erro ao verificar código. Tente novamente.' };
    }

    return {
      preview: {
        id: result.id,
        familia_id: result.familia_id,
        filho_id: result.filho_id ?? null,
        nome_filho: result.nome_filho,
        familyName: result.familyName ?? 'Família',
        adminName: result.adminName ?? 'Administrador',
      },
      error: null,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'child-invite', step: 'validate_unhandled' },
    });
    return { preview: null, error: 'Erro ao verificar código. Tente novamente.' };
  }
}
