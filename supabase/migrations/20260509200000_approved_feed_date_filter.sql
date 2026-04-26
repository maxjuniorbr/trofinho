-- Add optional date filter to listar_atribuicoes_aprovadas
-- Default: last 7 days. Pass NULL to get all.
DROP FUNCTION IF EXISTS public.listar_atribuicoes_aprovadas(integer, integer);

CREATE OR REPLACE FUNCTION public.listar_atribuicoes_aprovadas(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_desde timestamptz DEFAULT (now() - interval '7 days')
) RETURNS TABLE (
  atribuicao_id uuid,
  tarefa_id uuid,
  tarefa_titulo text,
  tarefa_arquivada boolean,
  filho_id uuid,
  filho_nome text,
  pontos integer,
  validada_em timestamptz,
  competencia date,
  evidencia_url text
)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem listar atribuições aprovadas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 100 THEN
    p_limit := 20;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  RETURN QUERY
    SELECT a.id,
           t.id,
           t.titulo,
           (t.arquivada_em IS NOT NULL),
           f.id,
           f.nome,
           a.pontos_snapshot,
           a.validada_em,
           a.competencia,
           a.evidencia_url
      FROM public.atribuicoes a
      JOIN public.tarefas t ON t.id = a.tarefa_id
      JOIN public.filhos f ON f.id = a.filho_id
     WHERE t.familia_id = v_familia_id
       AND a.status = 'aprovada'
       AND (p_desde IS NULL OR a.validada_em >= p_desde)
     ORDER BY a.validada_em DESC NULLS LAST, a.created_at DESC
     LIMIT p_limit OFFSET p_offset;
END;
$$;

ALTER FUNCTION public.listar_atribuicoes_aprovadas(integer, integer, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.listar_atribuicoes_aprovadas(integer, integer, timestamptz) TO authenticated;
