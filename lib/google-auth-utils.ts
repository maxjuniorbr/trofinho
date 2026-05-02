import type { GoogleAuthResult } from './google-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches the `convites_filho` table columns used for validation. */
export type InviteRecord = {
  aceito_por: string | null;
  expira_em: string;
};

/** Discriminated union for invite code validation results. */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: 'INVALID_CODE' | 'EXPIRED_CODE' | 'ALREADY_LINKED' };

/** Shape for Supabase Auth errors passed to `localizeOAuthError`. */
export type SupabaseAuthError = {
  message: string;
  status?: number;
};

// ---------------------------------------------------------------------------
// Date of birth validation
// ---------------------------------------------------------------------------

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a strict ISO calendar date (`YYYY-MM-DD`) and rejects values that
 * JavaScript would otherwise normalize, such as `2010-02-30`.
 */
export function parseIsoDate(date: string): Date | null {
  if (!ISO_DATE_REGEX.test(date)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/** Formats a local calendar date as `YYYY-MM-DD` without UTC conversion. */
export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns `true` when `date` falls between 1 Jan 1900 (inclusive) and
 * today minus `minAge` years (inclusive). Uses UTC to avoid timezone issues.
 */
export function isValidDateOfBirth(date: Date, minAge = 8): boolean {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  const minDate = new Date(Date.UTC(1900, 0, 1)); // 1 Jan 1900

  const now = new Date();
  const maxDate = new Date(
    Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate()),
  );

  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  return utcDate >= minDate && utcDate <= maxDate;
}

// ---------------------------------------------------------------------------
// OAuth error localisation
// ---------------------------------------------------------------------------

/**
 * Maps a `GoogleAuthResult` or `SupabaseAuthError` to a user-facing pt-BR
 * message. Returns `null` when the error represents a user cancellation
 * (no message should be shown).
 */
export function localizeOAuthError(
  error: GoogleAuthResult | SupabaseAuthError,
): string | null {
  // --- GoogleAuthResult path ---
  if ('type' in error) {
    if (error.type === 'cancelled') {
      return null;
    }

    if (error.type === 'success') {
      // Not an error — nothing to localise.
      return null;
    }

    // error.type === 'error'
    return error.message;
  }

  // --- SupabaseAuthError path ---
  const supaErr = error;
  const msg = (supaErr.message ?? '').toLowerCase();

  if (msg.includes('email_verified') || msg.includes('email not confirmed')) {
    return 'Não foi possível verificar seu e-mail. Use outra conta Google.';
  }

  if (msg.includes('provider') && msg.includes('already')) {
    return 'Esta conta já está vinculada a outro método de login. Faça login com e-mail/senha e vincule sua conta Google nas configurações.';
  }

  if (
    supaErr.status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many')
  ) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }

  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('internet')
  ) {
    return 'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.';
  }

  if (
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('server')
  ) {
    return 'O serviço do Google está temporariamente indisponível. Tente novamente em alguns minutos.';
  }

  return 'Erro na autenticação. Tente novamente.';
}

// ---------------------------------------------------------------------------
// Child invite code validation
// ---------------------------------------------------------------------------

/**
 * Pure validation of a child invite code against an `InviteRecord`.
 *
 * - `invite` is `null` → `INVALID_CODE`
 * - `aceito_por` is not null → `ALREADY_LINKED`
 * - `expira_em` ≤ `now` → `EXPIRED_CODE`
 * - Otherwise → `{ valid: true }`
 */
export function validateChildInviteCode(
  _code: string,
  invite: InviteRecord | null,
  now: Date,
): ValidationResult {
  if (invite === null) {
    return { valid: false, error: 'INVALID_CODE' };
  }

  if (invite.aceito_por !== null) {
    return { valid: false, error: 'ALREADY_LINKED' };
  }

  const expiresAt = new Date(invite.expira_em);
  if (expiresAt <= now) {
    return { valid: false, error: 'EXPIRED_CODE' };
  }

  return { valid: true };
}
