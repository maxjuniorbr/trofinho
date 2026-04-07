import { localizeRpcError } from './api-error';
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

export type PrizeInput = {
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  imageUri?: string | null;
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

export async function listPrizes(
  page = 0,
  pageSize = 20,
): Promise<{
  data: Prize[];
  hasMore: boolean;
  error: string | null;
}> {
  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await supabase
    .from('premios')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome')
    .range(from, to)
    .overrideTypes<Prize[], { merge: false }>();

  if (error) return { data: [], hasMore: false, error: localizeRpcError(error.message) };
  const items = data ?? [];
  const hasMore = items.length > pageSize;
  return { data: hasMore ? items.slice(0, pageSize) : items, hasMore, error: null };
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
      familia_id: profile.familia_id,
      nome: input.nome,
      descricao: input.descricao,
      custo_pontos: input.custo_pontos,
    })
    .select()
    .single();

  if (error) return { data: null, error: localizeRpcError(error.message) };

  if (input.imageUri && data) {
    const uploadResult = await uploadImageToPublicBucket({
      bucket: 'premios',
      imageUri: input.imageUri,
      imageOptions: PRIZE_IMAGE_OPTIONS,
      pathWithoutExtension: `${data.id}/capa`,
    });

    if (uploadResult.publicUrl) {
      await supabase
        .from('premios')
        .update({ imagem_url: uploadResult.publicUrl })
        .eq('id', data.id);

      data.imagem_url = uploadResult.publicUrl;
    }
  }

  return { data, error: null };
}

export async function updatePrize(
  id: string,
  input: UpdatePrizeInput,
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
    if (input.imageUri && nextImageUrl) {
      const path = `${id}/capa`;
      supabase.storage.from('premios').remove([path]).catch(() => {});
    }
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
    pendingCount > 0 ? `Existem ${pendingCount} resgates pendentes para este prêmio.` : null;

  return { data: { pendingCount }, error: null, warning };
}

export async function reactivatePrize(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reativar_premio', {
    p_premio_id: id,
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
    .overrideTypes<Prize[], { merge: false }>();

  if (error) return { data: [], error: localizeRpcError(error.message) };
  return { data: data ?? [], error: null };
}
