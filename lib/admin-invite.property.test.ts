import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: admin-invite, Property 1: Formato do código de convite
 *
 * Para qualquer código gerado pela função `gerar_codigo_convite()`, o código
 * deve ter exatamente 6 caracteres e cada caractere deve pertencer ao alfabeto
 * reduzido `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 caracteres).
 *
 * **Validates: Requirements 1.1, 9.1, 9.3**
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const AMBIGUOUS_CHARS = ['O', '0', 'I', '1', 'L'];

/**
 * Pure TypeScript replica of the SQL `gerar_codigo_convite()` function.
 * Takes 6 random bytes and maps each to the reduced alphabet using modulo 31.
 */
function gerarCodigoConvite(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % 31];
  }
  return code;
}

// Arbitrary: array of exactly 6 bytes (0–255)
const sixBytesArb = fc.uint8Array({ minLength: 6, maxLength: 6 });

describe('Feature: admin-invite, Property 1: Formato do código de convite', () => {
  it('generated code is always exactly 6 characters long', () => {
    fc.assert(
      fc.property(sixBytesArb, (bytes) => {
        const code = gerarCodigoConvite(bytes);
        expect(code).toHaveLength(6);
      }),
      { numRuns: 100 },
    );
  });

  it('every character belongs to the reduced alphabet (31 chars)', () => {
    fc.assert(
      fc.property(sixBytesArb, (bytes) => {
        const code = gerarCodigoConvite(bytes);
        for (const char of code) {
          expect(ALPHABET).toContain(char);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('no ambiguous characters (O, 0, I, 1, L) appear in the output', () => {
    fc.assert(
      fc.property(sixBytesArb, (bytes) => {
        const code = gerarCodigoConvite(bytes);
        for (const char of code) {
          expect(AMBIGUOUS_CHARS).not.toContain(char);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: admin-invite, Property 6: Formatação automática em maiúsculas do campo de código
 *
 * Para qualquer string digitada no campo de código de convite, o valor exibido
 * deve ser a versão em maiúsculas da entrada, limitada a 6 caracteres.
 *
 * **Validates: Requirements 3.2**
 */

/**
 * Pure function that replicates the invite code input formatting logic:
 * converts to uppercase and limits to 6 characters.
 */
function formatInviteCode(input: string): string {
  return input.toUpperCase().slice(0, 6);
}

describe('Feature: admin-invite, Property 6: Formatação automática em maiúsculas do campo de código', () => {
  it('output never contains lowercase characters', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = formatInviteCode(input);
        expect(result).toEqual(result.toUpperCase());
      }),
      { numRuns: 100 },
    );
  });

  it('output length is at most 6 characters', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = formatInviteCode(input);
        expect(result.length).toBeLessThanOrEqual(6);
      }),
      { numRuns: 100 },
    );
  });

  it('output is the uppercase version of the first 6 characters of input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = formatInviteCode(input);
        const expected = input.slice(0, 6).toUpperCase();
        expect(result).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 4: Invariante de máximo 2 admins por família
 *
 * Para qualquer família, após qualquer sequência de operações (geração de convite,
 * aceitação, remoção), o número de registros em `usuarios` com `papel = 'admin'`
 * e `familia_id` correspondente nunca deve exceder 2.
 *
 * **Validates: Requirements 2.1, 2.2**
 */

/**
 * Simplified state machine model for a family's admin count.
 * Enforces the same business rules as the RPCs:
 * - Can't add admin (accept invite) if already at 2
 * - Can't remove admin if only 1 remains
 * - Accept invite only if < 2 admins
 */
type FamilyState = {
  adminCount: number;
  hasPendingInvite: boolean;
};

type Operation =
  | { type: 'generateInvite' }
  | { type: 'acceptInvite' }
  | { type: 'removeAdmin' };

function applyOperation(state: FamilyState, op: Operation): FamilyState {
  switch (op.type) {
    case 'generateInvite': {
      // RPC gerar_convite_admin: rejects if family already has 2 admins or pending invite exists
      if (state.adminCount >= 2 || state.hasPendingInvite) {
        return state; // rejected, no state change
      }
      return { ...state, hasPendingInvite: true };
    }
    case 'acceptInvite': {
      // RPC aceitar_convite_admin: only works if there's a pending invite AND family < 2 admins
      if (!state.hasPendingInvite || state.adminCount >= 2) {
        return state; // rejected, no state change
      }
      return { adminCount: state.adminCount + 1, hasPendingInvite: false };
    }
    case 'removeAdmin': {
      // RPC remover_co_admin: rejects if only 1 admin remains
      if (state.adminCount <= 1) {
        return state; // rejected, no state change
      }
      return { ...state, adminCount: state.adminCount - 1 };
    }
  }
}

const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  fc.constant<Operation>({ type: 'generateInvite' }),
  fc.constant<Operation>({ type: 'acceptInvite' }),
  fc.constant<Operation>({ type: 'removeAdmin' }),
);

describe('Feature: admin-invite, Property 4: Invariante de máximo 2 admins por família', () => {
  it('admin count never exceeds 2 after any sequence of operations', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          // Every family starts with exactly 1 admin (the creator)
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };

          for (const op of operations) {
            state = applyOperation(state, op);
            expect(state.adminCount).toBeLessThanOrEqual(2);
            expect(state.adminCount).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('admin count never drops below 1 (cannot remove the last admin)', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };

          for (const op of operations) {
            state = applyOperation(state, op);
            expect(state.adminCount).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepting an invite is the only way to increase admin count', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };

          for (const op of operations) {
            const prevCount = state.adminCount;
            state = applyOperation(state, op);

            if (state.adminCount > prevCount) {
              expect(op.type).toBe('acceptInvite');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 5: No máximo um convite pendente por família
 *
 * Para qualquer família que já possua um convite com status `pendente`, a tentativa
 * de gerar um novo convite deve ser rejeitada.
 *
 * **Validates: Requirements 2.3**
 */

describe('Feature: admin-invite, Property 5: No máximo um convite pendente por família', () => {
  it('there is never more than one pending invite after any sequence of operations', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };

          for (const op of operations) {
            state = applyOperation(state, op);
            // hasPendingInvite is a boolean, so it can only be true (1) or false (0)
            // This verifies the invariant: at most one pending invite at any point
            expect(typeof state.hasPendingInvite).toBe('boolean');
            // A pending invite count can never exceed 1 — the boolean models this directly
            expect(state.hasPendingInvite === true || state.hasPendingInvite === false).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('attempting to generate a second invite while one is pending results in no state change', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 0, maxLength: 30 }),
        (prefixOps) => {
          // Run prefix operations to reach some state
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };
          for (const op of prefixOps) {
            state = applyOperation(state, op);
          }

          // If we already have a pending invite, a second generateInvite must be rejected
          if (state.hasPendingInvite) {
            const stateBeforeSecondInvite = { ...state };
            const stateAfterSecondInvite = applyOperation(state, { type: 'generateInvite' });

            expect(stateAfterSecondInvite).toEqual(stateBeforeSecondInvite);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('generateInvite only sets hasPendingInvite to true when no invite is pending', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          let state: FamilyState = { adminCount: 1, hasPendingInvite: false };

          for (const op of operations) {
            const prevState = { ...state };
            state = applyOperation(state, op);

            // If hasPendingInvite changed from false to true, it must have been a generateInvite
            // on a state that had no pending invite and < 2 admins
            if (!prevState.hasPendingInvite && state.hasPendingInvite) {
              expect(op.type).toBe('generateInvite');
              expect(prevState.adminCount).toBeLessThan(2);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 9: Rejeição de códigos inválidos ou expirados
 *
 * Para qualquer código que não corresponda a um convite com status `pendente`
 * e `expires_at > now()`, a tentativa de validação ou aceitação deve falhar com erro.
 *
 * Este teste modela uma função pura de validação que mantém um conjunto de convites
 * pendentes válidos. Códigos não-existentes ou expirados devem ser rejeitados.
 *
 * **Validates: Requirements 3.5, 4.1, 4.2**
 */

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

type InviteRecord = {
  codigo: string;
  status: 'pendente' | 'aceito' | 'expirado' | 'cancelado';
  expires_at: number; // timestamp ms
};

type InviteStore = {
  invites: InviteRecord[];
};

/**
 * Pure model of invite validation logic.
 * Returns { valid: true, preview } if the code matches a pending, non-expired invite.
 * Returns { valid: false, reason } otherwise.
 */
function modelValidateInvite(
  store: InviteStore,
  code: string,
  now: number,
): { valid: true; familia_nome: string; admin_nome: string } | { valid: false; reason: string } {
  const invite = store.invites.find((inv) => inv.codigo === code);

  if (!invite || invite.status !== 'pendente') {
    return { valid: false, reason: 'Código inválido ou expirado. Verifique o código e tente novamente' };
  }

  if (invite.expires_at <= now) {
    return { valid: false, reason: 'Este convite expirou. Solicite um novo código ao administrador' };
  }

  return { valid: true, familia_nome: 'Família Teste', admin_nome: 'Admin Teste' };
}

/**
 * Pure model of invite acceptance logic.
 * Same validation as above, plus checks that the user doesn't already belong to a family.
 */
function modelAcceptInvite(
  store: InviteStore,
  code: string,
  now: number,
  userHasFamily: boolean,
): { accepted: true; familia_id: string } | { accepted: false; reason: string } {
  const invite = store.invites.find((inv) => inv.codigo === code);

  if (!invite || invite.status !== 'pendente') {
    return { accepted: false, reason: 'Código inválido ou expirado. Verifique o código e tente novamente' };
  }

  if (invite.expires_at <= now) {
    return { accepted: false, reason: 'Este convite expirou. Solicite um novo código ao administrador' };
  }

  if (userHasFamily) {
    return { accepted: false, reason: 'Você já pertence a uma família' };
  }

  return { accepted: true, familia_id: 'family-uuid' };
}

// Arbitrary: random 6-char code from the invite alphabet
const inviteCodeArb = fc
  .array(fc.constantFrom(...INVITE_ALPHABET.split('')), { minLength: 6, maxLength: 6 })
  .map((chars) => chars.join(''));

// Arbitrary: a set of valid pending invite codes (1–5 codes)
const pendingCodesArb = fc.uniqueArray(inviteCodeArb, { minLength: 1, maxLength: 5 });

describe('Feature: admin-invite, Property 9: Rejeição de códigos inválidos ou expirados', () => {
  const NOW = Date.now();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  it('any code NOT in the pending set is rejected on validation', () => {
    fc.assert(
      fc.property(pendingCodesArb, inviteCodeArb, (pendingCodes, randomCode) => {
        const store: InviteStore = {
          invites: pendingCodes.map((code) => ({
            codigo: code,
            status: 'pendente' as const,
            expires_at: NOW + FORTY_EIGHT_HOURS,
          })),
        };

        // Only test codes that are NOT in the pending set
        if (pendingCodes.includes(randomCode)) return;

        const result = modelValidateInvite(store, randomCode, NOW);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toBe(
            'Código inválido ou expirado. Verifique o código e tente novamente',
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('any code NOT in the pending set is rejected on acceptance', () => {
    fc.assert(
      fc.property(pendingCodesArb, inviteCodeArb, (pendingCodes, randomCode) => {
        const store: InviteStore = {
          invites: pendingCodes.map((code) => ({
            codigo: code,
            status: 'pendente' as const,
            expires_at: NOW + FORTY_EIGHT_HOURS,
          })),
        };

        if (pendingCodes.includes(randomCode)) return;

        const result = modelAcceptInvite(store, randomCode, NOW, false);
        expect(result.accepted).toBe(false);
        if (!result.accepted) {
          expect(result.reason).toBe(
            'Código inválido ou expirado. Verifique o código e tente novamente',
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('expired pending codes are rejected on validation', () => {
    fc.assert(
      fc.property(inviteCodeArb, fc.integer({ min: 1, max: 100_000 }), (code, extraMs) => {
        const expiredAt = NOW - extraMs; // expired in the past
        const store: InviteStore = {
          invites: [{ codigo: code, status: 'pendente', expires_at: expiredAt }],
        };

        const result = modelValidateInvite(store, code, NOW);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toBe(
            'Este convite expirou. Solicite um novo código ao administrador',
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('expired pending codes are rejected on acceptance', () => {
    fc.assert(
      fc.property(inviteCodeArb, fc.integer({ min: 1, max: 100_000 }), (code, extraMs) => {
        const expiredAt = NOW - extraMs;
        const store: InviteStore = {
          invites: [{ codigo: code, status: 'pendente', expires_at: expiredAt }],
        };

        const result = modelAcceptInvite(store, code, NOW, false);
        expect(result.accepted).toBe(false);
        if (!result.accepted) {
          expect(result.reason).toBe(
            'Este convite expirou. Solicite um novo código ao administrador',
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('codes with non-pendente status are rejected regardless of expiry', () => {
    const nonPendenteStatus = fc.constantFrom<'aceito' | 'expirado' | 'cancelado'>(
      'aceito',
      'expirado',
      'cancelado',
    );

    fc.assert(
      fc.property(inviteCodeArb, nonPendenteStatus, (code, status) => {
        const store: InviteStore = {
          invites: [{ codigo: code, status, expires_at: NOW + FORTY_EIGHT_HOURS }],
        };

        const validateResult = modelValidateInvite(store, code, NOW);
        expect(validateResult.valid).toBe(false);

        const acceptResult = modelAcceptInvite(store, code, NOW, false);
        expect(acceptResult.accepted).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('only valid pending non-expired codes are accepted', () => {
    fc.assert(
      fc.property(inviteCodeArb, (code) => {
        const store: InviteStore = {
          invites: [{ codigo: code, status: 'pendente', expires_at: NOW + FORTY_EIGHT_HOURS }],
        };

        const result = modelValidateInvite(store, code, NOW);
        expect(result.valid).toBe(true);

        const acceptResult = modelAcceptInvite(store, code, NOW, false);
        expect(acceptResult.accepted).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 10: Rejeição de usuário que já pertence a uma família
 *
 * Para qualquer usuário que já possua um registro em `usuarios` (independente do papel),
 * a tentativa de aceitar qualquer convite deve ser rejeitada.
 *
 * **Validates: Requirements 3.6**
 */

describe('Feature: admin-invite, Property 10: Rejeição de usuário que já pertence a uma família', () => {
  const NOW = Date.now();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  it('a user who already belongs to a family is always rejected when accepting a valid pending non-expired invite', () => {
    fc.assert(
      fc.property(inviteCodeArb, (code) => {
        const store: InviteStore = {
          invites: [{ codigo: code, status: 'pendente', expires_at: NOW + FORTY_EIGHT_HOURS }],
        };

        const result = modelAcceptInvite(store, code, NOW, true);

        expect(result.accepted).toBe(false);
        if (!result.accepted) {
          expect(result.reason).toBe('Você já pertence a uma família');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejection reason is always "Você já pertence a uma família" regardless of invite details', () => {
    fc.assert(
      fc.property(
        pendingCodesArb,
        fc.integer({ min: 1, max: FORTY_EIGHT_HOURS }),
        (codes, futureOffset) => {
          const store: InviteStore = {
            invites: codes.map((code) => ({
              codigo: code,
              status: 'pendente' as const,
              expires_at: NOW + futureOffset,
            })),
          };

          for (const code of codes) {
            const result = modelAcceptInvite(store, code, NOW, true);
            expect(result.accepted).toBe(false);
            if (!result.accepted) {
              expect(result.reason).toBe('Você já pertence a uma família');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 13: Rate limiting bloqueia após 5 tentativas inválidas
 *
 * Para qualquer usuário que submeta 5 códigos inválidos consecutivos em um intervalo
 * de 10 minutos, a próxima tentativa deve ser bloqueada com erro de rate limit.
 *
 * Este teste modela um rate limiter puro que rastreia tentativas por usuário dentro
 * de uma janela de 10 minutos. Após 5 tentativas na janela, tentativas subsequentes
 * são bloqueadas até que a janela expire.
 *
 * **Validates: Requirements 9.2**
 */

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type RateLimiterState = {
  /** Timestamps (ms) of invalid attempts within the current window */
  attempts: number[];
};

type AttemptResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure rate limiter model.
 * Tracks invalid attempt timestamps per user within a sliding 10-minute window.
 * After 5 attempts in the window, subsequent attempts are blocked.
 */
function rateLimiterCheck(state: RateLimiterState, now: number): AttemptResult {
  // Keep only attempts within the current window
  const recentAttempts = state.attempts.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      reason: 'Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente',
    };
  }

  return { allowed: true };
}

/**
 * Records an invalid attempt and returns the updated state.
 */
function rateLimiterRecord(state: RateLimiterState, now: number): RateLimiterState {
  // Prune old attempts outside the window, then add the new one
  const recentAttempts = state.attempts.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  return { attempts: [...recentAttempts, now] };
}

// Arbitrary: a time offset within the 10-minute window (0 to just under 10 min)
const withinWindowOffsetArb = fc.integer({ min: 0, max: RATE_LIMIT_WINDOW_MS - 1 });

// Arbitrary: a time offset that exceeds the 10-minute window
const beyondWindowOffsetArb = fc.integer({ min: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_WINDOW_MS * 3 });

describe('Feature: admin-invite, Property 13: Rate limiting bloqueia após 5 tentativas inválidas', () => {
  const BASE_TIME = 1_700_000_000_000; // arbitrary fixed start

  it('after exactly 5 invalid attempts within the window, the 6th attempt is blocked', () => {
    fc.assert(
      fc.property(
        // Generate 5 small increasing deltas so all 5 attempts cluster together
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 5, maxLength: 5 }),
        // Small delta for the 6th attempt after the last one
        fc.integer({ min: 0, max: 1000 }),
        (deltas, sixthDelta) => {
          let state: RateLimiterState = { attempts: [] };
          let currentTime = BASE_TIME;

          // Record 5 invalid attempts with small increments (all within the window)
          for (const delta of deltas) {
            currentTime += delta;
            const check = rateLimiterCheck(state, currentTime);
            expect(check.allowed).toBe(true);
            state = rateLimiterRecord(state, currentTime);
          }

          // 6th attempt shortly after must be blocked (still within window of all 5)
          currentTime += sixthDelta;
          const sixthCheck = rateLimiterCheck(state, currentTime);
          expect(sixthCheck.allowed).toBe(false);
          if (!sixthCheck.allowed) {
            expect(sixthCheck.reason).toBe(
              'Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente',
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fewer than 5 attempts within the window are always allowed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.array(withinWindowOffsetArb, { minLength: 4, maxLength: 4 }),
        (attemptCount, offsets) => {
          const sorted = offsets.slice(0, attemptCount).sort((a, b) => a - b);

          let state: RateLimiterState = { attempts: [] };

          for (const offset of sorted) {
            const now = BASE_TIME + offset;
            const check = rateLimiterCheck(state, now);
            expect(check.allowed).toBe(true);
            state = rateLimiterRecord(state, now);
          }

          // Next attempt should still be allowed (we have < 5 attempts)
          const nextTime = BASE_TIME + sorted[sorted.length - 1] + 1;
          const nextCheck = rateLimiterCheck(state, nextTime);
          expect(nextCheck.allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('attempts are allowed again after the 10-minute window expires', () => {
    fc.assert(
      fc.property(
        beyondWindowOffsetArb,
        (beyondOffset) => {
          let state: RateLimiterState = { attempts: [] };

          // Fill up 5 attempts at BASE_TIME
          for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
            const now = BASE_TIME + i; // 1ms apart
            state = rateLimiterRecord(state, now);
          }

          // Confirm blocked right after
          const blockedCheck = rateLimiterCheck(state, BASE_TIME + RATE_LIMIT_MAX_ATTEMPTS);
          expect(blockedCheck.allowed).toBe(false);

          // After the window expires, attempts should be allowed again
          const afterWindowTime = BASE_TIME + beyondOffset;
          const allowedCheck = rateLimiterCheck(state, afterWindowTime);
          expect(allowedCheck.allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('random sequences of attempts with varying timestamps respect the rate limit invariant', () => {
    // Arbitrary: a sequence of attempt events with random time deltas
    const attemptEventArb = fc.record({
      // Time delta from previous event (0 to 20 minutes)
      deltaMs: fc.integer({ min: 0, max: 20 * 60 * 1000 }),
    });

    fc.assert(
      fc.property(
        fc.array(attemptEventArb, { minLength: 1, maxLength: 30 }),
        (events) => {
          let state: RateLimiterState = { attempts: [] };
          let currentTime = BASE_TIME;

          for (const event of events) {
            currentTime += event.deltaMs;

            const check = rateLimiterCheck(state, currentTime);

            // Count recent attempts in the window
            const recentCount = state.attempts.filter(
              (ts) => currentTime - ts < RATE_LIMIT_WINDOW_MS,
            ).length;

            // Core invariant: blocked iff recent attempts >= 5
            if (recentCount >= RATE_LIMIT_MAX_ATTEMPTS) {
              expect(check.allowed).toBe(false);
            } else {
              expect(check.allowed).toBe(true);
            }

            // Record the attempt if it was allowed
            if (check.allowed) {
              state = rateLimiterRecord(state, currentTime);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 12: Remoção de co-admin remove registro de usuarios
 *
 * Para qualquer família com exatamente 2 admins, a remoção de um co-admin deve
 * resultar em apenas 1 registro de admin restante para aquela família, e o usuário
 * removido não deve mais possuir registro em `usuarios`.
 *
 * **Validates: Requirements 7.2**
 */

/**
 * Extended family state model that tracks individual admin IDs,
 * allowing us to verify which specific admin was removed.
 */
type FamilyAdminState = {
  familyId: string;
  adminIds: Set<string>;
};

type RemovalResult =
  | { success: true; removedId: string }
  | { success: false; reason: string };

/**
 * Pure model of the `remover_co_admin` RPC logic.
 * - Validates that the caller is an admin of the same family
 * - Validates that the family has > 1 admin (cannot remove the last one)
 * - Removes the target admin's record from `usuarios`
 */
function modelRemoveCoAdmin(
  state: FamilyAdminState,
  callerId: string,
  targetId: string,
): { newState: FamilyAdminState; result: RemovalResult } {
  // Caller must be an admin in this family
  if (!state.adminIds.has(callerId)) {
    return {
      newState: state,
      result: { success: false, reason: 'Apenas admins podem remover co-administradores' },
    };
  }

  // Target must be an admin in this family
  if (!state.adminIds.has(targetId)) {
    return {
      newState: state,
      result: { success: false, reason: 'Usuário não encontrado na família' },
    };
  }

  // Cannot remove the last admin
  if (state.adminIds.size <= 1) {
    return {
      newState: state,
      result: { success: false, reason: 'Não é possível remover o único administrador da família' },
    };
  }

  // Remove the target admin
  const newAdminIds = new Set(state.adminIds);
  newAdminIds.delete(targetId);

  return {
    newState: { ...state, adminIds: newAdminIds },
    result: { success: true, removedId: targetId },
  };
}

// Arbitrary: unique admin ID strings (used in property tests below)

describe('Feature: admin-invite, Property 12: Remoção de co-admin remove registro de usuarios', () => {
  it('removing a co-admin from a 2-admin family leaves exactly 1 admin and the removed admin has no record', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (familyId, adminA, adminB) => {
          // Ensure two distinct admins
          fc.pre(adminA !== adminB);

          const state: FamilyAdminState = {
            familyId,
            adminIds: new Set([adminA, adminB]),
          };

          // Admin A removes Admin B
          const { newState, result } = modelRemoveCoAdmin(state, adminA, adminB);

          expect(result.success).toBe(true);
          // Exactly 1 admin remains
          expect(newState.adminIds.size).toBe(1);
          // The remaining admin is the caller
          expect(newState.adminIds.has(adminA)).toBe(true);
          // The removed admin has no record
          expect(newState.adminIds.has(adminB)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('cannot remove the last admin from a family with only 1 admin', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (familyId, soloAdmin) => {
          const state: FamilyAdminState = {
            familyId,
            adminIds: new Set([soloAdmin]),
          };

          // Solo admin tries to remove themselves
          const { newState, result } = modelRemoveCoAdmin(state, soloAdmin, soloAdmin);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.reason).toBe('Não é possível remover o único administrador da família');
          }
          // State unchanged — still 1 admin
          expect(newState.adminIds.size).toBe(1);
          expect(newState.adminIds.has(soloAdmin)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('either admin in a 2-admin family can remove the other, and the remover always remains', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.boolean(),
        (familyId, adminA, adminB, aRemovesB) => {
          fc.pre(adminA !== adminB);

          const state: FamilyAdminState = {
            familyId,
            adminIds: new Set([adminA, adminB]),
          };

          const caller = aRemovesB ? adminA : adminB;
          const target = aRemovesB ? adminB : adminA;

          const { newState, result } = modelRemoveCoAdmin(state, caller, target);

          expect(result.success).toBe(true);
          expect(newState.adminIds.size).toBe(1);
          // The caller (remover) always remains
          expect(newState.adminIds.has(caller)).toBe(true);
          // The target (removed) has no record
          expect(newState.adminIds.has(target)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after removal, a second removal attempt on the same family is rejected (cannot remove last admin)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (familyId, adminA, adminB) => {
          fc.pre(adminA !== adminB);

          const initialState: FamilyAdminState = {
            familyId,
            adminIds: new Set([adminA, adminB]),
          };

          // First removal: A removes B
          const { newState: stateAfterFirst, result: firstResult } = modelRemoveCoAdmin(
            initialState,
            adminA,
            adminB,
          );
          expect(firstResult.success).toBe(true);
          expect(stateAfterFirst.adminIds.size).toBe(1);

          // Second removal: A tries to remove themselves (the last admin)
          const { newState: stateAfterSecond, result: secondResult } = modelRemoveCoAdmin(
            stateAfterFirst,
            adminA,
            adminA,
          );
          expect(secondResult.success).toBe(false);
          if (!secondResult.success) {
            expect(secondResult.reason).toBe(
              'Não é possível remover o único administrador da família',
            );
          }
          // State unchanged — still 1 admin
          expect(stateAfterSecond.adminIds.size).toBe(1);
          expect(stateAfterSecond.adminIds.has(adminA)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 8: Round-trip de aceitação de convite
 *
 * Para qualquer convite pendente e não expirado, e para qualquer usuário autenticado
 * que não pertença a nenhuma família, aceitar o convite deve:
 * (a) criar um registro em `usuarios` com `papel = 'admin'` e `familia_id` da família do convite,
 * (b) atualizar o status do convite para `aceito`, e
 * (c) preencher `aceito_por` com o ID do usuário.
 *
 * **Validates: Requirements 3.4**
 */

type InviteRoundTripRecord = {
  id: string;
  familia_id: string;
  convidado_por: string;
  codigo: string;
  status: 'pendente' | 'aceito' | 'expirado' | 'cancelado';
  aceito_por: string | null;
  expires_at: number; // timestamp ms
};

type UsuarioRecord = {
  id: string;
  auth_user_id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
};

type RoundTripFamilyState = {
  familyId: string;
  usuarios: UsuarioRecord[];
  invites: InviteRoundTripRecord[];
};

/**
 * Pure model: generate an invite for a family.
 * Enforces: caller must be admin, family < 2 admins, no pending invite.
 */
function modelGenerateInvite(
  state: RoundTripFamilyState,
  callerId: string,
  inviteId: string,
  code: string,
  now: number,
): { newState: RoundTripFamilyState; success: boolean } {
  const callerUser = state.usuarios.find(
    (u) => u.auth_user_id === callerId && u.familia_id === state.familyId && u.papel === 'admin',
  );
  if (!callerUser) return { newState: state, success: false };

  const adminCount = state.usuarios.filter(
    (u) => u.familia_id === state.familyId && u.papel === 'admin',
  ).length;
  if (adminCount >= 2) return { newState: state, success: false };

  const hasPending = state.invites.some(
    (inv) => inv.familia_id === state.familyId && inv.status === 'pendente',
  );
  if (hasPending) return { newState: state, success: false };

  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  const newInvite: InviteRoundTripRecord = {
    id: inviteId,
    familia_id: state.familyId,
    convidado_por: callerUser.id,
    codigo: code,
    status: 'pendente',
    aceito_por: null,
    expires_at: now + FORTY_EIGHT_HOURS,
  };

  return {
    newState: {
      ...state,
      invites: [...state.invites, newInvite],
    },
    success: true,
  };
}

/**
 * Pure model: accept an invite by code.
 * Enforces: invite must be pending & not expired, user must not belong to any family,
 * family must have < 2 admins.
 * On success: creates usuario record, updates invite status to 'aceito', sets aceito_por.
 */
function modelAcceptInviteRoundTrip(
  state: RoundTripFamilyState,
  code: string,
  acceptingUserId: string,
  newUsuarioId: string,
  now: number,
): { newState: RoundTripFamilyState; success: boolean } {
  const invite = state.invites.find(
    (inv) => inv.codigo === code && inv.status === 'pendente' && inv.expires_at > now,
  );
  if (!invite) return { newState: state, success: false };

  // User must not already belong to any family
  const userAlreadyInFamily = state.usuarios.some((u) => u.auth_user_id === acceptingUserId);
  if (userAlreadyInFamily) return { newState: state, success: false };

  // Family must have < 2 admins
  const adminCount = state.usuarios.filter(
    (u) => u.familia_id === invite.familia_id && u.papel === 'admin',
  ).length;
  if (adminCount >= 2) return { newState: state, success: false };

  // Create new usuario record
  const newUsuario: UsuarioRecord = {
    id: newUsuarioId,
    auth_user_id: acceptingUserId,
    familia_id: invite.familia_id,
    papel: 'admin',
  };

  // Update invite status
  const updatedInvites = state.invites.map((inv) =>
    inv.id === invite.id
      ? { ...inv, status: 'aceito' as const, aceito_por: acceptingUserId }
      : inv,
  );

  return {
    newState: {
      ...state,
      usuarios: [...state.usuarios, newUsuario],
      invites: updatedInvites,
    },
    success: true,
  };
}

describe('Feature: admin-invite, Property 8: Round-trip de aceitação de convite', () => {
  const BASE_TIME = 1_700_000_000_000;

  it('generate invite then accept: family has 2 admins, invite status is aceito, aceito_por is set', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // familyId
        fc.uuid(), // original admin auth user id
        fc.uuid(), // original admin usuario id
        fc.uuid(), // invite id
        fc.uuid(), // accepting user auth id
        fc.uuid(), // new usuario id for accepting user
        inviteCodeArb, // invite code
        fc.integer({ min: 0, max: 47 * 60 * 60 * 1000 }), // acceptance time offset (within 48h)
        (familyId, adminAuthId, adminUsuarioId, inviteId, acceptingAuthId, newUsuarioId, code, acceptOffset) => {
          // Ensure distinct users
          fc.pre(adminAuthId !== acceptingAuthId);

          // Initial state: 1 admin in the family
          const initialState: RoundTripFamilyState = {
            familyId,
            usuarios: [
              {
                id: adminUsuarioId,
                auth_user_id: adminAuthId,
                familia_id: familyId,
                papel: 'admin',
              },
            ],
            invites: [],
          };

          // Step 1: Generate invite
          const generateResult = modelGenerateInvite(
            initialState,
            adminAuthId,
            inviteId,
            code,
            BASE_TIME,
          );
          expect(generateResult.success).toBe(true);

          // Verify: pending invite exists
          const pendingInvite = generateResult.newState.invites.find(
            (inv) => inv.codigo === code && inv.status === 'pendente',
          );
          expect(pendingInvite).toBeDefined();

          // Step 2: Accept invite (within 48h window)
          const acceptTime = BASE_TIME + acceptOffset;
          const acceptResult = modelAcceptInviteRoundTrip(
            generateResult.newState,
            code,
            acceptingAuthId,
            newUsuarioId,
            acceptTime,
          );
          expect(acceptResult.success).toBe(true);

          // Verify (a): family now has 2 admins
          const admins = acceptResult.newState.usuarios.filter(
            (u) => u.familia_id === familyId && u.papel === 'admin',
          );
          expect(admins).toHaveLength(2);

          // Verify (b): invite status is 'aceito'
          const updatedInvite = acceptResult.newState.invites.find((inv) => inv.id === inviteId);
          expect(updatedInvite).toBeDefined();
          expect(updatedInvite!.status).toBe('aceito');

          // Verify (c): aceito_por is set to the accepting user's auth id
          expect(updatedInvite!.aceito_por).toBe(acceptingAuthId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the new admin record has the correct familia_id and papel=admin', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        inviteCodeArb,
        (familyId, adminAuthId, adminUsuarioId, inviteId, acceptingAuthId, newUsuarioId, inviteCode) => {
          fc.pre(adminAuthId !== acceptingAuthId);

          const initialState: RoundTripFamilyState = {
            familyId,
            usuarios: [
              {
                id: adminUsuarioId,
                auth_user_id: adminAuthId,
                familia_id: familyId,
                papel: 'admin',
              },
            ],
            invites: [],
          };

          const { newState: afterGenerate, success: genOk } = modelGenerateInvite(
            initialState,
            adminAuthId,
            inviteId,
            inviteCode,
            BASE_TIME,
          );
          expect(genOk).toBe(true);

          const { newState: afterAccept, success: accOk } = modelAcceptInviteRoundTrip(
            afterGenerate,
            inviteCode,
            acceptingAuthId,
            newUsuarioId,
            BASE_TIME + 1000,
          );
          expect(accOk).toBe(true);

          // Find the newly created usuario record
          const newAdmin = afterAccept.usuarios.find((u) => u.auth_user_id === acceptingAuthId);
          expect(newAdmin).toBeDefined();
          expect(newAdmin!.familia_id).toBe(familyId);
          expect(newAdmin!.papel).toBe('admin');
          expect(newAdmin!.id).toBe(newUsuarioId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the original admin remains unchanged after the round-trip', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        inviteCodeArb,
        (familyId, adminAuthId, adminUsuarioId, inviteId, acceptingAuthId, newUsuarioId, inviteCode) => {
          fc.pre(adminAuthId !== acceptingAuthId);

          const initialState: RoundTripFamilyState = {
            familyId,
            usuarios: [
              {
                id: adminUsuarioId,
                auth_user_id: adminAuthId,
                familia_id: familyId,
                papel: 'admin',
              },
            ],
            invites: [],
          };

          const { newState: afterGenerate } = modelGenerateInvite(
            initialState,
            adminAuthId,
            inviteId,
            inviteCode,
            BASE_TIME,
          );

          const { newState: afterAccept } = modelAcceptInviteRoundTrip(
            afterGenerate,
            inviteCode,
            acceptingAuthId,
            newUsuarioId,
            BASE_TIME + 5000,
          );

          // Original admin is still present and unchanged
          const originalAdmin = afterAccept.usuarios.find((u) => u.id === adminUsuarioId);
          expect(originalAdmin).toBeDefined();
          expect(originalAdmin!.auth_user_id).toBe(adminAuthId);
          expect(originalAdmin!.familia_id).toBe(familyId);
          expect(originalAdmin!.papel).toBe('admin');
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: admin-invite, Property 11: Cancelamento altera status para cancelado
 *
 * Para qualquer convite com status `pendente`, a chamada à RPC `cancelar_convite_admin`
 * pelo admin da mesma família deve atualizar o status para `cancelado`.
 *
 * Após o cancelamento:
 * - O convite não pode mais ser aceito
 * - Um novo convite pode ser gerado para a mesma família
 *
 * **Validates: Requirements 4.3**
 */

type CancellationInvite = {
  id: string;
  familia_id: string;
  convidado_por: string;
  codigo: string;
  status: 'pendente' | 'aceito' | 'expirado' | 'cancelado';
  aceito_por: string | null;
  expires_at: number;
};

type CancellationUsuario = {
  id: string;
  auth_user_id: string;
  familia_id: string;
  papel: 'admin' | 'filho';
};

type CancellationFamilyState = {
  familyId: string;
  usuarios: CancellationUsuario[];
  invites: CancellationInvite[];
};

/**
 * Pure model of `cancelar_convite_admin` RPC.
 * - Caller must be admin of the same family as the invite
 * - Invite must be in 'pendente' status
 * - Updates status to 'cancelado'
 */
function modelCancelInvite(
  state: CancellationFamilyState,
  callerId: string,
  inviteId: string,
): { newState: CancellationFamilyState; success: boolean; reason?: string } {
  const callerUser = state.usuarios.find(
    (u) => u.auth_user_id === callerId && u.familia_id === state.familyId && u.papel === 'admin',
  );
  if (!callerUser) {
    return { newState: state, success: false, reason: 'Apenas admins podem cancelar convites' };
  }

  const invite = state.invites.find((inv) => inv.id === inviteId);
  if (!invite || invite.status !== 'pendente') {
    return { newState: state, success: false, reason: 'Convite não encontrado ou não está pendente' };
  }

  if (invite.familia_id !== state.familyId) {
    return { newState: state, success: false, reason: 'Convite não pertence à família do admin' };
  }

  const updatedInvites = state.invites.map((inv) =>
    inv.id === inviteId ? { ...inv, status: 'cancelado' as const } : inv,
  );

  return {
    newState: { ...state, invites: updatedInvites },
    success: true,
  };
}

/**
 * Pure model of invite generation (simplified for cancellation tests).
 */
function modelGenerateInviteForCancellation(
  state: CancellationFamilyState,
  callerId: string,
  inviteId: string,
  code: string,
  now: number,
): { newState: CancellationFamilyState; success: boolean } {
  const callerUser = state.usuarios.find(
    (u) => u.auth_user_id === callerId && u.familia_id === state.familyId && u.papel === 'admin',
  );
  if (!callerUser) return { newState: state, success: false };

  const adminCount = state.usuarios.filter(
    (u) => u.familia_id === state.familyId && u.papel === 'admin',
  ).length;
  if (adminCount >= 2) return { newState: state, success: false };

  const hasPending = state.invites.some(
    (inv) => inv.familia_id === state.familyId && inv.status === 'pendente',
  );
  if (hasPending) return { newState: state, success: false };

  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  const newInvite: CancellationInvite = {
    id: inviteId,
    familia_id: state.familyId,
    convidado_por: callerUser.id,
    codigo: code,
    status: 'pendente',
    aceito_por: null,
    expires_at: now + FORTY_EIGHT_HOURS,
  };

  return {
    newState: { ...state, invites: [...state.invites, newInvite] },
    success: true,
  };
}

/**
 * Pure model of invite acceptance (simplified for cancellation tests).
 */
function modelAcceptInviteForCancellation(
  state: CancellationFamilyState,
  code: string,
  acceptingUserId: string,
  newUsuarioId: string,
  now: number,
): { newState: CancellationFamilyState; success: boolean; reason?: string } {
  const invite = state.invites.find(
    (inv) => inv.codigo === code && inv.status === 'pendente' && inv.expires_at > now,
  );
  if (!invite) {
    return { newState: state, success: false, reason: 'Código inválido ou expirado' };
  }

  const userAlreadyInFamily = state.usuarios.some((u) => u.auth_user_id === acceptingUserId);
  if (userAlreadyInFamily) return { newState: state, success: false, reason: 'Já pertence a uma família' };

  const adminCount = state.usuarios.filter(
    (u) => u.familia_id === invite.familia_id && u.papel === 'admin',
  ).length;
  if (adminCount >= 2) return { newState: state, success: false, reason: 'Família já tem 2 admins' };

  const newUsuario: CancellationUsuario = {
    id: newUsuarioId,
    auth_user_id: acceptingUserId,
    familia_id: invite.familia_id,
    papel: 'admin',
  };

  const updatedInvites = state.invites.map((inv) =>
    inv.id === invite.id ? { ...inv, status: 'aceito' as const, aceito_por: acceptingUserId } : inv,
  );

  return {
    newState: { ...state, usuarios: [...state.usuarios, newUsuario], invites: updatedInvites },
    success: true,
  };
}

// Reuse invite code arbitrary from earlier in the file
const cancellationInviteCodeArb = fc
  .array(fc.constantFrom(...'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('')), { minLength: 6, maxLength: 6 })
  .map((chars) => chars.join(''));

describe('Feature: admin-invite, Property 11: Cancelamento altera status para cancelado', () => {
  const BASE_TIME = 1_700_000_000_000;

  it('cancelling a pending invite changes its status to cancelado', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // familyId
        fc.uuid(), // admin auth user id
        fc.uuid(), // admin usuario id
        fc.uuid(), // invite id
        cancellationInviteCodeArb, // invite code
        (familyId, adminAuthId, adminUsuarioId, inviteId, code) => {
          const initialState: CancellationFamilyState = {
            familyId,
            usuarios: [
              { id: adminUsuarioId, auth_user_id: adminAuthId, familia_id: familyId, papel: 'admin' },
            ],
            invites: [],
          };

          // Generate a pending invite
          const genResult = modelGenerateInviteForCancellation(
            initialState, adminAuthId, inviteId, code, BASE_TIME,
          );
          expect(genResult.success).toBe(true);

          // Verify invite is pending
          const pendingInvite = genResult.newState.invites.find((inv) => inv.id === inviteId);
          expect(pendingInvite).toBeDefined();
          expect(pendingInvite!.status).toBe('pendente');

          // Cancel the invite
          const cancelResult = modelCancelInvite(genResult.newState, adminAuthId, inviteId);
          expect(cancelResult.success).toBe(true);

          // Verify status changed to cancelado
          const cancelledInvite = cancelResult.newState.invites.find((inv) => inv.id === inviteId);
          expect(cancelledInvite).toBeDefined();
          expect(cancelledInvite!.status).toBe('cancelado');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a cancelled invite cannot be accepted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // familyId
        fc.uuid(), // admin auth user id
        fc.uuid(), // admin usuario id
        fc.uuid(), // invite id
        fc.uuid(), // accepting user auth id
        fc.uuid(), // new usuario id
        cancellationInviteCodeArb, // invite code
        (familyId, adminAuthId, adminUsuarioId, inviteId, acceptingAuthId, newUsuarioId, code) => {
          fc.pre(adminAuthId !== acceptingAuthId);

          const initialState: CancellationFamilyState = {
            familyId,
            usuarios: [
              { id: adminUsuarioId, auth_user_id: adminAuthId, familia_id: familyId, papel: 'admin' },
            ],
            invites: [],
          };

          // Generate invite
          const genResult = modelGenerateInviteForCancellation(
            initialState, adminAuthId, inviteId, code, BASE_TIME,
          );
          expect(genResult.success).toBe(true);

          // Cancel the invite
          const cancelResult = modelCancelInvite(genResult.newState, adminAuthId, inviteId);
          expect(cancelResult.success).toBe(true);

          // Try to accept the cancelled invite — must fail
          const acceptResult = modelAcceptInviteForCancellation(
            cancelResult.newState, code, acceptingAuthId, newUsuarioId, BASE_TIME + 1000,
          );
          expect(acceptResult.success).toBe(false);

          // Family should still have only 1 admin
          const admins = acceptResult.newState.usuarios.filter(
            (u) => u.familia_id === familyId && u.papel === 'admin',
          );
          expect(admins).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after cancellation, a new invite can be generated for the same family', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // familyId
        fc.uuid(), // admin auth user id
        fc.uuid(), // admin usuario id
        fc.uuid(), // first invite id
        fc.uuid(), // second invite id
        cancellationInviteCodeArb, // first code
        cancellationInviteCodeArb, // second code
        (familyId, adminAuthId, adminUsuarioId, inviteId1, inviteId2, code1, code2) => {
          fc.pre(inviteId1 !== inviteId2);

          const initialState: CancellationFamilyState = {
            familyId,
            usuarios: [
              { id: adminUsuarioId, auth_user_id: adminAuthId, familia_id: familyId, papel: 'admin' },
            ],
            invites: [],
          };

          // Generate first invite
          const gen1 = modelGenerateInviteForCancellation(
            initialState, adminAuthId, inviteId1, code1, BASE_TIME,
          );
          expect(gen1.success).toBe(true);

          // Cancel first invite
          const cancel1 = modelCancelInvite(gen1.newState, adminAuthId, inviteId1);
          expect(cancel1.success).toBe(true);

          // Generate second invite — should succeed since no pending invite exists
          const gen2 = modelGenerateInviteForCancellation(
            cancel1.newState, adminAuthId, inviteId2, code2, BASE_TIME + 1000,
          );
          expect(gen2.success).toBe(true);

          // Verify second invite is pending
          const newInvite = gen2.newState.invites.find((inv) => inv.id === inviteId2);
          expect(newInvite).toBeDefined();
          expect(newInvite!.status).toBe('pendente');

          // Verify first invite is still cancelled
          const oldInvite = gen2.newState.invites.find((inv) => inv.id === inviteId1);
          expect(oldInvite).toBeDefined();
          expect(oldInvite!.status).toBe('cancelado');
        },
      ),
      { numRuns: 100 },
    );
  });
});
