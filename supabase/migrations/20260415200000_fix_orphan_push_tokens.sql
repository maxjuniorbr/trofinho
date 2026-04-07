-- Fix orphan push tokens from app reinstalls.
-- When device_id changes (SecureStore wiped), old rows remain.
-- Add cleanup of stale tokens (> 30 days) for the same user during upsert.

CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token text, p_device_id text DEFAULT ''::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token de push inválido';
  END IF;

  v_user_id := public.usuario_autenticado_id();

  -- Remove the previous token for this device (same user)
  DELETE FROM public.push_tokens
   WHERE user_id = v_user_id
     AND device_id = p_device_id;

  -- Remove any stale row that holds this token under a different user
  DELETE FROM public.push_tokens
   WHERE token = p_token
     AND user_id <> v_user_id;

  -- Remove orphan tokens for this user older than 30 days (reinstall leftovers)
  DELETE FROM public.push_tokens
   WHERE user_id = v_user_id
     AND created_at < now() - INTERVAL '30 days';

  INSERT INTO public.push_tokens (user_id, token, device_id)
  VALUES (v_user_id, p_token, p_device_id);
END;
$$;
