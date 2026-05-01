-- Child invite table: convites_filho
-- Stores invite records for child onboarding via short alphanumeric codes.
-- Children accept invites and link their Google OAuth account to the family.
-- Requirements: 5.1, 5.4, 5.5

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.convites_filho (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  familia_id  uuid        NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  filho_id    uuid        REFERENCES public.filhos(id) ON DELETE CASCADE,
  codigo      varchar(6)  NOT NULL,
  criado_por  uuid        NOT NULL REFERENCES auth.users(id),
  nome_filho  varchar(60) NOT NULL,
  aceito_por  uuid        REFERENCES auth.users(id),
  aceito_em   timestamptz,
  expira_em   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- 2. Unique index for fast lookup by invite code
CREATE UNIQUE INDEX IF NOT EXISTS idx_convites_filho_codigo
  ON public.convites_filho (codigo);

CREATE INDEX IF NOT EXISTS idx_convites_filho_filho_id
  ON public.convites_filho (filho_id);

-- 3. RLS
ALTER TABLE public.convites_filho ENABLE ROW LEVEL SECURITY;

-- Admin of the family can perform all operations on child invites
DROP POLICY IF EXISTS "admin_familia_convites_filho" ON public.convites_filho;

CREATE POLICY "admin_familia_convites_filho"
  ON public.convites_filho
  FOR ALL
  USING (
    familia_id IN (
      SELECT u.familia_id FROM public.usuarios u
       WHERE u.id = auth.uid()
         AND u.papel = 'admin'
    )
  );

-- Public validation happens through the SECURITY DEFINER
-- public.validar_convite_filho(text) RPC. Do not expose table SELECT to anon:
-- it lets clients enumerate invite metadata through the REST API.
DROP POLICY IF EXISTS "validar_convite_filho" ON public.convites_filho;

-- 4. Grants
REVOKE ALL ON TABLE public.convites_filho FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.convites_filho TO authenticated;
GRANT ALL ON TABLE public.convites_filho TO service_role;
