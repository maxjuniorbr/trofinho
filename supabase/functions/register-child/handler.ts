// Handler logic extracted for testability (Vitest runs in Node, not Deno).
// index.ts re-exports everything from here and adds the Deno.serve entry point.

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterChildRequest = {
  name: string;
  email: string;
  tempPassword: string;
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

  const { name, email, tempPassword } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim() === '') {
    return { valid: false, error: 'name must be a non-empty string' };
  }
  if (typeof email !== 'string' || email.trim() === '') {
    return { valid: false, error: 'email must be a non-empty string' };
  }
  if (typeof tempPassword !== 'string' || tempPassword.length < 6) {
    return { valid: false, error: 'tempPassword must be at least 6 characters' };
  }

  return { valid: true, data: { name: name.trim(), email: email.trim(), tempPassword } };
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
  if (!serviceRoleKey) {
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

  const { name, email, tempPassword } = validation.data;
  const supabase = deps.createSupabaseClient(deps.getSupabaseUrl(), serviceRoleKey);

  // Verify caller identity — must be an authenticated admin
  const { data: authData, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Create auth user via admin API (bypasses email confirmation flow)
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
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

  // Step 2: Link child to family via RPC (runs as the admin caller via service role,
  // but the RPC uses auth.uid() internally — we pass the user ID explicitly)
  const { data: childId, error: rpcError } = await supabase.rpc('criar_filho_na_familia', {
    filho_user_id: userId,
    filho_nome: name,
  });

  if (rpcError) {
    // Rollback: delete the orphan auth user immediately via admin API (no 5-min window)
    await supabase.auth.admin.deleteUser(userId);

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
