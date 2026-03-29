-- Return the actual deducted amount from aplicar_penalizacao so the client
-- can inform the admin when the penalty was partial (saldo < requested value).
-- Must DROP first because CREATE OR REPLACE cannot change return type.

DROP FUNCTION IF EXISTS public.aplicar_penalizacao(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.aplicar_penalizacao(
  p_filho_id  UUID,
  p_valor     INTEGER,
  p_descricao TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT saldo_livre INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id;

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

  RETURN v_deducted;
END;
$$;
