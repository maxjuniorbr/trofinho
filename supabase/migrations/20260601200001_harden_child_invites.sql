-- Harden child invites after the invite-table migration.
--
-- The public validation path is the validar_convite_filho RPC. The table
-- itself must not be selectable by anon, otherwise invite metadata can be
-- enumerated through the REST API. Invites also need to point at a concrete
-- child row; linking by name is ambiguous when siblings share names.

ALTER TABLE public.convites_filho
  ADD COLUMN IF NOT EXISTS filho_id uuid REFERENCES public.filhos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_convites_filho_filho_id
  ON public.convites_filho (filho_id);

-- Best-effort backfill for legacy invites. Only fill when the family/name pair
-- is unique; ambiguous names intentionally stay NULL and are handled by the
-- Edge Function's legacy fallback.
WITH unique_children AS (
  SELECT familia_id, nome, (array_agg(id ORDER BY id::text))[1] AS filho_id
    FROM public.filhos
   GROUP BY familia_id, nome
  HAVING count(*) = 1
)
UPDATE public.convites_filho c
   SET filho_id = u.filho_id
  FROM unique_children u
 WHERE c.filho_id IS NULL
   AND c.familia_id = u.familia_id
   AND c.nome_filho = u.nome;

DROP POLICY IF EXISTS "validar_convite_filho" ON public.convites_filho;

REVOKE ALL ON TABLE public.convites_filho FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.convites_filho TO authenticated;
GRANT ALL ON TABLE public.convites_filho TO service_role;

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
  SELECT c.id,
         c.familia_id,
         c.filho_id,
         c.nome_filho,
         c.aceito_por,
         c.expira_em,
         c.criado_por
    INTO v_invite
    FROM public.convites_filho c
   WHERE c.codigo = upper(p_codigo);

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'INVALID_CODE');
  END IF;

  IF v_invite.aceito_por IS NOT NULL THEN
    RETURN json_build_object('valid', false, 'error', 'ALREADY_LINKED');
  END IF;

  IF v_invite.expira_em <= now() THEN
    RETURN json_build_object('valid', false, 'error', 'EXPIRED_CODE');
  END IF;

  SELECT f.nome INTO v_family_name
    FROM public.familias f
   WHERE f.id = v_invite.familia_id;

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

GRANT EXECUTE ON FUNCTION public.validar_convite_filho(text) TO anon, authenticated;
