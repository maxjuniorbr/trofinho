// Handler logic extracted for testability (Vitest runs in Node, not Deno).
// index.ts re-exports everything from here and adds the Deno.serve entry point.

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterChildRequest = {
  name: string;
  email: string;
  tempPassword: string;
  avatar?: string;
};

export type RegisterChildResponse = {
  childId: string;
};

// ─── Supabase client interface (avoids importing @supabase/supabase-js) ──────

export interface SupabaseAuthAdmin {
  createUser(params: { email: string; password: string; email_confirm: boolean }): PromiseLike<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
  deleteUser(userId: string): PromiseLike<{
    error: { message: string } | null;
  }>;
}

export interface SupabaseClientLike {
  auth: {
    getUser(jwt?: string): PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
    admin: SupabaseAuthAdmin;
  };
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
    };
  };
  rpc(
    fnName: string,
    params: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateRequest(
  body: unknown,
): { valid: true; data: RegisterChildRequest } | { valid: false; error: string } {
  if (body === null || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { name, email, tempPassword, avatar } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim() === '') {
    return { valid: false, error: 'name must be a non-empty string' };
  }
  if (name.trim().length > 60) {
    return { valid: false, error: 'name must be at most 60 characters' };
  }
  if (typeof email !== 'string' || email.trim() === '') {
    return { valid: false, error: 'email must be a non-empty string' };
  }
  if (typeof tempPassword !== 'string' || tempPassword.length < 8) {
    return { valid: false, error: 'tempPassword must be at least 8 characters' };
  }

  const sanitizedAvatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : undefined;

  return {
    valid: true,
    data: { name: name.trim(), email: email.trim(), tempPassword, avatar: sanitizedAvatar },
  };
}

// ─── Main handler (framework-agnostic) ───────────────────────────────────────

export interface HandlerDeps {
  getServiceRoleKey: () => string | undefined;
  getAnonKey: () => string | undefined;
  getSupabaseUrl: () => string;
  createSupabaseClient: (
    url: string,
    key: string,
    options?: { globalHeaders?: Record<string, string> },
  ) => SupabaseClientLike;
}

const MAX_BODY_BYTES = 4_096;

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  const userToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!userToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleKey = deps.getServiceRoleKey();
  const anonKey = deps.getAnonKey();
  if (!serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, email, tempPassword, avatar } = validation.data;
  const adminClient = deps.createSupabaseClient(deps.getSupabaseUrl(), serviceRoleKey);

  // Verify caller identity — must be an authenticated admin
  const { data: authData, error: authError } = await adminClient.auth.getUser(userToken);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Verify the caller is an admin BEFORE creating the auth user.
  // This prevents non-admin users from triggering createUser + rollback cycles.
  const { data: callerRows, error: callerError } = await adminClient
    .from('usuarios')
    .select('papel')
    .eq('id', authData.user.id);

  if (callerError || !callerRows || callerRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (callerRows[0].papel !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 2: Create auth user via admin API (bypasses email confirmation flow)
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return new Response(
      JSON.stringify({ error: createError?.message ?? 'Failed to create user' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const userId = newUser.user.id;

  // Step 3: Link child to family via RPC. Use anon key for the API gateway
  // and override Authorization with the caller's JWT so auth.uid() resolves
  // to the admin user inside the RPC function.
  const userClient = deps.createSupabaseClient(deps.getSupabaseUrl(), anonKey, {
    globalHeaders: { Authorization: `Bearer ${userToken}` },
  });
  const rpcParams: Record<string, unknown> = {
    filho_user_id: userId,
    filho_nome: name,
  };
  if (avatar) rpcParams.p_avatar_url = avatar;
  const { data: childId, error: rpcError } = await userClient.rpc(
    'criar_filho_na_familia',
    rpcParams,
  );

  if (rpcError) {
    // Rollback: delete the orphan auth user immediately via admin API (no 5-min window)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      // Both the RPC and the rollback failed — surface for diagnostics so we can
      // reconcile the orphan auth user manually. Edge functions don't have Sentry
      // wired yet, so we use structured stderr that the Supabase log drain captures.
      console.error(
        JSON.stringify({
          event: 'register-child.rollback-failed',
          userId,
          rpcError: rpcError.message,
          deleteError: deleteError.message,
        }),
      );
    }

    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ childId: childId as string } satisfies RegisterChildResponse),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
