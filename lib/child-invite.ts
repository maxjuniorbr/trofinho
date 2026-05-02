import * as Sentry from '@sentry/react-native';
import { getRandomBytes } from 'expo-crypto';

import { localizeRpcError } from './api-error';
import { supabase } from './supabase';

export const CHILD_INVITE_CODE_LENGTH = 6;

const CHILD_INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_INVITE_CODE_ATTEMPTS = 5;

export type ChildInvitePreview = {
  id: string;
  familia_id: string;
  filho_id: string | null;
  nome_filho: string;
  familyName: string;
  adminName: string;
};

export type ChildInviteData = {
  codigo: string;
  nome_filho: string;
  expira_em: string;
};

export type GenerateChildInviteInput = {
  familyId: string;
  childId: string;
  childName: string;
  createdBy: string;
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

export function generateInviteCode(): string {
  let code = '';
  const alphabetLength = CHILD_INVITE_CODE_CHARS.length;
  const maxUnbiasedByte = Math.floor(256 / alphabetLength) * alphabetLength - 1;

  while (code.length < CHILD_INVITE_CODE_LENGTH) {
    const bytes = getRandomBytes(CHILD_INVITE_CODE_LENGTH * 2);
    for (const byte of bytes) {
      if (byte > maxUnbiasedByte) continue;
      code += CHILD_INVITE_CODE_CHARS[byte % alphabetLength];
      if (code.length === CHILD_INVITE_CODE_LENGTH) break;
    }
  }

  return code;
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || error.message?.toLowerCase().includes('unique') === true;
}

export async function generateChildInvite(
  input: GenerateChildInviteInput,
): Promise<{ data: ChildInviteData | null; error: string | null }> {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
    const codigo = generateInviteCode();
    const { data, error } = await supabase
      .from('convites_filho')
      .insert({
        familia_id: input.familyId,
        filho_id: input.childId,
        codigo,
        criado_por: input.createdBy,
        nome_filho: input.childName,
      })
      .select('codigo, expira_em')
      .single();

    if (!error) {
      return {
        data: {
          codigo: data.codigo,
          nome_filho: input.childName,
          expira_em: data.expira_em,
        },
        error: null,
      };
    }

    if (!isUniqueViolation(error)) {
      return { data: null, error: localizeRpcError(error.message) };
    }
  }

  return { data: null, error: 'Não foi possível gerar o convite. Tente novamente.' };
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
