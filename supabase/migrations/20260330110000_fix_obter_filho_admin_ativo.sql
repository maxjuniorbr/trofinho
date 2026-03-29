-- ============================================================
-- Fix: add `ativo` to obter_filho_admin return type
-- The soft-delete migration added `ativo` to filhos but did not
-- update this RPC, causing the child detail screen to show
-- ativo=undefined (treated as inactive).
-- ============================================================

DROP FUNCTION IF EXISTS public.obter_filho_admin(UUID);

CREATE OR REPLACE FUNCTION public.obter_filho_admin(p_filho_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  email TEXT,
  usuario_id UUID,
  avatar_url TEXT,
  ativo BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem visualizar filhos';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.nome,
    au.email::TEXT,
    f.usuario_id,
    f.avatar_url,
    f.ativo
  FROM public.filhos f
  LEFT JOIN auth.users au ON au.id = f.usuario_id
  WHERE f.id = p_filho_id
    AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;
END;
$$;
