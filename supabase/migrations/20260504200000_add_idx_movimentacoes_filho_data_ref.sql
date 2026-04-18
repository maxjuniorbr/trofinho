-- Composite index for listar_movimentacoes_por_periodo RPC
-- which filters by filho_id and orders by data_referencia DESC.
CREATE INDEX IF NOT EXISTS idx_movimentacoes_filho_data_ref
  ON public.movimentacoes (filho_id, data_referencia DESC);
