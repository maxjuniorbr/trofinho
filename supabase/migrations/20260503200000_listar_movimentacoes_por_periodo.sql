-- RPC to list transactions filtered by effective activity date.
-- Uses COALESCE(data_referencia, created_at::date) so legacy rows (no data_referencia) keep working.
-- Ordering matches: activity date desc, then created_at desc as tiebreaker.

CREATE OR REPLACE FUNCTION public.listar_movimentacoes_por_periodo(
  p_filho_id uuid,
  p_from date,
  p_to date
)
RETURNS SETOF public.movimentacoes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM public.movimentacoes
  WHERE filho_id = p_filho_id
    AND COALESCE(data_referencia, (created_at AT TIME ZONE 'UTC')::date) >= p_from
    AND COALESCE(data_referencia, (created_at AT TIME ZONE 'UTC')::date) < p_to
  ORDER BY COALESCE(data_referencia, (created_at AT TIME ZONE 'UTC')::date) DESC,
           created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_movimentacoes_por_periodo(uuid, date, date) TO authenticated;
