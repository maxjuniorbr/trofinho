-- Allow unauthenticated (anon) users to read invite codes.
-- The child validates the invite code BEFORE authenticating with Google,
-- so auth.uid() is NULL at that point. The code itself acts as the access token.

DROP POLICY IF EXISTS "validar_convite_filho" ON public.convites_filho;

CREATE POLICY "validar_convite_filho"
  ON public.convites_filho
  FOR SELECT
  USING (true);
