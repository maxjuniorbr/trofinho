-- Revert the open SELECT policy back to authenticated-only.
-- The anon SELECT was a security risk — it exposed all invite records.
DO $$
BEGIN
  IF to_regclass('public.convites_filho') IS NOT NULL THEN
    DROP POLICY IF EXISTS "validar_convite_filho" ON public.convites_filho;
  END IF;
END $$;

-- Create a SECURITY DEFINER RPC that validates a single invite code.
-- This runs with elevated privileges (bypasses RLS) but only returns
-- the preview data for the specific code provided — no table scan.
-- Callable by anon (pre-auth) since the code itself is the access token.
CREATE OR REPLACE FUNCTION public.validar_convite_filho(p_codigo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite record;
  v_family_name text;
  v_admin_name text;
BEGIN
  -- Look up the invite by code
  SELECT c.id, c.familia_id, c.filho_id, c.nome_filho, c.aceito_por, c.expira_em, c.criado_por
    INTO v_invite
    FROM public.convites_filho c
   WHERE c.codigo = upper(p_codigo);

  -- Code not found
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'INVALID_CODE');
  END IF;

  -- Already accepted
  IF v_invite.aceito_por IS NOT NULL THEN
    RETURN json_build_object('valid', false, 'error', 'ALREADY_LINKED');
  END IF;

  -- Expired
  IF v_invite.expira_em <= now() THEN
    RETURN json_build_object('valid', false, 'error', 'EXPIRED_CODE');
  END IF;

  -- Fetch family name
  SELECT f.nome INTO v_family_name
    FROM public.familias f
   WHERE f.id = v_invite.familia_id;

  -- Fetch admin name (creator of the invite)
  SELECT u.nome INTO v_admin_name
    FROM public.usuarios u
   WHERE u.id = v_invite.criado_por;

  RETURN json_build_object(
    'valid', true,
    'id', v_invite.id,
    'familia_id', v_invite.familia_id,
    'filho_id', v_invite.filho_id,
    'nome_filho', v_invite.nome_filho,
    'familyName', coalesce(v_family_name, 'Família'),
    'adminName', coalesce(v_admin_name, 'Administrador')
  );
END;
$$;

-- Allow anon and authenticated to call this RPC
GRANT EXECUTE ON FUNCTION public.validar_convite_filho(text) TO anon, authenticated;
