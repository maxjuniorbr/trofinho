-- Lock appreciation period to 'mensal' and simplify configurar_valorizacao

-- 1. Migrate all existing rows to mensal
UPDATE public.saldos
   SET periodo_valorizacao = 'mensal',
       proxima_valorizacao_em = CASE
         WHEN indice_valorizacao > 0 THEN
           public.avancar_data_valorizacao(
             COALESCE(data_ultima_valorizacao, CURRENT_DATE),
             'mensal'
           )
         ELSE NULL
       END,
       updated_at = now()
 WHERE periodo_valorizacao != 'mensal';

-- 2. Drop the old 3-parameter function and create a 2-parameter version
DROP FUNCTION IF EXISTS public.configurar_valorizacao(uuid, numeric, public.periodo_valorizacao);

CREATE OR REPLACE FUNCTION public.configurar_valorizacao(
  p_filho_id uuid,
  p_indice numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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
    'mensal',
    CASE
      WHEN p_indice > 0 THEN public.avancar_data_valorizacao(CURRENT_DATE, 'mensal')
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
