-- Migration: delete legacy pontual tasks (test data) and enforce recurring-only going forward.
-- Cleanup steps for pontual tasks (dias_semana = 0):
--   1. Reverse approved assignments by deleting their movimentacoes and decrementing saldos.
--   2. Delete the tarefas. atribuicoes cascade automatically.
-- After cleanup, add CHECK constraint and update RPCs to require dias_semana > 0.

-- Step 1: reverse approved assignments of pontual tasks.
WITH approved AS (
  SELECT a.id AS atribuicao_id,
         a.filho_id,
         a.pontos_snapshot
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE t.dias_semana = 0
     AND a.status = 'aprovada'
), totals AS (
  SELECT filho_id, SUM(pontos_snapshot)::integer AS total
    FROM approved
   GROUP BY filho_id
)
UPDATE public.saldos s
   SET saldo_livre = GREATEST(s.saldo_livre - t.total, 0),
       updated_at = now()
  FROM totals t
 WHERE s.filho_id = t.filho_id;

DELETE FROM public.movimentacoes m
 USING public.atribuicoes a
  JOIN public.tarefas t ON t.id = a.tarefa_id
 WHERE t.dias_semana = 0
   AND m.referencia_id = a.id
   AND m.tipo = 'credito';

-- Step 2: delete pontual tasks (atribuicoes cascade via FK ON DELETE CASCADE).
DELETE FROM public.tarefas WHERE dias_semana = 0;

-- Safety net: any row created in flight should be treated as recurring-every-day.
UPDATE public.tarefas SET dias_semana = 127 WHERE dias_semana = 0;

-- Step 3: enforce recurring-only at schema level.
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_dias_semana_recurring CHECK (dias_semana > 0 AND dias_semana <= 127);

-- Step 4: update criar_tarefa_com_atribuicoes to reject dias_semana <= 0.
CREATE OR REPLACE FUNCTION public.criar_tarefa_com_atribuicoes(
  p_titulo text,
  p_descricao text,
  p_pontos integer,
  p_dias_semana smallint,
  p_exige_evidencia boolean,
  p_filho_ids uuid[] DEFAULT ARRAY[]::uuid[]
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_admin_id UUID;
  v_familia_id UUID;
  v_tarefa_id UUID;
  v_filho_ids UUID[];
  v_total_filhos INTEGER;
  v_filhos_validos INTEGER;
  v_dow integer;
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

  IF p_dias_semana IS NULL OR p_dias_semana <= 0 OR p_dias_semana > 127 THEN
    RAISE EXCEPTION 'Selecione ao menos um dia da semana';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT COALESCE(array_agg(DISTINCT filho_id), ARRAY[]::UUID[])
    INTO v_filho_ids
    FROM unnest(COALESCE(p_filho_ids, ARRAY[]::UUID[])) AS filho_id;

  v_total_filhos := COALESCE(array_length(v_filho_ids, 1), 0);

  IF v_total_filhos > 0 THEN
    SELECT count(*) INTO v_filhos_validos
      FROM public.filhos
     WHERE id = ANY (v_filho_ids) AND familia_id = v_familia_id AND ativo = true;

    IF v_filhos_validos <> v_total_filhos THEN
      RAISE EXCEPTION 'Há filhos inválidos ou de outra família na atribuição';
    END IF;
  END IF;

  INSERT INTO public.tarefas (familia_id, titulo, descricao, pontos, dias_semana, exige_evidencia, criado_por)
  VALUES (
    v_familia_id,
    trim(p_titulo),
    NULLIF(trim(COALESCE(p_descricao, '')), ''),
    p_pontos,
    p_dias_semana,
    COALESCE(p_exige_evidencia, false),
    v_admin_id
  )
  RETURNING id INTO v_tarefa_id;

  -- Only create today's assignment if today's weekday is in the recurrence mask.
  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  IF v_total_filhos > 0 AND (p_dias_semana & (1 << v_dow)) > 0 THEN
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
    SELECT v_tarefa_id, filho_id, 'pendente', CURRENT_DATE, p_pontos
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

ALTER FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  TO authenticated;

-- Step 5: update editar_tarefa to require dias_semana > 0 and drop pontual-specific branches.
CREATE OR REPLACE FUNCTION public.editar_tarefa(
  p_tarefa_id uuid,
  p_titulo text,
  p_descricao text,
  p_pontos integer DEFAULT NULL,
  p_requer_evidencia boolean DEFAULT NULL,
  p_dias_semana smallint DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_dias_semana smallint;
  v_effective_dias_semana smallint;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar tarefas';
  END IF;

  IF trim(COALESCE(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  SELECT t.dias_semana INTO v_dias_semana
    FROM public.tarefas t
   WHERE t.id = p_tarefa_id AND t.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND ativo = true AND arquivada_em IS NULL) THEN
    RAISE EXCEPTION 'Não é possível editar uma tarefa pausada ou arquivada.';
  END IF;

  v_effective_dias_semana := COALESCE(p_dias_semana, v_dias_semana);

  IF v_effective_dias_semana IS NULL OR v_effective_dias_semana <= 0 OR v_effective_dias_semana > 127 THEN
    RAISE EXCEPTION 'Selecione ao menos um dia da semana';
  END IF;

  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    RAISE EXCEPTION 'Pontos devem ser maiores que zero';
  END IF;

  UPDATE public.tarefas
     SET titulo = trim(p_titulo),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         pontos = p_pontos,
         exige_evidencia = COALESCE(p_requer_evidencia, exige_evidencia),
         dias_semana = COALESCE(p_dias_semana, dias_semana)
   WHERE id = p_tarefa_id;
END;
$$;

ALTER FUNCTION public.editar_tarefa(uuid, text, text, integer, boolean, smallint)
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.editar_tarefa(uuid, text, text, integer, boolean, smallint)
  TO authenticated;

-- Step 6: update cancelar_envio_atribuicao for recurring-only.
CREATE OR REPLACE FUNCTION public.cancelar_envio_atribuicao(p_atribuicao_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_caller_id UUID;
  v_owner_user_id UUID;
  v_tarefa_familia UUID;
  v_status public.atribuicao_status;
  v_competencia DATE;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT f.usuario_id, t.familia_id, a.status, a.competencia, t.ativo
    INTO v_owner_user_id, v_tarefa_familia, v_status, v_competencia, v_tarefa_ativa
    FROM public.atribuicoes a
    JOIN public.filhos f ON f.id = a.filho_id
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = p_atribuicao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_owner_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Apenas filhos podem cancelar o próprio envio';
  END IF;

  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  IF v_status != 'aguardando_validacao' THEN
    RAISE EXCEPTION 'Esta atribuição não está aguardando validação';
  END IF;

  IF v_tarefa_ativa = false THEN
    RAISE EXCEPTION 'Esta tarefa está pausada';
  END IF;

  IF v_competencia IS NOT NULL AND v_competencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível cancelar envio de tarefa de data anterior';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'pendente',
         concluida_em = NULL,
         evidencia_url = NULL,
         nota_rejeicao = NULL,
         validada_em = NULL,
         validada_por = NULL
   WHERE id = p_atribuicao_id
     AND status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta atribuição não está aguardando validação';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_envio_atribuicao(uuid) TO authenticated;
