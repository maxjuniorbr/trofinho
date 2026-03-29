-- ============================================================
-- Trofinho — Soft Delete: Tarefas e Filhos
-- Adds `ativo` flag, partial indexes, new RPCs for
-- deactivation/reactivation, and modifies existing RPCs
-- to respect the flag.
-- ============================================================

-- ─── 1. Schema: Add `ativo` columns ─────────────────────────

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.filhos
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- ─── 2. Partial indexes ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tarefas_familia_ativo
  ON public.tarefas (familia_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_filhos_familia_ativo
  ON public.filhos (familia_id) WHERE ativo = true;

-- ─── 3. New RPCs ────────────────────────────────────────────

-- ─── 3a. desativar_tarefa ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.desativar_tarefa(p_tarefa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_pending_validation INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desativar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.ativo = true
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.tarefas SET ativo = false WHERE id = p_tarefa_id;

  UPDATE public.atribuicoes
     SET status = 'rejeitada', nota_rejeicao = 'Tarefa desativada'
   WHERE tarefa_id = p_tarefa_id AND status = 'pendente';

  SELECT count(*)::INTEGER INTO v_pending_validation
    FROM public.atribuicoes
   WHERE tarefa_id = p_tarefa_id AND status = 'aguardando_validacao';

  RETURN v_pending_validation;
END;
$$;

-- ─── 3b. reativar_tarefa ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reativar_tarefa(p_tarefa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem reativar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  UPDATE public.tarefas SET ativo = true WHERE id = p_tarefa_id;
END;
$$;

-- ─── 3c. desativar_filho ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.desativar_filho(p_filho_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_pending_validation INTEGER;
  v_total_balance INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desativar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.ativo = true
  ) THEN
    SELECT count(*)::INTEGER INTO v_pending_validation
      FROM public.atribuicoes WHERE filho_id = p_filho_id AND status = 'aguardando_validacao';

    SELECT COALESCE(s.saldo_livre, 0) + COALESCE(s.cofrinho, 0) INTO v_total_balance
      FROM public.saldos s WHERE s.filho_id = p_filho_id;
    v_total_balance := COALESCE(v_total_balance, 0);

    RETURN json_build_object('pendingValidationCount', v_pending_validation, 'totalBalance', v_total_balance);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.resgates r
     WHERE r.filho_id = p_filho_id AND r.status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.';
  END IF;

  UPDATE public.filhos SET ativo = false WHERE id = p_filho_id;

  UPDATE public.atribuicoes
     SET status = 'rejeitada', nota_rejeicao = 'Filho desativado'
   WHERE filho_id = p_filho_id AND status = 'pendente';

  SELECT count(*)::INTEGER INTO v_pending_validation
    FROM public.atribuicoes WHERE filho_id = p_filho_id AND status = 'aguardando_validacao';

  SELECT COALESCE(s.saldo_livre, 0) + COALESCE(s.cofrinho, 0) INTO v_total_balance
    FROM public.saldos s WHERE s.filho_id = p_filho_id;
  v_total_balance := COALESCE(v_total_balance, 0);

  RETURN json_build_object('pendingValidationCount', v_pending_validation, 'totalBalance', v_total_balance);
END;
$$;

-- ─── 3d. reativar_filho ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reativar_filho(p_filho_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem reativar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  UPDATE public.filhos SET ativo = true WHERE id = p_filho_id;

  UPDATE public.saldos
     SET proxima_valorizacao_em = NULL, updated_at = now()
   WHERE filho_id = p_filho_id;
END;
$$;

-- ─── 4. Modified RPCs ──────────────────────────────────────

-- ─── 4a. editar_tarefa — add guard for deactivated tasks ────

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

  SELECT t.frequencia INTO v_frequencia
    FROM public.tarefas t
   WHERE t.id = p_tarefa_id AND t.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND ativo = true) THEN
    RAISE EXCEPTION 'Não é possível editar uma tarefa desativada.';
  END IF;

  IF v_frequencia = 'unica'
     AND EXISTS (
       SELECT 1 FROM public.atribuicoes a
        WHERE a.tarefa_id = p_tarefa_id
          AND (a.status IN ('aguardando_validacao', 'aprovada') OR a.concluida_em IS NOT NULL)
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

-- ─── 4b. editar_filho — add guard for deactivated children ──

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

  SELECT f.usuario_id INTO v_usuario_id
    FROM public.filhos f
   WHERE f.id = p_filho_id AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.filhos WHERE id = p_filho_id AND ativo = true) THEN
    RAISE EXCEPTION 'Não é possível editar um filho desativado.';
  END IF;

  UPDATE public.filhos SET nome = trim(p_nome) WHERE id = p_filho_id;

  IF v_usuario_id IS NOT NULL THEN
    UPDATE public.usuarios SET nome = trim(p_nome) WHERE id = v_usuario_id;
  END IF;
END;
$$;

-- ─── 4c. obter_meu_perfil — block deactivated children ──────

CREATE OR REPLACE FUNCTION public.obter_meu_perfil()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', u.id,
    'familia_id', u.familia_id,
    'papel', u.papel,
    'nome', u.nome,
    'avatarUrl', COALESCE(
      (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = v_user_id),
      f.avatar_url
    )
  )
  INTO v_result
  FROM public.usuarios u
  LEFT JOIN public.filhos f ON f.usuario_id = u.id
  WHERE u.id = v_user_id;

  IF (v_result->>'papel') = 'filho' AND EXISTS (
    SELECT 1 FROM public.filhos WHERE usuario_id = v_user_id AND ativo = false
  ) THEN
    RAISE EXCEPTION 'Sua conta foi desativada. Entre em contato com o responsável.';
  END IF;

  RETURN v_result;
END;
$$;

-- ─── 4d. garantir_atribuicoes_diarias — filter inactive ─────

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

  IF NOT EXISTS (SELECT 1 FROM public.filhos WHERE id = v_filho_id AND ativo = true) THEN
    RETURN;
  END IF;

  INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
  SELECT t.id, v_filho_id, 'pendente', CURRENT_DATE, t.pontos
    FROM public.tarefas t
   WHERE t.frequencia = 'diaria'
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

-- ─── 4e. sincronizar_valorizacoes_automaticas — filter inactive children ─

CREATE OR REPLACE FUNCTION public.sincronizar_valorizacoes_automaticas(
  p_filho_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alvos UUID[] := ARRAY[]::UUID[];
  v_alvo_id UUID;
  v_familia_id UUID;
  v_saldo public.saldos%ROWTYPE;
  v_proxima DATE;
  v_ganho INTEGER;
  v_total_geral INTEGER := 0;
  v_total_filho INTEGER := 0;
  v_ultima_valorizacao_efetiva DATE;
  v_indice_formatado TEXT;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF public.usuario_e_admin() THEN
    v_familia_id := public.minha_familia_id();

    IF p_filho_id IS NOT NULL THEN
      PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);
      v_alvos := ARRAY[p_filho_id];
    ELSE
      SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
        INTO v_alvos
        FROM public.filhos
       WHERE familia_id = v_familia_id
         AND ativo = true;
    END IF;
  ELSIF public.meu_filho_id() IS NOT NULL THEN
    IF p_filho_id IS NOT NULL AND p_filho_id <> public.meu_filho_id() THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    v_alvos := ARRAY[public.meu_filho_id()];
  ELSE
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOREACH v_alvo_id IN ARRAY v_alvos LOOP
    SELECT * INTO v_saldo FROM public.saldos WHERE filho_id = v_alvo_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_saldo.indice_valorizacao <= 0 THEN
      IF v_saldo.proxima_valorizacao_em IS NOT NULL THEN
        UPDATE public.saldos SET proxima_valorizacao_em = NULL, updated_at = now() WHERE filho_id = v_alvo_id;
      END IF;
      CONTINUE;
    END IF;

    v_proxima := COALESCE(
      v_saldo.proxima_valorizacao_em,
      CASE
        WHEN v_saldo.data_ultima_valorizacao IS NOT NULL THEN public.avancar_data_valorizacao(v_saldo.data_ultima_valorizacao, v_saldo.periodo_valorizacao)
        ELSE public.avancar_data_valorizacao(CURRENT_DATE, v_saldo.periodo_valorizacao)
      END
    );

    v_total_filho := 0;
    v_ultima_valorizacao_efetiva := v_saldo.data_ultima_valorizacao;
    v_indice_formatado := replace(trim(to_char(v_saldo.indice_valorizacao, 'FM999999990D00')), '.', ',');

    WHILE v_proxima <= CURRENT_DATE LOOP
      IF v_saldo.cofrinho > 0 THEN
        v_ganho := FLOOR(v_saldo.cofrinho * v_saldo.indice_valorizacao / 100)::INTEGER;
        IF v_ganho > 0 THEN
          v_saldo.cofrinho := v_saldo.cofrinho + v_ganho;
          v_total_filho := v_total_filho + v_ganho;
          v_ultima_valorizacao_efetiva := v_proxima;
          INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
          VALUES (v_alvo_id, 'valorizacao', v_ganho,
            'Valorização automática do cofrinho (' || v_indice_formatado || '% · ref. ' || to_char(v_proxima, 'DD/MM/YYYY') || ')');
        END IF;
      END IF;
      v_proxima := public.avancar_data_valorizacao(v_proxima, v_saldo.periodo_valorizacao);
    END LOOP;

    UPDATE public.saldos
       SET cofrinho = v_saldo.cofrinho,
           data_ultima_valorizacao = v_ultima_valorizacao_efetiva,
           proxima_valorizacao_em = v_proxima,
           updated_at = CASE
             WHEN cofrinho IS DISTINCT FROM v_saldo.cofrinho
               OR data_ultima_valorizacao IS DISTINCT FROM v_ultima_valorizacao_efetiva
               OR proxima_valorizacao_em IS DISTINCT FROM v_proxima
             THEN now() ELSE updated_at END
     WHERE filho_id = v_alvo_id;

    v_total_geral := v_total_geral + v_total_filho;
  END LOOP;

  RETURN v_total_geral;
END;
$$;

-- ─── 4f. criar_tarefa_com_atribuicoes — filter inactive children ─

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
    SELECT count(*) INTO v_filhos_validos
      FROM public.filhos
     WHERE id = ANY (v_filho_ids) AND familia_id = v_familia_id AND ativo = true;

    IF v_filhos_validos <> v_total_filhos THEN
      RAISE EXCEPTION 'Há filhos inválidos ou de outra família na atribuição';
    END IF;
  END IF;

  INSERT INTO public.tarefas (familia_id, titulo, descricao, pontos, frequencia, exige_evidencia, criado_por)
  VALUES (v_familia_id, trim(p_titulo), NULLIF(trim(COALESCE(p_descricao, '')), ''), p_pontos, p_frequencia, COALESCE(p_exige_evidencia, false), v_admin_id)
  RETURNING id INTO v_tarefa_id;

  IF v_total_filhos > 0 THEN
    INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
    SELECT v_tarefa_id, filho_id, 'pendente',
           CASE WHEN p_frequencia = 'diaria' THEN CURRENT_DATE ELSE NULL END, p_pontos
      FROM unnest(v_filho_ids) AS filho_id;
  END IF;

  RETURN v_tarefa_id;
END;
$$;
