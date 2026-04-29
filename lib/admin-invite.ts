import { localizeRpcError } from './api-error';
import { resolveStorageUrls } from './storage';
import { supabase } from './supabase';

// --- Types ---

export type InviteStatus = 'pendente' | 'aceito' | 'expirado' | 'cancelado';

export type AdminInvite = {
  id: string;
  familia_id: string;
  convidado_por: string;
  codigo: string;
  status: InviteStatus;
  aceito_por: string | null;
  created_at: string;
  expires_at: string;
};

export type InvitePreview = {
  familia_nome: string;
  admin_nome: string;
};

export type FamilyAdmin = {
  id: string;
  nome: string;
  email: string | null;
  avatarUrl: string | null;
};

// ---------------------------------------------------------------------------
// The admin-invite RPCs and `convites_admin` table are not yet in the
// generated Supabase types. The typed client's `.rpc()` and `.from()` methods
// accept any string at runtime, so we call `supabase` directly with targeted
// type suppressions. Re-run `supabase gen types` to remove these.
// ---------------------------------------------------------------------------

// Narrowly-scoped type escapes for untyped RPCs and tables.
// Remove once `supabase gen types` includes admin-invite entities.
type UntypedRpc = (
  fn: string,
  params?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

type UntypedFrom = (table: string) => {
  select: (columns: string) => {
    eq: (col: string, val: string) => {
      eq: (col2: string, val2: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

// Double cast through `unknown` is required because the Supabase generated
// types are deeply generic and don't overlap with our simplified interfaces.
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

const untypedFrom = supabase.from.bind(supabase) as unknown as UntypedFrom;

// --- Data access functions ---

export async function generateInvite(): Promise<{
  data: { codigo: string; expires_at: string } | null;
  error: string | null;
}> {
  const { data, error } = await untypedRpc('gerar_convite_admin');

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as { codigo: string; expires_at: string }, error: null };
}

export async function validateInvite(code: string): Promise<{
  data: InvitePreview | null;
  error: string | null;
}> {
  const { data, error } = await untypedRpc('validar_convite_admin', {
    p_codigo: code,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as InvitePreview, error: null };
}

export async function acceptInvite(
  code: string,
  name: string,
): Promise<{
  data: { familia_id: string } | null;
  error: string | null;
}> {
  const { data, error } = await untypedRpc('aceitar_convite_admin', {
    p_codigo: code,
    p_nome: name,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: { familia_id: data as string }, error: null };
}

export async function cancelInvite(inviteId: string): Promise<{ error: string | null }> {
  const { error } = await untypedRpc('cancelar_convite_admin', {
    p_convite_id: inviteId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function removeCoAdmin(userId: string): Promise<{ error: string | null }> {
  const { error } = await untypedRpc('remover_co_admin', {
    p_usuario_id: userId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listFamilyAdmins(): Promise<{
  data: FamilyAdmin[];
  error: string | null;
}> {
  const { data, error } = await untypedRpc('listar_admins_familia');

  if (error) return { data: [], error: localizeRpcError(error.message) };

  const admins = (data as FamilyAdmin[]) ?? [];
  if (admins.length === 0) return { data: [], error: null };

  const signedUrls = await resolveStorageUrls(
    'avatars',
    admins.map((a) => a.avatarUrl),
  );

  return {
    data: admins.map((admin, i) => ({ ...admin, avatarUrl: signedUrls[i] })),
    error: null,
  };
}

export async function getPendingInvite(familyId: string): Promise<{
  data: AdminInvite | null;
  error: string | null;
}> {
  const { data, error } = await untypedFrom('convites_admin')
    .select('*')
    .eq('familia_id', familyId)
    .eq('status', 'pendente')
    .maybeSingle();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as AdminInvite | null, error: null };
}
