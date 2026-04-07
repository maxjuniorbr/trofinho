-- 1. Fix editar_filho: actually write p_avatar_url when provided
CREATE OR REPLACE FUNCTION public.editar_filho(
  p_filho_id uuid,
  p_nome text,
  p_avatar_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar filhos';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  SELECT f.usuario_id INTO v_usuario_id
    FROM public.filhos f
   WHERE f.id = p_filho_id AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.filhos WHERE id = p_filho_id AND ativo = true) THEN
    RAISE EXCEPTION 'Não é possível editar um filho desativado.';
  END IF;

  UPDATE public.filhos
     SET nome = trim(p_nome),
         avatar_url = COALESCE(p_avatar_url, avatar_url)
   WHERE id = p_filho_id;

  IF v_usuario_id IS NOT NULL THEN
    UPDATE public.usuarios SET nome = trim(p_nome) WHERE id = v_usuario_id;
  END IF;
END;
$$;

-- 2. New RPC: let an authenticated child sync their own avatar_url
CREATE OR REPLACE FUNCTION public.sincronizar_avatar_filho(p_avatar_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := public.usuario_autenticado_id();

  UPDATE public.filhos
     SET avatar_url = p_avatar_url
   WHERE usuario_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_avatar_filho(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sincronizar_avatar_filho(text) FROM anon;

-- 3. Backfill: sync existing avatars from auth.users metadata to filhos
UPDATE public.filhos f
   SET avatar_url = au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
 WHERE au.id = f.usuario_id
   AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL
   AND (f.avatar_url IS NULL OR f.avatar_url = '');

-- 4. Clean all orphan push_tokens (full table reset since device_id model changed)
TRUNCATE public.push_tokens;
