-- ============================================================
-- Trofinho — Marco 3 final: Cadastro de Filho
-- ============================================================
-- Função SECURITY DEFINER: admin cria registros de usuarios + filhos
-- para um usuário auth já existente (criado pelo client via signUp).
-- Bypassa RLS pois a policy usuarios_insert_self exige id = auth.uid(),
-- o que impediria o admin de inserir um registro para outro usuário.

CREATE OR REPLACE FUNCTION public.criar_filho_na_familia(
  filho_user_id UUID,
  filho_nome    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID;
  v_familia_id UUID;
  v_filho_id   UUID;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cadastrar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- Cria o perfil do filho em usuarios (evita duplicata silenciosamente)
  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (filho_user_id, v_familia_id, 'filho', filho_nome)
  ON CONFLICT (id) DO NOTHING;

  -- Cria o registro em filhos vinculado ao usuario_id
  INSERT INTO public.filhos (familia_id, nome, usuario_id)
  VALUES (v_familia_id, filho_nome, filho_user_id)
  RETURNING id INTO v_filho_id;

  RETURN v_filho_id;
END;
$$;
