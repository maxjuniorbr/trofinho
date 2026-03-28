-- ============================================================
-- Trofinho — RPCs for prize activation / deactivation
-- ============================================================

-- ─── 1. RPC: desativar_premio ────────────────────────────────

CREATE OR REPLACE FUNCTION public.desativar_premio(p_premio_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
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
$;

-- ─── 2. RPC: reativar_premio ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.reativar_premio(p_premio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
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
$;
