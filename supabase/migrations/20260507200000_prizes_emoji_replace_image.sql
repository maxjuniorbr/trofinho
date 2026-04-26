-- Replace imagem_url with emoji on premios table
ALTER TABLE public.premios ADD COLUMN emoji TEXT NOT NULL DEFAULT '🎁';
ALTER TABLE public.premios DROP COLUMN imagem_url;

-- Drop the old function signature (has p_imagem_url parameter)
DROP FUNCTION IF EXISTS public.editar_premio(uuid, text, text, integer, text, boolean);

-- Recreate editar_premio without p_imagem_url, adding p_emoji
CREATE OR REPLACE FUNCTION public.editar_premio(
  p_premio_id uuid,
  p_nome text,
  p_descricao text,
  p_custo_pontos integer,
  p_emoji text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_custo_atual INTEGER;
  v_points_message TEXT := NULL;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar prêmios';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  IF p_custo_pontos IS NULL OR p_custo_pontos <= 0 THEN
    RAISE EXCEPTION 'O custo em pontos deve ser maior que zero';
  END IF;

  SELECT p.custo_pontos
    INTO v_custo_atual
    FROM public.premios p
   WHERE p.id = p_premio_id
     AND p.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado';
  END IF;

  IF p_custo_pontos <> v_custo_atual
     AND EXISTS (
       SELECT 1
         FROM public.resgates r
        WHERE r.premio_id = p_premio_id
          AND r.status IN ('pendente', 'confirmado')
     ) THEN
    v_points_message := 'Não é possível alterar os pontos pois há resgates em aberto.';
  END IF;

  UPDATE public.premios
     SET nome = trim(p_nome),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         custo_pontos = CASE WHEN v_points_message IS NULL THEN p_custo_pontos ELSE custo_pontos END,
         emoji = COALESCE(p_emoji, emoji),
         ativo = COALESCE(p_ativo, ativo)
   WHERE id = p_premio_id;

  RETURN v_points_message;
END;
$$;
