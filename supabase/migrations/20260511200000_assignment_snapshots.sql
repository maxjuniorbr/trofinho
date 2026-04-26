-- Assignment Snapshots Migration
-- Freeze task title, description, and evidence requirement into atribuicoes
-- at assignment creation time.

-- ============================================================
-- Step 1: Add three nullable columns
-- ============================================================
ALTER TABLE public.atribuicoes ADD COLUMN titulo_snapshot text;
ALTER TABLE public.atribuicoes ADD COLUMN descricao_snapshot text;
ALTER TABLE public.atribuicoes ADD COLUMN exige_evidencia_snapshot boolean;

-- ============================================================
-- Step 2: Backfill existing rows from parent tarefas
-- ============================================================
UPDATE public.atribuicoes a
   SET titulo_snapshot          = t.titulo,
       descricao_snapshot       = t.descricao,
       exige_evidencia_snapshot = t.exige_evidencia
  FROM public.tarefas t
 WHERE a.tarefa_id = t.id
   AND a.titulo_snapshot IS NULL;

-- ============================================================
-- Step 3: Set NOT NULL + defaults on non-nullable columns
-- ============================================================
ALTER TABLE public.atribuicoes ALTER COLUMN titulo_snapshot SET NOT NULL;
ALTER TABLE public.atribuicoes ALTER COLUMN titulo_snapshot SET DEFAULT '';

ALTER TABLE public.atribuicoes ALTER COLUMN exige_evidencia_snapshot SET NOT NULL;
ALTER TABLE public.atribuicoes ALTER COLUMN exige_evidencia_snapshot SET DEFAULT false;

-- ============================================================
-- Step 4: Update criar_tarefa_com_atribuicoes to populate snapshot columns
-- ============================================================
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
    INSERT INTO public.atribuicoes (
      tarefa_id, filho_id, status, competencia,
      pontos_snapshot, titulo_snapshot, descricao_snapshot, exige_evidencia_snapshot
    )
    SELECT
      v_tarefa_id,
      filho_id,
      'pendente',
      CURRENT_DATE,
      p_pontos,
      trim(p_titulo),
      NULLIF(trim(COALESCE(p_descricao, '')), ''),
      COALESCE(p_exige_evidencia, false)
    FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

ALTER FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, smallint, boolean, uuid[])
  TO authenticated;

-- ============================================================
-- Step 5: Update garantir_atribuicoes_recorrentes to populate snapshot columns
-- ============================================================
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

  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  INSERT INTO public.atribuicoes (
    tarefa_id, filho_id, status, competencia,
    pontos_snapshot, titulo_snapshot, descricao_snapshot, exige_evidencia_snapshot
  )
  SELECT
    t.id,
    v_filho_id,
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

-- ============================================================
-- Step 6: Update concluir_atribuicao to use exige_evidencia_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.concluir_atribuicao(
  p_atribuicao_id uuid,
  p_evidencia_url text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_tarefa_familia UUID;
  v_exige_evidencia BOOLEAN;
  v_status public.atribuicao_status;
  v_tarefa_ativa BOOLEAN;
  v_tarefa_arquivada timestamptz;
  v_tentativas integer;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT t.familia_id, a.exige_evidencia_snapshot, a.status, t.ativo, t.arquivada_em, a.tentativas
    INTO v_tarefa_familia, v_exige_evidencia, v_status, v_tarefa_ativa, v_tarefa_arquivada, v_tentativas
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
    JOIN public.filhos f ON f.id = a.filho_id
   WHERE a.id = p_atribuicao_id
     AND f.usuario_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  IF v_status NOT IN ('pendente', 'rejeitada') THEN
    RAISE EXCEPTION 'Esta atribuição não pode ser enviada agora';
  END IF;

  IF v_tarefa_ativa = false OR v_tarefa_arquivada IS NOT NULL THEN
    RAISE EXCEPTION 'Esta tarefa está pausada ou arquivada e não pode ser enviada';
  END IF;

  IF v_tentativas >= 2 THEN
    RAISE EXCEPTION 'Você já usou todas as tentativas para esta tarefa';
  END IF;

  IF v_exige_evidencia AND (p_evidencia_url IS NULL OR trim(p_evidencia_url) = '') THEN
    RAISE EXCEPTION 'Esta tarefa exige evidência';
  END IF;

  UPDATE public.atribuicoes a
     SET status = 'aguardando_validacao',
         evidencia_url = p_evidencia_url,
         concluida_em = now(),
         nota_rejeicao = NULL,
         validada_em = NULL,
         validada_por = NULL,
         tentativas = a.tentativas + 1
    FROM public.tarefas t
   WHERE a.id = p_atribuicao_id
     AND a.tarefa_id = t.id
     AND a.status IN ('pendente', 'rejeitada')
     AND t.ativo = true
     AND t.arquivada_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta atribuição não pode ser enviada agora';
  END IF;
END;
$$;

ALTER FUNCTION public.concluir_atribuicao(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.concluir_atribuicao(uuid, text) TO authenticated;

-- ============================================================
-- Step 7: Update listar_atribuicoes_aprovadas to use titulo_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.listar_atribuicoes_aprovadas(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_desde timestamptz DEFAULT (now() - interval '7 days')
) RETURNS TABLE (
  atribuicao_id uuid,
  tarefa_id uuid,
  tarefa_titulo text,
  tarefa_arquivada boolean,
  filho_id uuid,
  filho_nome text,
  pontos integer,
  validada_em timestamptz,
  competencia date,
  evidencia_url text
)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem listar atribuições aprovadas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 100 THEN
    p_limit := 20;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  RETURN QUERY
    SELECT a.id,
           t.id,
           a.titulo_snapshot,
           (t.arquivada_em IS NOT NULL),
           f.id,
           f.nome,
           a.pontos_snapshot,
           a.validada_em,
           a.competencia,
           a.evidencia_url
      FROM public.atribuicoes a
      JOIN public.tarefas t ON t.id = a.tarefa_id
      JOIN public.filhos f ON f.id = a.filho_id
     WHERE t.familia_id = v_familia_id
       AND a.status = 'aprovada'
       AND (p_desde IS NULL OR a.validada_em >= p_desde)
     ORDER BY a.validada_em DESC NULLS LAST, a.created_at DESC
     LIMIT p_limit OFFSET p_offset;
END;
$$;

ALTER FUNCTION public.listar_atribuicoes_aprovadas(integer, integer, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.listar_atribuicoes_aprovadas(integer, integer, timestamptz) TO authenticated;
