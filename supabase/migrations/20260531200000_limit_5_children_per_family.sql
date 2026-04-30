-- Enforce a maximum of 5 children per family.
-- The limit is checked inside criar_filho_na_familia (the only entry point for
-- child creation) so it cannot be bypassed by direct inserts (RLS blocks those).

CREATE OR REPLACE FUNCTION public.criar_filho_na_familia(
  filho_user_id uuid,
  filho_nome text,
  p_avatar_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id  UUID;
  v_familia_id UUID;
  v_filho_id   UUID;
  v_child_count INT;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cadastrar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- ── Limit: max 5 children per family ──
  SELECT count(*) INTO v_child_count
    FROM public.filhos
   WHERE familia_id = v_familia_id;

  IF v_child_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 filhos por família atingido';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = filho_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família';
  END IF;

  IF EXISTS (SELECT 1 FROM public.filhos WHERE usuario_id = filho_user_id) THEN
    RAISE EXCEPTION 'Usuário já está vinculado a um filho';
  END IF;

  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (filho_user_id, v_familia_id, 'filho', filho_nome);

  INSERT INTO public.filhos (familia_id, nome, usuario_id, avatar_url)
  VALUES (v_familia_id, filho_nome, filho_user_id, p_avatar_url)
  RETURNING id INTO v_filho_id;

  INSERT INTO public.saldos (filho_id)
  VALUES (v_filho_id)
  ON CONFLICT (filho_id) DO NOTHING;

  RETURN v_filho_id;
END;
$$;
