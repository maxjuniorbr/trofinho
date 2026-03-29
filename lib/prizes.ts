import { localizeRpcError } from './api-error';
import { notifyRedemptionRequested } from './notifications';
import { dispatchPushNotification } from './push';
import { uploadImageToPublicBucket } from './storage';
import { supabase } from './supabase';

export type Prize = {
  id: string;
  familia_id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  imagem_url: string | null;
  ativo: boolean;
  created_at: string;
};

export type RedemptionStatus = 'pendente' | 'confirmado' | 'cancelado';

export type Redemption = {
  id: string;
  filho_id: string;
  premio_id: string;
  status: RedemptionStatus;
  pontos_debitados: number;
  created_at: string;
  updated_at: string;
};

export type RedemptionWithPrize = Redemption & {
  premios: { nome: string; custo_pontos: number };
};

export type RedemptionWithChildAndPrize = Redemption & {
  filhos: { nome: string; usuario_id: string | null };
  premios: { nome: string };
};

export type PrizeInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
};

export type UpdatePrizeInput = PrizeInput & {
  ativo?: boolean | null;
  imagem_url?: string | null;
  imageUri?: string | null;
};

const PRIZE_IMAGE_OPTIONS = {
  maxDimension: 768,
  compress: 0.65,
} as const;

export async function listPrizes(limit = 50): Promise<{
  data: Prize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome')
    .limit(limit)
    .returns<Prize[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function getPrize(id: string): Promise<{
  data: Prize | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('id', id)
    .returns<Prize>()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data, error: null };
}

export async function createPrize(input: PrizeInput): Promise<{
  data: Prize | null;
  error: string | null;
}> {
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return { data: null, error: 'Usuário não autenticado' };

  const { data: profile } = await supabase
    .from('usuarios')
    .select('familia_id')
    .eq('id', authUser.user.id)
    .single();

  if (!profile) return { data: null, error: 'Perfil não encontrado' };

  const { data, error } = await supabase
    .from('premios')
    .insert({
      familia_id:   profile.familia_id,
      nome:         input.nome,
      descricao:    input.descricao,
      custo_pontos: input.custo_pontos,
    })
    .select()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };
  return { data, error: null };
}

export async function updatePrize(
  id: string,
  input: UpdatePrizeInput
): Promise<{ error: string | null; imageUrl: string | null; pointsMessage: string | null }> {
  let nextImageUrl = input.imagem_url ?? null;

  if (input.imageUri) {
    const uploadResult = await uploadImageToPublicBucket({
      bucket: 'premios',
      imageUri: input.imageUri,
      imageOptions: PRIZE_IMAGE_OPTIONS,
      pathWithoutExtension: `${id}/capa`,
    });

    if (uploadResult.error || !uploadResult.publicUrl) {
      return {
        error: uploadResult.error ?? 'Não foi possível fazer upload da imagem do prêmio.',
        imageUrl: null,
        pointsMessage: null,
      };
    }

    nextImageUrl = uploadResult.publicUrl;
  }

  const { data, error } = await supabase.rpc('editar_premio', {
    p_premio_id: id,
    p_nome: input.nome,
    p_descricao: input.descricao ?? '',
    p_custo_pontos: input.custo_pontos,
    p_imagem_url: nextImageUrl ?? undefined,
    p_ativo: input.ativo ?? undefined,
  });

  if (error) {
    return {
      error: localizeRpcError(error.message),
      imageUrl: nextImageUrl,
      pointsMessage: null,
    };
  }

  return {
    error: null,
    imageUrl: nextImageUrl,
    // RPC editar_premio returns a message string when points changed
    pointsMessage: (data as string | null) ?? null,
  };
}

export async function deactivatePrize(id: string): Promise<{
  data: { pendingCount: number } | null;
  error: string | null;
  warning: string | null;
}> {
  const { data, error } = await supabase.rpc('desativar_premio', {
    p_premio_id: id,
  });

  if (error) return { data: null, error: localizeRpcError(error.message), warning: null };

  const pendingCount = data ?? 0;
  const warning =
    pendingCount > 0
      ? `Existem ${pendingCount} resgates pendentes para este prêmio.`
      : null;

  return { data: { pendingCount }, error: null, warning };
}

export async function reactivatePrize(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reativar_premio', {
    p_premio_id: id,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listRedemptions(): Promise<{
  data: RedemptionWithChildAndPrize[];
  error: string | null;
}> {
  // .returns needed: joined shape (filhos + premios) differs from generated row type
  const { data, error } = await supabase
    .from('resgates')
    .select('*, filhos(nome, usuario_id), premios(nome)')
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<RedemptionWithChildAndPrize[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function confirmRedemption(
  redemptionId: string,
  opts?: { familiaId: string; userId: string; prizeName: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirmar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  if (opts) {
    dispatchPushNotification('resgate_confirmado', opts.familiaId, {
      userId: opts.userId,
      prizeName: opts.prizeName,
    });
  }
  return { error: null };
}

export async function cancelRedemption(redemptionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancelar_resgate', {
    p_resgate_id: redemptionId,
  });

  if (error) return { error: localizeRpcError(error.message) };
  return { error: null };
}

export async function listActivePrizes(): Promise<{
  data: Prize[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .eq('ativo', true)
    .order('custo_pontos')
    .limit(50)
    .returns<Prize[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function listChildRedemptions(): Promise<{
  data: RedemptionWithPrize[];
  error: string | null;
}> {
  // .returns needed: joined shape (premios) differs from generated row type
  const { data, error } = await supabase
    .from('resgates')
    .select('*, premios(nome, custo_pontos)')
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<RedemptionWithPrize[]>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}

export async function requestRedemption(
  prizeId: string,
  opts?: { familiaId: string; childName: string; prizeName: string },
): Promise<{
  data: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('solicitar_resgate', {
    p_premio_id: prizeId,
  });

  if (error) return { data: null, error: localizeRpcError(error.message) };
  await notifyRedemptionRequested();
  if (opts) {
    dispatchPushNotification('resgate_solicitado', opts.familiaId, {
      childName: opts.childName,
      prizeName: opts.prizeName,
    });
  }
  // RPC solicitar_resgate returns the redemption ID as text
  return { data: data as string, error: null };
}

export async function countPendingRedemptions(): Promise<{
  data: number;
  error: string | null;
}> {
  const { count, error } = await supabase
    .from('resgates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) return { data: 0, error: localizeRpcError(error.message) };
  return { data: count ?? 0, error: null };
}
