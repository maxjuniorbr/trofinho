


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."atribuicao_status" AS ENUM (
    'pendente',
    'aguardando_validacao',
    'aprovada',
    'rejeitada'
);


ALTER TYPE "public"."atribuicao_status" OWNER TO "postgres";


CREATE TYPE "public"."periodo_valorizacao" AS ENUM (
    'diario',
    'semanal',
    'mensal'
);


ALTER TYPE "public"."periodo_valorizacao" OWNER TO "postgres";


CREATE TYPE "public"."tarefa_frequencia" AS ENUM (
    'diaria',
    'unica'
);


ALTER TYPE "public"."tarefa_frequencia" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aplicar_penalizacao"("p_filho_id" "uuid", "p_valor" integer, "p_descricao" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_familia_id UUID;
  v_saldo_livre INTEGER;
  v_deducted INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aplicar penalização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
    RAISE EXCEPTION 'Descrição obrigatória para penalização';
  END IF;

  -- Rate limit: max 10 penalties per 10 minutes
  PERFORM public.verificar_limite_frequencia(p_filho_id, 'penalizacao', INTERVAL '10 minutes', 10);

  SELECT saldo_livre INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id
   FOR UPDATE;

  IF v_saldo_livre = 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para penalização.';
  END IF;

  v_deducted := LEAST(p_valor, GREATEST(0, v_saldo_livre));

  UPDATE public.saldos
     SET saldo_livre = GREATEST(0, saldo_livre - p_valor),
         updated_at  = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'penalizacao', v_deducted, trim(p_descricao));

  PERFORM public.registrar_audit(
    'aplicar_penalizacao', 'filho', p_filho_id,
    jsonb_build_object('valor', p_valor, 'deducted', v_deducted, 'descricao', trim(p_descricao))
  );

  RETURN v_deducted;
END;
$$;


ALTER FUNCTION "public"."aplicar_penalizacao"("p_filho_id" "uuid", "p_valor" integer, "p_descricao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aplicar_valorizacao"("p_filho_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aplicar valorização';
  END IF;

  RETURN public.sincronizar_valorizacoes_automaticas(p_filho_id);
END;
$$;


ALTER FUNCTION "public"."aplicar_valorizacao"("p_filho_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;


ALTER FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."avancar_data_valorizacao"("p_data_base" "date", "p_periodo" "public"."periodo_valorizacao") RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE p_periodo
    WHEN 'diario' THEN p_data_base + 1
    WHEN 'semanal' THEN p_data_base + 7
    WHEN 'mensal' THEN (p_data_base + INTERVAL '1 month')::DATE
  END;
$$;


ALTER FUNCTION "public"."avancar_data_valorizacao"("p_data_base" "date", "p_periodo" "public"."periodo_valorizacao") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bucket_evidencias_id"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT 'evidencias';
$$;


ALTER FUNCTION "public"."bucket_evidencias_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_envio_atribuicao"("p_atribuicao_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id UUID;
  v_owner_user_id UUID;
  v_tarefa_familia UUID;
  v_status public.atribuicao_status;
  v_competencia DATE;
  v_frequencia public.tarefa_frequencia;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT f.usuario_id,
         t.familia_id,
         a.status,
         a.competencia,
         t.frequencia,
         t.ativo
    INTO v_owner_user_id,
         v_tarefa_familia,
         v_status,
         v_competencia,
         v_frequencia,
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

  IF v_frequencia = 'diaria'
     AND v_competencia IS NOT NULL
     AND v_competencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível cancelar envio de tarefa diária de data anterior';
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


ALTER FUNCTION "public"."cancelar_envio_atribuicao"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho_id UUID;
  v_pontos   INTEGER;
  v_nome     TEXT;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cancelar resgates';
  END IF;

  SELECT r.filho_id, r.pontos_debitados, p.nome
    INTO v_filho_id, v_pontos, v_nome
    FROM public.resgates r
    JOIN public.filhos f ON f.id = r.filho_id
    JOIN public.premios p ON p.id = r.premio_id
   WHERE r.id = p_resgate_id
     AND r.status = 'pendente'
     AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado ou não está pendente';
  END IF;

  UPDATE public.resgates
     SET status     = 'cancelado',
         updated_at = now()
   WHERE id = p_resgate_id;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre + v_pontos,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'estorno_resgate', v_pontos,
          'Estorno: ' || v_nome, p_resgate_id);

  PERFORM public.registrar_audit(
    'cancelar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos_estornados', v_pontos)
  );
END;
$$;


ALTER FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."concluir_atribuicao"("p_atribuicao_id" "uuid", "p_evidencia_url" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id UUID;
  v_tarefa_familia UUID;
  v_exige_evidencia BOOLEAN;
  v_status public.atribuicao_status;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT t.familia_id,
         t.exige_evidencia,
         a.status,
         t.ativo
    INTO v_tarefa_familia,
         v_exige_evidencia,
         v_status,
         v_tarefa_ativa
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

  IF v_status != 'pendente' THEN
    RAISE EXCEPTION 'Esta atribuição não está pendente';
  END IF;

  IF v_tarefa_ativa = false THEN
    RAISE EXCEPTION 'Esta tarefa está desativada e não pode ser enviada para validação';
  END IF;

  IF v_exige_evidencia AND (p_evidencia_url IS NULL OR trim(p_evidencia_url) = '') THEN
    RAISE EXCEPTION 'Esta tarefa exige evidência';
  END IF;

  UPDATE public.atribuicoes a
     SET status = 'aguardando_validacao',
         evidencia_url = p_evidencia_url,
         concluida_em = now()
    FROM public.tarefas t
   WHERE a.id = p_atribuicao_id
     AND a.tarefa_id = t.id
     AND a.status = 'pendente'
     AND t.ativo = true;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
        FROM public.atribuicoes a
        JOIN public.tarefas t ON t.id = a.tarefa_id
       WHERE a.id = p_atribuicao_id
         AND t.ativo = false
    ) THEN
      RAISE EXCEPTION 'Esta tarefa está desativada e não pode ser enviada para validação';
    END IF;

    RAISE EXCEPTION 'Esta atribuição não está pendente';
  END IF;
END;
$$;


ALTER FUNCTION "public"."concluir_atribuicao"("p_atribuicao_id" "uuid", "p_evidencia_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configurar_valorizacao"("p_filho_id" "uuid", "p_indice" numeric, "p_periodo" "public"."periodo_valorizacao") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem configurar valorização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  IF p_indice < 0 OR p_indice > 100 THEN
    RAISE EXCEPTION 'Índice deve estar entre 0 e 100';
  END IF;

  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

  INSERT INTO public.saldos (
    filho_id,
    indice_valorizacao,
    periodo_valorizacao,
    proxima_valorizacao_em
  )
  VALUES (
    p_filho_id,
    p_indice,
    p_periodo,
    CASE
      WHEN p_indice > 0 THEN public.avancar_data_valorizacao(CURRENT_DATE, p_periodo)
      ELSE NULL
    END
  )
  ON CONFLICT (filho_id) DO UPDATE
    SET indice_valorizacao = EXCLUDED.indice_valorizacao,
        periodo_valorizacao = EXCLUDED.periodo_valorizacao,
        proxima_valorizacao_em = EXCLUDED.proxima_valorizacao_em,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."configurar_valorizacao"("p_filho_id" "uuid", "p_indice" numeric, "p_periodo" "public"."periodo_valorizacao") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_resgate"("p_resgate_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho_id UUID;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates';
  END IF;

  SELECT r.filho_id
    INTO v_filho_id
    FROM public.resgates r
    JOIN public.filhos f ON f.id = r.filho_id
   WHERE r.id = p_resgate_id
     AND r.status = 'pendente'
     AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado ou não está pendente';
  END IF;

  UPDATE public.resgates
     SET status     = 'confirmado',
         updated_at = now()
   WHERE id = p_resgate_id;

  PERFORM public.registrar_audit(
    'confirmar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id)
  );
END;
$$;


ALTER FUNCTION "public"."confirmar_resgate"("p_resgate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_familia"("nome_familia" "text", "nome_usuario" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    UUID;
  v_familia_id UUID;
BEGIN
  -- Garante que há um usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Impede que o usuário crie múltiplas famílias
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família';
  END IF;

  -- Cria a família
  INSERT INTO public.familias (nome)
  VALUES (nome_familia)
  RETURNING id INTO v_familia_id;

  -- Cria o perfil admin
  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (v_user_id, v_familia_id, 'admin', nome_usuario);

  RETURN v_familia_id;
END;
$$;


ALTER FUNCTION "public"."criar_familia"("nome_familia" "text", "nome_usuario" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_filho_na_familia"("filho_user_id" "uuid", "filho_nome" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."criar_filho_na_familia"("filho_user_id" "uuid", "filho_nome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_timebox_inicio" "date", "p_timebox_fim" "date", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_timebox_inicio" "date", "p_timebox_fim" "date", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cron_sincronizar_valorizacoes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho RECORD;
  v_saldo public.saldos%ROWTYPE;
  v_proxima DATE;
  v_ganho INTEGER;
  v_total_geral INTEGER := 0;
  v_total_filho INTEGER;
  v_ultima_valorizacao_efetiva DATE;
  v_indice_formatado TEXT;
BEGIN
  FOR v_filho IN
    SELECT f.id AS filho_id
      FROM public.filhos f
     WHERE f.ativo = true
  LOOP
    SELECT *
      INTO v_saldo
      FROM public.saldos
     WHERE filho_id = v_filho.filho_id
     FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_saldo.indice_valorizacao <= 0 THEN
      IF v_saldo.proxima_valorizacao_em IS NOT NULL THEN
        UPDATE public.saldos
           SET proxima_valorizacao_em = NULL,
               updated_at = now()
         WHERE filho_id = v_filho.filho_id;
      END IF;
      CONTINUE;
    END IF;

    v_proxima := COALESCE(
      v_saldo.proxima_valorizacao_em,
      CASE
        WHEN v_saldo.data_ultima_valorizacao IS NOT NULL THEN public.avancar_data_valorizacao(
          v_saldo.data_ultima_valorizacao,
          v_saldo.periodo_valorizacao
        )
        ELSE public.avancar_data_valorizacao(CURRENT_DATE, v_saldo.periodo_valorizacao)
      END
    );

    v_total_filho := 0;
    v_ultima_valorizacao_efetiva := v_saldo.data_ultima_valorizacao;
    v_indice_formatado := replace(
      trim(to_char(v_saldo.indice_valorizacao, 'FM999999990D00')),
      '.',
      ','
    );

    WHILE v_proxima <= CURRENT_DATE LOOP
      IF v_saldo.cofrinho > 0 THEN
        v_ganho := FLOOR(v_saldo.cofrinho * v_saldo.indice_valorizacao / 100)::INTEGER;

        IF v_ganho > 0 THEN
          v_saldo.cofrinho := v_saldo.cofrinho + v_ganho;
          v_total_filho := v_total_filho + v_ganho;
          v_ultima_valorizacao_efetiva := v_proxima;

          INSERT INTO public.movimentacoes (
            filho_id, tipo, valor, descricao
          ) VALUES (
            v_filho.filho_id,
            'valorizacao',
            v_ganho,
            'Valorização automática do cofrinho (' ||
              v_indice_formatado ||
              '% · ref. ' ||
              to_char(v_proxima, 'DD/MM/YYYY') ||
              ')'
          );
        END IF;
      END IF;

      v_proxima := public.avancar_data_valorizacao(v_proxima, v_saldo.periodo_valorizacao);
    END LOOP;

    UPDATE public.saldos
       SET cofrinho = v_saldo.cofrinho,
           data_ultima_valorizacao = v_ultima_valorizacao_efetiva,
           proxima_valorizacao_em = v_proxima,
           updated_at = now()
     WHERE filho_id = v_filho.filho_id;

    v_total_geral := v_total_geral + v_total_filho;
  END LOOP;

  RETURN v_total_geral;
END;
$$;


ALTER FUNCTION "public"."cron_sincronizar_valorizacoes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desativar_filho"("p_filho_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  PERFORM public.registrar_audit(
    'desativar_filho', 'filho', p_filho_id, NULL
  );

  RETURN json_build_object('pendingValidationCount', v_pending_validation, 'totalBalance', v_total_balance);
END;
$$;


ALTER FUNCTION "public"."desativar_filho"("p_filho_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desativar_premio"("p_premio_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_familia_id UUID;
  v_pending_count INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desativar prêmios';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- Validate prize belongs to caller's family
  IF NOT EXISTS (
    SELECT 1
      FROM public.premios p
     WHERE p.id = p_premio_id
       AND p.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Prêmio não encontrado';
  END IF;

  -- Deactivate the prize
  UPDATE public.premios
     SET ativo = false
   WHERE id = p_premio_id;

  -- Count pending redemptions
  SELECT count(*)::INTEGER
    INTO v_pending_count
    FROM public.resgates r
   WHERE r.premio_id = p_premio_id
     AND r.status = 'pendente';

  RETURN v_pending_count;
END;
$$;


ALTER FUNCTION "public"."desativar_premio"("p_premio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desativar_tarefa"("p_tarefa_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."desativar_tarefa"("p_tarefa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_filho"("p_filho_id" "uuid", "p_nome" "text", "p_avatar_url" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."editar_filho"("p_filho_id" "uuid", "p_nome" "text", "p_avatar_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_premio"("p_premio_id" "uuid", "p_nome" "text", "p_descricao" "text", "p_custo_pontos" integer, "p_imagem_url" "text" DEFAULT NULL::"text", "p_ativo" boolean DEFAULT NULL::boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."editar_premio"("p_premio_id" "uuid", "p_nome" "text", "p_descricao" "text", "p_custo_pontos" integer, "p_imagem_url" "text", "p_ativo" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_tarefa"("p_tarefa_id" "uuid", "p_titulo" "text", "p_descricao" "text", "p_pontos" integer DEFAULT NULL::integer, "p_frequencia" "public"."tarefa_frequencia" DEFAULT NULL::"public"."tarefa_frequencia", "p_requer_evidencia" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."editar_tarefa"("p_tarefa_id" "uuid", "p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_requer_evidencia" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."garantir_atribuicoes_diarias"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."garantir_atribuicoes_diarias"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpar_auth_user_orfao"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

  -- S4: Only allow deleting users created in the last 5 minutes (cleanup window).
  -- Prevents abuse of this function to delete arbitrary auth.users.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
     WHERE id = p_user_id
       AND created_at >= now() - INTERVAL '5 minutes'
  ) THEN
    RETURN;
  END IF;

  DELETE FROM auth.users
   WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."limpar_auth_user_orfao"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_filho_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM public.filhos WHERE usuario_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."meu_filho_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_papel"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT papel FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."meu_papel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."minha_familia_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT familia_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."minha_familia_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_filho_admin"("p_filho_id" "uuid") RETURNS TABLE("id" "uuid", "nome" "text", "email" "text", "usuario_id" "uuid", "avatar_url" "text", "ativo" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem visualizar filhos';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.nome,
    au.email::TEXT,
    f.usuario_id,
    f.avatar_url,
    f.ativo
  FROM public.filhos f
  LEFT JOIN auth.users au ON au.id = f.usuario_id
  WHERE f.id = p_filho_id
    AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;
END;
$$;


ALTER FUNCTION "public"."obter_filho_admin"("p_filho_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_meu_perfil"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."obter_meu_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_usuarios_privilege_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.papel != OLD.papel OR NEW.familia_id IS DISTINCT FROM OLD.familia_id THEN
    RAISE EXCEPTION 'Alteração de papel ou família não permitida.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_usuarios_privilege_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reativar_filho"("p_filho_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  PERFORM public.registrar_audit(
    'reativar_filho', 'filho', p_filho_id, NULL
  );
END;
$$;


ALTER FUNCTION "public"."reativar_filho"("p_filho_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reativar_premio"("p_premio_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem reativar prêmios';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- Validate prize belongs to caller's family
  IF NOT EXISTS (
    SELECT 1
      FROM public.premios p
     WHERE p.id = p_premio_id
       AND p.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Prêmio não encontrado';
  END IF;

  -- Reactivate the prize
  UPDATE public.premios
     SET ativo = true
   WHERE id = p_premio_id;
END;
$$;


ALTER FUNCTION "public"."reativar_premio"("p_premio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reativar_tarefa"("p_tarefa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."reativar_tarefa"("p_tarefa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_audit"("p_acao" "text", "p_alvo_tipo" "text", "p_alvo_id" "uuid" DEFAULT NULL::"uuid", "p_detalhes" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_log (familia_id, operador_id, acao, alvo_tipo, alvo_id, detalhes)
  VALUES (
    public.minha_familia_id(),
    auth.uid(),
    p_acao,
    p_alvo_tipo,
    p_alvo_id,
    p_detalhes
  );
END;
$$;


ALTER FUNCTION "public"."registrar_audit"("p_acao" "text", "p_alvo_tipo" "text", "p_alvo_id" "uuid", "p_detalhes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rejeitar_atribuicao"("p_atribuicao_id" "uuid", "p_nota_rejeicao" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id UUID;
  v_familia_id UUID;
  v_filho_id UUID;
  v_tarefa_familia UUID;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem rejeitar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id, t.familia_id
    INTO v_filho_id, v_tarefa_familia
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = p_atribuicao_id
     AND a.status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada ou não está aguardando validação';
  END IF;

  IF v_tarefa_familia != v_familia_id THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'rejeitada',
         nota_rejeicao = p_nota_rejeicao,
         validada_em = now(),
         validada_por = v_caller_id
   WHERE id = p_atribuicao_id;

  PERFORM public.registrar_audit(
    'rejeitar_atribuicao', 'atribuicao', p_atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'nota', p_nota_rejeicao)
  );
END;
$$;


ALTER FUNCTION "public"."rejeitar_atribuicao"("p_atribuicao_id" "uuid", "p_nota_rejeicao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_concluida_em_on_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status = 'aguardando_validacao' THEN
    NEW.concluida_em = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_concluida_em_on_submit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- S15: Rate limit moved after FOR UPDATE to eliminate window between check and lock.
  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate', INTERVAL '10 minutes', 5);

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente para este resgate';
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


ALTER FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transferir_para_cofrinho"("p_filho_id" "uuid", "p_valor" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- Rate limit: max 10 transfers per 10 minutes
  PERFORM public.verificar_limite_frequencia(p_filho_id, 'transferencia_cofrinho', INTERVAL '10 minutes', 10);

  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

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
         cofrinho = cofrinho + p_valor,
         updated_at = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'transferencia_cofrinho', p_valor, 'Transferência para o cofrinho');
END;
$$;


ALTER FUNCTION "public"."transferir_para_cofrinho"("p_filho_id" "uuid", "p_valor" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_push_token"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token de push inválido';
  END IF;

  v_user_id := public.usuario_autenticado_id();

  INSERT INTO public.push_tokens (user_id, token)
  VALUES (v_user_id, p_token)
  ON CONFLICT (token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    created_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_push_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_push_token"("p_token" "text", "p_device_id" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token de push inválido';
  END IF;

  v_user_id := public.usuario_autenticado_id();

  -- Remove the previous token for this device (same user)
  DELETE FROM public.push_tokens
  WHERE user_id = v_user_id
    AND device_id = p_device_id;

  -- Remove any stale row that holds this token under a different user
  DELETE FROM public.push_tokens
  WHERE token = p_token
    AND user_id <> v_user_id;

  INSERT INTO public.push_tokens (user_id, token, device_id)
  VALUES (v_user_id, p_token, p_device_id);
END;
$$;


ALTER FUNCTION "public"."upsert_push_token"("p_token" "text", "p_device_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_autenticado_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."usuario_autenticado_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_e_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.meu_papel() = 'admin';
$$;


ALTER FUNCTION "public"."usuario_e_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_filho_da_familia"("p_filho_id" "uuid", "p_familia_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
    WHERE f.id = p_filho_id AND f.familia_id = p_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não pertence a esta família';
  END IF;
END;
$$;


ALTER FUNCTION "public"."validar_filho_da_familia"("p_filho_id" "uuid", "p_familia_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_limite_frequencia"("p_filho_id" "uuid", "p_tipo" "text", "p_janela" interval, "p_limite" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_contagem INTEGER;
BEGIN
  SELECT count(*)::int
    INTO v_contagem
    FROM public.movimentacoes
   WHERE filho_id = p_filho_id
     AND tipo = p_tipo
     AND created_at > now() - p_janela;

  IF v_contagem >= p_limite THEN
    RAISE EXCEPTION 'Limite de operações atingido. Tente novamente em alguns minutos.';
  END IF;
END;
$$;


ALTER FUNCTION "public"."verificar_limite_frequencia"("p_filho_id" "uuid", "p_tipo" "text", "p_janela" interval, "p_limite" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."atribuicoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tarefa_id" "uuid" NOT NULL,
    "filho_id" "uuid" NOT NULL,
    "status" "public"."atribuicao_status" DEFAULT 'pendente'::"public"."atribuicao_status" NOT NULL,
    "evidencia_url" "text",
    "nota_rejeicao" "text",
    "concluida_em" timestamp with time zone,
    "validada_em" timestamp with time zone,
    "validada_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "competencia" "date",
    "pontos_snapshot" integer NOT NULL,
    CONSTRAINT "atribuicoes_nota_rejeicao_max_length" CHECK ((("nota_rejeicao" IS NULL) OR ("length"("nota_rejeicao") <= 500))),
    CONSTRAINT "atribuicoes_nota_rejeicao_required" CHECK ((("status" <> 'rejeitada'::"public"."atribuicao_status") OR ("nota_rejeicao" IS NOT NULL)))
);


ALTER TABLE "public"."atribuicoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "familia_id" "uuid" NOT NULL,
    "operador_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "alvo_tipo" "text" NOT NULL,
    "alvo_id" "uuid",
    "detalhes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."familias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "familias_nome_max_length" CHECK (("length"("nome") <= 100))
);


ALTER TABLE "public"."familias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."filhos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "familia_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid",
    "ativo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "filhos_nome_max_length" CHECK (("length"("nome") <= 100))
);


ALTER TABLE "public"."filhos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimentacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filho_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" integer NOT NULL,
    "descricao" "text" NOT NULL,
    "referencia_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimentacoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['credito'::"text", 'debito'::"text", 'transferencia_cofrinho'::"text", 'valorizacao'::"text", 'penalizacao'::"text", 'resgate'::"text", 'estorno_resgate'::"text"]))),
    CONSTRAINT "movimentacoes_valor_check" CHECK (("valor" > 0))
);


ALTER TABLE "public"."movimentacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "familia_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "custo_pontos" integer NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "imagem_url" "text",
    CONSTRAINT "premios_custo_pontos_check" CHECK (("custo_pontos" > 0)),
    CONSTRAINT "premios_custo_pontos_max" CHECK (("custo_pontos" <= 99999)),
    CONSTRAINT "premios_descricao_max_length" CHECK ((("descricao" IS NULL) OR ("length"("descricao") <= 2000))),
    CONSTRAINT "premios_nome_max_length" CHECK (("length"("nome") <= 200))
);


ALTER TABLE "public"."premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "device_id" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resgates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filho_id" "uuid" NOT NULL,
    "premio_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "pontos_debitados" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resgates_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'confirmado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."resgates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saldos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filho_id" "uuid" NOT NULL,
    "saldo_livre" integer DEFAULT 0 NOT NULL,
    "cofrinho" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "indice_valorizacao" numeric(5,2) DEFAULT 0 NOT NULL,
    "periodo_valorizacao" "public"."periodo_valorizacao" DEFAULT 'mensal'::"public"."periodo_valorizacao" NOT NULL,
    "data_ultima_valorizacao" "date",
    "proxima_valorizacao_em" "date",
    CONSTRAINT "saldos_cofrinho_non_negative" CHECK (("cofrinho" >= 0)),
    CONSTRAINT "saldos_saldo_livre_non_negative" CHECK (("saldo_livre" >= 0))
);


ALTER TABLE "public"."saldos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarefas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "familia_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "pontos" integer NOT NULL,
    "exige_evidencia" boolean DEFAULT false NOT NULL,
    "criado_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "frequencia" "public"."tarefa_frequencia" DEFAULT 'unica'::"public"."tarefa_frequencia" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "tarefas_descricao_max_length" CHECK ((("descricao" IS NULL) OR ("length"("descricao") <= 2000))),
    CONSTRAINT "tarefas_pontos_check" CHECK (("pontos" > 0)),
    CONSTRAINT "tarefas_pontos_max" CHECK (("pontos" <= 99999)),
    CONSTRAINT "tarefas_titulo_max_length" CHECK (("length"("titulo") <= 200))
);


ALTER TABLE "public"."tarefas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" NOT NULL,
    "familia_id" "uuid" NOT NULL,
    "papel" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notif_prefs" "jsonb" DEFAULT '{"tarefaAprovada": true, "tarefaConcluida": true, "tarefaRejeitada": true, "resgateCancelado": true, "tarefasPendentes": true, "resgateConfirmado": true, "resgatesSolicitado": true}'::"jsonb" NOT NULL,
    CONSTRAINT "usuarios_nome_max_length" CHECK (("length"("nome") <= 100)),
    CONSTRAINT "usuarios_papel_check" CHECK (("papel" = ANY (ARRAY['admin'::"text", 'filho'::"text"])))
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios"."notif_prefs" IS 'Per-user push notification preferences. Keys: tarefasPendentes, tarefaAprovada, tarefaRejeitada, tarefaConcluida, resgatesSolicitado, resgateConfirmado, resgateCancelado.';



ALTER TABLE ONLY "public"."atribuicoes"
    ADD CONSTRAINT "atribuicoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."familias"
    ADD CONSTRAINT "familias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filhos"
    ADD CONSTRAINT "filhos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentacoes"
    ADD CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premios"
    ADD CONSTRAINT "premios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_device_unique" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saldos"
    ADD CONSTRAINT "saldos_filho_id_key" UNIQUE ("filho_id");



ALTER TABLE ONLY "public"."saldos"
    ADD CONSTRAINT "saldos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarefas"
    ADD CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_atribuicoes_diaria_dia" ON "public"."atribuicoes" USING "btree" ("tarefa_id", "filho_id", "competencia") WHERE ("competencia" IS NOT NULL);



CREATE INDEX "idx_atribuicoes_filho" ON "public"."atribuicoes" USING "btree" ("filho_id");



CREATE INDEX "idx_atribuicoes_status" ON "public"."atribuicoes" USING "btree" ("status");



CREATE INDEX "idx_atribuicoes_tarefa" ON "public"."atribuicoes" USING "btree" ("tarefa_id");



CREATE UNIQUE INDEX "idx_atribuicoes_unica" ON "public"."atribuicoes" USING "btree" ("tarefa_id", "filho_id") WHERE ("competencia" IS NULL);



CREATE INDEX "idx_audit_log_created" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_familia" ON "public"."audit_log" USING "btree" ("familia_id");



CREATE INDEX "idx_audit_log_operador" ON "public"."audit_log" USING "btree" ("operador_id");



CREATE INDEX "idx_filhos_familia" ON "public"."filhos" USING "btree" ("familia_id");



CREATE INDEX "idx_filhos_familia_ativo" ON "public"."filhos" USING "btree" ("familia_id") WHERE ("ativo" = true);



CREATE INDEX "idx_filhos_usuario" ON "public"."filhos" USING "btree" ("usuario_id");



CREATE INDEX "idx_filhos_usuario_id" ON "public"."filhos" USING "btree" ("usuario_id");



CREATE INDEX "idx_movimentacoes_created" ON "public"."movimentacoes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_movimentacoes_filho" ON "public"."movimentacoes" USING "btree" ("filho_id");



CREATE INDEX "idx_movimentacoes_rate_limit" ON "public"."movimentacoes" USING "btree" ("filho_id", "tipo", "created_at");



CREATE INDEX "idx_movimentacoes_tipo" ON "public"."movimentacoes" USING "btree" ("tipo");



CREATE INDEX "idx_premios_ativo" ON "public"."premios" USING "btree" ("ativo");



CREATE INDEX "idx_premios_familia" ON "public"."premios" USING "btree" ("familia_id");



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_resgates_created" ON "public"."resgates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_resgates_filho" ON "public"."resgates" USING "btree" ("filho_id");



CREATE INDEX "idx_resgates_premio" ON "public"."resgates" USING "btree" ("premio_id");



CREATE INDEX "idx_resgates_status" ON "public"."resgates" USING "btree" ("status");



CREATE INDEX "idx_saldos_filho" ON "public"."saldos" USING "btree" ("filho_id");



CREATE INDEX "idx_tarefas_familia" ON "public"."tarefas" USING "btree" ("familia_id");



CREATE INDEX "idx_tarefas_familia_ativo" ON "public"."tarefas" USING "btree" ("familia_id") WHERE ("ativo" = true);



CREATE INDEX "idx_usuarios_familia" ON "public"."usuarios" USING "btree" ("familia_id");



CREATE OR REPLACE TRIGGER "prevent_usuarios_privilege_escalation" BEFORE UPDATE ON "public"."usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_usuarios_privilege_escalation"();



CREATE OR REPLACE TRIGGER "set_concluida_em_on_submit" BEFORE UPDATE ON "public"."atribuicoes" FOR EACH ROW EXECUTE FUNCTION "public"."set_concluida_em_on_submit"();



ALTER TABLE ONLY "public"."atribuicoes"
    ADD CONSTRAINT "atribuicoes_filho_id_fkey" FOREIGN KEY ("filho_id") REFERENCES "public"."filhos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes"
    ADD CONSTRAINT "atribuicoes_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes"
    ADD CONSTRAINT "atribuicoes_validada_por_fkey" FOREIGN KEY ("validada_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."filhos"
    ADD CONSTRAINT "filhos_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."filhos"
    ADD CONSTRAINT "filhos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes"
    ADD CONSTRAINT "movimentacoes_filho_id_fkey" FOREIGN KEY ("filho_id") REFERENCES "public"."filhos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premios"
    ADD CONSTRAINT "premios_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_filho_id_fkey" FOREIGN KEY ("filho_id") REFERENCES "public"."filhos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "public"."premios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saldos"
    ADD CONSTRAINT "saldos_filho_id_fkey" FOREIGN KEY ("filho_id") REFERENCES "public"."filhos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarefas"
    ADD CONSTRAINT "tarefas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tarefas"
    ADD CONSTRAINT "tarefas_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."atribuicoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "atribuicoes_insert_admin" ON "public"."atribuicoes" FOR INSERT WITH CHECK (("public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."tarefas" "t"
  WHERE (("t"."id" = "atribuicoes"."tarefa_id") AND ("t"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "atribuicoes_select_admin" ON "public"."atribuicoes" FOR SELECT USING (("public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."tarefas" "t"
  WHERE (("t"."id" = "atribuicoes"."tarefa_id") AND ("t"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "atribuicoes_select_filho" ON "public"."atribuicoes" FOR SELECT USING (("filho_id" = "public"."meu_filho_id"()));



CREATE POLICY "atribuicoes_update_admin" ON "public"."atribuicoes" FOR UPDATE USING (("public"."usuario_e_admin"() AND ("status" = 'aguardando_validacao'::"public"."atribuicao_status") AND (EXISTS ( SELECT 1
   FROM "public"."tarefas" "t"
  WHERE (("t"."id" = "atribuicoes"."tarefa_id") AND ("t"."familia_id" = "public"."minha_familia_id"())))))) WITH CHECK (("public"."usuario_e_admin"() AND ("status" = 'rejeitada'::"public"."atribuicao_status") AND (EXISTS ( SELECT 1
   FROM "public"."tarefas" "t"
  WHERE (("t"."id" = "atribuicoes"."tarefa_id") AND ("t"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "atribuicoes_update_filho" ON "public"."atribuicoes" FOR UPDATE USING ((("filho_id" = "public"."meu_filho_id"()) AND ("status" = 'pendente'::"public"."atribuicao_status"))) WITH CHECK ((("filho_id" = "public"."meu_filho_id"()) AND ("status" = 'aguardando_validacao'::"public"."atribuicao_status") AND ("nota_rejeicao" IS NULL) AND ("validada_em" IS NULL) AND ("validada_por" IS NULL) AND (("evidencia_url" IS NOT NULL) OR (NOT (EXISTS ( SELECT 1
   FROM "public"."tarefas" "t"
  WHERE (("t"."id" = "atribuicoes"."tarefa_id") AND "t"."exige_evidencia")))))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select_admin" ON "public"."audit_log" FOR SELECT USING (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"())));



ALTER TABLE "public"."familias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "familias_insert_authenticated" ON "public"."familias" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "familias_select_own" ON "public"."familias" FOR SELECT USING (("id" = "public"."minha_familia_id"()));



ALTER TABLE "public"."filhos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "filhos_delete_admin" ON "public"."filhos" FOR DELETE USING ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



CREATE POLICY "filhos_insert_admin" ON "public"."filhos" FOR INSERT WITH CHECK ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



CREATE POLICY "filhos_select_familia" ON "public"."filhos" FOR SELECT USING (("familia_id" = "public"."minha_familia_id"()));



CREATE POLICY "filhos_update_admin" ON "public"."filhos" FOR UPDATE USING ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



ALTER TABLE "public"."movimentacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimentacoes_select_admin" ON "public"."movimentacoes" FOR SELECT USING (("public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE (("f"."id" = "movimentacoes"."filho_id") AND ("f"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "movimentacoes_select_filho" ON "public"."movimentacoes" FOR SELECT USING (("filho_id" = "public"."meu_filho_id"()));



ALTER TABLE "public"."premios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "premios_delete_admin" ON "public"."premios" FOR DELETE USING (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"())));



CREATE POLICY "premios_insert_admin" ON "public"."premios" FOR INSERT WITH CHECK (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"())));



CREATE POLICY "premios_select_admin" ON "public"."premios" FOR SELECT USING (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"())));



CREATE POLICY "premios_select_filho" ON "public"."premios" FOR SELECT USING ((("public"."meu_papel"() = 'filho'::"text") AND ("ativo" = true) AND ("familia_id" = "public"."minha_familia_id"())));



CREATE POLICY "premios_update_admin" ON "public"."premios" FOR UPDATE USING (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"()))) WITH CHECK (("public"."usuario_e_admin"() AND ("familia_id" = "public"."minha_familia_id"())));



ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_tokens_delete_self" ON "public"."push_tokens" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_tokens_insert_self" ON "public"."push_tokens" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "push_tokens_select_self" ON "public"."push_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."resgates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resgates_select_admin" ON "public"."resgates" FOR SELECT USING (("public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE (("f"."id" = "resgates"."filho_id") AND ("f"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "resgates_select_filho" ON "public"."resgates" FOR SELECT USING (("filho_id" = "public"."meu_filho_id"()));



ALTER TABLE "public"."saldos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saldos_select_admin" ON "public"."saldos" FOR SELECT USING (("public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE (("f"."id" = "saldos"."filho_id") AND ("f"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "saldos_select_filho" ON "public"."saldos" FOR SELECT USING (("filho_id" = "public"."meu_filho_id"()));



ALTER TABLE "public"."tarefas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tarefas_insert_admin" ON "public"."tarefas" FOR INSERT WITH CHECK ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



CREATE POLICY "tarefas_select_familia" ON "public"."tarefas" FOR SELECT USING (("familia_id" = "public"."minha_familia_id"()));



CREATE POLICY "tarefas_update_admin" ON "public"."tarefas" FOR UPDATE USING ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_insert_self" ON "public"."usuarios" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "usuarios_select_familia_admin" ON "public"."usuarios" FOR SELECT USING ((("familia_id" = "public"."minha_familia_id"()) AND "public"."usuario_e_admin"()));



CREATE POLICY "usuarios_select_self" ON "public"."usuarios" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "usuarios_update_self_limited" ON "public"."usuarios" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."atribuicoes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tarefas";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."aplicar_penalizacao"("p_filho_id" "uuid", "p_valor" integer, "p_descricao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_penalizacao"("p_filho_id" "uuid", "p_valor" integer, "p_descricao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_penalizacao"("p_filho_id" "uuid", "p_valor" integer, "p_descricao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."aplicar_valorizacao"("p_filho_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_valorizacao"("p_filho_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_valorizacao"("p_filho_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."avancar_data_valorizacao"("p_data_base" "date", "p_periodo" "public"."periodo_valorizacao") TO "anon";
GRANT ALL ON FUNCTION "public"."avancar_data_valorizacao"("p_data_base" "date", "p_periodo" "public"."periodo_valorizacao") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avancar_data_valorizacao"("p_data_base" "date", "p_periodo" "public"."periodo_valorizacao") TO "service_role";



GRANT ALL ON FUNCTION "public"."bucket_evidencias_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."bucket_evidencias_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bucket_evidencias_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_envio_atribuicao"("p_atribuicao_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancelar_envio_atribuicao"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_envio_atribuicao"("p_atribuicao_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."concluir_atribuicao"("p_atribuicao_id" "uuid", "p_evidencia_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."concluir_atribuicao"("p_atribuicao_id" "uuid", "p_evidencia_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."concluir_atribuicao"("p_atribuicao_id" "uuid", "p_evidencia_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."configurar_valorizacao"("p_filho_id" "uuid", "p_indice" numeric, "p_periodo" "public"."periodo_valorizacao") TO "anon";
GRANT ALL ON FUNCTION "public"."configurar_valorizacao"("p_filho_id" "uuid", "p_indice" numeric, "p_periodo" "public"."periodo_valorizacao") TO "authenticated";
GRANT ALL ON FUNCTION "public"."configurar_valorizacao"("p_filho_id" "uuid", "p_indice" numeric, "p_periodo" "public"."periodo_valorizacao") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirmar_resgate"("p_resgate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirmar_resgate"("p_resgate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_resgate"("p_resgate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_familia"("nome_familia" "text", "nome_usuario" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_familia"("nome_familia" "text", "nome_usuario" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_familia"("nome_familia" "text", "nome_usuario" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_filho_na_familia"("filho_user_id" "uuid", "filho_nome" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_filho_na_familia"("filho_user_id" "uuid", "filho_nome" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_filho_na_familia"("filho_user_id" "uuid", "filho_nome" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_timebox_inicio" "date", "p_timebox_fim" "date", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_timebox_inicio" "date", "p_timebox_fim" "date", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_tarefa_com_atribuicoes"("p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_timebox_inicio" "date", "p_timebox_fim" "date", "p_exige_evidencia" boolean, "p_filho_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cron_sincronizar_valorizacoes"() TO "anon";
GRANT ALL ON FUNCTION "public"."cron_sincronizar_valorizacoes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cron_sincronizar_valorizacoes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."desativar_filho"("p_filho_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."desativar_filho"("p_filho_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."desativar_filho"("p_filho_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."desativar_premio"("p_premio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."desativar_premio"("p_premio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."desativar_premio"("p_premio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."desativar_tarefa"("p_tarefa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."desativar_tarefa"("p_tarefa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."desativar_tarefa"("p_tarefa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."editar_filho"("p_filho_id" "uuid", "p_nome" "text", "p_avatar_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."editar_filho"("p_filho_id" "uuid", "p_nome" "text", "p_avatar_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_filho"("p_filho_id" "uuid", "p_nome" "text", "p_avatar_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."editar_premio"("p_premio_id" "uuid", "p_nome" "text", "p_descricao" "text", "p_custo_pontos" integer, "p_imagem_url" "text", "p_ativo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."editar_premio"("p_premio_id" "uuid", "p_nome" "text", "p_descricao" "text", "p_custo_pontos" integer, "p_imagem_url" "text", "p_ativo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_premio"("p_premio_id" "uuid", "p_nome" "text", "p_descricao" "text", "p_custo_pontos" integer, "p_imagem_url" "text", "p_ativo" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."editar_tarefa"("p_tarefa_id" "uuid", "p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_requer_evidencia" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."editar_tarefa"("p_tarefa_id" "uuid", "p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_requer_evidencia" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_tarefa"("p_tarefa_id" "uuid", "p_titulo" "text", "p_descricao" "text", "p_pontos" integer, "p_frequencia" "public"."tarefa_frequencia", "p_requer_evidencia" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."garantir_atribuicoes_diarias"() TO "anon";
GRANT ALL ON FUNCTION "public"."garantir_atribuicoes_diarias"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."garantir_atribuicoes_diarias"() TO "service_role";



GRANT ALL ON FUNCTION "public"."limpar_auth_user_orfao"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."limpar_auth_user_orfao"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."limpar_auth_user_orfao"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."meu_filho_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."meu_filho_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_filho_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."meu_papel"() TO "anon";
GRANT ALL ON FUNCTION "public"."meu_papel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_papel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."minha_familia_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."minha_familia_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."minha_familia_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."obter_filho_admin"("p_filho_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."obter_filho_admin"("p_filho_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_filho_admin"("p_filho_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."obter_meu_perfil"() TO "anon";
GRANT ALL ON FUNCTION "public"."obter_meu_perfil"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_meu_perfil"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_usuarios_privilege_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_usuarios_privilege_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_usuarios_privilege_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reativar_filho"("p_filho_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reativar_filho"("p_filho_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reativar_filho"("p_filho_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reativar_premio"("p_premio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reativar_premio"("p_premio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reativar_premio"("p_premio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reativar_tarefa"("p_tarefa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reativar_tarefa"("p_tarefa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reativar_tarefa"("p_tarefa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_audit"("p_acao" "text", "p_alvo_tipo" "text", "p_alvo_id" "uuid", "p_detalhes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_audit"("p_acao" "text", "p_alvo_tipo" "text", "p_alvo_id" "uuid", "p_detalhes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_audit"("p_acao" "text", "p_alvo_tipo" "text", "p_alvo_id" "uuid", "p_detalhes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rejeitar_atribuicao"("p_atribuicao_id" "uuid", "p_nota_rejeicao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rejeitar_atribuicao"("p_atribuicao_id" "uuid", "p_nota_rejeicao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rejeitar_atribuicao"("p_atribuicao_id" "uuid", "p_nota_rejeicao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_concluida_em_on_submit"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_concluida_em_on_submit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_concluida_em_on_submit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transferir_para_cofrinho"("p_filho_id" "uuid", "p_valor" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."transferir_para_cofrinho"("p_filho_id" "uuid", "p_valor" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."transferir_para_cofrinho"("p_filho_id" "uuid", "p_valor" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_device_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_device_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_device_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."usuario_autenticado_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."usuario_autenticado_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_autenticado_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."usuario_e_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."usuario_e_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_e_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_filho_da_familia"("p_filho_id" "uuid", "p_familia_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validar_filho_da_familia"("p_filho_id" "uuid", "p_familia_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_filho_da_familia"("p_filho_id" "uuid", "p_familia_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_limite_frequencia"("p_filho_id" "uuid", "p_tipo" "text", "p_janela" interval, "p_limite" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_limite_frequencia"("p_filho_id" "uuid", "p_tipo" "text", "p_janela" interval, "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_limite_frequencia"("p_filho_id" "uuid", "p_tipo" "text", "p_janela" interval, "p_limite" integer) TO "service_role";
























GRANT ALL ON TABLE "public"."atribuicoes" TO "anon";
GRANT ALL ON TABLE "public"."atribuicoes" TO "authenticated";
GRANT ALL ON TABLE "public"."atribuicoes" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."familias" TO "anon";
GRANT ALL ON TABLE "public"."familias" TO "authenticated";
GRANT ALL ON TABLE "public"."familias" TO "service_role";



GRANT ALL ON TABLE "public"."filhos" TO "anon";
GRANT ALL ON TABLE "public"."filhos" TO "authenticated";
GRANT ALL ON TABLE "public"."filhos" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes" TO "anon";
GRANT ALL ON TABLE "public"."movimentacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes" TO "service_role";



GRANT ALL ON TABLE "public"."premios" TO "anon";
GRANT ALL ON TABLE "public"."premios" TO "authenticated";
GRANT ALL ON TABLE "public"."premios" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."resgates" TO "anon";
GRANT ALL ON TABLE "public"."resgates" TO "authenticated";
GRANT ALL ON TABLE "public"."resgates" TO "service_role";



GRANT ALL ON TABLE "public"."saldos" TO "anon";
GRANT ALL ON TABLE "public"."saldos" TO "authenticated";
GRANT ALL ON TABLE "public"."saldos" TO "service_role";



GRANT ALL ON TABLE "public"."tarefas" TO "anon";
GRANT ALL ON TABLE "public"."tarefas" TO "authenticated";
GRANT ALL ON TABLE "public"."tarefas" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE POLICY "Avatar delete permitido" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND ((("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text") OR ("public"."usuario_e_admin"() AND (("storage"."foldername"("name"))[1] = 'filhos'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE ((("f"."id")::"text" = ("storage"."foldername"("objects"."name"))[2]) AND ("f"."familia_id" = "public"."minha_familia_id"()))))))));



CREATE POLICY "Avatar leitura pública" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Avatar update permitido" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND ((("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text") OR ("public"."usuario_e_admin"() AND (("storage"."foldername"("name"))[1] = 'filhos'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE ((("f"."id")::"text" = ("storage"."foldername"("objects"."name"))[2]) AND ("f"."familia_id" = "public"."minha_familia_id"()))))))));



CREATE POLICY "Avatar upload permitido" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ((("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text") OR ("public"."usuario_e_admin"() AND (("storage"."foldername"("name"))[1] = 'filhos'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."filhos" "f"
  WHERE ((("f"."id")::"text" = ("storage"."foldername"("objects"."name"))[2]) AND ("f"."familia_id" = "public"."minha_familia_id"()))))))));



CREATE POLICY "Premios delete admin" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'premios'::"text") AND "public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."premios" "p"
  WHERE ((("p"."id")::"text" = ("storage"."foldername"("objects"."name"))[1]) AND ("p"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "Premios leitura pública" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'premios'::"text"));



CREATE POLICY "Premios update admin" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'premios'::"text") AND "public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."premios" "p"
  WHERE ((("p"."id")::"text" = ("storage"."foldername"("objects"."name"))[1]) AND ("p"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "Premios upload admin" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'premios'::"text") AND "public"."usuario_e_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."premios" "p"
  WHERE ((("p"."id")::"text" = ("storage"."foldername"("objects"."name"))[1]) AND ("p"."familia_id" = "public"."minha_familia_id"()))))));



CREATE POLICY "evidencias_insert_filho" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = "public"."bucket_evidencias_id"()) AND ("public"."meu_papel"() = 'filho'::"text") AND ("split_part"("name", '/'::"text", 1) = ("public"."minha_familia_id"())::"text") AND ("split_part"("name", '/'::"text", 2) = ("public"."meu_filho_id"())::"text") AND ("split_part"("name", '/'::"text", 3) <> ''::"text")));



CREATE POLICY "evidencias_select_admin" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = "public"."bucket_evidencias_id"()) AND "public"."usuario_e_admin"() AND ("split_part"("name", '/'::"text", 1) = ("public"."minha_familia_id"())::"text")));



CREATE POLICY "evidencias_select_filho" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = "public"."bucket_evidencias_id"()) AND ("public"."meu_papel"() = 'filho'::"text") AND ("split_part"("name", '/'::"text", 1) = ("public"."minha_familia_id"())::"text") AND ("split_part"("name", '/'::"text", 2) = ("public"."meu_filho_id"())::"text")));



