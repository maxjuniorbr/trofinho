-- ============================================================
-- Trofinho — Push tokens: device-scoped deduplication
--
-- Problem: a device that reinstalls the app (or whose token
-- rotates) accumulates multiple rows in push_tokens for the
-- same (user, device), causing duplicate notifications.
--
-- Fix: add a device_id column and enforce UNIQUE(user_id,
-- device_id) so each device can only hold one active token
-- per user at a time.
-- ============================================================

-- 1. Add device_id column (empty default preserves existing rows)
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT '';

-- 2. Remove stale duplicates among existing rows that have no
--    device_id (keep the most-recently-created token per user)
DELETE FROM public.push_tokens
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, device_id
             ORDER BY created_at DESC
           ) AS rn
    FROM public.push_tokens
    WHERE device_id = ''
  ) ranked
  WHERE rn > 1
);

-- 3. Enforce one token per (user, device)
ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_user_device_unique
  UNIQUE (user_id, device_id);

-- 4. Replace upsert function to accept device_id.
--    Strategy:
--    a) Delete any existing row for this (user_id, device_id)
--       pair (handles token rotation on the same device).
--    b) Delete any row where another user owns this exact token
--       (handles device hand-off between accounts).
--    c) Insert the fresh (user_id, device_id, token) row.
CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_token     TEXT,
  p_device_id TEXT DEFAULT ''
)
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

  -- Remove the previous token for this device (same user)
  DELETE FROM public.push_tokens
  WHERE user_id = v_user_id
    AND device_id = p_device_id;

  -- Remove any stale row that holds this token under a different user
  DELETE FROM public.push_tokens
  WHERE token = p_token
    AND user_id <> v_user_id;

  INSERT INTO public.push_tokens (user_id, token, device_id)
  VALUES (v_user_id, p_token, p_device_id);
END;
$$;
