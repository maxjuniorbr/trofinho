// Handler logic extracted for testability (Vitest runs in Node, not Deno).
// index.ts re-exports everything from here and adds the Deno.serve entry point.

// ─── Types ───────────────────────────────────────────────────────────────────

export type VincularFilhoRequest = {
  invite_code: string;
  date_of_birth: string; // ISO 8601 date (e.g. "2010-05-15")
};

export type VincularFilhoSuccessResponse = {
  success: true;
  familia_nome: string;
  papel: 'filho';
};

export type VincularFilhoErrorResponse = {
  success: false;
  error: 'INVALID_CODE' | 'EXPIRED_CODE' | 'ALREADY_LINKED' | 'FAMILY_FULL';
};

export type VincularFilhoResponse = VincularFilhoSuccessResponse | VincularFilhoErrorResponse;

// ─── Supabase client interface (avoids importing @supabase/supabase-js) ──────
// Kept intentionally loose (Record-based returns) so mocks stay simple.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SupabaseClientLike {
  auth: {
    getUser(jwt?: string): PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
    admin: {
      updateUserById(
        userId: string,
        attributes: { user_metadata: Record<string, unknown> },
      ): PromiseLike<{
        data: { user: unknown } | null;
        error: { message: string } | null;
      }>;
    };
  };
  from(table: string): any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Validation ──────────────────────────────────────────────────────────────

const INVITE_CODE_REGEX = /^[A-Za-z0-9]{6}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateRequest(
  body: unknown,
): { valid: true; data: VincularFilhoRequest } | { valid: false; error: string } {
  if (body === null || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { invite_code, date_of_birth } = body as Record<string, unknown>;

  if (typeof invite_code !== 'string' || !INVITE_CODE_REGEX.test(invite_code)) {
    return { valid: false, error: 'invite_code must be a 6-character alphanumeric string' };
  }

  if (typeof date_of_birth !== 'string' || !ISO_DATE_REGEX.test(date_of_birth)) {
    return { valid: false, error: 'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)' };
  }

  // Verify the date string is actually a valid date
  const parsed = new Date(date_of_birth + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, error: 'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)' };
  }

  // Validate age: must be between 1900-01-01 and today minus 8 years
  const minDate = new Date(Date.UTC(1900, 0, 1));
  const now = new Date();
  const maxDate = new Date(Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate()));
  const utcDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));

  if (utcDate < minDate || utcDate > maxDate) {
    return { valid: false, error: 'date_of_birth must be at least 8 years ago' };
  }

  return {
    valid: true,
    data: { invite_code: invite_code.toUpperCase(), date_of_birth },
  };
}

// ─── Main handler (framework-agnostic) ───────────────────────────────────────

export interface HandlerDeps {
  getServiceRoleKey: () => string | undefined;
  getSupabaseUrl: () => string;
  createSupabaseClient: (url: string, key: string) => SupabaseClientLike;
}

const MAX_BODY_BYTES = 4_096;

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const userToken = extractBearerToken(req);
  if (!userToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const serviceRoleKey = deps.getServiceRoleKey();
  if (!serviceRoleKey) {
    return jsonResponse({ error: 'Internal error' }, 500);
  }

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
    return jsonResponse({ error: validation.error }, 400);
  }

  const { invite_code, date_of_birth } = validation.data;
  const adminClient = deps.createSupabaseClient(deps.getSupabaseUrl(), serviceRoleKey);

  // Authenticate the caller
  const childUserId = await authenticateCaller(adminClient, userToken);
  if (!childUserId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Look up and validate the invite code
  const inviteResult = await lookupAndValidateInvite(adminClient, invite_code);
  if ('errorResponse' in inviteResult) {
    return inviteResult.errorResponse;
  }

  const { invite, familiaId, nomeFilho } = inviteResult;

  // Find the matching filhos record and verify it's not already linked
  const filhoResult = await findUnlinkedFilho(adminClient, familiaId, nomeFilho);
  if ('errorResponse' in filhoResult) {
    return filhoResult.errorResponse;
  }

  // Check family child limit
  const childCount = await countActiveChildren(adminClient, familiaId);
  if (childCount >= 10) {
    return jsonResponse(
      { success: false, error: 'FAMILY_FULL' } satisfies VincularFilhoErrorResponse,
      400,
    );
  }

  // Perform the linking: update filhos, create usuarios, update invite, save metadata
  const linkError = await performLinking(
    adminClient,
    childUserId,
    filhoResult.filhoId,
    invite.id as string,
    familiaId,
    nomeFilho,
    date_of_birth,
  );
  if (linkError) {
    return linkError;
  }

  // Fetch family name for the response
  const { data: familia, error: familiaError } = await adminClient
    .from('familias')
    .select('nome')
    .eq('id', familiaId)
    .single();

  if (familiaError || !familia) {
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  return jsonResponse(
    {
      success: true,
      familia_nome: familia.nome as string,
      papel: 'filho',
    } satisfies VincularFilhoSuccessResponse,
    200,
  );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || undefined;
}

async function authenticateCaller(
  client: SupabaseClientLike,
  token: string,
): Promise<string | null> {
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function lookupAndValidateInvite(
  client: SupabaseClientLike,
  code: string,
): Promise<
  | { invite: Record<string, unknown>; familiaId: string; nomeFilho: string }
  | { errorResponse: Response }
> {
  const { data: invite, error } = await client
    .from('convites_filho')
    .select('id, familia_id, nome_filho, aceito_por, expira_em')
    .eq('codigo', code)
    .maybeSingle();

  if (error) {
    return { errorResponse: jsonResponse({ error: 'Internal error' }, 500) };
  }

  if (!invite) {
    return {
      errorResponse: jsonResponse(
        { success: false, error: 'INVALID_CODE' } satisfies VincularFilhoErrorResponse,
        400,
      ),
    };
  }

  const expiresAt = new Date(invite.expira_em as string);
  if (expiresAt <= new Date()) {
    return {
      errorResponse: jsonResponse(
        { success: false, error: 'EXPIRED_CODE' } satisfies VincularFilhoErrorResponse,
        400,
      ),
    };
  }

  if (invite.aceito_por !== null) {
    return {
      errorResponse: jsonResponse(
        { success: false, error: 'ALREADY_LINKED' } satisfies VincularFilhoErrorResponse,
        400,
      ),
    };
  }

  return {
    invite,
    familiaId: invite.familia_id as string,
    nomeFilho: invite.nome_filho as string,
  };
}

async function findUnlinkedFilho(
  client: SupabaseClientLike,
  familiaId: string,
  nomeFilho: string,
): Promise<{ filhoId: string } | { errorResponse: Response }> {
  const { data: filhoRecord, error } = await client
    .from('filhos')
    .select('id, usuario_id')
    .eq('familia_id', familiaId)
    .eq('nome', nomeFilho)
    .maybeSingle();

  if (error || !filhoRecord) {
    return { errorResponse: jsonResponse({ error: 'Internal error' }, 500) };
  }

  if (filhoRecord.usuario_id) {
    return {
      errorResponse: jsonResponse(
        { success: false, error: 'ALREADY_LINKED' } satisfies VincularFilhoErrorResponse,
        400,
      ),
    };
  }

  return { filhoId: filhoRecord.id as string };
}

const MAX_CHILDREN_PER_FAMILY = 10;

async function countActiveChildren(
  client: SupabaseClientLike,
  familiaId: string,
): Promise<number> {
  const { data, error } = await client
    .from('filhos')
    .select('id')
    .eq('familia_id', familiaId);

  if (error || !data) return 0;
  return (data as unknown[]).length;
}

async function performLinking(
  client: SupabaseClientLike,
  childUserId: string,
  filhoId: string,
  inviteId: string,
  familiaId: string,
  nomeFilho: string,
  dateOfBirth: string,
): Promise<Response | null> {
  // The four writes below are not wrapped in a single Postgres transaction
  // (the supabase-js client cannot start one across statements), so each step
  // installs a compensating rollback that runs if a later step fails. This
  // keeps the database in a consistent state even on partial failures —
  // without rollback, a failed step 2 would leave `filhos.usuario_id` set
  // with no matching `usuarios` row (orphan state).
  //
  // Rollbacks are best-effort: a failure to roll back is logged via stderr
  // (Edge Functions surface this in `supabase functions logs`) but does not
  // change the response — the original failure is still reported as 500.

  // Step 1: claim the filho row
  const { error: updateFilhoError } = await client
    .from('filhos')
    .update({ usuario_id: childUserId })
    .eq('id', filhoId)
    .select('id')
    .single();

  if (updateFilhoError) {
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  // Step 2: create the usuarios record for the child
  const { error: createUsuarioError } = await client.from('usuarios').insert({
    id: childUserId,
    familia_id: familiaId,
    papel: 'filho',
    nome: nomeFilho,
  });

  if (createUsuarioError) {
    await rollbackFilho(client, filhoId);
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  // Step 3: mark the invite as accepted
  const { error: updateInviteError } = await client
    .from('convites_filho')
    .update({ aceito_por: childUserId, aceito_em: new Date().toISOString() })
    .eq('id', inviteId)
    .select('id')
    .single();

  if (updateInviteError) {
    await rollbackUsuario(client, childUserId);
    await rollbackFilho(client, filhoId);
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  // Step 4: save date_of_birth + LGPD consent in user_metadata and clear pending invite marker
  const { error: metadataError } = await client.auth.admin.updateUserById(childUserId, {
    user_metadata: {
      date_of_birth: dateOfBirth,
      lgpd_consent_at: new Date().toISOString(),
      lgpd_consent_version: '1.0',
      pending_child_invite: null,
    },
  });

  if (metadataError) {
    await rollbackInvite(client, inviteId);
    await rollbackUsuario(client, childUserId);
    await rollbackFilho(client, filhoId);
    return jsonResponse({ error: 'Internal error' }, 500);
  }

  return null; // success — no error
}

async function rollbackFilho(client: SupabaseClientLike, filhoId: string): Promise<void> {
  const { error } = await client.from('filhos').update({ usuario_id: null }).eq('id', filhoId);
  if (error) logRollbackFailure('filhos.usuario_id', filhoId, error);
}

async function rollbackUsuario(client: SupabaseClientLike, userId: string): Promise<void> {
  const { error } = await client.from('usuarios').delete().eq('id', userId);
  if (error) logRollbackFailure('usuarios', userId, error);
}

async function rollbackInvite(client: SupabaseClientLike, inviteId: string): Promise<void> {
  const { error } = await client
    .from('convites_filho')
    .update({ aceito_por: null, aceito_em: null })
    .eq('id', inviteId);
  if (error) logRollbackFailure('convites_filho', inviteId, error);
}

function logRollbackFailure(target: string, id: string, error: unknown): void {
  // Edge Function logs surface stderr — see `supabase functions logs vincular-filho`.
  // We deliberately do not throw: the original write failure is what the caller needs.
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'vincular-filho rollback failed',
      target,
      id,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
