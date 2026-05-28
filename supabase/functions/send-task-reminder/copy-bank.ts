// Copy bank for the Child_Task_Reminder push notification.
//
// pt-BR copy is fixed at code level — no DB-driven copy, no i18n indirection
// (req 9.4). Singular/plural is selected from `pendingCount` at compose time
// (req 3.2, 3.6). Title may carry at most one emoji per the `ui-communication`
// server-side push template exception (req 3.4); body carries no emoji
// (req 3.3). Neither title nor body contains banned substrings or guilt-
// inducing constructions (req 3.5), and neither contains any child name,
// task title, identifier, or `competencia` (req 3.7).
//
// This file has no imports so it can be loaded both by the Deno runtime
// (via `index.ts`) and by Vitest running in Node (via the property and
// example tests in `copy-bank.test.ts` / `handler.test.ts`).

export const REMINDER_TITLE = 'Bora fechar o dia 🌙';

export const REMINDER_BODY_SINGULAR = 'Você ainda tem 1 tarefa pra hoje. Bora?';

export const REMINDER_BODY_PLURAL = 'Você ainda tem {n} tarefas pra hoje. Bora?';

export const REMINDER_BODY_FALLBACK = 'Falta pouco pra fechar o dia.';

/**
 * Builds the Reminder_Body string for a given pending-task count.
 *
 * - Returns `REMINDER_BODY_FALLBACK` when `pendingCount` is not a positive
 *   integer (req 8.4 defensive path: composition time may observe zero
 *   pending after the orchestrator selected the child).
 * - Returns `REMINDER_BODY_SINGULAR` for exactly 1 pending task (req 3.6).
 * - Returns `REMINDER_BODY_PLURAL` with `{n}` substituted by the integer
 *   for 2 or more pending tasks (req 3.2, 3.6).
 */
export function buildReminderBody(pendingCount: number): string {
  if (!Number.isInteger(pendingCount) || pendingCount < 1) {
    return REMINDER_BODY_FALLBACK;
  }
  if (pendingCount === 1) {
    return REMINDER_BODY_SINGULAR;
  }
  return REMINDER_BODY_PLURAL.replace('{n}', String(pendingCount));
}
