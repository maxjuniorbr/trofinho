-- ============================================================
-- Trofinho — Hardening de RLS e cadastro de filho
-- ============================================================

-- O app atual nao possui edicao de perfil, entao removemos a policy
-- de update em usuarios para evitar elevacao de privilegio via API.
DROP POLICY IF EXISTS "usuarios_update_self" ON public.usuarios;

-- Filho pode apenas concluir uma atribuicao pendente da propria conta
-- e so enviar para validacao sem campos de aprovacao/rejeicao preenchidos.
DROP POLICY IF EXISTS "atribuicoes_update_filho" ON public.atribuicoes;

CREATE POLICY "atribuicoes_update_filho"
  ON public.atribuicoes
  FOR UPDATE
  USING (
    filho_id = public.meu_filho_id()
    AND status = 'pendente'
  )
  WITH CHECK (
    filho_id = public.meu_filho_id()
    AND status = 'aguardando_validacao'
    AND nota_rejeicao IS NULL
    AND validada_em IS NULL
    AND validada_por IS NULL
    AND (
      evidencia_url IS NOT NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.tarefas t
        WHERE t.id = tarefa_id
          AND t.exige_evidencia
      )
    )
  );

-- Admin pode rejeitar apenas atribuicoes da propria familia que
-- estejam aguardando validacao.
DROP POLICY IF EXISTS "atribuicoes_update_admin" ON public.atribuicoes;

CREATE POLICY "atribuicoes_update_admin"
  ON public.atribuicoes
  FOR UPDATE
  USING (
    public.meu_papel() = 'admin'
    AND status = 'aguardando_validacao'
    AND EXISTS (
      SELECT 1
      FROM public.tarefas t
      WHERE t.id = tarefa_id
        AND t.familia_id = public.minha_familia_id()
    )
  )
  WITH CHECK (
    public.meu_papel() = 'admin'
    AND status = 'rejeitada'
    AND EXISTS (
      SELECT 1
      FROM public.tarefas t
      WHERE t.id = tarefa_id
        AND t.familia_id = public.minha_familia_id()
    )
  );

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
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF public.meu_papel() != 'admin' THEN
    RAISE EXCEPTION 'Apenas admins podem cadastrar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = filho_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família';
  END IF;

  IF EXISTS (SELECT 1 FROM public.filhos WHERE usuario_id = filho_user_id) THEN
    RAISE EXCEPTION 'Usuário já está vinculado a um filho';
  END IF;

  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (filho_user_id, v_familia_id, 'filho', filho_nome);

  INSERT INTO public.filhos (familia_id, nome, usuario_id)
  VALUES (v_familia_id, filho_nome, filho_user_id)
  RETURNING id INTO v_filho_id;

  RETURN v_filho_id;
END;
$$;
