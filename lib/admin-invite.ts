import { localizeRpcError } from './api-error';
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
};

// ---------------------------------------------------------------------------
// Untyped RPC / table helper
// The Supabase generated types do not yet include the admin-invite RPCs and
// the `convites_admin` table.  We use a narrowly-scoped cast so the rest of
// the module stays fully typed.  Remove once `supabase gen types` is re-run.
// ---------------------------------------------------------------------------
const db = supabase as any;

// --- Data access functions ---

export async function generateInvite(): Promise<{
  data: { codigo: string; expires_at: string } | null;
  error: string | null;
}> {
  const { data, error } = await db.rpc('gerar_convite_admin');

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as { codigo: string; expires_at: string }, error: null };
}

export async function validateInvite(code: string): Promise<{
  data: InvitePreview | null;
  error: string | null;
}> {
  const { data, error } = await db.rpc('validar_convite_admin', {
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
  const { data, error } = await db.rpc('aceitar_convite_admin', {
    p_codigo: code,
    p_nome: name,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: { familia_id: data as string }, error: null };
}

export async function cancelInvite(inviteId: string): Promise<{ error: string | null }> {
  const { error } = await db.rpc('cancelar_convite_admin', {
    p_convite_id: inviteId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function removeCoAdmin(userId: string): Promise<{ error: string | null }> {
  const { error } = await db.rpc('remover_co_admin', {
    p_usuario_id: userId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listFamilyAdmins(): Promise<{
  data: FamilyAdmin[];
  error: string | null;
}> {
  const { data, error } = await db.rpc('listar_admins_familia');

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: (data as FamilyAdmin[]) ?? [], error: null };
}

export async function getPendingInvite(familyId: string): Promise<{
  data: AdminInvite | null;
  error: string | null;
}> {
  const { data, error } = await db
    .from('convites_admin')
    .select('*')
    .eq('familia_id', familyId)
    .eq('status', 'pendente')
    .maybeSingle();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data: data as AdminInvite | null, error: null };
}
