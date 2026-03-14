-- ============================================================
-- Trofinho — Atomicidade, concorrência e privacidade
-- ============================================================

-- ─── SALDOS: invariantes de segurança ───────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'saldos_saldo_livre_non_negative'
  ) THEN
    ALTER TABLE public.saldos
      ADD CONSTRAINT saldos_saldo_livre_non_negative
      CHECK (saldo_livre >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'saldos_cofrinho_non_negative'
  ) THEN
    ALTER TABLE public.saldos
      ADD CONSTRAINT saldos_cofrinho_non_negative
      CHECK (cofrinho >= 0);
  END IF;
END;
$$;

-- ─── CADASTRO DE FILHO: cleanup e saldo inicial ─────────────

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
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
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

  INSERT INTO public.saldos (filho_id)
  VALUES (v_filho_id)
  ON CONFLICT (filho_id) DO NOTHING;

  RETURN v_filho_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.limpar_auth_user_orfao(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem remover contas órfãs';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.filhos WHERE usuario_id = p_user_id) THEN
    RETURN;
  END IF;

  DELETE FROM auth.users
   WHERE id = p_user_id;
END;
$$;

-- ─── TAREFAS: criação transacional com atribuições ─────────

CREATE OR REPLACE FUNCTION public.criar_tarefa_com_atribuicoes(
  p_titulo          TEXT,
  p_descricao       TEXT,
  p_pontos          INTEGER,
  p_timebox_inicio  DATE,
  p_timebox_fim     DATE,
  p_exige_evidencia BOOLEAN,
  p_filho_ids       UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id      UUID;
  v_familia_id    UUID;
  v_tarefa_id     UUID;
  v_filho_ids     UUID[];
  v_total_filhos  INTEGER;
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

  IF p_timebox_inicio IS NULL OR p_timebox_fim IS NULL THEN
    RAISE EXCEPTION 'Período da tarefa é obrigatório';
  END IF;

  IF p_timebox_fim < p_timebox_inicio THEN
    RAISE EXCEPTION 'Data final não pode ser anterior à inicial';
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
    timebox_inicio,
    timebox_fim,
    exige_evidencia,
    criado_por
  )
  VALUES (
    v_familia_id,
    trim(p_titulo),
    NULLIF(trim(COALESCE(p_descricao, '')), ''),
    p_pontos,
    p_timebox_inicio,
    p_timebox_fim,
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

-- ─── PONTOS: proteger contra corridas de concorrência ──────

CREATE OR REPLACE FUNCTION public.transferir_para_cofrinho(
  p_filho_id UUID,
  p_valor INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_livre INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF public.meu_filho_id() != p_filho_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id
   FOR UPDATE;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < p_valor THEN
    RAISE EXCEPTION 'Saldo livre insuficiente';
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - p_valor,
         cofrinho    = cofrinho + p_valor,
         updated_at  = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'transferencia_cofrinho', p_valor, 'Transferência para o cofrinho');
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_resgate(p_premio_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id        UUID;
  v_familia_id      UUID;
  v_custo           INTEGER;
  v_saldo_livre     INTEGER;
  v_nome_premio     TEXT;
  v_resgate_id      UUID;
BEGIN
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates';
  END IF;

  v_filho_id   := public.meu_filho_id();
  v_familia_id := (
    SELECT u.familia_id
      FROM public.usuarios u
     WHERE u.id = auth.uid()
  );

  SELECT nome, custo_pontos
    INTO v_nome_premio, v_custo
    FROM public.premios
   WHERE id = p_premio_id
     AND familia_id = v_familia_id
     AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado ou não disponível';
  END IF;

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: % pts, necessário: % pts',
      v_saldo_livre, v_custo;
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - v_custo,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  INSERT INTO public.resgates (filho_id, premio_id, status, pontos_debitados)
  VALUES (v_filho_id, p_premio_id, 'pendente', v_custo)
  RETURNING id INTO v_resgate_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (
    v_filho_id,
    'resgate',
    v_custo,
    'Resgate: ' || v_nome_premio,
    v_resgate_id
  );

  RETURN v_resgate_id;
END;
$$;

-- ─── STORAGE: tornar evidências privadas por família ───────

UPDATE storage.buckets
   SET public = false
 WHERE id = public.bucket_evidencias_id();

DROP POLICY IF EXISTS "evidencias_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_insert_filho" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_select_filho" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_select_admin" ON storage.objects;

CREATE POLICY "evidencias_insert_filho"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = public.bucket_evidencias_id()
    AND public.meu_papel() = 'filho'
    AND split_part(name, '/', 1) = public.minha_familia_id()::TEXT
    AND split_part(name, '/', 2) = public.meu_filho_id()::TEXT
    AND split_part(name, '/', 3) <> ''
  );

CREATE POLICY "evidencias_select_filho"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = public.bucket_evidencias_id()
    AND public.meu_papel() = 'filho'
    AND split_part(name, '/', 1) = public.minha_familia_id()::TEXT
    AND split_part(name, '/', 2) = public.meu_filho_id()::TEXT
  );

CREATE POLICY "evidencias_select_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = public.bucket_evidencias_id()
    AND public.usuario_e_admin()
    AND split_part(name, '/', 1) = public.minha_familia_id()::TEXT
  );
