-- ============================================================
-- RPC obter_meu_perfil — retorna perfil completo em 1 round-trip
-- Substitui 2-3 queries sequenciais no getProfile() do client.
-- ============================================================

CREATE OR REPLACE FUNCTION public.obter_meu_perfil()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', u.id,
    'familia_id', u.familia_id,
    'papel', u.papel,
    'nome', u.nome,
    'avatarUrl', COALESCE(
      (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = v_user_id),
      f.avatar_url
    )
  )
  INTO v_result
  FROM public.usuarios u
  LEFT JOIN public.filhos f ON f.usuario_id = u.id
  WHERE u.id = v_user_id;

  RETURN v_result;
END;
$$;
