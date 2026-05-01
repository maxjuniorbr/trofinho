-- Child invite table: convites_filho
-- Stores invite records for child onboarding via short alphanumeric codes.
-- Children accept invites and link their Google OAuth account to the family.
-- Requirements: 5.1, 5.4, 5.5

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.convites_filho (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  familia_id  uuid        NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  codigo      varchar(6)  NOT NULL,
  criado_por  uuid        NOT NULL REFERENCES auth.users(id),
  nome_filho  varchar(60) NOT NULL,
  aceito_por  uuid        REFERENCES auth.users(id),
  aceito_em   timestamptz,
  expira_em   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- 2. Unique index for fast lookup by invite code
CREATE UNIQUE INDEX idx_convites_filho_codigo
  ON public.convites_filho (codigo);

-- 3. RLS
ALTER TABLE public.convites_filho ENABLE ROW LEVEL SECURITY;

-- Admin of the family can perform all operations on child invites
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

-- Any user (including unauthenticated/anon) can read invites by code.
-- This is needed because the child validates the invite code BEFORE
-- authenticating with Google. The code itself acts as the access token.
CREATE POLICY "validar_convite_filho"
  ON public.convites_filho
  FOR SELECT
  USING (true);

-- 4. Grants (same pattern as other tables)
GRANT ALL ON TABLE public.convites_filho TO anon, authenticated, service_role;
