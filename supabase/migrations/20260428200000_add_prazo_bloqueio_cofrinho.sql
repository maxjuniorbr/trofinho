-- Add prazo_bloqueio_dias to saldos and unified configurar_cofrinho RPC.
--
-- Background:
--   The admin's piggy bank config sheet edits three rules atomically:
--     - indice_valorizacao   (% monthly appreciation)
--     - taxa_resgate_cofrinho (% penalty on early withdrawal)
--     - prazo_bloqueio_dias  (cooldown in days after a deposit before it can
--                             be withdrawn without triggering the penalty)
--
--   The first two already exist; this migration adds the third and ships a
--   single transactional RPC so the sheet can persist all three in one call.
--
-- Percentage / integer policy:
--   All values handled here are integers. The DB constraints + the RPC body
--   round / clamp incoming values so no fractional configuration ever lands
--   on the table. Downstream calculations (penalty, projection) already use
--   FLOOR with a minimum of 1 pt to avoid fractional / "broken" prizes.

-- 1. Add the new column with a sensible default.
ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS prazo_bloqueio_dias INTEGER NOT NULL DEFAULT 7;

ALTER TABLE public.saldos
  DROP CONSTRAINT IF EXISTS saldos_prazo_bloqueio_range;

ALTER TABLE public.saldos
  ADD CONSTRAINT saldos_prazo_bloqueio_range
  CHECK (prazo_bloqueio_dias >= 0 AND prazo_bloqueio_dias <= 365);

COMMENT ON COLUMN public.saldos.prazo_bloqueio_dias IS
  'Dias após um depósito no cofrinho em que o saque não cobra a taxa de resgate. Apenas exibido na UI por enquanto; a aplicação no resgate antecipado fica para versão futura.';

-- 2. Unified RPC: updates the three piggy bank rules in a single transaction.
CREATE OR REPLACE FUNCTION public.configurar_cofrinho(
  p_filho_id UUID,
  p_indice NUMERIC,
  p_taxa NUMERIC,
  p_prazo INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_indice INTEGER;
  v_taxa INTEGER;
  v_prazo INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem configurar o cofrinho';
  END IF;

  v_familia_id := public.minha_familia_id();
  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  -- Clamp + floor to integers (config UI is integer-only; we enforce it here too).
  v_indice := GREATEST(0, LEAST(100, FLOOR(COALESCE(p_indice, 0))::INTEGER));
  v_taxa   := GREATEST(0, LEAST(50,  FLOOR(COALESCE(p_taxa, 0))::INTEGER));
  v_prazo  := GREATEST(0, LEAST(365, FLOOR(COALESCE(p_prazo, 0))::INTEGER));

  -- Sync any pending appreciations with the OLD rate before changing it.
  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

  INSERT INTO public.saldos (
    filho_id,
    indice_valorizacao,
    periodo_valorizacao,
    proxima_valorizacao_em,
    taxa_resgate_cofrinho,
    prazo_bloqueio_dias
  )
  VALUES (
    p_filho_id,
    v_indice,
    'mensal',
    CASE
      WHEN v_indice > 0 THEN public.avancar_data_valorizacao(CURRENT_DATE, 'mensal')
      ELSE NULL
    END,
    v_taxa,
    v_prazo
  )
  ON CONFLICT (filho_id) DO UPDATE
    SET indice_valorizacao = EXCLUDED.indice_valorizacao,
        periodo_valorizacao = EXCLUDED.periodo_valorizacao,
        proxima_valorizacao_em = EXCLUDED.proxima_valorizacao_em,
        taxa_resgate_cofrinho = EXCLUDED.taxa_resgate_cofrinho,
        prazo_bloqueio_dias = EXCLUDED.prazo_bloqueio_dias,
        updated_at = now();

  PERFORM public.registrar_audit(
    'configurar_cofrinho', 'saldo', p_filho_id,
    jsonb_build_object('indice', v_indice, 'taxa', v_taxa, 'prazo', v_prazo)
  );
END;
$$;

GRANT ALL ON FUNCTION public.configurar_cofrinho(UUID, NUMERIC, NUMERIC, INTEGER)
  TO anon, authenticated, service_role;
