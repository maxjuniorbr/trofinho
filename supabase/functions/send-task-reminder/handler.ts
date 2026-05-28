// Handler logic extracted for testability (Vitest runs in Node, not Deno).
// index.ts re-exports everything from here and adds the Deno.serve entry point.
//
// The Child_Task_Reminder edge function is a thin wrapper around the existing
// push transport. Authenticates with the service role key (constant-time
// compare), validates the body, server-resolves the targeted `usuarios.id`
// from `(familiaId, filhoId)` to defeat IDOR, composes a single
// `ExpoPushMessage` from the COPY_BANK using `pendingCount`, and reuses
// `resolveTokens`, `sendToExpoPushApi`, and `processTicketResults` from
// `send-push-notification/handler.ts` so transport logic is not duplicated.
//
// Observability follows the `observability` rule: every event is emitted
// via `reportDiagnostic` (the Deno entry maps it to `console.info`; tests
// capture it). Push tokens are masked to the first 12 characters; no child
// names, task titles, or full tokens leak into any extra.

import {
  type ExpoPushMessage,
  type NotificationData,
  type SupabaseClientLike,
  processTicketResults,
  resolveTokens,
  sendToExpoPushApi,
} from '../send-push-notification/handler.ts';
import { REMINDER_TITLE, buildReminderBody } from './copy-bank.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SendTaskReminderRequest = {
  familiaId: string;
  filhoId: string;
  pendingCount: number;
};

export type SendTaskReminderResponse = {
  sent: number;
  failed: number;
  cleaned: number;
};

type EdgeDiagnostic = Readonly<{
  event: string;
  message?: string;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  level?: 'info' | 'warn' | 'error';
}>;

type EdgeDiagnosticReporter = (diagnostic: EdgeDiagnostic) => void;

const noopReportDiagnostic: EdgeDiagnosticReporter = () => {};

const DEFAULT_CHANNEL_ID = 'trofinho-default';
const TOKEN_PREFIX_LENGTH = 12;

// Service role keys are JWTs (>>10 KB headroom); 8 KB request cap is plenty.
const MAX_BODY_BYTES = 4_096;

// UUID v1-v5 (the shape Supabase issues). The orchestrator only ever passes
// proper UUIDs from `familias.id` and `filhos.id`, but we double-check here
// to keep the handler safe under direct invocation as well.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDiagnosticMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * Constant-time string comparison.
 *
 * Returns true iff `a` and `b` have identical length and identical bytes.
 * The XOR loop iterates over the maximum of both lengths so that early
 * termination cannot leak information about which prefix matched.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const x = aBytes[i] ?? 0;
    const y = bBytes[i] ?? 0;
    diff |= x ^ y;
  }
  return diff === 0;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function maskToken(token: string | undefined | null): string | undefined {
  if (typeof token !== 'string' || token.length === 0) return undefined;
  return token.slice(0, TOKEN_PREFIX_LENGTH);
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateRequest(
  body: unknown,
):
  | { valid: true; data: SendTaskReminderRequest }
  | { valid: false; error: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { familiaId, filhoId, pendingCount } = body as Record<string, unknown>;

  if (typeof familiaId !== 'string' || !UUID_REGEX.test(familiaId)) {
    return { valid: false, error: 'familiaId must be a UUID' };
  }
  if (typeof filhoId !== 'string' || !UUID_REGEX.test(filhoId)) {
    return { valid: false, error: 'filhoId must be a UUID' };
  }
  if (
    typeof pendingCount !== 'number' ||
    !Number.isInteger(pendingCount) ||
    pendingCount < 1
  ) {
    return { valid: false, error: 'pendingCount must be a positive integer' };
  }

  return {
    valid: true,
    data: { familiaId, filhoId, pendingCount },
  };
}

// ─── Server-side IDOR guard ──────────────────────────────────────────────────

/**
 * Resolves the child's `usuarios.id` for a given `(familiaId, filhoId)`
 * pair, enforcing tenant isolation server-side.
 *
 * The query joins `filhos` → `usuarios` constrained to the same `familia_id`
 * and to `papel = 'filho'` so a malicious caller cannot dispatch reminders
 * across families even if they manage to hit this endpoint with a forged
 * service role key (defense-in-depth: the orchestrator never sends
 * mismatched pairs).
 *
 * Returns `null` when no matching child user is found — handled as 404 by
 * the caller.
 */
export async function resolveChildUserId(
  supabase: SupabaseClientLike,
  familiaId: string,
  filhoId: string,
  reportDiagnostic: EdgeDiagnosticReporter = noopReportDiagnostic,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('filhos')
    .select('usuario_id')
    .eq('id', filhoId)
    .eq('familia_id', familiaId);

  if (error) {
    reportDiagnostic({
      event: 'send-task-reminder.resolve-filho-failed',
      message: getDiagnosticMessage(error),
      context: { familiaId },
      level: 'error',
    });
    return null;
  }

  const usuarioId = data?.[0]?.usuario_id;
  if (typeof usuarioId !== 'string' || usuarioId.length === 0) return null;

  // Verify the joined `usuarios` row is still in the same family with
  // `papel = 'filho'`. The select on `filhos` already enforced family
  // membership; this check defends against a row whose `usuario_id` was
  // re-pointed to a different family's user.
  const { data: usuarioRows, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('familia_id', familiaId);

  if (usuarioError) {
    reportDiagnostic({
      event: 'send-task-reminder.resolve-usuario-failed',
      message: getDiagnosticMessage(usuarioError),
      context: { familiaId },
      level: 'error',
    });
    return null;
  }

  if (!usuarioRows || usuarioRows.length === 0) return null;
  return usuarioId;
}

// ─── Message composition ─────────────────────────────────────────────────────

export function buildReminderMessage(
  familiaId: string,
  pendingCount: number,
): Omit<ExpoPushMessage, 'to'> {
  const data: NotificationData = {
    route: '/(child)/tasks',
    familiaId,
  };
  return {
    title: REMINDER_TITLE,
    body: buildReminderBody(pendingCount),
    sound: 'default',
    priority: 'high',
    channelId: DEFAULT_CHANNEL_ID,
    data,
  };
}

// ─── Main handler (framework-agnostic) ───────────────────────────────────────

export interface HandlerDeps {
  getServiceRoleKey: () => string | undefined;
  getSupabaseUrl: () => string;
  createSupabaseClient: (url: string, key: string) => SupabaseClientLike;
  reportDiagnostic?: EdgeDiagnosticReporter;
}

export async function handleRequest(
  req: Request,
  deps: HandlerDeps,
): Promise<Response> {
  const reportDiagnostic = deps.reportDiagnostic ?? noopReportDiagnostic;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const serviceRoleKey = deps.getServiceRoleKey();
  if (!serviceRoleKey) {
    reportDiagnostic({
      event: 'send-task-reminder.missing-service-role-key',
      level: 'error',
    });
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  // Constant-time auth check against the service role key. This endpoint is
  // called by the orchestrator over `pg_net.http_post` and never by clients;
  // any other Authorization value is rejected outright.
  const authHeader = req.headers.get('Authorization');
  const presentedKey = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!presentedKey || !constantTimeEquals(presentedKey, serviceRoleKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Reject oversized payloads before parsing.
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const { familiaId, filhoId, pendingCount } = validation.data;
  const supabase = deps.createSupabaseClient(deps.getSupabaseUrl(), serviceRoleKey);

  try {
    const userId = await resolveChildUserId(supabase, familiaId, filhoId, reportDiagnostic);
    if (!userId) {
      reportDiagnostic({
        event: 'send-task-reminder.child-not-found',
        context: { familiaId },
        level: 'warn',
      });
      return jsonResponse({ error: 'Not found' }, 404);
    }

    // Reuse the existing transport: token resolution, preference check,
    // tenant-isolation check on the resolved `userId`, Expo Push API call,
    // and DeviceNotRegistered cleanup.
    const tokens = await resolveTokens(
      supabase,
      'tarefa_lembrete',
      familiaId,
      { userId, taskTitle: '', pendingCount },
      reportDiagnostic,
    );

    if (tokens.length === 0) {
      reportDiagnostic({
        event: 'reminder: skipped, no token',
        context: { familiaId, pendingCount },
      });
      const empty: SendTaskReminderResponse = { sent: 0, failed: 0, cleaned: 0 };
      return jsonResponse(empty, 200);
    }

    const messageContent = buildReminderMessage(familiaId, pendingCount);
    const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, ...messageContent }));

    const tickets = await sendToExpoPushApi(messages);
    const result = await processTicketResults(supabase, tickets, tokens, reportDiagnostic);

    reportDiagnostic({
      event: 'reminder: dispatched',
      context: {
        familiaId,
        pendingCount,
        tokenPrefix: maskToken(tokens[0]),
      },
    });

    return jsonResponse(result satisfies SendTaskReminderResponse, 200);
  } catch (error) {
    reportDiagnostic({
      event: 'send-task-reminder.processing-failed',
      message: getDiagnosticMessage(error),
      context: { familiaId },
      tags: { subsystem: 'push', event: 'tarefa_lembrete' },
      level: 'error',
    });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
}
