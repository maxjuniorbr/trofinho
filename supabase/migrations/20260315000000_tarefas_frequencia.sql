-- ============================================================
-- Trofinho — Frequência de tarefas
-- Substitui timebox_inicio / timebox_fim por frequencia
-- ============================================================

DO $$
BEGIN
  CREATE TYPE public.tarefa_frequencia AS ENUM ('diaria', 'unica');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Adiciona a nova coluna (default 'unica' para linhas já existentes)
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS frequencia public.tarefa_frequencia NOT NULL DEFAULT 'unica';

-- Remove as colunas de data
ALTER TABLE public.tarefas
  DROP COLUMN IF EXISTS timebox_inicio,
  DROP COLUMN IF EXISTS timebox_fim;

-- ─── Atualiza a RPC de criação transacional ───────────────

CREATE OR REPLACE FUNCTION public.criar_tarefa_com_atribuicoes(
  p_titulo          TEXT,
  p_descricao       TEXT,
  p_pontos          INTEGER,
  p_frequencia      public.tarefa_frequencia,
  p_exige_evidencia BOOLEAN,
  p_filho_ids       UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id       UUID;
  v_familia_id     UUID;
  v_tarefa_id      UUID;
  v_filho_ids      UUID[];
  v_total_filhos   INTEGER;
  v_filhos_validos INTEGER;
BEGIN
  v_admin_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem criar tarefas';
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

  v_familia_id := public.minha_familia_id();

  SELECT COALESCE(array_agg(DISTINCT filho_id), ARRAY[]::UUID[])
    INTO v_filho_ids
    FROM unnest(COALESCE(p_filho_ids, ARRAY[]::UUID[])) AS filho_id;

  v_total_filhos := COALESCE(array_length(v_filho_ids, 1), 0);

  IF v_total_filhos > 0 THEN
    SELECT count(*)
      INTO v_filhos_validos
      FROM public.filhos
     WHERE id = ANY (v_filho_ids)
       AND familia_id = v_familia_id;

    IF v_filhos_validos <> v_total_filhos THEN
      RAISE EXCEPTION 'Há filhos inválidos ou de outra família na atribuição';
    END IF;
  END IF;

  INSERT INTO public.tarefas (
    familia_id,
    titulo,
    descricao,
    pontos,
    frequencia,
    exige_evidencia,
    criado_por
  )
  VALUES (
    v_familia_id,
    trim(p_titulo),
    NULLIF(trim(COALESCE(p_descricao, '')), ''),
    p_pontos,
    p_frequencia,
    COALESCE(p_exige_evidencia, false),
    v_admin_id
  )
  RETURNING id INTO v_tarefa_id;

  IF v_total_filhos > 0 THEN
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status)
    SELECT v_tarefa_id, filho_id, 'pendente'
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;
