-- ============================================================
-- Trofinho — Marco 8: edição de tarefas, filhos e prêmios
-- ============================================================

ALTER TABLE public.premios
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'premios',
  'premios',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
   SET public = true,
       file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 WHERE id = 'premios';

DROP POLICY IF EXISTS "Avatar upload próprio" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update próprio" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete próprio" ON storage.objects;
DROP POLICY IF EXISTS "Avatar leitura pública" ON storage.objects;

CREATE POLICY "Avatar upload permitido"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.usuario_e_admin()
        AND (storage.foldername(name))[1] = 'filhos'
        AND EXISTS (
          SELECT 1
            FROM public.filhos f
           WHERE f.id::text = (storage.foldername(name))[2]
             AND f.familia_id = public.minha_familia_id()
        )
      )
    )
  );

CREATE POLICY "Avatar update permitido"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.usuario_e_admin()
        AND (storage.foldername(name))[1] = 'filhos'
        AND EXISTS (
          SELECT 1
            FROM public.filhos f
           WHERE f.id::text = (storage.foldername(name))[2]
             AND f.familia_id = public.minha_familia_id()
        )
      )
    )
  );

CREATE POLICY "Avatar delete permitido"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.usuario_e_admin()
        AND (storage.foldername(name))[1] = 'filhos'
        AND EXISTS (
          SELECT 1
            FROM public.filhos f
           WHERE f.id::text = (storage.foldername(name))[2]
             AND f.familia_id = public.minha_familia_id()
        )
      )
    )
  );

CREATE POLICY "Avatar leitura pública"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Premios leitura pública" ON storage.objects;
DROP POLICY IF EXISTS "Premios upload admin" ON storage.objects;
DROP POLICY IF EXISTS "Premios update admin" ON storage.objects;
DROP POLICY IF EXISTS "Premios delete admin" ON storage.objects;

CREATE POLICY "Premios leitura pública"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'premios');

CREATE POLICY "Premios upload admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'premios'
    AND public.usuario_e_admin()
    AND EXISTS (
      SELECT 1
        FROM public.premios p
       WHERE p.id::text = (storage.foldername(name))[1]
         AND p.familia_id = public.minha_familia_id()
    )
  );

CREATE POLICY "Premios update admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'premios'
    AND public.usuario_e_admin()
    AND EXISTS (
      SELECT 1
        FROM public.premios p
       WHERE p.id::text = (storage.foldername(name))[1]
         AND p.familia_id = public.minha_familia_id()
    )
  );

CREATE POLICY "Premios delete admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'premios'
    AND public.usuario_e_admin()
    AND EXISTS (
      SELECT 1
        FROM public.premios p
       WHERE p.id::text = (storage.foldername(name))[1]
         AND p.familia_id = public.minha_familia_id()
    )
  );

CREATE OR REPLACE FUNCTION public.editar_tarefa(
  p_tarefa_id UUID,
  p_titulo TEXT,
  p_descricao TEXT,
  p_pontos INTEGER,
  p_frequencia public.tarefa_frequencia,
  p_requer_evidencia BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar tarefas';
  END IF;

  IF trim(COALESCE(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    RAISE EXCEPTION 'Pontos devem ser maiores que zero';
  END IF;

  IF p_frequencia IS NULL THEN
    RAISE EXCEPTION 'Frequência obrigatória';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.tarefas t
     WHERE t.id = p_tarefa_id
       AND t.familia_id = public.minha_familia_id()
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.atribuicoes a
     WHERE a.tarefa_id = p_tarefa_id
       AND (
         a.status IN ('aguardando_validacao', 'aprovada')
         OR a.concluida_em IS NOT NULL
       )
  ) THEN
    RAISE EXCEPTION 'Esta tarefa já teve execuções concluídas e não pode ser editada';
  END IF;

  UPDATE public.tarefas
     SET titulo = trim(p_titulo),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         pontos = p_pontos,
         frequencia = p_frequencia,
         exige_evidencia = COALESCE(p_requer_evidencia, false)
   WHERE id = p_tarefa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_filho(
  p_filho_id UUID,
  p_nome TEXT,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar filhos';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  SELECT f.usuario_id
    INTO v_usuario_id
    FROM public.filhos f
   WHERE f.id = p_filho_id
     AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  UPDATE public.filhos
     SET nome = trim(p_nome),
         avatar_url = COALESCE(p_avatar_url, avatar_url)
   WHERE id = p_filho_id;

  IF v_usuario_id IS NOT NULL THEN
    UPDATE public.usuarios
       SET nome = trim(p_nome)
     WHERE id = v_usuario_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_premio(
  p_premio_id UUID,
  p_nome TEXT,
  p_descricao TEXT,
  p_custo_pontos INTEGER,
  p_imagem_url TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo_atual INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar prêmios';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  IF p_custo_pontos IS NULL OR p_custo_pontos <= 0 THEN
    RAISE EXCEPTION 'O custo em pontos deve ser maior que zero';
  END IF;

  SELECT p.custo_pontos
    INTO v_custo_atual
    FROM public.premios p
   WHERE p.id = p_premio_id
     AND p.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado';
  END IF;

  IF p_custo_pontos < v_custo_atual
     AND EXISTS (
       SELECT 1
         FROM public.resgates r
        WHERE r.premio_id = p_premio_id
          AND r.status = 'pendente'
     ) THEN
    RAISE EXCEPTION 'Não é possível reduzir o custo de um prêmio com resgates pendentes';
  END IF;

  UPDATE public.premios
     SET nome = trim(p_nome),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         custo_pontos = p_custo_pontos,
         imagem_url = COALESCE(p_imagem_url, imagem_url),
         ativo = COALESCE(p_ativo, ativo)
   WHERE id = p_premio_id;
END;
$$;
