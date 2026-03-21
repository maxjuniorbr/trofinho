-- ============================================================
-- Trofinho — Marco 7: Push tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_self"
  ON public.push_tokens
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert_self"
  ON public.push_tokens
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token de push inválido';
  END IF;

  v_user_id := public.usuario_autenticado_id();

  INSERT INTO public.push_tokens (user_id, token)
  VALUES (v_user_id, p_token)
  ON CONFLICT (token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    created_at = now();
END;
$$;
