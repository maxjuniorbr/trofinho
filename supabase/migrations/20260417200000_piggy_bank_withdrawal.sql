-- Piggy bank withdrawal feature (resgate do cofrinho)
-- Children request withdrawal → admin approves/rejects.
-- Configurable penalty rate (0–50%) deducted on approval.

-- 1. Add 'resgate_cofrinho' to movimentacao_tipo enum
ALTER TYPE public.movimentacao_tipo ADD VALUE IF NOT EXISTS 'resgate_cofrinho';

-- 2. Add penalty rate column to saldos (admin-configurable per child, default 10%)
ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS taxa_resgate_cofrinho numeric(5,2) NOT NULL DEFAULT 10;

ALTER TABLE public.saldos
  ADD CONSTRAINT saldos_taxa_resgate_range
    CHECK (taxa_resgate_cofrinho >= 0 AND taxa_resgate_cofrinho <= 50);

-- 3. Create resgates_cofrinho table
CREATE TABLE IF NOT EXISTS public.resgates_cofrinho (
  id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  filho_id        uuid NOT NULL REFERENCES public.filhos(id) ON DELETE CASCADE,
  valor_solicitado integer NOT NULL,
  taxa_aplicada   numeric(5,2) NOT NULL,
  valor_liquido   integer NOT NULL,
  status          public.resgate_status NOT NULL DEFAULT 'pendente'::public.resgate_status,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resgates_cofrinho_valor_positivo CHECK (valor_solicitado > 0),
  CONSTRAINT resgates_cofrinho_liquido_non_negative CHECK (valor_liquido >= 0)
);

-- Index for common queries (pending by child, family lookups)
CREATE INDEX idx_resgates_cofrinho_filho_status
  ON public.resgates_cofrinho (filho_id, status);

-- RLS
ALTER TABLE public.resgates_cofrinho ENABLE ROW LEVEL SECURITY;

CREATE POLICY resgates_cofrinho_select_admin
  ON public.resgates_cofrinho FOR SELECT
  USING (
    public.usuario_e_admin()
    AND EXISTS (
      SELECT 1 FROM public.filhos f
       WHERE f.id = resgates_cofrinho.filho_id
         AND f.familia_id = public.minha_familia_id()
    )
  );

CREATE POLICY resgates_cofrinho_select_filho
  ON public.resgates_cofrinho FOR SELECT
  USING (filho_id = public.meu_filho_id());

-- 4. RPC: solicitar_resgate_cofrinho
--    Child requests withdrawal. Does NOT debit yet (debit happens on confirmation).
--    Calculates and stores penalty rate + net amount at request time.
CREATE OR REPLACE FUNCTION public.solicitar_resgate_cofrinho(p_valor integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id   uuid;
  v_cofrinho   integer;
  v_taxa       numeric(5,2);
  v_liquido    integer;
  v_resgate_id uuid;
BEGIN
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates do cofrinho';
  END IF;

  v_filho_id := public.meu_filho_id();

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  -- Sync appreciations before checking balance
  PERFORM public.sincronizar_valorizacoes_automaticas(v_filho_id);

  -- Lock saldos row and read balance + rate
  SELECT cofrinho, taxa_resgate_cofrinho
    INTO v_cofrinho, v_taxa
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

  -- Rate limit after lock
  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate_cofrinho', INTERVAL '10 minutes', 5);

  IF v_cofrinho IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_cofrinho < p_valor THEN
    RAISE EXCEPTION 'Saldo do cofrinho insuficiente';
  END IF;

  -- Check no other pending withdrawal exists for this child
  IF EXISTS (
    SELECT 1 FROM public.resgates_cofrinho
     WHERE filho_id = v_filho_id AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Já existe um resgate do cofrinho pendente';
  END IF;

  -- Calculate net amount (floor to avoid fractional points)
  v_liquido := p_valor - FLOOR(p_valor * v_taxa / 100)::integer;

  INSERT INTO public.resgates_cofrinho (filho_id, valor_solicitado, taxa_aplicada, valor_liquido, status)
  VALUES (v_filho_id, p_valor, v_taxa, v_liquido, 'pendente')
  RETURNING id INTO v_resgate_id;

  RETURN v_resgate_id;
END;
$$;

-- 5. RPC: confirmar_resgate_cofrinho
--    Admin approves. Debits cofrinho, credits saldo_livre with net amount, records movimentacao.
CREATE OR REPLACE FUNCTION public.confirmar_resgate_cofrinho(p_resgate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id   uuid;
  v_solicitado integer;
  v_liquido    integer;
  v_taxa       numeric(5,2);
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates do cofrinho';
  END IF;

  SELECT rc.filho_id, rc.valor_solicitado, rc.valor_liquido, rc.taxa_aplicada
    INTO v_filho_id, v_solicitado, v_liquido, v_taxa
    FROM public.resgates_cofrinho rc
    JOIN public.filhos f ON f.id = rc.filho_id
   WHERE rc.id = p_resgate_id
     AND rc.status = 'pendente'
     AND f.familia_id = public.minha_familia_id()
   FOR UPDATE OF rc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate do cofrinho não encontrado ou não está pendente';
  END IF;

  -- Sync appreciations before balance mutation
  PERFORM public.sincronizar_valorizacoes_automaticas(v_filho_id);

  -- Debit cofrinho, credit saldo_livre with net amount
  UPDATE public.saldos
     SET cofrinho   = cofrinho - v_solicitado,
         saldo_livre = saldo_livre + v_liquido,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  -- Record the transaction
  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (
    v_filho_id,
    'resgate_cofrinho',
    v_solicitado,
    'Resgate do cofrinho (taxa ' || v_taxa || '%): recebeu ' || v_liquido || ' pts',
    p_resgate_id
  );

  -- Update withdrawal status
  UPDATE public.resgates_cofrinho
     SET status     = 'confirmado',
         updated_at = now()
   WHERE id = p_resgate_id;

  PERFORM public.registrar_audit(
    'confirmar_resgate_cofrinho', 'resgate_cofrinho', p_resgate_id,
    jsonb_build_object(
      'filho_id', v_filho_id,
      'valor_solicitado', v_solicitado,
      'taxa_aplicada', v_taxa,
      'valor_liquido', v_liquido
    )
  );
END;
$$;

-- 6. RPC: cancelar_resgate_cofrinho
--    Admin or child cancels. No balance changes (never debited on request).
CREATE OR REPLACE FUNCTION public.cancelar_resgate_cofrinho(p_resgate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id uuid;
  v_is_admin boolean;
  v_is_own   boolean;
BEGIN
  v_is_admin := public.usuario_e_admin();

  SELECT rc.filho_id
    INTO v_filho_id
    FROM public.resgates_cofrinho rc
    JOIN public.filhos f ON f.id = rc.filho_id
   WHERE rc.id = p_resgate_id
     AND rc.status = 'pendente'
     AND f.familia_id = public.minha_familia_id()
   FOR UPDATE OF rc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate do cofrinho não encontrado ou não está pendente';
  END IF;

  -- Allow admin or own child to cancel
  v_is_own := (NOT v_is_admin AND public.meu_filho_id() = v_filho_id);

  IF NOT v_is_admin AND NOT v_is_own THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este resgate';
  END IF;

  UPDATE public.resgates_cofrinho
     SET status     = 'cancelado',
         updated_at = now()
   WHERE id = p_resgate_id;

  PERFORM public.registrar_audit(
    'cancelar_resgate_cofrinho', 'resgate_cofrinho', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'cancelado_por', auth.uid())
  );
END;
$$;

-- 7. RPC: configurar_taxa_resgate_cofrinho
--    Admin sets the penalty rate (0–50%) for a specific child.
CREATE OR REPLACE FUNCTION public.configurar_taxa_resgate_cofrinho(p_filho_id uuid, p_taxa numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem configurar a taxa de resgate';
  END IF;

  IF p_taxa < 0 OR p_taxa > 50 THEN
    RAISE EXCEPTION 'Taxa deve estar entre 0 e 50';
  END IF;

  UPDATE public.saldos
     SET taxa_resgate_cofrinho = p_taxa,
         updated_at = now()
   WHERE filho_id = p_filho_id
     AND EXISTS (
       SELECT 1 FROM public.filhos f
        WHERE f.id = p_filho_id
          AND f.familia_id = public.minha_familia_id()
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  PERFORM public.registrar_audit(
    'configurar_taxa_resgate_cofrinho', 'saldo', p_filho_id,
    jsonb_build_object('taxa', p_taxa)
  );
END;
$$;

-- 8. Grants (same pattern as existing RPCs)
GRANT ALL ON TABLE public.resgates_cofrinho TO anon, authenticated, service_role;

GRANT ALL ON FUNCTION public.solicitar_resgate_cofrinho(integer) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.confirmar_resgate_cofrinho(uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.cancelar_resgate_cofrinho(uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.configurar_taxa_resgate_cofrinho(uuid, numeric) TO anon, authenticated, service_role;
