-- Add stock column to premios
ALTER TABLE public.premios ADD COLUMN estoque INTEGER NOT NULL DEFAULT 99;

-- Update editar_premio to accept p_estoque
DROP FUNCTION IF EXISTS public.editar_premio(uuid, text, text, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.editar_premio(
  p_premio_id uuid,
  p_nome text,
  p_descricao text,
  p_custo_pontos integer,
  p_emoji text DEFAULT NULL,
  p_estoque integer DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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
         emoji = COALESCE(p_emoji, emoji),
         estoque = COALESCE(p_estoque, estoque),
         ativo = COALESCE(p_ativo, ativo)
   WHERE id = p_premio_id;

  RETURN v_points_message;
END;
$$;

-- Update solicitar_resgate to check and decrement stock
CREATE OR REPLACE FUNCTION public.solicitar_resgate(p_premio_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id        UUID;
  v_familia_id      UUID;
  v_custo           INTEGER;
  v_saldo_livre     INTEGER;
  v_nome_premio     TEXT;
  v_estoque         INTEGER;
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

  SELECT nome, custo_pontos, estoque
    INTO v_nome_premio, v_custo, v_estoque
    FROM public.premios
   WHERE id = p_premio_id
     AND familia_id = v_familia_id
     AND ativo = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado ou não disponível';
  END IF;

  IF v_estoque <= 0 THEN
    RAISE EXCEPTION 'Este prêmio está esgotado';
  END IF;

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

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

  UPDATE public.premios
     SET estoque = estoque - 1
   WHERE id = p_premio_id;

  INSERT INTO public.resgates (filho_id, premio_id, status, pontos_debitados)
  VALUES (v_filho_id, p_premio_id, 'pendente', v_custo)
  RETURNING id INTO v_resgate_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'resgate', v_custo, v_nome_premio, v_resgate_id);

  RETURN v_resgate_id;
END;
$$;

-- Update cancelar_resgate to restore stock
CREATE OR REPLACE FUNCTION public.cancelar_resgate(p_resgate_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id  UUID;
  v_pontos    INTEGER;
  v_nome      TEXT;
  v_premio_id UUID;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cancelar resgates';
  END IF;

  SELECT r.filho_id, r.pontos_debitados, p.nome, r.premio_id
    INTO v_filho_id, v_pontos, v_nome, v_premio_id
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

  UPDATE public.premios
     SET estoque = estoque + 1
   WHERE id = v_premio_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'estorno_resgate', v_pontos, v_nome, p_resgate_id);

  PERFORM public.registrar_audit(
    'cancelar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos_estornados', v_pontos)
  );
END;
$$;
