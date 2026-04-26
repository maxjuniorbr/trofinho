-- Fix: remove the EXISTS guard that requires a prior assignment.
-- Tasks should generate assignments for ALL active children in the family,
-- not just those who already had one. This was blocking renewal for tasks
-- created before the assignment-snapshots migration.

-- Overload with explicit filho_id (admin/impersonation)
CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_recorrentes(p_filho_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_familia_id UUID;
  v_dow integer;
BEGIN
  IF p_filho_id IS NULL THEN
    RETURN;
  END IF;

  SELECT familia_id INTO v_familia_id
    FROM public.filhos
   WHERE id = p_filho_id AND ativo = true;

  IF v_familia_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
     WHERE id = auth.uid() AND familia_id = v_familia_id
  ) THEN
    RETURN;
  END IF;

  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  INSERT INTO public.atribuicoes (
    tarefa_id, filho_id, familia_id, status, competencia,
    pontos_snapshot, titulo_snapshot, descricao_snapshot, exige_evidencia_snapshot
  )
  SELECT
    t.id,
    p_filho_id,
    v_familia_id,
    'pendente',
    CURRENT_DATE,
    t.pontos,
    t.titulo,
    t.descricao,
    t.exige_evidencia
    FROM public.tarefas t
   WHERE t.dias_semana > 0
     AND (t.dias_semana & (1 << v_dow)) > 0
     AND t.familia_id = v_familia_id
     AND t.ativo = true
     AND t.excluida_em IS NULL
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = p_filho_id AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;

-- Original (child self-service)
CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_recorrentes()
RETURNS void
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

  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  INSERT INTO public.atribuicoes (
    tarefa_id, filho_id, familia_id, status, competencia,
    pontos_snapshot, titulo_snapshot, descricao_snapshot, exige_evidencia_snapshot
  )
  SELECT
    t.id,
    v_filho_id,
    v_familia_id,
    'pendente',
    CURRENT_DATE,
    t.pontos,
    t.titulo,
    t.descricao,
    t.exige_evidencia
    FROM public.tarefas t
   WHERE t.dias_semana > 0
     AND (t.dias_semana & (1 << v_dow)) > 0
     AND t.familia_id = v_familia_id
     AND t.ativo = true
     AND t.excluida_em IS NULL
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;
