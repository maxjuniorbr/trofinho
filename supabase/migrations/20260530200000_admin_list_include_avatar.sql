-- Include avatar_url in listar_admins_familia response.
-- The avatar path is stored in auth.users.raw_user_meta_data->>'avatar_url'
-- and must be resolved to a signed URL on the client side.

CREATE OR REPLACE FUNCTION public.listar_admins_familia()
RETURNS json[]
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id uuid;
  v_result     json[];
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem listar administradores';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT coalesce(array_agg(
    json_build_object(
      'id',        u.id,
      'nome',      u.nome,
      'email',     au.email,
      'avatarUrl', au.raw_user_meta_data->>'avatar_url'
    )
  ), ARRAY[]::json[])
  INTO v_result
  FROM public.usuarios u
  JOIN auth.users au ON au.id = u.id
  WHERE u.familia_id = v_familia_id
    AND u.papel = 'admin';

  RETURN v_result;
END;
$$;
