-- ============================================================
-- Trofinho — Atribuições diárias: competência por dia
-- Cada tarefa diária gera uma nova atribuição a cada dia.
-- ============================================================

-- ─── Nova coluna ─────────────────────────────────────────────
-- competencia = NULL  → tarefa única (comportamento original)
-- competencia = DATE  → tarefa diária (uma por dia, por filho)

ALTER TABLE public.atribuicoes
  ADD COLUMN IF NOT EXISTS competencia DATE;

-- ─── Restrições de unicidade ─────────────────────────────────

-- Remove a constraint antiga (um registro por tarefa+filho)
ALTER TABLE public.atribuicoes
  DROP CONSTRAINT IF EXISTS atribuicoes_tarefa_id_filho_id_key;

-- Tarefas únicas: um único registro por (tarefa, filho)
CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicoes_unica
  ON public.atribuicoes (tarefa_id, filho_id)
  WHERE competencia IS NULL;

-- Tarefas diárias: um registro por (tarefa, filho, dia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicoes_diaria_dia
  ON public.atribuicoes (tarefa_id, filho_id, competencia)
  WHERE competencia IS NOT NULL;

-- ─── Backfill: preenche competencia para registros já existentes ──
UPDATE public.atribuicoes a
   SET competencia = a.created_at::date
  FROM public.tarefas t
 WHERE t.id = a.tarefa_id
   AND t.frequencia = 'diaria'
   AND a.competencia IS NULL;

-- ─── criar_tarefa_com_atribuicoes: passa competencia ─────────

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
    familia_id, titulo, descricao, pontos,
    frequencia, exige_evidencia, criado_por
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
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia)
    SELECT v_tarefa_id,
           filho_id,
           'pendente',
           -- diária: competência = hoje; única: NULL
           CASE WHEN p_frequencia = 'diaria' THEN CURRENT_DATE ELSE NULL END
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

-- ─── garantir_atribuicoes_diarias ────────────────────────────
-- Chamada pelo filho ao abrir a tela de tarefas.
-- Cria atribuições pendentes para HOJE para todas as tarefas
-- diárias que já foram atribuídas a ele mas ainda não têm
-- registro de hoje. Idempotente: ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_diarias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id   UUID;
  v_familia_id UUID;
BEGIN
  v_filho_id := public.meu_filho_id();
  IF v_filho_id IS NULL THEN
    RAISE EXCEPTION 'Perfil de filho não encontrado';
  END IF;

  v_familia_id := public.minha_familia_id();

  INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia)
  SELECT t.id, v_filho_id, 'pendente', CURRENT_DATE
    FROM public.tarefas t
   WHERE t.frequencia = 'diaria'
     AND t.familia_id = v_familia_id
     -- o filho já teve esta tarefa atribuída ao menos uma vez
     AND EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id
         )
     -- mas ainda não há registro para hoje
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id
              AND a.filho_id = v_filho_id
              AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;
