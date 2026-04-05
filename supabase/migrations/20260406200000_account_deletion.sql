-- Q12.4: LGPD account deletion support
-- 1. Change tarefas.criado_por FK from RESTRICT to SET NULL so family deletion is not blocked.
-- 2. Create RPC excluir_minha_conta for admin users to delete their entire family and auth entries.

-- Step 1: Fix foreign key constraint
ALTER TABLE public.tarefas DROP CONSTRAINT tarefas_criado_por_fkey;
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Step 2: Account deletion RPC (admin only)
CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_familia_id uuid;
  v_auth_ids uuid[];
BEGIN
  -- Only admin users can delete the family account
  SELECT familia_id INTO STRICT v_familia_id
  FROM public.usuarios
  WHERE id = v_user_id AND papel = 'admin';

  -- Collect all auth user IDs belonging to this family
  SELECT array_agg(id) INTO v_auth_ids
  FROM public.usuarios
  WHERE familia_id = v_familia_id;

  -- Delete the family row — cascades to usuarios, filhos, tarefas, premios,
  -- atribuicoes, resgates, saldos, transacoes, push_tokens, etc.
  DELETE FROM public.familias WHERE id = v_familia_id;

  -- Remove auth.users entries (public rows already gone via cascade)
  DELETE FROM auth.users WHERE id = ANY(v_auth_ids);

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'NOT_ADMIN';
END;
$$;
