// Handler logic extracted for testability (Vitest runs in Node, not Deno).
// index.ts re-exports everything from here and adds the Deno.serve entry point.

// ─── Types ───────────────────────────────────────────────────────────────────

export type PushEvent =
  | 'tarefa_aprovada'
  | 'tarefa_rejeitada'
  | 'tarefa_criada'
  | 'resgate_confirmado'
  | 'resgate_solicitado'
  | 'resgate_cancelado'
  | 'tarefa_concluida'
  | 'resgate_cofrinho_solicitado'
  | 'resgate_cofrinho_confirmado'
  | 'resgate_cofrinho_cancelado';

export type EventPayload =
  | { userId: string; taskTitle: string; entityId?: string }
  | { userId: string; prizeName: string }
  | { childName: string; prizeName: string; redemptionId?: string; childUserId?: string }
  | {
      childName: string;
      taskTitle: string;
      entityId?: string;
      assignmentId?: string;
      childUserId?: string;
    }
  | { filhoIds: string[]; taskTitle: string };

export type NotificationPrefs = {
  tarefasPendentes?: boolean;
  tarefaAprovada?: boolean;
  tarefaRejeitada?: boolean;
  tarefaConcluida?: boolean;
  resgatesSolicitado?: boolean;
  resgateConfirmado?: boolean;
  resgateCancelado?: boolean;
  resgateCofrinhoSolicitado?: boolean;
  resgateCofrinhoConfirmado?: boolean;
  resgateCofrinhoCancelado?: boolean;
};

export type PushNotificationRequest = {
  event: PushEvent;
  familiaId: string;
  payload: EventPayload;
};

export type PushNotificationResponse = {
  sent: number;
  failed: number;
  cleaned: number;
};

const DEFAULT_CHANNEL_ID = 'trofinho-default';

export type NotificationData = {
  route: string;
  entityId?: string;
  assignmentId?: string;
  redemptionId?: string;
  familiaId?: string;
  childUserId?: string;
  taskTitle?: string;
  prizeName?: string;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: string;
  categoryId?: string;
  data: NotificationData;
};

export type ExpoTicketResult =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error: string } };

type MessageContent = Omit<ExpoPushMessage, 'to'>;
type EdgeDiagnostic = Readonly<{
  event: string;
  message?: string;
  context?: Record<string, unknown>;
}>;
type EdgeDiagnosticReporter = (diagnostic: EdgeDiagnostic) => void;

const noopReportDiagnostic: EdgeDiagnosticReporter = () => {};

function getDiagnosticMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string') return message;
  }

  return String(error);
}

// ─── Supabase client interface (avoids importing @supabase/supabase-js) ──────

/** Minimal interface for the Supabase operations used by the handler. */
export interface SupabaseClientLike {
  auth: {
    getUser(jwt?: string): PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          column: string,
          value: string,
        ): PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
      } & PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
      in(
        column: string,
        values: string[],
      ): {
        eq(
          column: string,
          value: string,
        ): PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
      } & PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
    };
    delete(): {
      in(column: string, values: string[]): PromiseLike<{ error: unknown }>;
    };
  };
}

export const ADMIN_ONLY_EVENTS: ReadonlySet<PushEvent> = new Set<PushEvent>([
  'tarefa_criada',
  'tarefa_aprovada',
  'tarefa_rejeitada',
  'resgate_confirmado',
  'resgate_cofrinho_confirmado',
  'resgate_cofrinho_cancelado',
]);

export const FILHO_ONLY_EVENTS: ReadonlySet<PushEvent> = new Set<PushEvent>([
  'tarefa_concluida',
  'resgate_solicitado',
  'resgate_cofrinho_solicitado',
]);

// resgate_cancelado is allowed for both roles (admin and filho can cancel pending redemptions)

export function isEventAllowedForRole(event: PushEvent, papel: string): boolean {
  if (ADMIN_ONLY_EVENTS.has(event)) return papel === 'admin';
  if (FILHO_ONLY_EVENTS.has(event)) return papel === 'filho';
  return true;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

export const VALID_EVENTS: ReadonlySet<string> = new Set<PushEvent>([
  'tarefa_aprovada',
  'tarefa_rejeitada',
  'tarefa_criada',
  'resgate_confirmado',
  'resgate_solicitado',
  'resgate_cancelado',
  'tarefa_concluida',
  'resgate_cofrinho_solicitado',
  'resgate_cofrinho_confirmado',
  'resgate_cofrinho_cancelado',
]);

export function validateRequest(body: unknown):
  | {
      valid: true;
      data: PushNotificationRequest;
    }
  | {
      valid: false;
      error: string;
    } {
  if (body === null || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { event, familiaId, payload } = body as Record<string, unknown>;

  if (typeof event !== 'string' || !VALID_EVENTS.has(event)) {
    return {
      valid: false,
      error: `Invalid event. Must be one of: ${[...VALID_EVENTS].join(', ')}`,
    };
  }

  if (typeof familiaId !== 'string' || familiaId.trim() === '') {
    return { valid: false, error: 'familiaId must be a non-empty string' };
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'payload must be an object' };
  }

  return {
    valid: true,
    data: { event: event as PushEvent, familiaId, payload: payload as EventPayload },
  };
}

// ─── Message template builder ────────────────────────────────────────────────

type MessageTemplateVariant = {
  title: string;
  bodyTemplate: string;
};

type MessageTemplateConfig = {
  variants: MessageTemplateVariant[];
  route: string;
};

export const MESSAGE_TEMPLATES: Record<PushEvent, MessageTemplateConfig> = {
  tarefa_aprovada: {
    variants: [
      { title: 'Tarefa aprovada ✅', bodyTemplate: 'Sua tarefa "{taskTitle}" foi aprovada!' },
      { title: 'Mandou bem! 🎯', bodyTemplate: '"{taskTitle}" aprovada! Continue assim!' },
      { title: 'Arrasou! ⭐', bodyTemplate: 'Parabéns! "{taskTitle}" foi aprovada!' },
      { title: 'Muito bem! 🏆', bodyTemplate: '"{taskTitle}" aprovada com sucesso!' },
    ],
    route: '/(child)/tasks',
  },
  tarefa_rejeitada: {
    variants: [
      {
        title: 'Quase lá! 🔄',
        bodyTemplate: 'Sua tarefa "{taskTitle}" precisa de ajustes. Confira!',
      },
      {
        title: 'Tarefa devolvida 📋',
        bodyTemplate: '"{taskTitle}" foi devolvida. Dá uma olhadinha!',
      },
      {
        title: 'Ops, tenta de novo 💪',
        bodyTemplate: '"{taskTitle}" precisa de correção. Você consegue!',
      },
    ],
    route: '/(child)/tasks',
  },
  tarefa_criada: {
    variants: [
      { title: 'Nova tarefa 📝', bodyTemplate: 'Você tem uma nova tarefa: "{taskTitle}".' },
      { title: 'Missão nova! 🚀', bodyTemplate: 'Nova tarefa chegou: "{taskTitle}". Bora!' },
      { title: 'Tarefa fresquinha 🆕', bodyTemplate: '"{taskTitle}" te espera. Partiu!' },
    ],
    route: '/(child)/tasks',
  },
  resgate_confirmado: {
    variants: [
      {
        title: 'Resgate confirmado 🎉',
        bodyTemplate: 'Seu resgate de "{prizeName}" foi confirmado!',
      },
      { title: 'Prêmio garantido! 🎁', bodyTemplate: '"{prizeName}" é seu! Aproveite!' },
      { title: 'Oba! 🥳', bodyTemplate: 'Resgate de "{prizeName}" confirmado! Parabéns!' },
    ],
    route: '/(child)/redemptions',
  },
  resgate_cancelado: {
    variants: [
      { title: 'Resgate cancelado ❌', bodyTemplate: 'O resgate de "{prizeName}" foi cancelado.' },
      {
        title: 'Resgate não aprovado 😕',
        bodyTemplate: '"{prizeName}" foi cancelado. Que tal tentar outro?',
      },
    ],
    route: '/(child)/redemptions',
  },
  resgate_solicitado: {
    variants: [
      { title: 'Novo resgate! 🎁', bodyTemplate: '{childName} quer resgatar "{prizeName}".' },
      {
        title: 'Pedido de resgate 📬',
        bodyTemplate: '{childName} solicitou "{prizeName}". Confira!',
      },
    ],
    route: '/(admin)/redemptions',
  },
  tarefa_concluida: {
    variants: [
      {
        title: 'Tarefa concluída 🎯',
        bodyTemplate: '{childName} concluiu "{taskTitle}". Confira!',
      },
      { title: 'Missão cumprida! ✨', bodyTemplate: '{childName} finalizou "{taskTitle}".' },
      {
        title: 'Pronto! 📌',
        bodyTemplate: '{childName} terminou a tarefa "{taskTitle}".',
      },
    ],
    route: '/(admin)/tasks',
  },
  resgate_cofrinho_solicitado: {
    variants: [
      {
        title: 'Resgate do cofrinho 🐷',
        bodyTemplate: '{childName} quer resgatar do cofrinho.',
      },
      {
        title: 'Pedido de resgate 📬',
        bodyTemplate: '{childName} solicitou resgate do cofrinho. Confira!',
      },
    ],
    route: '/(admin)/balances',
  },
  resgate_cofrinho_confirmado: {
    variants: [
      {
        title: 'Resgate do cofrinho confirmado 🎉',
        bodyTemplate: 'Seu resgate do cofrinho foi confirmado!',
      },
      {
        title: 'Cofrinho liberado! 🐷',
        bodyTemplate: 'O resgate do seu cofrinho foi aprovado!',
      },
    ],
    route: '/(child)/balance',
  },
  resgate_cofrinho_cancelado: {
    variants: [
      {
        title: 'Resgate do cofrinho cancelado ❌',
        bodyTemplate: 'Seu resgate do cofrinho foi cancelado.',
      },
      {
        title: 'Cofrinho mantido 🐷',
        bodyTemplate: 'O resgate do cofrinho não foi aprovado.',
      },
    ],
    route: '/(child)/balance',
  },
};

// ─── Progress suffix (best-effort) ──────────────────────────────────────────

function getTodaySP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

async function fetchFilhoId(supabase: SupabaseClientLike, userId: string): Promise<string | null> {
  const { data: filhos } = await supabase.from('filhos').select('id').eq('usuario_id', userId);
  return (filhos?.[0]?.id as string) ?? null;
}

async function fetchTaskProgressSuffix(
  supabase: SupabaseClientLike,
  event: 'tarefa_aprovada' | 'tarefa_concluida',
  payload: EventPayload,
): Promise<string> {
  const userId =
    event === 'tarefa_aprovada'
      ? (payload as { userId: string }).userId
      : (payload as { childUserId?: string }).childUserId;
  if (!userId) return '';

  const filhoId = await fetchFilhoId(supabase, userId);
  if (!filhoId) return '';

  const today = getTodaySP();
  const { data: assignments } = await supabase
    .from('atribuicoes')
    .select('status')
    .eq('filho_id', filhoId)
    .eq('competencia', today);

  if (!assignments?.length) return '';
  const approved = assignments.filter(
    (a: Record<string, unknown>) => a.status === 'aprovada',
  ).length;
  return ` (${approved}/${assignments.length} hoje 🎯)`;
}

async function fetchRedemptionSuffix(
  supabase: SupabaseClientLike,
  payload: EventPayload,
): Promise<string> {
  const userId = (payload as { userId: string }).userId;
  if (!userId) return '';

  const filhoId = await fetchFilhoId(supabase, userId);
  if (!filhoId) return '';

  const { data: saldos } = await supabase
    .from('saldos')
    .select('saldo_livre')
    .eq('filho_id', filhoId);
  if (!saldos?.[0]) return '';
  const saldo = saldos[0].saldo_livre as number;
  return ` Saldo: ${saldo} moedas 💰`;
}

export async function fetchProgressSuffix(
  supabase: SupabaseClientLike,
  event: PushEvent,
  payload: EventPayload,
): Promise<string> {
  try {
    if (event === 'tarefa_aprovada' || event === 'tarefa_concluida') {
      return await fetchTaskProgressSuffix(supabase, event, payload);
    }
    if (event === 'resgate_confirmado') {
      return await fetchRedemptionSuffix(supabase, payload);
    }
  } catch {
    // Progress is best-effort — don't fail the notification
  }
  return '';
}

const EVENT_CATEGORY_MAP: Partial<Record<PushEvent, string>> = {
  tarefa_concluida: 'TASK_REVIEW',
  resgate_solicitado: 'REDEMPTION_REVIEW',
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]; // NOSONAR — non-security random: picking notification copy
}

function buildActionData(
  event: PushEvent,
  payload: EventPayload,
  familiaId: string,
): Partial<NotificationData> {
  const p = payload as Record<string, string>;
  if (event === 'tarefa_concluida') {
    return {
      ...(p.assignmentId ? { assignmentId: p.assignmentId } : {}),
      ...(p.childUserId ? { childUserId: p.childUserId } : {}),
      ...(p.taskTitle ? { taskTitle: p.taskTitle } : {}),
      familiaId,
    };
  }
  if (event === 'resgate_solicitado') {
    return {
      ...(p.redemptionId ? { redemptionId: p.redemptionId } : {}),
      ...(p.childUserId ? { childUserId: p.childUserId } : {}),
      ...(p.prizeName ? { prizeName: p.prizeName } : {}),
      familiaId,
    };
  }
  return {};
}

export function buildMessage(
  event: PushEvent,
  payload: EventPayload,
  familiaId: string,
): MessageContent {
  const config = MESSAGE_TEMPLATES[event];
  const variant = pickRandom(config.variants);

  const body = variant.bodyTemplate.replaceAll(
    /\{(\w+)\}/g,
    (_, key: string) => (payload as Record<string, string>)[key] ?? '',
  );

  const entityId = 'entityId' in payload ? payload.entityId : undefined;
  const categoryId = EVENT_CATEGORY_MAP[event];
  const actionData = buildActionData(event, payload, familiaId);

  return {
    title: variant.title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: DEFAULT_CHANNEL_ID,
    ...(categoryId ? { categoryId } : {}),
    data: { route: config.route, ...(entityId ? { entityId } : {}), ...actionData },
  };
}

// ─── Recipient resolution helpers ────────────────────────────────────────────

const CHILD_TARGETED_EVENTS: ReadonlySet<PushEvent> = new Set<PushEvent>([
  'tarefa_aprovada',
  'tarefa_rejeitada',
  'resgate_confirmado',
  'resgate_cancelado',
  'resgate_cofrinho_confirmado',
  'resgate_cofrinho_cancelado',
]);

const ADMIN_TARGETED_EVENTS: ReadonlySet<PushEvent> = new Set<PushEvent>([
  'resgate_solicitado',
  'tarefa_concluida',
  'resgate_cofrinho_solicitado',
]);

/** Events targeting multiple children via filhoIds. */
const MULTI_CHILD_TARGETED_EVENTS: ReadonlySet<PushEvent> = new Set<PushEvent>(['tarefa_criada']);

export const PREFERENCE_KEY_MAP: Record<PushEvent, keyof NotificationPrefs> = {
  tarefa_aprovada: 'tarefaAprovada',
  tarefa_rejeitada: 'tarefaRejeitada',
  tarefa_criada: 'tarefasPendentes',
  tarefa_concluida: 'tarefaConcluida',
  resgate_solicitado: 'resgatesSolicitado',
  resgate_confirmado: 'resgateConfirmado',
  resgate_cancelado: 'resgateCancelado',
  resgate_cofrinho_solicitado: 'resgateCofrinhoSolicitado',
  resgate_cofrinho_confirmado: 'resgateCofrinhoConfirmado',
  resgate_cofrinho_cancelado: 'resgateCofrinhoCancelado',
};

export function getPreferenceKey(event: PushEvent): keyof NotificationPrefs {
  return PREFERENCE_KEY_MAP[event];
}

export async function resolveRecipientUserIds(
  supabase: SupabaseClientLike,
  event: PushEvent,
  familiaId: string,
  payload: EventPayload,
  reportDiagnostic: EdgeDiagnosticReporter = noopReportDiagnostic,
): Promise<string[]> {
  if (CHILD_TARGETED_EVENTS.has(event)) {
    const userId = (payload as { userId: string }).userId;
    if (!userId) return [];

    // Validate that the target user belongs to the specified family
    // to prevent cross-tenant push notifications (IDOR).
    const { data: userRows, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .eq('familia_id', familiaId);

    if (userError || !userRows || userRows.length === 0) {
      reportDiagnostic({
        event: 'send-push-notification.target-user-family-mismatch',
        context: { userId, familiaId },
      });
      return [];
    }

    return [userId];
  }

  if (MULTI_CHILD_TARGETED_EVENTS.has(event)) {
    const filhoIds = (payload as { filhoIds: string[] }).filhoIds;
    if (!filhoIds || filhoIds.length === 0) return [];

    const { data, error } = await supabase
      .from('filhos')
      .select('usuario_id')
      .in('id', filhoIds)
      .eq('familia_id', familiaId);

    if (error) {
      reportDiagnostic({
        event: 'send-push-notification.resolve-filho-ids-failed',
        message: getDiagnosticMessage(error),
      });
      return [];
    }

    return (data ?? [])
      .map((f: Record<string, unknown>) => f.usuario_id as string | null)
      .filter((id): id is string => !!id);
  }

  if (ADMIN_TARGETED_EVENTS.has(event)) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('familia_id', familiaId)
      .eq('papel', 'admin');

    if (error) {
      reportDiagnostic({
        event: 'send-push-notification.query-admin-users-failed',
        message: getDiagnosticMessage(error),
      });
      return [];
    }

    return (data ?? []).map((u: Record<string, unknown>) => u.id as string);
  }

  return [];
}

export function isPreferenceEnabled(
  notifPrefs: NotificationPrefs | null | undefined,
  prefKey: keyof NotificationPrefs,
): boolean {
  if (notifPrefs == null) return true;
  const value = notifPrefs[prefKey];
  if (value === undefined) return true;
  return value === true;
}

export async function resolveTokens(
  supabase: SupabaseClientLike,
  event: PushEvent,
  familiaId: string,
  payload: EventPayload,
  reportDiagnostic: EdgeDiagnosticReporter = noopReportDiagnostic,
): Promise<string[]> {
  const userIds = await resolveRecipientUserIds(
    supabase,
    event,
    familiaId,
    payload,
    reportDiagnostic,
  );
  if (userIds.length === 0) return [];

  const prefKey = getPreferenceKey(event);

  const { data: users, error: usersError } = await supabase
    .from('usuarios')
    .select('id, notif_prefs')
    .in('id', userIds)
    .eq('familia_id', familiaId);

  if (usersError) {
    reportDiagnostic({
      event: 'send-push-notification.query-user-preferences-failed',
      message: getDiagnosticMessage(usersError),
    });
    return [];
  }

  const eligibleUserIds = (users ?? [])
    .filter((u: Record<string, unknown>) =>
      isPreferenceEnabled(u.notif_prefs as NotificationPrefs | null, prefKey),
    )
    .map((u: Record<string, unknown>) => u.id as string);

  if (eligibleUserIds.length === 0) return [];

  const { data: tokens, error: tokensError } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', eligibleUserIds);

  if (tokensError) {
    reportDiagnostic({
      event: 'send-push-notification.query-push-tokens-failed',
      message: getDiagnosticMessage(tokensError),
    });
    return [];
  }

  return (tokens ?? []).map((t: Record<string, unknown>) => t.token as string);
}

// ─── Expo Push API helpers ────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends an array of ExpoPushMessages to the Expo Push API.
 * Returns the ticket results from the API response.
 */
export async function sendToExpoPushApi(messages: ExpoPushMessage[]): Promise<ExpoTicketResult[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as { data: ExpoTicketResult[] };
  return json.data;
}

/**
 * Processes Expo Push API ticket results:
 * - Counts sent (status === 'ok') and failed (status === 'error')
 * - Deletes tokens with DeviceNotRegistered errors from push_tokens
 * - Retains tokens for other error types (InvalidCredentials, MessageTooBig, etc.)
 * Returns { sent, failed, cleaned }.
 */
export async function processTicketResults(
  supabase: SupabaseClientLike,
  tickets: ExpoTicketResult[],
  tokens: string[],
  reportDiagnostic: EdgeDiagnosticReporter = noopReportDiagnostic,
): Promise<PushNotificationResponse> {
  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  const tokensToDelete: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      const errorType = ticket.details?.error;
      if (errorType === 'DeviceNotRegistered') {
        tokensToDelete.push(tokens[i]);
      } else {
        reportDiagnostic({
          event: 'send-push-notification.expo-ticket-failed',
          message: errorType ?? ticket.message,
          context: { tokenIndex: i },
        });
      }
    }
  }

  if (tokensToDelete.length > 0) {
    const { error } = await supabase.from('push_tokens').delete().in('token', tokensToDelete);

    if (error) {
      reportDiagnostic({
        event: 'send-push-notification.delete-invalid-tokens-failed',
        message: getDiagnosticMessage(error),
      });
    } else {
      cleaned = tokensToDelete.length;
    }
  }

  return { sent, failed, cleaned };
}

// ─── Main handler (framework-agnostic) ───────────────────────────────────────

export interface HandlerDeps {
  getServiceRoleKey: () => string | undefined;
  getSupabaseUrl: () => string;
  createSupabaseClient: (url: string, key: string) => SupabaseClientLike;
  reportDiagnostic?: EdgeDiagnosticReporter;
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth check: accept any Bearer token (user JWT from supabase.functions.invoke).
  // The service role key is used internally for DB queries that bypass RLS.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.replace(/^Bearer\s+/i, '').trim()) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleKey = deps.getServiceRoleKey();
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // S22: Reject oversized payloads before parsing
  const MAX_BODY_BYTES = 10_240; // 10 KB
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate body
  const validation = validateRequest(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { event, familiaId, payload } = validation.data;

  const supabase = deps.createSupabaseClient(deps.getSupabaseUrl(), serviceRoleKey);
  const reportDiagnostic = deps.reportDiagnostic ?? noopReportDiagnostic;

  // Verify the caller's identity via Supabase Auth (validates JWT signature server-side).
  // Prevents forged tokens from being accepted.
  const userToken = authHeader.replace(/^Bearer\s+/i, '');
  const { data: authData, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const callerId = authData.user.id;

  const { data: callerRows, error: callerError } = await supabase
    .from('usuarios')
    .select('familia_id, papel')
    .eq('id', callerId);

  if (callerError || !callerRows || callerRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callerFamiliaId = callerRows[0].familia_id as string;
  if (callerFamiliaId !== familiaId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callerPapel = callerRows[0].papel as string;
  if (!isEventAllowedForRole(event, callerPapel)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const tokens = await resolveTokens(supabase, event, familiaId, payload, reportDiagnostic);
    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, cleaned: 0 } satisfies PushNotificationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const messageContent = buildMessage(event, payload, familiaId);
    const suffix = await fetchProgressSuffix(supabase, event, payload);
    if (suffix) {
      messageContent.body += suffix;
    }
    const messages: ExpoPushMessage[] = tokens.map((t) => ({ to: t, ...messageContent }));
    const tickets = await sendToExpoPushApi(messages);
    const response = await processTicketResults(supabase, tickets, tokens, reportDiagnostic);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    reportDiagnostic({
      event: 'send-push-notification.processing-failed',
      message: getDiagnosticMessage(error),
      context: { pushEvent: event, familiaId },
    });
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
