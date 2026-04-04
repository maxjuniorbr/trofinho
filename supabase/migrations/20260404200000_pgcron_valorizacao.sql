-- ============================================================
-- Trofinho — S27: Server-side cron for automatic appreciation
--
-- Moves sincronizar_valorizacoes_automaticas from client-triggered
-- (every pull-to-refresh) to pg_cron (every 15 minutes).
-- Client keeps the sync on app boot and config mutations only.
-- ============================================================

-- ─── Cron-safe version (no auth context) ────────────────────

CREATE OR REPLACE FUNCTION public.cron_sincronizar_valorizacoes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ─── Enable pg_cron extension ───���───────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ─── Schedule cron job ──────────────────────────────────────

SELECT cron.schedule(
  'sincronizar-valorizacoes',
  '*/15 * * * *',
  $$SELECT public.cron_sincronizar_valorizacoes()$$
);
