-- Fix type mismatch in verificar_limite_frequencia after movimentacoes.tipo was
-- converted from TEXT to movimentacao_tipo ENUM in 20260408200000_text_check_to_enum.sql.
-- The comparison `tipo = p_tipo` (enum = text) fails with:
--   "operator does not exist: movimentacao_tipo = text" (SQLSTATE 42883)
-- Fix: cast the column to text for the comparison so the existing text parameter is preserved.

CREATE OR REPLACE FUNCTION "public"."verificar_limite_frequencia"(
  "p_filho_id" "uuid",
  "p_tipo" "text",
  "p_janela" interval,
  "p_limite" integer
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_contagem INTEGER;
BEGIN
  SELECT count(*)::int
    INTO v_contagem
    FROM public.movimentacoes
   WHERE filho_id = p_filho_id
     AND tipo::text = p_tipo
     AND created_at > now() - p_janela;

  IF v_contagem >= p_limite THEN
    RAISE EXCEPTION 'Limite de operações atingido. Tente novamente em alguns minutos.';
  END IF;
END;
$$;
