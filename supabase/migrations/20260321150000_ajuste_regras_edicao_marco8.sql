-- ============================================================
-- Trofinho — Ajustes das regras de edição do Marco 8
-- ============================================================

ALTER TABLE public.atribuicoes
  ADD COLUMN IF NOT EXISTS pontos_snapshot INTEGER;

UPDATE public.atribuicoes a
   SET pontos_snapshot = t.pontos
  FROM public.tarefas t
 WHERE t.id = a.tarefa_id
   AND a.pontos_snapshot IS NULL;

ALTER TABLE public.atribuicoes
  ALTER COLUMN pontos_snapshot SET NOT NULL;

CREATE OR REPLACE FUNCTION public.criar_tarefa_com_atribuicoes(
  p_titulo TEXT,
  p_descricao TEXT,
  p_pontos INTEGER,
  p_frequencia public.tarefa_frequencia,
  p_exige_evidencia BOOLEAN,
  p_filho_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
    SELECT v_tarefa_id,
           filho_id,
           'pendente',
           CASE WHEN p_frequencia = 'diaria' THEN CURRENT_DATE ELSE NULL END,
           p_pontos
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_diarias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id UUID;
  v_familia_id UUID;
BEGIN
  v_filho_id := public.meu_filho_id();

  IF v_filho_id IS NULL THEN
    RETURN;
  END IF;

  v_familia_id := public.minha_familia_id();

  INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
  SELECT t.id, v_filho_id, 'pendente', CURRENT_DATE, t.pontos
    FROM public.tarefas t
   WHERE t.frequencia = 'diaria'
     AND t.familia_id = v_familia_id
     AND EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id
              AND a.filho_id = v_filho_id
              AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_atribuicao(atribuicao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_familia_id UUID;
  v_filho_id UUID;
  v_pontos INTEGER;
  v_tarefa_familia UUID;
  v_titulo TEXT;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aprovar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id,
         COALESCE(a.pontos_snapshot, t.pontos),
         t.familia_id,
         t.titulo
    INTO v_filho_id, v_pontos, v_tarefa_familia, v_titulo
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = atribuicao_id
     AND a.status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada ou não está aguardando validação';
  END IF;

  IF v_tarefa_familia != v_familia_id THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'aprovada',
         validada_em = now(),
         validada_por = v_caller_id
   WHERE id = atribuicao_id;

  INSERT INTO public.saldos (filho_id, saldo_livre)
  VALUES (v_filho_id, v_pontos)
  ON CONFLICT (filho_id) DO UPDATE
    SET saldo_livre = saldos.saldo_livre + EXCLUDED.saldo_livre,
        updated_at = now();

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'credito', v_pontos, 'Tarefa aprovada: ' || v_titulo, atribuicao_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_tarefa(
  p_tarefa_id UUID,
  p_titulo TEXT,
  p_descricao TEXT,
  p_pontos INTEGER DEFAULT NULL,
  p_frequencia public.tarefa_frequencia DEFAULT NULL,
  p_requer_evidencia BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frequencia public.tarefa_frequencia;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar tarefas';
  END IF;

  IF trim(COALESCE(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  SELECT t.frequencia
    INTO v_frequencia
    FROM public.tarefas t
   WHERE t.id = p_tarefa_id
     AND t.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF v_frequencia = 'unica'
     AND EXISTS (
       SELECT 1
         FROM public.atribuicoes a
        WHERE a.tarefa_id = p_tarefa_id
          AND (
            a.status IN ('aguardando_validacao', 'aprovada')
            OR a.concluida_em IS NOT NULL
          )
     ) THEN
    RAISE EXCEPTION 'Esta tarefa já foi concluída e não pode ser editada.';
  END IF;

  IF v_frequencia = 'diaria' AND (p_pontos IS NULL OR p_pontos <= 0) THEN
    RAISE EXCEPTION 'Pontos devem ser maiores que zero';
  END IF;

  UPDATE public.tarefas
     SET titulo = trim(p_titulo),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         pontos = CASE WHEN v_frequencia = 'diaria' THEN p_pontos ELSE pontos END,
         exige_evidencia = COALESCE(p_requer_evidencia, exige_evidencia)
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
     SET nome = trim(p_nome)
   WHERE id = p_filho_id;

  IF v_usuario_id IS NOT NULL THEN
    UPDATE public.usuarios
       SET nome = trim(p_nome)
     WHERE id = v_usuario_id;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.editar_premio(UUID, TEXT, TEXT, INTEGER, TEXT, BOOLEAN);

CREATE FUNCTION public.editar_premio(
  p_premio_id UUID,
  p_nome TEXT,
  p_descricao TEXT,
  p_custo_pontos INTEGER,
  p_imagem_url TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo_atual INTEGER;
  v_points_message TEXT := NULL;
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

  IF p_custo_pontos <> v_custo_atual
     AND EXISTS (
       SELECT 1
         FROM public.resgates r
        WHERE r.premio_id = p_premio_id
          AND r.status IN ('pendente', 'confirmado')
     ) THEN
    v_points_message := 'Não é possível alterar os pontos pois há resgates em aberto.';
  END IF;

  UPDATE public.premios
     SET nome = trim(p_nome),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         custo_pontos = CASE WHEN v_points_message IS NULL THEN p_custo_pontos ELSE custo_pontos END,
         imagem_url = COALESCE(p_imagem_url, imagem_url),
         ativo = COALESCE(p_ativo, ativo)
   WHERE id = p_premio_id;

  RETURN v_points_message;
END;
$$;
