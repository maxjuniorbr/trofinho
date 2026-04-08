-- Replace the binary diaria/unica frequency model with a weekday bitmask.
-- dias_semana is a 7-bit bitmask: bit 0 = Sunday, bit 1 = Monday, ..., bit 6 = Saturday.
-- 0 = one-time (pontual), 127 = every day, any other value = specific days.
-- This matches JS Date.getDay() and PostgreSQL EXTRACT(DOW FROM ...).

-- 1. Add dias_semana column with default 0 (one-time).
ALTER TABLE public.tarefas
  ADD COLUMN dias_semana smallint NOT NULL DEFAULT 0;

-- 2. Backfill: existing daily tasks → all 7 days (127).
UPDATE public.tarefas SET dias_semana = 127 WHERE frequencia = 'diaria';
-- One-time tasks keep the default 0.

-- 3. Replace criar_tarefa_com_atribuicoes: new signature with p_dias_semana instead of p_frequencia.
DROP FUNCTION IF EXISTS public.criar_tarefa_com_atribuicoes(text, text, integer, public.tarefa_frequencia, boolean, uuid[]);

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
    COALESCE(p_dias_semana, 0),
    COALESCE(p_exige_evidencia, false),
    v_admin_id
  )
  RETURNING id INTO v_tarefa_id;

  IF v_total_filhos > 0 THEN
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
    SELECT v_tarefa_id, filho_id, 'pendente',
           CASE WHEN COALESCE(p_dias_semana, 0) > 0 THEN CURRENT_DATE ELSE NULL END,
           p_pontos
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

ALTER FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  TO authenticated;

-- 4. Replace editar_tarefa: use dias_semana instead of frequencia for edit rules.
DROP FUNCTION IF EXISTS public.editar_tarefa(uuid, text, text, integer, public.tarefa_frequencia, boolean);

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

  IF NOT EXISTS (SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND ativo = true) THEN
    RAISE EXCEPTION 'Não é possível editar uma tarefa desativada.';
  END IF;

  -- One-time tasks (dias_semana = 0) cannot be edited if any assignment was completed.
  IF v_dias_semana = 0
     AND EXISTS (
       SELECT 1 FROM public.atribuicoes a
        WHERE a.tarefa_id = p_tarefa_id
          AND (a.status IN ('aguardando_validacao', 'aprovada') OR a.concluida_em IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'Esta tarefa já foi concluída e não pode ser editada.';
  END IF;

  -- Recurring tasks require valid points.
  IF v_dias_semana > 0 AND (p_pontos IS NULL OR p_pontos <= 0) THEN
    RAISE EXCEPTION 'Pontos devem ser maiores que zero';
  END IF;

  UPDATE public.tarefas
     SET titulo = trim(p_titulo),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         pontos = CASE WHEN v_dias_semana > 0 THEN p_pontos ELSE pontos END,
         exige_evidencia = COALESCE(p_requer_evidencia, exige_evidencia),
         dias_semana = COALESCE(p_dias_semana, dias_semana)
   WHERE id = p_tarefa_id;
END;
$$;

ALTER FUNCTION public.editar_tarefa(uuid, text, text, integer, boolean, smallint)
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.editar_tarefa(uuid, text, text, integer, boolean, smallint)
  TO authenticated;

-- 5. Replace cancelar_envio_atribuicao: use dias_semana instead of frequencia.
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
  v_dias_semana smallint;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT f.usuario_id,
         t.familia_id,
         a.status,
         a.competencia,
         t.dias_semana,
         t.ativo
    INTO v_owner_user_id,
         v_tarefa_familia,
         v_status,
         v_competencia,
         v_dias_semana,
         v_tarefa_ativa
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
    RAISE EXCEPTION 'Esta tarefa está desativada';
  END IF;

  -- Recurring tasks: cannot cancel submission for a past date.
  IF v_dias_semana > 0
     AND v_competencia IS NOT NULL
     AND v_competencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível cancelar envio de tarefa recorrente de data anterior';
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

-- 6. Replace garantir_atribuicoes_diarias → garantir_atribuicoes_recorrentes.
-- Creates today's assignments for recurring tasks where today's weekday bit is set.
DROP FUNCTION IF EXISTS public.garantir_atribuicoes_diarias();

CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_recorrentes() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_filho_id UUID;
  v_familia_id UUID;
  v_dow integer;
BEGIN
  v_filho_id := public.meu_filho_id();

  IF v_filho_id IS NULL THEN
    RETURN;
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (SELECT 1 FROM public.filhos WHERE id = v_filho_id AND ativo = true) THEN
    RETURN;
  END IF;

  -- EXTRACT(DOW FROM ...) returns 0=Sunday, 1=Monday, ..., 6=Saturday
  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
  SELECT t.id, v_filho_id, 'pendente', CURRENT_DATE, t.pontos
    FROM public.tarefas t
   WHERE t.dias_semana > 0
     AND (t.dias_semana & (1 << v_dow)) > 0
     AND t.familia_id = v_familia_id
     AND t.ativo = true
     AND EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;

ALTER FUNCTION public.garantir_atribuicoes_recorrentes()
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.garantir_atribuicoes_recorrentes()
  TO authenticated;

-- 7. Drop the frequencia column and enum now that no function references them.
ALTER TABLE public.tarefas DROP COLUMN frequencia;
DROP TYPE IF EXISTS public.tarefa_frequencia;

-- 8. Reload PostgREST schema cache so the new column/functions are visible.
NOTIFY pgrst, 'reload schema';
